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
import {
  uploadFileToSupabase,
  generateFilePath,
  validateFile,
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
      // STEP 9: RETURN SUCCESS RESPONSE
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

// ==========================================
// HELPER: Import missing functions
// ==========================================
import { eq, desc } from 'drizzle-orm';
