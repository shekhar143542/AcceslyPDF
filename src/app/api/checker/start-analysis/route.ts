/**
 * ===========================================
 * START PREP ACCESSIBILITY ANALYSIS
 * ===========================================
 * 
 * POST /api/checker/start-analysis
 * 
 * This endpoint initiates the PREP Checker accessibility analysis
 * for a specific PDF document.
 * 
 * Request Body:
 * {
 *   pdfId: string (UUID of the PDF to analyze)
 * }
 * 
 * Response:
 * {
 *   success: true,
 *   message: "Analysis started successfully",
 *   sourceId: string
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

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 [START-ANALYSIS] New analysis request received');

    // ========================================
    // STEP 1: AUTHENTICATE USER
    // ========================================
    const { userId } = await auth();

    if (!userId) {
      console.log('❌ [START-ANALYSIS] Unauthorized access attempt');
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('✅ [START-ANALYSIS] User authenticated:', userId);

    // ========================================
    // STEP 2: PARSE REQUEST BODY
    // ========================================
    const body = await request.json();
    const { pdfId } = body;

    if (!pdfId) {
      console.log('❌ [START-ANALYSIS] Missing pdfId in request body');
      return NextResponse.json(
        { success: false, error: 'pdfId is required' },
        { status: 400 }
      );
    }

    console.log('📄 [START-ANALYSIS] PDF ID:', pdfId);

    // ========================================
    // STEP 3: FETCH PDF FROM DATABASE
    // ========================================
    const [pdf] = await db
      .select()
      .from(pdfs)
      .where(and(eq(pdfs.id, pdfId), eq(pdfs.userId, userId)))
      .limit(1);

    if (!pdf) {
      console.log('❌ [START-ANALYSIS] PDF not found or unauthorized');
      return NextResponse.json(
        { success: false, error: 'PDF not found' },
        { status: 404 }
      );
    }

    console.log('✅ [START-ANALYSIS] PDF found:', pdf.fileName);

    // Check if analysis already started
    if (pdf.analysisStatus === 'started' || pdf.analysisStatus === 'completed') {
      console.log('⚠️ [START-ANALYSIS] Analysis already', pdf.analysisStatus);
      return NextResponse.json(
        {
          success: false,
          error: `Analysis already ${pdf.analysisStatus}`,
          sourceId: pdf.prepSourceId,
        },
        { status: 409 }
      );
    }

    // ========================================
    // STEP 4: VALIDATE PREP API CREDENTIALS
    // ========================================
    if (!PREP_API_ID || !PREP_APP_KEY) {
      console.error('❌ [START-ANALYSIS] PREP API credentials not configured');
      return NextResponse.json(
        { success: false, error: 'API credentials not configured' },
        { status: 500 }
      );
    }

    console.log('🔑 [START-ANALYSIS] PREP API credentials validated');

    // ========================================
    // STEP 5: CALL PREP ACCESSIBILITY-CHECK-INIT API (CORRECT FORMAT)
    // ========================================
    console.log('📡 [START-ANALYSIS] Calling PREP accessibility-check-init API...');
    console.log('� [START-ANALYSIS] PDF file:', pdf.fileName);

    // Import Supabase client to download the file
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const STORAGE_BUCKET = process.env.SUPABASE_BUCKET_NAME || 'pdfs';

    // Extract file path from fileUrl or reconstruct it
    // File path format: userId/timestamp-filename.pdf
    const urlParts = pdf.fileUrl.split('/');
    const filePath = urlParts.slice(-2).join('/'); // Get last two parts: userId/filename.pdf
    
    console.log('� [START-ANALYSIS] Downloading file from Supabase:', filePath);

    // Download the PDF from Supabase
    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .download(filePath);

    if (downloadError || !fileData) {
      console.error('❌ [START-ANALYSIS] Failed to download file:', downloadError);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to download PDF file for analysis',
          details: downloadError?.message,
        },
        { status: 500 }
      );
    }

    console.log('✅ [START-ANALYSIS] File downloaded, size:', fileData.size, 'bytes');

    // Create FormData with the PDF file
    const formData = new FormData();
    formData.append('pdf1', fileData, pdf.fileName);

    const prepResponse = await fetch(
      `${PREP_BASE_URL}/pdf-content/pdf/accessibility-check-init/`,
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

    console.log('📊 [START-ANALYSIS] PREP API response status:', prepResponse.status);

    if (!prepResponse.ok) {
      const errorText = await prepResponse.text();
      console.error('❌ [START-ANALYSIS] PREP API error:', errorText);
      return NextResponse.json(
        {
          success: false,
          error: `PREP API error: ${prepResponse.status}`,
          details: errorText,
        },
        { status: 500 }
      );
    }

    const prepData = await prepResponse.json();
    console.log('✅ [START-ANALYSIS] PREP API response:', JSON.stringify(prepData, null, 2));

    // Extract source_id from response
    const sourceId = prepData.source_id || prepData.sourceId || prepData.id;

    if (!sourceId) {
      console.error('❌ [START-ANALYSIS] No source_id in PREP response');
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid PREP API response: missing source_id',
          prepResponse: prepData,
        },
        { status: 500 }
      );
    }

    console.log('🎯 [START-ANALYSIS] Source ID received:', sourceId);

    // ========================================
    // STEP 6: UPDATE DATABASE
    // ========================================
    console.log('💾 [START-ANALYSIS] Updating database...');

    await db
      .update(pdfs)
      .set({
        prepSourceId: sourceId,
        analysisStatus: 'started',
        updatedAt: new Date(),
      })
      .where(eq(pdfs.id, pdfId));

    console.log('✅ [START-ANALYSIS] Database updated successfully');

    // ========================================
    // STEP 7: RETURN SUCCESS RESPONSE
    // ========================================
    return NextResponse.json(
      {
        success: true,
        message: 'Analysis started successfully',
        sourceId: sourceId,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('❌ [START-ANALYSIS] Unexpected error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
