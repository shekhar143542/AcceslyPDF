'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, Download, Trash2, FileText } from 'lucide-react';
import { toast } from 'sonner';
import DeleteConfirmDialog from './DeleteConfirmDialog';

interface PDFDocument {
  id: string;
  filename: string;
  uploadedAt: string;
  score: number;
  status: 'excellent' | 'good' | 'needs-work';
  size: string;
}

interface PDFCardProps {
  document: PDFDocument;
  onDelete?: (id: string) => void; // Callback when PDF is deleted
}

export default function PDFCard({ document, onDelete }: PDFCardProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  
  // Get badge styling based on score
  const getBadgeStyle = (score: number) => {
    if (score >= 90) return 'bg-green-600 text-white';
    if (score >= 70) return 'bg-orange-500 text-white';
    return 'bg-red-600 text-white';
  };

  const getBadgeLabel = (score: number) => {
    if (score >= 90) return '92% Accessible';
    if (score >= 85) return '85% Accessible';
    if (score >= 70) return '78% Accessible';
    return '68% Accessible';
  };

  const handleView = () => {
    router.push(`/pdf-viewer/${document.id}`);
  };

  const handleDownload = () => {
    console.log('Download:', document.filename);
    // Implement download logic
  };

  /**
   * Show delete confirmation dialog
   */
  const handleDeleteClick = () => {
    setShowDeleteDialog(true);
  };

  /**
   * Handle confirmed deletion
   * Steps:
   * 1. Show loading state
   * 2. Call DELETE API with PDF ID
   * 3. API verifies user authorization via Clerk
   * 4. API deletes file from Supabase Storage
   * 5. API deletes metadata from Neon DB
   * 6. Update UI by calling parent's onDelete callback
   * 7. Show success toast
   */
  const handleConfirmDelete = async () => {
    setShowDeleteDialog(false);
    
    try {
      setIsDeleting(true);
      console.log('🗑️ Deleting PDF:', document.filename);

      // Show loading toast
      const loadingToast = toast.loading('Deleting PDF...');

      // Call delete API endpoint
      // API will:
      // - Verify user authentication with Clerk
      // - Check user owns this PDF
      // - Delete file from Supabase Storage bucket
      // - Delete metadata record from Neon DB
      const response = await fetch(`/api/pdf/${document.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      // Dismiss loading toast
      toast.dismiss(loadingToast);

      // Handle error responses
      if (!response.ok || !result.success) {
        // Handle specific error cases
        if (response.status === 401) {
          toast.error('Unauthorized', {
            description: 'Please sign in to delete PDFs',
          });
        } else if (response.status === 404) {
          toast.error('PDF not found', {
            description: 'This PDF may have already been deleted',
          });
        } else {
          toast.error('Failed to delete PDF', {
            description: result.error || 'An unexpected error occurred',
          });
        }
        throw new Error(result.error || 'Delete failed');
      }

      console.log('✅ PDF deleted successfully:', document.filename);

      // Show success toast
      toast.success('PDF deleted successfully', {
        description: `"${document.filename}" has been removed`,
      });

      // Call parent's onDelete callback to update UI
      // This will remove the card from the dashboard without page reload
      if (onDelete) {
        onDelete(document.id);
      }

    } catch (error) {
      console.error('❌ Delete error:', error);
      
      // Only show error toast if we haven't already shown one
      if (error instanceof Error && !error.message.includes('Failed to delete')) {
        toast.error('Failed to delete PDF', {
          description: error.message || 'An unexpected error occurred. Please try again.',
        });
      }
    } finally {
      setIsDeleting(false);
    }
  };

  /**
   * Handle dialog cancel
   */
  const handleCancelDelete = () => {
    setShowDeleteDialog(false);
  };

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden hover:border-blue-600 transition-colors shadow-sm">
      {/* Card Header */}
      <div className="p-5">
        {/* File Icon and Name */}
        <div className="flex items-start space-x-3 mb-3">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white truncate mb-1">
              {document.filename}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">{document.uploadedAt}</p>
          </div>
        </div>

        {/* File Size and Badge */}
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">{document.size}</span>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getBadgeStyle(document.score)}`}>
            {getBadgeLabel(document.score)}
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 px-5 py-3 flex items-center justify-between">
        <button
          onClick={handleView}
          className="flex items-center space-x-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors cursor-pointer"
          title="View"
        >
          <Eye className="w-4 h-4" />
          <span className="text-sm font-medium">View</span>
        </button>

        <button
          onClick={handleDownload}
          className="flex items-center space-x-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors cursor-pointer"
          title="Download"
        >
          <Download className="w-4 h-4" />
        </button>

        <button
          onClick={handleDeleteClick}
          disabled={isDeleting}
          className={`flex items-center space-x-1 transition-colors cursor-pointer ${
            isDeleting
              ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
              : 'text-gray-600 dark:text-gray-400 hover:text-red-500'
          }`}
          title={isDeleting ? 'Deleting...' : 'Delete'}
        >
          {isDeleting ? (
            <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          ) : (
            <Trash2 className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        isOpen={showDeleteDialog}
        fileName={document.filename}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </div>
  );
}
