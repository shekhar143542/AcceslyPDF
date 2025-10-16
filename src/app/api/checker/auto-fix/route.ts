import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { pdfs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { createClient } from '@supabase/supabase-js';
import { autoTagPDF } from '@/lib/prepAutoTag';
import { uploadToPrep } from '@/lib/prepClient';

// Use service role key for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    console.log('🔧 [AUTO-FIX] Auto-fix request received');

    // Validate environment variables
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('❌ [AUTO-FIX] Missing Supabase configuration');
      return NextResponse.json(
        { success: false, error: 'Server configuration error: Supabase credentials missing' },
        { status: 500 }
      );
    }

    if (!process.env.PREP_API_ID || !process.env.PREP_APP_KEY) {
      console.error('❌ [AUTO-FIX] Missing PREP API configuration');
      return NextResponse.json(
        { success: false, error: 'Server configuration error: PREP API credentials missing' },
        { status: 500 }
      );
    }

    // 1. Authenticate user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Get pdfId from request body
    const body = await request.json();
    const { pdfId } = body;

    if (!pdfId) {
      return NextResponse.json(
        { success: false, error: 'Missing pdfId' },
        { status: 400 }
      );
    }

    console.log('📄 [AUTO-FIX] PDF ID:', pdfId);

    // 3. Fetch PDF from database
    const pdfRecords = await db
      .select()
      .from(pdfs)
      .where(eq(pdfs.id, pdfId))
      .limit(1);

    if (!pdfRecords || pdfRecords.length === 0) {
      return NextResponse.json(
        { success: false, error: 'PDF not found' },
        { status: 404 }
      );
    }

    const pdfRecord = pdfRecords[0];

    // 4. Verify ownership
    if (pdfRecord.userId !== userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - PDF belongs to different user' },
        { status: 403 }
      );
    }

    console.log('✅ [AUTO-FIX] PDF found:', pdfRecord.fileName);

    // 5. Download PDF from Supabase
    const fileUrl = pdfRecord.fileUrl;
    const publicUrlPrefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/pdfs/`;
    const filePath = fileUrl.replace(publicUrlPrefix, '');

    console.log('⬇️ [AUTO-FIX] Downloading PDF from Supabase...');

    const { data: fileData, error: downloadError } = await supabase.storage
      .from('pdfs')
      .download(filePath);

    if (downloadError || !fileData) {
      console.error('❌ [AUTO-FIX] Download error:', downloadError);
      return NextResponse.json(
        { success: false, error: 'Failed to download PDF from storage' },
        { status: 500 }
      );
    }

    const arrayBuffer = await fileData.arrayBuffer();
    const pdfBuffer = Buffer.from(arrayBuffer);
    console.log('✅ [AUTO-FIX] PDF downloaded, size:', pdfBuffer.length);

    // 6. Send to PREP AutoTag API
    console.log('🚀 [AUTO-FIX] Sending PDF to PREP AutoTag API...');
    
    const fixedPdfBuffer = await autoTagPDF(
      pdfBuffer,
      pdfRecord.fileName,
      undefined, // templateId - optional
      30, // maxPollAttempts
      5000 // pollIntervalMs (5 seconds)
    );

    console.log('✅ [AUTO-FIX] Received fixed PDF, size:', fixedPdfBuffer.length);

    // 7. Upload fixed PDF to Supabase (create new version)
    const timestamp = Date.now();
    const baseFileName = pdfRecord.fileName.replace('.pdf', '');
    const newFileName = `${baseFileName}_autofix_${timestamp}.pdf`;
    const newFilePath = `${userId}/${newFileName}`;

    console.log('📤 [AUTO-FIX] Uploading fixed PDF to Supabase:', newFileName);

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('pdfs')
      .upload(newFilePath, fixedPdfBuffer, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (uploadError) {
      console.error('❌ [AUTO-FIX] Upload error:', uploadError);
      return NextResponse.json(
        { success: false, error: 'Failed to upload fixed PDF to storage' },
        { status: 500 }
      );
    }

    // 8. Get public URL for the new file
    const { data: urlData } = supabase.storage
      .from('pdfs')
      .getPublicUrl(newFilePath);

    const newFileUrl = urlData.publicUrl;
    console.log('✅ [AUTO-FIX] Fixed PDF uploaded:', newFileUrl);

    // 9. Re-analyze the fixed PDF with Document Checker
    console.log('🔍 [AUTO-FIX] Re-analyzing fixed PDF with Document Checker...');
    
    const prepResponse = await uploadToPrep(fixedPdfBuffer, newFileName);
    const newSourceId = prepResponse.source_id;

    console.log('✅ [AUTO-FIX] New analysis started, source_id:', newSourceId);

    // 10. Update database with new file URL and source_id
    await db
      .update(pdfs)
      .set({
        fileName: newFileName,
        fileUrl: newFileUrl,
        prepSourceId: newSourceId,
        analysisStatus: 'started',
        rawReport: null, // Clear old report
        updatedAt: new Date(),
      })
      .where(eq(pdfs.id, pdfId));

    console.log('✅ [AUTO-FIX] Database updated with new file info');

    // 11. Return success
    return NextResponse.json({
      success: true,
      message: 'PDF auto-fixed successfully',
      newFileUrl,
      newFileName,
      newSourceId,
      originalSize: pdfBuffer.length,
      fixedSize: fixedPdfBuffer.length,
      sizeDifference: fixedPdfBuffer.length - pdfBuffer.length,
    });

  } catch (error) {
    console.error('❌ [AUTO-FIX] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      },
      { status: 500 }
    );
  }
}
