/**
 * ===========================================
 * GET ANALYSIS RESULTS
 * ===========================================
 * 
 * GET /api/checker/analysis?pdfId=<uuid>
 * 
 * Retrieves the latest accessibility analysis for a PDF
 * 
 * Query params: pdfId (required)
 * 
 * Returns: Latest analysis record with status, results, and report URL
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { pdfs, pdfAnalyses } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { parseCheckerReport } from '@/lib/prepClient';

export async function GET(request: NextRequest) {
  try {
    console.log('📊 Fetching analysis results...');

    // ========================================
    // STEP 1: AUTHENTICATE USER
    // ========================================
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // ========================================
    // STEP 2: GET PDF ID FROM QUERY
    // ========================================
    const { searchParams } = new URL(request.url);
    const pdfId = searchParams.get('pdfId');

    if (!pdfId) {
      return NextResponse.json(
        { ok: false, error: 'pdfId is required' },
        { status: 400 }
      );
    }

    console.log('📄 PDF ID:', pdfId);

    // ========================================
    // STEP 3: VERIFY PDF OWNERSHIP
    // ========================================
    const [pdf] = await db
      .select()
      .from(pdfs)
      .where(
        and(
          eq(pdfs.id, pdfId),
          eq(pdfs.userId, userId) // Verify ownership
        )
      )
      .limit(1);

    if (!pdf) {
      return NextResponse.json(
        { ok: false, error: 'PDF not found or access denied' },
        { status: 404 }
      );
    }

    // ========================================
    // STEP 4: GET LATEST ANALYSIS
    // ========================================
    const [analysis] = await db
      .select()
      .from(pdfAnalyses)
      .where(eq(pdfAnalyses.pdfId, pdfId))
      .orderBy(desc(pdfAnalyses.createdAt))
      .limit(1);

    if (!analysis) {
      return NextResponse.json(
        {
          ok: true,
          analysis: null,
          message: 'No analysis found for this PDF',
        },
        { status: 200 }
      );
    }

    console.log('✅ Analysis found:', analysis.id);
    console.log('📊 Status:', analysis.status);

    // ========================================
    // STEP 5: PARSE ISSUES IF AVAILABLE
    // ========================================
    let issues = [];
    
    if (analysis.status === 'completed' && analysis.rawReport) {
      try {
        issues = parseCheckerReport(analysis.rawReport);
        console.log(`📋 Parsed ${issues.length} issues`);
      } catch (error) {
        console.error('❌ Error parsing issues:', error);
      }
    }

    // ========================================
    // STEP 6: RETURN RESPONSE
    // ========================================
    return NextResponse.json(
      {
        ok: true,
        analysis: {
          id: analysis.id,
          pdfId: analysis.pdfId,
          sourceId: analysis.sourceId,
          status: analysis.status,
          reportUrl: analysis.reportUrl,
          rawReport: analysis.rawReport,
          errorMessage: analysis.errorMessage,
          createdAt: analysis.createdAt,
          updatedAt: analysis.updatedAt,
          issues, // Parsed issues array
        },
        pdf: {
          id: pdf.id,
          fileName: pdf.fileName,
          accessibilityScore: pdf.accessibilityScore,
        },
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('❌ Error fetching analysis:', error);
    
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to fetch analysis',
      },
      { status: 500 }
    );
  }
}
