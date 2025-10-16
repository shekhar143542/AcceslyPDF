/**
 * ===========================================
 * PDF UPLOAD API ROUTE
 * ===========================================
 * 
 * POST /api/upload
 * 
 * This API endpoint handles PDF file uploads from the frontend.
 * 
 * WORKFLOW:
 * 1. Authenticate user with Clerk
 * 2. Extract PDF file from multipart form data
 * 3. Validate file type and size
 * 4. Upload file to Supabase Storage
 * 5. Save metadata to Neon database
 * 6. Return success response with metadata
 * 
 * FRONTEND USAGE:
 * ```typescript
 * const formData = new FormData();
 * formData.append('file', pdfFile);
 * 
 * const response = await fetch('/api/upload', {
 *   method: 'POST',
 *   body: formData,
 * });
 * 
 * const data = await response.json();
 * ```
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { pdfs } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import {
  uploadFileToSupabase,
  generateFilePath,
  validateFile,
  getSignedUrl,
  supabaseAdmin,
  STORAGE_BUCKET,
} from '@/lib/supabase';

// ==========================================
// CONFIGURATION
// ==========================================
// Maximum file size (10MB)
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '10485760', 10);

// Allowed MIME types
const ALLOWED_MIME_TYPES = ['application/pdf'];

// ==========================================
// MAIN UPLOAD HANDLER
// ==========================================
export async function POST(request: NextRequest) {
  try {
    // ========================================
    // STEP 1: AUTHENTICATE USER
    // ========================================
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Unauthorized. Please sign in to upload files.' 
        },
        { status: 401 }
      );
    }

    console.log(`📤 Upload request from user: ${userId}`);

    // ========================================
    // STEP 2: EXTRACT FILE FROM REQUEST
    // ========================================
    const formData = await request.formData();
    const file = formData.get('file') as File;

    // Check if file exists in request
    if (!file) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'No file provided. Please select a PDF file to upload.' 
        },
        { status: 400 }
      );
    }

    console.log(`📄 File received: ${file.name} (${file.size} bytes)`);

    // ========================================
    // STEP 3: VALIDATE FILE TYPE
    // ========================================
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Invalid file type: ${file.type}. Only PDF files are allowed.` 
        },
        { status: 400 }
      );
    }

    // ========================================
    // STEP 4: VALIDATE FILE SIZE
    // ========================================
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { 
          success: false, 
          error: `File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB.` 
        },
        { status: 400 }
      );
    }

    // ========================================
    // STEP 5: CONVERT FILE TO BUFFER
    // ========================================
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Additional validation with buffer
    const validation = validateFile(buffer, file.name, MAX_FILE_SIZE);
    if (!validation.valid) {
      return NextResponse.json(
        { 
          success: false, 
          error: validation.error 
        },
        { status: 400 }
      );
    }

    // ========================================
    // STEP 6: GENERATE UNIQUE FILE PATH
    // ========================================
    // Format: userId/timestamp-filename.pdf
    const filePath = generateFilePath(userId, file.name);
    console.log(`📁 Storage path: ${filePath}`);

    // ========================================
    // STEP 7: UPLOAD TO SUPABASE STORAGE
    // ========================================
    const { publicUrl, error: uploadError } = await uploadFileToSupabase(
      buffer,
      filePath,
      file.type
    );

    if (uploadError || !publicUrl) {
      console.error('❌ Supabase upload failed:', uploadError);
      return NextResponse.json(
        { 
          success: false, 
          error: `File upload failed: ${uploadError || 'Unknown error'}` 
        },
        { status: 500 }
      );
    }

    console.log(`✅ File uploaded to Supabase: ${publicUrl}`);

    // ========================================
    // STEP 8: SAVE METADATA TO DATABASE
    // ========================================
    try {
      const [newPdf] = await db
        .insert(pdfs)
        .values({
          userId,
          fileName: file.name,
          fileUrl: publicUrl,
          fileSize: file.size,
          uploadStatus: 'uploaded',
        })
        .returning();

      console.log(`✅ Metadata saved to database with ID: ${newPdf.id}`);

      // ========================================
      // STEP 9: TRIGGER PREP ANALYSIS (CORRECT API)
      // ========================================
      console.log('📡 Triggering PREP accessibility analysis...');
      
      try {
        const PREP_BASE_URL = 'https://api-pdfservice.continualengine.com';
        const PREP_API_ID = process.env.PREP_API_ID;
        const PREP_APP_KEY = process.env.PREP_APP_KEY;

        if (PREP_API_ID && PREP_APP_KEY) {
          console.log('📡 Calling PREP accessibility-check-init API...');
          console.log('📄 File path:', filePath);
          
          // Download the PDF from Supabase to upload to PREP
          const { data: fileData, error: downloadError } = await supabaseAdmin.storage
            .from(STORAGE_BUCKET)
            .download(filePath);

          if (downloadError || !fileData) {
            console.error('❌ Failed to download file for PREP:', downloadError);
            console.warn('⚠️ Skipping PREP analysis');
          } else {
            console.log('✅ File downloaded, size:', fileData.size, 'bytes');
            
            // Create FormData with the PDF file
            const formData = new FormData();
            formData.append('pdf1', fileData, file.name);
            
            console.log('📤 Uploading to PREP API...');

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

            console.log('📊 PREP API response status:', prepResponse.status);

            if (prepResponse.ok) {
              const prepData = await prepResponse.json();
              console.log('✅ PREP API response:', JSON.stringify(prepData, null, 2));
              
              const sourceId = prepData.source_id;
              
              if (sourceId) {
                console.log('✅ PREP Analysis started with source ID:', sourceId);
                
                // Update database with source ID and status
                await db
                  .update(pdfs)
                  .set({
                    prepSourceId: String(sourceId),
                    analysisStatus: 'in-progress',
                    updatedAt: new Date(),
                  })
                  .where(eq(pdfs.id, newPdf.id));
                
                console.log('💾 Database updated with PREP source ID');
              } else {
                console.warn('⚠️ No source_id in PREP response:', prepData);
              }
            } else {
              const errorText = await prepResponse.text();
              console.warn('⚠️ PREP API error:', prepResponse.status, errorText);
            }
          }
        } else {
          console.warn('⚠️ PREP API credentials not configured');
        }
      } catch (analysisError) {
        // Don't fail the upload if analysis fails
        console.error('⚠️ Analysis trigger error (non-blocking):', analysisError);
      }

      // ========================================
      // STEP 10: RETURN SUCCESS RESPONSE
      // ========================================
      return NextResponse.json(
        {
          success: true,
          message: 'File uploaded successfully',
          data: {
            id: newPdf.id,
            userId: newPdf.userId,
            fileName: newPdf.fileName,
            fileUrl: newPdf.fileUrl,
            fileSize: newPdf.fileSize,
            uploadStatus: newPdf.uploadStatus,
            createdAt: newPdf.createdAt,
          },
        },
        { status: 201 }
      );
    } catch (dbError) {
      // Database error occurred
      console.error('❌ Database error:', dbError);

      // Try to clean up uploaded file from Supabase
      // (Optional: implement deleteFileFromSupabase here)

      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to save file metadata to database.' 
        },
        { status: 500 }
      );
    }
  } catch (error) {
    // ========================================
    // GENERAL ERROR HANDLER
    // ========================================
    console.error('❌ Unexpected error in upload route:', error);

    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'An unexpected error occurred during upload.' 
      },
      { status: 500 }
    );
  }
}

// ==========================================
// OPTIONAL: GET METHOD (List User's PDFs)
// ==========================================
/**
 * GET /api/upload
 * Returns all PDFs uploaded by the authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Unauthorized' 
        },
        { status: 401 }
      );
    }

    // Query database for user's PDFs
    const userPdfs = await db
      .select()
      .from(pdfs)
      .where(eq(pdfs.userId, userId))
      .orderBy(desc(pdfs.createdAt));

    return NextResponse.json(
      {
        success: true,
        data: userPdfs,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('❌ Error fetching PDFs:', error);

    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch PDFs' 
      },
      { status: 500 }
    );
  }
}
