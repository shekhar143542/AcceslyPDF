'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Download, ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from 'lucide-react';
import AIAssistant from '@/components/AIAssistant';

export default function PDFViewerPage() {
  const params = useParams();
  const router = useRouter();
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(50);
  const totalPages = 5;
  const documentName = 'Annual Report 2024.pdf';

  const handleZoomIn = () => {
    if (zoom < 200) setZoom(prev => Math.min(prev + 25, 200));
  };

  const handleZoomOut = () => {
    if (zoom > 25) setZoom(prev => Math.max(prev - 25, 25));
  };

  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage(prev => prev - 1);
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(prev => prev + 1);
  };

  return (
    <div className="h-screen bg-gray-50 dark:bg-slate-900 flex flex-col overflow-hidden transition-colors duration-300">
      {/* Top Navigation Bar */}
      <div className="bg-white dark:bg-slate-950 border-b border-gray-200 dark:border-slate-950 px-6 py-4 flex items-center justify-between shadow-sm transition-colors duration-300">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back</span>
          </button>
          <div className="h-6 w-px bg-gray-300 dark:bg-slate-700" />
          <div>
            <h1 className="text-gray-900 dark:text-white font-semibold text-lg">{documentName}</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">Page {currentPage} of {totalPages}</p>
          </div>
        </div>

        {/* Zoom and Page Controls */}
        <div className="flex items-center gap-4">
          {/* Page Navigation */}
          <div className="flex items-center gap-2 bg-gray-100 dark:bg-slate-900 rounded-lg px-3 py-2 border border-gray-200 dark:border-slate-800 transition-colors duration-300">
            <button
              onClick={handlePrevPage}
              disabled={currentPage === 1}
              className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-gray-900 dark:text-white text-sm min-w-[60px] text-center font-medium">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
              className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center gap-2 bg-gray-100 dark:bg-slate-900 rounded-lg px-3 py-2 border border-gray-200 dark:border-slate-800 transition-colors duration-300">
            <button
              onClick={handleZoomOut}
              disabled={zoom <= 25}
              className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ZoomOut className="w-5 h-5" />
            </button>
            <span className="text-gray-900 dark:text-white text-sm font-medium min-w-[50px] text-center">
              {zoom}%
            </span>
            <button
              onClick={handleZoomIn}
              disabled={zoom >= 200}
              className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ZoomIn className="w-5 h-5" />
            </button>
          </div>

          {/* Download Button */}
          <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors shadow-sm">
            <Download className="w-5 h-5" />
            <span className="font-medium">Download</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* PDF Viewer Section */}
        <div className="flex-1 overflow-auto bg-gray-100 dark:bg-slate-900 p-6 transition-colors duration-300">
          <div className="flex justify-center">
            <div 
              className="bg-white dark:bg-slate-900 shadow-2xl rounded-lg overflow-hidden border border-gray-200 dark:border-slate-800 transition-colors duration-300"
              style={{ 
                width: `${zoom}%`,
                minWidth: '400px',
                maxWidth: '1200px'
              }}
            >
              {/* PDF Preview Placeholder */}
              <div className="aspect-[8.5/11] flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 border-2 border-dashed border-gray-300 dark:border-slate-800 bg-gray-50 dark:bg-slate-900 transition-colors duration-300">
                <svg 
                  className="w-24 h-24 mb-4 text-gray-300" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={1.5} 
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" 
                  />
                </svg>
                <h3 className="text-xl font-medium text-gray-600 mb-2">PDF Preview</h3>
                <p className="text-sm text-gray-500">In production, PDF.js will render the actual document here</p>
              </div>
            </div>
          </div>
        </div>

        {/* AI Assistant Panel */}
        <AIAssistant documentName={documentName} />
      </div>
    </div>
  );
}
