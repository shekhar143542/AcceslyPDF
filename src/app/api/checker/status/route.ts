/**
 * ===========================================
 * CHECK PREP ANALYSIS STATUS
 * ===========================================
 * 
 * GET /api/checker/status?pdfId={pdfId}
 * 
 * This endpoint checks the status of a PREP Checker analysis
 * and returns the results when completed.
 * 
 * Query Parameters:
 * - pdfId: UUID of the PDF document
 * 
 * Response (in-progress):
 * {
 *   ok: true,
 *   status: "in-progress",
 *   issues: []
 * }
 * 
 * Response (completed):
 * {
 *   ok: true,
 *   status: "completed",
 *   reportUrl: string,
 *   issues: Issue[]
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { pdfs } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

const PREP_BASE_URL = 'https://api-pdfservice.continualengine.com';
const PREP_API_ID = process.env.PREP_API_ID!;
const PREP_APP_KEY = process.env.PREP_APP_KEY!;

interface NormalizedIssue {
  id: number;
  page: number | null;
  type: string;
  severity: string;
  description: string;
  suggestion: string | null;
  wcagReference: string | null;
}

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 [STATUS] Status check request received');

    // ========================================
    // STEP 1: AUTHENTICATE USER
    // ========================================
    const { userId } = await auth();

    if (!userId) {
      console.log('❌ [STATUS] Unauthorized access attempt');
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('✅ [STATUS] User authenticated:', userId);

    // ========================================
    // STEP 2: EXTRACT PDF ID FROM QUERY
    // ========================================
    const { searchParams } = new URL(request.url);
    const pdfId = searchParams.get('pdfId');

    if (!pdfId) {
      console.log('❌ [STATUS] Missing pdfId parameter');
      return NextResponse.json(
        { ok: false, error: 'pdfId is required' },
        { status: 400 }
      );
    }

    console.log('📄 [STATUS] PDF ID:', pdfId);

    // ========================================
    // STEP 3: FETCH PDF FROM DATABASE
    // ========================================
    const [pdf] = await db
      .select()
      .from(pdfs)
      .where(and(eq(pdfs.id, pdfId), eq(pdfs.userId, userId)))
      .limit(1);

    if (!pdf) {
      console.log('❌ [STATUS] PDF not found or unauthorized');
      return NextResponse.json(
        { ok: false, error: 'PDF not found' },
        { status: 404 }
      );
    }

    console.log('✅ [STATUS] PDF found:', pdf.fileName);

    // ========================================
    // STEP 4: CHECK IF ANALYSIS STARTED
    // ========================================
    if (!pdf.analysisStatus || !pdf.prepSourceId) {
      console.log('⚠️ [STATUS] No analysis started yet');
      return NextResponse.json(
        {
          ok: false,
          error: 'No analysis started for this PDF',
        },
        { status: 400 }
      );
    }

    console.log('📊 [STATUS] Current status:', pdf.analysisStatus);
    console.log('🔑 [STATUS] Source ID:', pdf.prepSourceId);

    // If already completed, return cached results
    if (pdf.analysisStatus === 'completed' && pdf.rawReport) {
      console.log('✅ [STATUS] Returning cached results');
      return NextResponse.json(
        {
          ok: true,
          status: 'completed',
          reportUrl: pdf.reportUrl,
          issues: pdf.rawReport as NormalizedIssue[],
        },
        { status: 200 }
      );
    }

    // ========================================
    // STEP 5: CALL PREP CHECK STATUS API (CORRECT FORMAT)
    // ========================================
    console.log('📡 [STATUS] Calling PREP Check Status API...');
    console.log('� [STATUS] Source ID:', pdf.prepSourceId);

    // Create form data with action and source_id
    const formData = new FormData();
    formData.append('action', 'doc-checker');
    formData.append('source_id', pdf.prepSourceId);

    const prepResponse = await fetch(
      `${PREP_BASE_URL}/pdf-content/pdf/check-status/`,
      {
        method: 'POST',
        headers: {
          'api-id': PREP_API_ID,
          'app-key': PREP_APP_KEY,
          // Don't set Content-Type, let FormData set it with boundary
        },
        body: formData,
      }
    );

    console.log('📊 [STATUS] PREP API response status:', prepResponse.status);

    if (!prepResponse.ok) {
      const errorText = await prepResponse.text();
      console.error('❌ [STATUS] PREP API error:', errorText);
      return NextResponse.json(
        {
          ok: false,
          error: `PREP API error: ${prepResponse.status}`,
          details: errorText,
        },
        { status: 500 }
      );
    }

    const prepData = await prepResponse.json();
    console.log('✅ [STATUS] PREP API response:', JSON.stringify(prepData, null, 2));

    // ========================================
    // STEP 6: PROCESS RESPONSE BASED ON STATUS (PER DOCUMENTATION)
    // ========================================
    const status = prepData.status;

    if (status === 'completed') {
      console.log('🎉 [STATUS] Analysis completed!');

      // Extract checkerData from result per documentation
      // Response format: { "file_id": "source_id", "status": "completed", "result": {"checkerData": [...]}, "file_url": "<download-url>" }
      let checkerData: any[] = [];
      
      if (prepData.result?.checkerData) {
        checkerData = Array.isArray(prepData.result.checkerData) 
          ? prepData.result.checkerData 
          : [];
      }

      console.log('📋 [STATUS] Found', checkerData.length, 'categories in checkerData');

      // CORRECT NORMALIZATION: Extract issues from ErrorInfo arrays
      // Each item in checkerData is a CATEGORY (Document, Fonts, etc.)
      // The actual issues are in the ErrorInfo array within each category
      const normalizedIssues: NormalizedIssue[] = [];
      let issueId = 1;

      checkerData.forEach((category: any) => {
        const categoryType = category.type || 'Unknown Category';
        const categoryStatus = category.status || 'Unknown';
        const errorInfo = category.ErrorInfo || [];

        console.log(`📂 [STATUS] Processing category: ${categoryType} (${errorInfo.length} items, status: ${categoryStatus})`);

        errorInfo.forEach((errorItem: any) => {
          // Only include Failed or Manual items as issues
          const itemStatus = errorItem.status || 'Unknown';
          
          if (itemStatus === 'Failed' || itemStatus === 'Manual') {
            // Extract description from Description array or string
            let description = 'No description available';
            let suggestion = null;

            if (Array.isArray(errorItem.Description)) {
              // Format: [{"question": "Why error occurred", "answer": "..."}, ...]
              const whyError = errorItem.Description.find((d: any) => d.question?.includes('Why'));
              const howToSolve = errorItem.Description.find((d: any) => d.question?.includes('How'));
              
              description = whyError?.answer || errorItem.error || 'No description available';
              suggestion = howToSolve?.answer || null;
            } else if (typeof errorItem.Description === 'string') {
              description = errorItem.Description;
            } else {
              description = errorItem.error || 'No description available';
            }

            // Determine severity based on status
            const severity = itemStatus === 'Failed' ? 'high' : 'medium';

            normalizedIssues.push({
              id: issueId++,
              page: errorItem.page || null,
              type: `${categoryType} - ${errorItem.type || 'Unknown'}`,
              severity: severity,
              description: description,
              suggestion: suggestion,
              wcagReference: errorItem.wcag || errorItem.wcagReference || null,
            });
          }
        });
      });

      console.log('✅ [STATUS] Normalized', normalizedIssues.length, 'real issues');
      if (normalizedIssues.length > 0) {
        console.log('📄 [STATUS] First issue sample:', JSON.stringify(normalizedIssues[0], null, 2));
      }

      // Extract report URL (file_url in root level per documentation)
      const reportUrl = prepData.file_url || null;

      // Update database with results
      await db
        .update(pdfs)
        .set({
          analysisStatus: 'completed',
          reportUrl: reportUrl,
          rawReport: normalizedIssues,
          updatedAt: new Date(),
        })
        .where(eq(pdfs.id, pdfId));

      console.log('💾 [STATUS] Database updated with results');

      return NextResponse.json(
        {
          ok: true,
          status: 'completed',
          reportUrl: reportUrl,
          issues: normalizedIssues,
        },
        { status: 200 }
      );
    } else if (status === 'in-progress' || status === 'processing' || status === 'started' || status === 'queued') {
      console.log('⏳ [STATUS] Analysis still in progress');

      // Update status in database if changed
      if (pdf.analysisStatus !== status) {
        await db
          .update(pdfs)
          .set({
            analysisStatus: status,
            updatedAt: new Date(),
          })
          .where(eq(pdfs.id, pdfId));

        console.log('💾 [STATUS] Database status updated to:', status);
      }

      return NextResponse.json(
        {
          ok: true,
          status: 'in-progress',
          issues: [],
        },
        { status: 200 }
      );
    } else if (status === 'failed') {
      console.log('❌ [STATUS] Analysis failed');

      await db
        .update(pdfs)
        .set({
          analysisStatus: 'failed',
          updatedAt: new Date(),
        })
        .where(eq(pdfs.id, pdfId));

      return NextResponse.json(
        {
          ok: false,
          error: 'Analysis failed',
          details: prepData.error || 'Unknown error',
        },
        { status: 500 }
      );
    } else {
      console.log('⚠️ [STATUS] Unknown status:', status);

      return NextResponse.json(
        {
          ok: true,
          status: 'in-progress',
          issues: [],
        },
        { status: 200 }
      );
    }
  } catch (error) {
    console.error('❌ [STATUS] Unexpected error:', error);

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
