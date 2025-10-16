/**
 * Force refresh - bypasses cache and rechecks PREP API
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { pdfs } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

const PREP_BASE_URL = 'https://api-pdfservice.continualengine.com';
const PREP_API_ID = process.env.PREP_API_ID!;
const PREP_APP_KEY = process.env.PREP_APP_KEY!;

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { pdfId } = await request.json();
    if (!pdfId) {
      return NextResponse.json({ error: 'pdfId required' }, { status: 400 });
    }

    console.log('🔄 [REFRESH] Force refreshing PDF:', pdfId);

    const [pdf] = await db
      .select()
      .from(pdfs)
      .where(and(eq(pdfs.id, pdfId), eq(pdfs.userId, userId)))
      .limit(1);

    if (!pdf || !pdf.prepSourceId) {
      return NextResponse.json({ error: 'PDF not found or no analysis' }, { status: 404 });
    }

    console.log('📡 [REFRESH] Calling PREP API with source ID:', pdf.prepSourceId);

    // Call PREP Check Status API
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
        },
        body: formData,
      }
    );

    if (!prepResponse.ok) {
      const errorText = await prepResponse.text();
      console.error('❌ [REFRESH] PREP API error:', errorText);
      return NextResponse.json({
        error: 'PREP API error',
        details: errorText,
        status: prepResponse.status
      }, { status: 500 });
    }

    const prepData = await prepResponse.json();
    console.log('✅ [REFRESH] PREP Response:', JSON.stringify(prepData, null, 2));

    // Check if we have a file_url (downloadable report)
    const fileUrl = prepData.file_url || prepData.result?.file_url;
    console.log('📄 [REFRESH] File URL:', fileUrl);

    let reportData = null;
    let checkerData = [];

    // If there's a file_url, download the actual report
    if (fileUrl) {
      console.log('⬇️ [REFRESH] Downloading report from:', fileUrl);
      try {
        const reportResponse = await fetch(fileUrl);
        if (reportResponse.ok) {
          const contentType = reportResponse.headers.get('content-type');
          console.log('📝 [REFRESH] Report content type:', contentType);
          
          if (contentType?.includes('application/json')) {
            reportData = await reportResponse.json();
            console.log('✅ [REFRESH] Downloaded JSON report:', JSON.stringify(reportData, null, 2));
            
            // Extract checkerData from downloaded report
            checkerData = reportData.checkerData || reportData.issues || reportData.result?.checkerData || [];
          } else {
            const reportText = await reportResponse.text();
            console.log('📄 [REFRESH] Downloaded report (first 500 chars):', reportText.substring(0, 500));
            
            // Try to parse as JSON
            try {
              reportData = JSON.parse(reportText);
              checkerData = reportData.checkerData || reportData.issues || reportData.result?.checkerData || [];
            } catch (e) {
              console.error('❌ [REFRESH] Could not parse report as JSON');
            }
          }
        } else {
          console.error('❌ [REFRESH] Failed to download report:', reportResponse.status);
        }
      } catch (err) {
        console.error('❌ [REFRESH] Error downloading report:', err);
      }
    }

    // Fallback to inline checkerData if no file_url or download failed
    if (checkerData.length === 0) {
      console.log('⚠️ [REFRESH] No data from file_url, checking inline checkerData...');
      checkerData = prepData.result?.checkerData || prepData.checkerData || [];
    }

    console.log('📋 [REFRESH] Found issues:', checkerData.length);

    // If still no data, return the raw response for debugging
    if (checkerData.length === 0) {
      console.error('❌ [REFRESH] No checker data found in response!');
      console.log('📊 [REFRESH] Full PREP response structure:', Object.keys(prepData));
      console.log('📊 [REFRESH] Result structure:', prepData.result ? Object.keys(prepData.result) : 'No result');
      
      return NextResponse.json({
        success: false,
        error: 'No accessibility issues found in PREP response',
        prepResponse: prepData,
        reportData: reportData,
        hint: 'Check the raw response structure above'
      }, { status: 200 });
    }

    // CORRECT NORMALIZATION: Extract issues from ErrorInfo arrays
    // Each item in checkerData is a CATEGORY (Document, Fonts, etc.)
    // The actual issues are in the ErrorInfo array within each category
    const normalizedIssues: any[] = [];
    let issueId = 1;

    checkerData.forEach((category: any) => {
      const categoryType = category.type || 'Unknown Category';
      const categoryStatus = category.status || 'Unknown';
      const errorInfo = category.ErrorInfo || [];

      console.log(`📂 [REFRESH] Processing category: ${categoryType} (${errorInfo.length} items, status: ${categoryStatus})`);

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
            status: itemStatus,
            rawError: errorItem.error,
          });
        }
      });
    });

    console.log('✅ [REFRESH] Normalized issues:', normalizedIssues.length);
    if (normalizedIssues.length > 0) {
      console.log('📄 [REFRESH] Sample issue:', JSON.stringify(normalizedIssues[0], null, 2));
    }

    // Update database
    await db
      .update(pdfs)
      .set({
        analysisStatus: prepData.status,
        reportUrl: prepData.file_url || null,
        rawReport: normalizedIssues,
        updatedAt: new Date(),
      })
      .where(eq(pdfs.id, pdfId));

    console.log('💾 [REFRESH] Database updated');

    return NextResponse.json({
      success: true,
      status: prepData.status,
      issues: normalizedIssues,
      issueCount: normalizedIssues.length,
      fileUrl: prepData.file_url,
      reportData: reportData,
      rawPrepResponse: prepData,
    }, { status: 200 });

  } catch (error) {
    console.error('❌ [REFRESH] Error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
