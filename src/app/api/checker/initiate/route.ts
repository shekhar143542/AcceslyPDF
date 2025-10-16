/**
 * ===========================================
 * INITIATE ACCESSIBILITY CHECK
 * ===========================================
 * 
 * POST /api/checker/initiate
 * 
 * Initiates an accessibility check for an uploaded PDF using PREP Checker API
 * 
 * Request body: { pdfId: string }
 * 
 * Workflow:
 * 1. Authenticate user with Clerk
 * 2. Verify PDF ownership
 * 3. Download PDF from Supabase
 * 4. Upload to PREP Checker API
 * 5. Store analysis record in database
 * 6. Return source_id and analysisId
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { pdfs, pdfAnalyses } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { uploadToPrep } from '@/lib/prepClient';
import { createClient } from '@supabase/supabase-js';

// ==========================================
// SUPABASE CLIENT (SERVER-SIDE)
// ==========================================
// IMPORTANT: Use SERVICE_ROLE_KEY only on server!
// Never expose this key to the client-side code.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // Service role key for server-side operations
  {
    auth: {
      persistSession: false,
    },
  }
);

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Initiating accessibility check...');

    // ========================================
    // STEP 1: AUTHENTICATE USER
    // ========================================
    const { userId } = await auth();

    if (!userId) {
      console.error('❌ Unauthorized: No user ID');
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('✅ User authenticated:', userId);

    // ========================================
    // STEP 2: GET PDF ID FROM REQUEST
    // ========================================
    const body = await request.json();
    const { pdfId } = body;

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
      console.error('❌ PDF not found or access denied');
      return NextResponse.json(
        { ok: false, error: 'PDF not found or access denied' },
        { status: 404 }
      );
    }

    console.log('✅ PDF found:', pdf.fileName);

    // ========================================
    // STEP 4: DOWNLOAD PDF FROM SUPABASE
    // ========================================
    console.log('⬇️ Downloading PDF from Supabase...');
    console.log('📍 URL:', pdf.fileUrl);

    // Extract file path from Supabase URL
    // URL format: https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
    const urlParts = pdf.fileUrl.split('/storage/v1/object/public/');
    if (urlParts.length !== 2) {
      throw new Error('Invalid Supabase URL format');
    }

    const [bucket, ...pathParts] = urlParts[1].split('/');
    const filePath = pathParts.join('/');

    console.log('📦 Bucket:', bucket);
    console.log('📂 Path:', filePath);

    // Download file as buffer
    const { data: fileData, error: downloadError } = await supabase
      .storage
      .from(bucket)
      .download(filePath);

    if (downloadError || !fileData) {
      console.error('❌ Download error:', downloadError);
      throw new Error(`Failed to download PDF: ${downloadError?.message}`);
    }

    const fileBuffer = Buffer.from(await fileData.arrayBuffer());
    console.log('✅ PDF downloaded, size:', fileBuffer.length, 'bytes');

    // ========================================
    // STEP 5: UPLOAD TO PREP CHECKER API
    // ========================================
    console.log('📡 Uploading to PREP Checker...');

    const prepResult = await uploadToPrep(fileBuffer, pdf.fileName);

    console.log('✅ PREP upload successful');
    console.log('📋 Source ID:', prepResult.source_id);

    // ========================================
    // STEP 6: CREATE ANALYSIS RECORD IN DB
    // ========================================
    console.log('💾 Creating analysis record...');

    const [analysis] = await db
      .insert(pdfAnalyses)
      .values({
        pdfId: pdf.id,
        sourceId: prepResult.source_id,
        status: 'queued', // Initial status
      })
      .returning();

    console.log('✅ Analysis record created:', analysis.id);

    // ========================================
    // STEP 7: RETURN SUCCESS RESPONSE
    // ========================================
    return NextResponse.json(
      {
        ok: true,
        source_id: prepResult.source_id,
        analysisId: analysis.id,
        message: 'Accessibility check initiated successfully',
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('❌ Error initiating check:', error);
    
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to initiate accessibility check',
      },
      { status: 500 }
    );
  }
}
