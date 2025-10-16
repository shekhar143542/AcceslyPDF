/**
 * ===========================================
 * SUPABASE CLIENT CONFIGURATION
 * ===========================================
 * 
 * This file initializes the Supabase client for file storage operations.
 * 
 * SETUP INSTRUCTIONS:
 * 1. Install Supabase: npm install @supabase/supabase-js
 * 2. Create a Supabase project at https://supabase.com
 * 3. Go to Project Settings > API
 * 4. Copy your Project URL and Service Role Key
 * 5. Add them to .env.local (see .env.example)
 * 6. Create a storage bucket named 'pdfs' in Supabase Dashboard:
 *    - Go to Storage in sidebar
 *    - Click "New bucket"
 *    - Name: pdfs
 *    - Set as Public or Private (recommend Private for security)
 *    - Enable RLS (Row Level Security) for production
 */

import { createClient } from '@supabase/supabase-js';

// ==========================================
// ENVIRONMENT VARIABLES VALIDATION
// ==========================================
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl) {
  throw new Error(
    '❌ Missing NEXT_PUBLIC_SUPABASE_URL environment variable. ' +
    'Please add it to .env.local'
  );
}

if (!supabaseServiceKey) {
  throw new Error(
    '❌ Missing SUPABASE_SERVICE_KEY environment variable. ' +
    'Please add it to .env.local. ' +
    'Use the service_role key for server-side operations.'
  );
}

// ==========================================
// SUPABASE CLIENT INITIALIZATION
// ==========================================
/**
 * Server-side Supabase client with service role key
 * This has full permissions to bypass RLS policies
 * ⚠️ ONLY use this on the server-side (API routes, Server Components)
 * NEVER expose this client to the browser
 */
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// ==========================================
// STORAGE BUCKET CONFIGURATION
// ==========================================
export const STORAGE_BUCKET = process.env.SUPABASE_BUCKET_NAME || 'pdfs';

/**
 * Check if the storage bucket exists
 * This is useful for debugging during setup
 */
export async function checkStorageBucket() {
  try {
    const { data, error } = await supabaseAdmin.storage.getBucket(STORAGE_BUCKET);
    
    if (error) {
      console.error(`❌ Storage bucket '${STORAGE_BUCKET}' not found:`, error.message);
      console.log('📝 Create the bucket in Supabase Dashboard > Storage');
      return false;
    }
    
    console.log(`✅ Storage bucket '${STORAGE_BUCKET}' is ready`);
    return true;
  } catch (error) {
    console.error('❌ Error checking storage bucket:', error);
    return false;
  }
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Upload a file to Supabase Storage
 * 
 * @param file - The file buffer to upload
 * @param filePath - The path where the file should be stored (e.g., "userId/filename.pdf")
 * @param contentType - MIME type of the file
 * @returns Object with publicUrl and error
 */
export async function uploadFileToSupabase(
  file: Buffer,
  filePath: string,
  contentType: string = 'application/pdf'
) {
  try {
    // Upload file to Supabase Storage
    const { data, error } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, file, {
        contentType,
        upsert: false, // Don't overwrite existing files
        cacheControl: '3600', // Cache for 1 hour
      });

    if (error) {
      console.error('❌ Supabase upload error:', error);
      return { publicUrl: null, error: error.message };
    }

    console.log('✅ File uploaded, generating public URL...');

    // Get public URL for the uploaded file
    const { data: urlData } = supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(filePath);

    const publicUrl = urlData.publicUrl;
    
    // Validate URL format
    if (!publicUrl || !publicUrl.startsWith('http')) {
      console.error('❌ Invalid public URL generated:', publicUrl);
      return { publicUrl: null, error: 'Failed to generate valid public URL' };
    }

    console.log('✅ Public URL generated:', publicUrl);
    return { publicUrl, error: null };
  } catch (error) {
    console.error('❌ Unexpected error during file upload:', error);
    return { 
      publicUrl: null, 
      error: error instanceof Error ? error.message : 'Unknown upload error' 
    };
  }
}

/**
 * Get a signed URL for a file (works for private buckets)
 * The signed URL will be valid for the specified duration
 * 
 * @param filePath - The path of the file
 * @param expiresIn - Expiration time in seconds (default: 1 hour)
 * @returns Object with signedUrl and error
 */
export async function getSignedUrl(filePath: string, expiresIn: number = 3600) {
  try {
    const { data, error } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(filePath, expiresIn);

    if (error) {
      console.error('❌ Error creating signed URL:', error);
      return { signedUrl: null, error: error.message };
    }

    console.log('✅ Signed URL created (expires in', expiresIn, 'seconds)');
    return { signedUrl: data.signedUrl, error: null };
  } catch (error) {
    console.error('❌ Unexpected error creating signed URL:', error);
    return {
      signedUrl: null,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Delete a file from Supabase Storage
 * 
 * @param filePath - The path of the file to delete
 * @returns Success boolean and error message
 */
export async function deleteFileFromSupabase(filePath: string) {
  try {
    const { error } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .remove([filePath]);

    if (error) {
      console.error('❌ Supabase delete error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (error) {
    console.error('❌ Unexpected error during file deletion:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown deletion error' 
    };
  }
}

/**
 * Generate a safe file path for storage
 * Format: userId/timestamp-filename.pdf
 * 
 * @param userId - Clerk user ID
 * @param originalFilename - Original filename from upload
 * @returns Sanitized file path
 */
export function generateFilePath(userId: string, originalFilename: string): string {
  // Remove any path traversal attempts
  const safeFilename = originalFilename.replace(/[^a-zA-Z0-9.-]/g, '_');
  
  // Add timestamp to ensure uniqueness
  const timestamp = Date.now();
  
  // Format: userId/timestamp-filename.pdf
  return `${userId}/${timestamp}-${safeFilename}`;
}

/**
 * Validate file type and size
 * 
 * @param file - File buffer
 * @param filename - Original filename
 * @param maxSize - Maximum file size in bytes (default 10MB)
 * @returns Validation result
 */
export function validateFile(
  file: Buffer,
  filename: string,
  maxSize: number = 10 * 1024 * 1024 // 10MB default
): { valid: boolean; error: string | null } {
  // Check file size
  if (file.length > maxSize) {
    return {
      valid: false,
      error: `File size exceeds maximum of ${maxSize / 1024 / 1024}MB`,
    };
  }

  // Check file extension
  const allowedExtensions = ['.pdf'];
  const fileExtension = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  
  if (!allowedExtensions.includes(fileExtension)) {
    return {
      valid: false,
      error: `Invalid file type. Only PDF files are allowed.`,
    };
  }

  return { valid: true, error: null };
}

// Export types for use in other files
export type UploadResult = {
  publicUrl: string | null;
  error: string | null;
};

export type DeleteResult = {
  success: boolean;
  error: string | null;
};
