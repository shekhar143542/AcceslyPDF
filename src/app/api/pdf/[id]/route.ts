/**
 * ===========================================
 * PDF DETAIL API ROUTES
 * ===========================================
 * 
 * Dynamic routes for individual PDF operations:
 * - GET /api/pdf/[id] - Get PDF details
 * - DELETE /api/pdf/[id] - Delete PDF
 * - PATCH /api/pdf/[id] - Update PDF metadata
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { eq, and } from 'drizzle-orm';
import { db } from '@/db';
import { pdfs } from '@/db/schema';
import { deleteFileFromSupabase } from '@/lib/supabase';

// ==========================================
// GET SINGLE PDF
// ==========================================
/**
 * GET /api/pdf/[id]
 * Retrieve details of a specific PDF
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: pdfId } = await params;

    // Query database for the specific PDF
    const [pdf] = await db
      .select()
      .from(pdfs)
      .where(
        and(
          eq(pdfs.id, pdfId),
          eq(pdfs.userId, userId) // Ensure user owns this PDF
        )
      )
      .limit(1);

    if (!pdf) {
      return NextResponse.json(
        { success: false, error: 'PDF not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: pdf,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('❌ Error fetching PDF:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch PDF' },
      { status: 500 }
    );
  }
}

// ==========================================
// DELETE PDF
// ==========================================
/**
 * DELETE /api/pdf/[id]
 * 
 * Safely deletes a PDF file and its metadata.
 * 
 * Security & Authorization:
 * 1. Uses Clerk authentication to get userId
 * 2. Verifies the PDF belongs to the authenticated user
 * 3. Returns 401 if not authenticated
 * 4. Returns 404 if PDF not found or doesn't belong to user
 * 
 * Deletion Process:
 * 1. Fetch PDF metadata from Neon DB
 * 2. Verify user owns the PDF
 * 3. Extract file path from Supabase URL
 * 4. Delete file from Supabase Storage bucket
 * 5. Delete metadata record from Neon DB
 * 6. Return success response
 * 
 * Error Handling:
 * - Continues with DB deletion even if storage deletion fails
 * - Logs all errors for debugging
 * - Returns appropriate HTTP status codes
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log('🗑️ DELETE /api/pdf/[id] - Starting deletion process');

    // ============================================
    // STEP 1: AUTHENTICATE USER WITH CLERK
    // ============================================
    const { userId } = await auth();

    if (!userId) {
      console.warn('⚠️ Unauthorized deletion attempt - no userId');
      return NextResponse.json(
        { 
          success: false, 
          error: 'Unauthorized - Please sign in to delete PDFs' 
        },
        { status: 401 }
      );
    }

    console.log('✅ User authenticated:', userId);

    const { id: pdfId } = await params;
    console.log('📄 PDF ID to delete:', pdfId);

    // ============================================
    // STEP 2: FETCH PDF METADATA FROM NEON DB
    // ============================================
    console.log('🔍 Fetching PDF metadata from database...');
    
    const [pdf] = await db
      .select()
      .from(pdfs)
      .where(
        and(
          eq(pdfs.id, pdfId),
          eq(pdfs.userId, userId) // IMPORTANT: Verify ownership
        )
      )
      .limit(1);

    // ============================================
    // STEP 3: VERIFY PDF EXISTS AND USER OWNS IT
    // ============================================
    if (!pdf) {
      console.warn('⚠️ PDF not found or unauthorized access attempt');
      console.warn('   PDF ID:', pdfId);
      console.warn('   User ID:', userId);
      return NextResponse.json(
        { 
          success: false, 
          error: 'PDF not found or you do not have permission to delete it' 
        },
        { status: 404 }
      );
    }

    console.log('✅ PDF found:', pdf.fileName);
    console.log('   File URL:', pdf.fileUrl);
    console.log('   Owner:', pdf.userId);

    // ============================================
    // STEP 4: EXTRACT FILE PATH FROM SUPABASE URL
    // ============================================
    // URL format: https://xxx.supabase.co/storage/v1/object/public/pdfs/userId/filename.pdf
    // We need: userId/filename.pdf
    const urlParts = pdf.fileUrl.split('/pdfs/');
    
    if (urlParts.length < 2) {
      console.error('❌ Invalid file URL format:', pdf.fileUrl);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid file URL format' 
        },
        { status: 500 }
      );
    }

    const filePath = urlParts[1]; // Gets "userId/timestamp-filename.pdf"
    console.log('📂 Extracted file path:', filePath);

    // ============================================
    // STEP 5: DELETE FILE FROM SUPABASE STORAGE
    // ============================================
    console.log('🗑️ Deleting file from Supabase Storage...');
    
    const { success: deleteSuccess, error: deleteError } = await deleteFileFromSupabase(filePath);

    if (!deleteSuccess) {
      console.error('⚠️ Failed to delete file from Supabase Storage:', deleteError);
      console.warn('   Continuing with database deletion...');
      // Continue with database deletion even if storage deletion fails
      // This prevents orphaned database records
    } else {
      console.log('✅ File deleted from Supabase Storage');
    }

    // ============================================
    // STEP 6: DELETE METADATA FROM NEON DB
    // ============================================
    console.log('🗑️ Deleting metadata from Neon DB...');
    
    await db
      .delete(pdfs)
      .where(eq(pdfs.id, pdfId));

    console.log('✅ Metadata deleted from database');
    console.log('🎉 PDF deletion completed successfully');

    return NextResponse.json(
      {
        success: true,
        message: 'PDF deleted successfully',
        data: {
          deletedId: pdfId,
          fileName: pdf.fileName,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('❌ Error deleting PDF:', error);
    console.error('   Error details:', error instanceof Error ? error.message : 'Unknown error');
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to delete PDF - An unexpected error occurred',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// ==========================================
// UPDATE PDF METADATA
// ==========================================
/**
 * PATCH /api/pdf/[id]
 * Update PDF metadata (e.g., accessibility score, status)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: pdfId } = await params;
    const body = await request.json();

    // Verify ownership
    const [pdf] = await db
      .select()
      .from(pdfs)
      .where(
        and(
          eq(pdfs.id, pdfId),
          eq(pdfs.userId, userId)
        )
      )
      .limit(1);

    if (!pdf) {
      return NextResponse.json(
        { success: false, error: 'PDF not found' },
        { status: 404 }
      );
    }

    // Update allowed fields
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (body.uploadStatus) {
      updateData.uploadStatus = body.uploadStatus;
    }

    if (body.accessibilityScore !== undefined) {
      updateData.accessibilityScore = body.accessibilityScore;
    }

    // Perform update
    const [updatedPdf] = await db
      .update(pdfs)
      .set(updateData)
      .where(eq(pdfs.id, pdfId))
      .returning();

    return NextResponse.json(
      {
        success: true,
        data: updatedPdf,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('❌ Error updating PDF:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update PDF' },
      { status: 500 }
    );
  }
}
