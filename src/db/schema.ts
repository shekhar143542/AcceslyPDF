/**
 * ===========================================
 * DRIZZLE ORM DATABASE SCHEMA
 * ===========================================
 * 
 * This file defines the database schema for PDF metadata storage.
 * 
 * SETUP INSTRUCTIONS:
 * 1. Install dependencies:
 *    npm install drizzle-orm @neondatabase/serverless
 *    npm install -D drizzle-kit
 * 
 * 2. Create a Neon database:
 *    - Go to https://neon.tech
 *    - Create a new project
 *    - Copy the connection string
 *    - Add it to .env.local as DATABASE_URL
 * 
 * 3. Push schema to database:
 *    npx drizzle-kit push
 * 
 * 4. (Optional) Generate migrations:
 *    npx drizzle-kit generate
 */

import { pgTable, uuid, text, integer, timestamp, varchar } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ==========================================
// PDF METADATA TABLE
// ==========================================
/**
 * Table to store metadata about uploaded PDF files
 * 
 * Columns:
 * - id: Unique identifier (UUID)
 * - userId: Clerk user ID who uploaded the file
 * - fileName: Original filename
 * - fileUrl: Public URL from Supabase Storage
 * - fileSize: File size in bytes
 * - uploadStatus: Current status (uploaded, processing, analyzed, error)
 * - accessibilityScore: Score from accessibility analysis (0-100)
 * - createdAt: When the file was uploaded
 * - updatedAt: When the record was last updated
 */
export const pdfs = pgTable('pdfs', {
  // Primary key - auto-generated UUID
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  
  // User who uploaded the file (from Clerk)
  userId: text('user_id')
    .notNull(),
  
  // Original filename
  fileName: text('file_name')
    .notNull(),
  
  // Public URL from Supabase Storage
  fileUrl: text('file_url')
    .notNull(),
  
  // File size in bytes
  fileSize: integer('file_size')
    .notNull(),
  
  // Upload/processing status
  // Possible values: 'uploaded', 'processing', 'analyzed', 'error'
  uploadStatus: varchar('upload_status', { length: 50 })
    .notNull()
    .default('uploaded'),
  
  // Accessibility score (0-100) - null until analyzed
  accessibilityScore: integer('accessibility_score'),
  
  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ==========================================
// TYPESCRIPT TYPES
// ==========================================
/**
 * Type for inserting a new PDF record
 * All fields except auto-generated ones (id, timestamps)
 */
export type NewPdf = typeof pdfs.$inferInsert;

/**
 * Type for a complete PDF record from the database
 * Includes all fields with their actual types
 */
export type Pdf = typeof pdfs.$inferSelect;

/**
 * Type for updating an existing PDF record
 * All fields are optional except id
 */
export type UpdatePdf = Partial<NewPdf> & { id: string };

// ==========================================
// HELPER TYPE DEFINITIONS
// ==========================================
/**
 * Upload status enum for type safety
 */
export type UploadStatus = 'uploaded' | 'processing' | 'analyzed' | 'error';

/**
 * Type for PDF metadata returned to frontend
 */
export interface PdfMetadata {
  id: string;
  userId: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  uploadStatus: UploadStatus;
  accessibilityScore: number | null;
  createdAt: Date;
  updatedAt: Date;
}

// ==========================================
// EXAMPLE QUERIES (for reference)
// ==========================================
/**
 * Example: Insert a new PDF record
 * 
 * await db.insert(pdfs).values({
 *   userId: 'user_abc123',
 *   fileName: 'document.pdf',
 *   fileUrl: 'https://supabase.co/storage/...',
 *   fileSize: 1024000,
 * });
 */

/**
 * Example: Get all PDFs for a user
 * 
 * const userPdfs = await db
 *   .select()
 *   .from(pdfs)
 *   .where(eq(pdfs.userId, userId))
 *   .orderBy(desc(pdfs.createdAt));
 */

/**
 * Example: Update accessibility score
 * 
 * await db
 *   .update(pdfs)
 *   .set({ 
 *     accessibilityScore: 85,
 *     uploadStatus: 'analyzed',
 *     updatedAt: new Date()
 *   })
 *   .where(eq(pdfs.id, pdfId));
 */

/**
 * Example: Delete a PDF record
 * 
 * await db
 *   .delete(pdfs)
 *   .where(eq(pdfs.id, pdfId));
 */
