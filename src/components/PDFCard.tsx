'use client';

import { useRouter } from 'next/navigation';
import { Eye, Download, Trash2, FileText } from 'lucide-react';

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
}

export default function PDFCard({ document }: PDFCardProps) {
  const router = useRouter();
  
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

  const handleDelete = () => {
    console.log('Delete:', document.filename);
    // Implement delete logic
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
          onClick={handleDelete}
          className="flex items-center space-x-1 text-gray-600 dark:text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
          title="Delete"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
