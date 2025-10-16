"use client";

import { useEffect, useState } from "react";

interface PDFViewerProps {
  fileUrl: string;
  zoom?: number;
  onPageChange?: (currentPage: number, totalPages: number) => void;
  onLoadSuccess?: (totalPages: number) => void;
  onLoadError?: (error: Error) => void;
}

/**
 * Simple PDF Viewer using iframe - Most reliable for Next.js 15
 */
export default function PDFViewer({ 
  fileUrl, 
  zoom = 100,
  onLoadSuccess,
  onLoadError
}: PDFViewerProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (fileUrl) {
      console.log("📄 Loading PDF from:", fileUrl);
      setLoading(false);
      
      if (onLoadSuccess) {
        onLoadSuccess(1);
      }
    }
  }, [fileUrl, onLoadSuccess]);

  const handleIframeLoad = () => {
    setLoading(false);
    console.log("✅ PDF loaded successfully");
  };

  const handleIframeError = () => {
    const errorMsg = "Failed to load PDF";
    setError(errorMsg);
    setLoading(false);
    console.error("❌ PDF load error");
    if (onLoadError) {
      onLoadError(new Error(errorMsg));
    }
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-100 dark:bg-slate-900">
        <div className="text-center p-8">
          <svg 
            className="w-16 h-16 mb-4 text-red-500 mx-auto" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
            />
          </svg>
          <p className="text-red-600 dark:text-red-400 font-medium mb-2">{error}</p>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Please try refreshing the page or uploading a different PDF
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-gray-100 dark:bg-slate-900">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-slate-900 z-10">
          <div className="text-center">
            <svg 
              className="w-12 h-12 mb-4 text-blue-600 dark:text-blue-400 animate-spin mx-auto" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
              />
            </svg>
            <p className="text-gray-600 dark:text-gray-400">Loading PDF...</p>
          </div>
        </div>
      )}
      
      <iframe
        src={`https://docs.google.com/viewer?url=${encodeURIComponent(fileUrl)}&embedded=true`}
        className="w-full h-full border-0"
        title="PDF Viewer"
        onLoad={handleIframeLoad}
        onError={handleIframeError}
        style={{
          transform: `scale(${zoom / 100})`,
          transformOrigin: 'top left',
          width: `${100 / (zoom / 100)}%`,
          height: `${100 / (zoom / 100)}%`,
        }}
      />
    </div>
  );
}
