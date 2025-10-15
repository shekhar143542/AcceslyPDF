'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface PDFViewerPaginatedProps {
  fileUrl: string;
  zoom?: number;
  onLoadSuccess?: (totalPages: number) => void;
  onLoadError?: (error: Error) => void;
  onPageChange?: (page: number) => void;
}

/**
 * PDFViewerPaginated Component - Single Page View
 * 
 * Key Differences from Full Viewer:
 * ✅ Renders ONLY one page at a time (much faster)
 * ✅ Next/Previous pagination buttons
 * ✅ No canvas conflicts (single canvas element)
 * ✅ Better performance for large PDFs
 * ✅ Proper render task cancellation
 * 
 * Use Cases:
 * - Dashboard preview (show first page only)
 * - Reading mode with page-by-page navigation
 * - Large PDFs that need better performance
 * - Mobile-friendly single page view
 */
export default function PDFViewerPaginated({ 
  fileUrl, 
  zoom = 100,
  onLoadSuccess,
  onLoadError,
  onPageChange
}: PDFViewerPaginatedProps) {
  // State management
  const [isLoading, setIsLoading] = useState(true);
  const [isRendering, setIsRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [isMounted, setIsMounted] = useState(false);

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfDocRef = useRef<any>(null);
  const pdfjsLibRef = useRef<any>(null);
  const renderTaskRef = useRef<any>(null);
  const isCancelledRef = useRef(false);

  /**
   * Mount check - SSR protection
   */
  useEffect(() => {
    setIsMounted(true);
    return () => {
      setIsMounted(false);
    };
  }, []);

  /**
   * Cancel any ongoing render task
   * Prevents: "Cannot use the same canvas during multiple render() operations"
   */
  const cancelRenderTask = useCallback(() => {
    if (renderTaskRef.current) {
      try {
        renderTaskRef.current.cancel();
        console.log('🛑 Cancelled previous render task');
      } catch (err) {
        console.warn('Failed to cancel render task:', err);
      }
      renderTaskRef.current = null;
    }
  }, []);

  /**
   * Load PDF.js library and PDF document - CLIENT SIDE ONLY
   */
  useEffect(() => {
    if (!isMounted || !fileUrl) return;

    isCancelledRef.current = false;

    const loadPDFJS = async () => {
      try {
        setIsLoading(true);
        setError(null);
        console.log('📦 Loading PDF.js library...');

        // Dynamically import PDF.js - runs only in browser
        const pdfjs = await import('pdfjs-dist');
        pdfjsLibRef.current = pdfjs;

        // Configure worker - use local worker file
        if (typeof window !== 'undefined') {
          pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
          console.log('✅ PDF.js worker configured');
        }

        if (isCancelledRef.current) return;

        console.log('📄 Loading PDF from:', fileUrl);

        // Load the PDF document
        const loadingTask = pdfjs.getDocument(fileUrl);
        const pdf = await loadingTask.promise;

        if (isCancelledRef.current) return;

        pdfDocRef.current = pdf;
        const totalPages = pdf.numPages;
        setNumPages(totalPages);

        console.log(`✅ PDF loaded successfully. Total pages: ${totalPages}`);

        // Notify parent component
        if (onLoadSuccess) {
          onLoadSuccess(totalPages);
        }

        setIsLoading(false);

        // Render first page
        renderPage(1);

      } catch (err) {
        if (isCancelledRef.current) return;

        console.error('❌ Error loading PDF:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to load PDF';
        setError(errorMessage);
        setIsLoading(false);

        if (onLoadError) {
          onLoadError(err instanceof Error ? err : new Error(errorMessage));
        }
      }
    };

    loadPDFJS();

    // Cleanup
    return () => {
      isCancelledRef.current = true;
      cancelRenderTask();
      if (pdfDocRef.current) {
        pdfDocRef.current.destroy();
        pdfDocRef.current = null;
      }
    };
  }, [fileUrl, isMounted, onLoadSuccess, onLoadError, cancelRenderTask]);

  /**
   * Render a specific page
   * Properly cancels any ongoing render before starting new one
   */
  const renderPage = useCallback(async (pageNumber: number) => {
    if (!pdfDocRef.current || !canvasRef.current || !isMounted || isCancelledRef.current) {
      return;
    }

    // Cancel any ongoing render
    cancelRenderTask();

    try {
      setIsRendering(true);
      console.log(`🎨 Rendering page ${pageNumber}...`);

      const page = await pdfDocRef.current.getPage(pageNumber);
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d', { willReadFrequently: false });

      if (!context || isCancelledRef.current) return;

      // Calculate scale based on zoom
      const viewport = page.getViewport({ scale: 1 });
      const containerWidth = canvas.parentElement?.clientWidth || 800;
      
      // Scale to fit container width, then apply zoom
      const baseScale = (containerWidth * 0.9) / viewport.width;
      const scale = baseScale * (zoom / 100);
      
      const scaledViewport = page.getViewport({ scale });

      // Set canvas dimensions
      canvas.width = scaledViewport.width;
      canvas.height = scaledViewport.height;

      // Render PDF page with cancellable task
      const renderContext = {
        canvasContext: context,
        viewport: scaledViewport,
      };

      const renderTask = page.render(renderContext);
      renderTaskRef.current = renderTask;

      // Wait for render to complete
      await renderTask.promise;

      // Clear the task reference
      renderTaskRef.current = null;

      console.log(`✅ Rendered page ${pageNumber}`);
      setIsRendering(false);

      // Notify parent of page change
      if (onPageChange) {
        onPageChange(pageNumber);
      }

    } catch (err: any) {
      // Ignore cancellation errors (expected when changing pages quickly)
      if (err?.name === 'RenderingCancelledException') {
        console.log(`   Render cancelled for page ${pageNumber} (expected)`);
      } else if (!isCancelledRef.current) {
        console.error(`❌ Error rendering page ${pageNumber}:`, err);
        setError(`Failed to render page ${pageNumber}`);
      }
      setIsRendering(false);
    }
  }, [zoom, isMounted, onPageChange, cancelRenderTask]);

  /**
   * Re-render current page when zoom changes
   */
  useEffect(() => {
    if (pdfDocRef.current && numPages > 0 && isMounted && !isLoading) {
      renderPage(currentPage);
    }
  }, [zoom, currentPage, numPages, isMounted, isLoading, renderPage]);

  /**
   * Navigate to next page
   */
  const goToNextPage = useCallback(() => {
    if (currentPage < numPages) {
      setCurrentPage(prev => prev + 1);
    }
  }, [currentPage, numPages]);

  /**
   * Navigate to previous page
   */
  const goToPreviousPage = useCallback(() => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
    }
  }, [currentPage]);

  /**
   * Go to specific page
   */
  const goToPage = useCallback((page: number) => {
    if (page >= 1 && page <= numPages) {
      setCurrentPage(page);
    }
  }, [numPages]);

  /**
   * SSR Protection
   */
  if (!isMounted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[600px] bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-800 shadow-lg transition-colors duration-300">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
          <p className="text-gray-600 dark:text-gray-400">Initializing PDF viewer...</p>
        </div>
      </div>
    );
  }

  /**
   * Loading State
   */
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[600px] bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-800 shadow-lg transition-colors duration-300">
        <svg 
          className="w-16 h-16 mb-4 text-blue-600 dark:text-blue-400 animate-spin" 
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
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          Loading PDF...
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Please wait while we prepare your document
        </p>
      </div>
    );
  }

  /**
   * Error State
   */
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[600px] bg-white dark:bg-slate-900 rounded-lg border border-red-200 dark:border-red-900 shadow-lg transition-colors duration-300">
        <svg 
          className="w-16 h-16 mb-4 text-red-500" 
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
        <h3 className="text-lg font-medium text-red-600 dark:text-red-400 mb-2">
          Failed to Load PDF
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 text-center max-w-md px-4">
          {error}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
          Please try refreshing the page or contact support
        </p>
      </div>
    );
  }

  /**
   * PDF Viewer - Paginated View
   */
  return (
    <div className="flex flex-col items-center w-full h-full bg-gray-100 dark:bg-slate-900 transition-colors duration-300">
      {/* Canvas Container */}
      <div className="flex-1 w-full flex items-center justify-center p-6 overflow-auto">
        <div className="relative bg-white dark:bg-slate-800 shadow-xl rounded-lg border border-gray-200 dark:border-slate-700 transition-colors duration-300">
          <canvas
            ref={canvasRef}
            className="block max-w-full h-auto rounded-lg"
            style={{
              display: 'block',
            }}
          />
          {isRendering && (
            <div className="absolute inset-0 bg-white/50 dark:bg-slate-900/50 flex items-center justify-center rounded-lg">
              <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 rounded-lg shadow-lg">
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-sm text-gray-700 dark:text-gray-300">Rendering...</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Controls */}
      <div className="w-full bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 px-6 py-4 transition-colors duration-300">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          {/* Previous Button */}
          <button
            onClick={goToPreviousPage}
            disabled={currentPage <= 1}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed disabled:text-gray-500 transition-colors duration-200 shadow-sm"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="font-medium">Previous</span>
          </button>

          {/* Page Indicator */}
          <div className="flex items-center gap-4">
            <div className="text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Page <span className="font-bold text-gray-900 dark:text-white">{currentPage}</span> of <span className="font-bold text-gray-900 dark:text-white">{numPages}</span>
              </p>
            </div>
            
            {/* Page Input (Optional - for quick navigation) */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Go to:</span>
              <input
                type="number"
                min={1}
                max={numPages}
                value={currentPage}
                onChange={(e) => {
                  const page = parseInt(e.target.value);
                  if (!isNaN(page)) {
                    goToPage(page);
                  }
                }}
                className="w-16 px-2 py-1 text-center text-sm border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Next Button */}
          <button
            onClick={goToNextPage}
            disabled={currentPage >= numPages}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed disabled:text-gray-500 transition-colors duration-200 shadow-sm"
          >
            <span className="font-medium">Next</span>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Progress Bar */}
        <div className="mt-4 max-w-4xl mx-auto">
          <div className="h-1 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-600 dark:bg-blue-400 transition-all duration-300"
              style={{ width: `${(currentPage / numPages) * 100}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
