/**
 * Debug endpoint to see what's actually stored in the database
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { pdfs } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const pdfId = searchParams.get('pdfId');

    if (!pdfId) {
      return NextResponse.json({ error: 'pdfId required' }, { status: 400 });
    }

    const [pdf] = await db
      .select()
      .from(pdfs)
      .where(and(eq(pdfs.id, pdfId), eq(pdfs.userId, userId)))
      .limit(1);

    if (!pdf) {
      return NextResponse.json({ error: 'PDF not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: pdf.id,
      fileName: pdf.fileName,
      analysisStatus: pdf.analysisStatus,
      prepSourceId: pdf.prepSourceId,
      reportUrl: pdf.reportUrl,
      rawReport: pdf.rawReport,
      rawReportType: typeof pdf.rawReport,
      rawReportLength: Array.isArray(pdf.rawReport) ? pdf.rawReport.length : 'not an array',
      accessibilityScore: pdf.accessibilityScore,
      createdAt: pdf.createdAt,
      updatedAt: pdf.updatedAt,
    }, { status: 200 });

  } catch (error) {
    console.error('Debug error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error' },
      { status: 500 }
    );
  }
}
