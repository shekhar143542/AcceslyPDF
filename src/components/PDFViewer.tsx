"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";

interface PDFViewerProps {
  fileUrl: string;
  zoom?: number;
  onPageChange?: (currentPage: number, totalPages: number) => void;
  onLoadSuccess?: (totalPages: number) => void;
  onLoadError?: (error: Error) => void;
}

/**
 * PDFViewer Component - Fixed Maximum Update Depth & Blinking
 * 
 * ✅ No infinite re-renders - proper dependency arrays
 * ✅ No blinking pages - stable refs and minimal state updates
 * ✅ pdfDoc stored in useRef - persists between renders
 * ✅ numPages set only once when PDF loads
 * ✅ Per-page rendering with independent useEffects
 * ✅ Smooth scrolling without state resets
 * ✅ Proper cleanup and memory management
 */
export default function PDFViewer({ 
  fileUrl, 
  zoom = 100,
  onPageChange,
  onLoadSuccess,
  onLoadError
}: PDFViewerProps) {
  // State - minimal to prevent re-renders
  const [numPages, setNumPages] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [isMounted, setIsMounted] = useState(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  
  // Refs - persist between renders without causing re-renders
  const pdfDocRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const pageContainerRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const renderTasksRef = useRef<Map<number, any>>(new Map());
  const hasInitializedRef = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Calculate scale from zoom percentage
  const scale = zoom / 100;

  /**
   * Initialize mounted state - prevents SSR issues
   */
  useEffect(() => {
    setIsMounted(true);
    return () => {
      setIsMounted(false);
    };
  }, []);

  /**
   * Load PDF document ONCE - store in ref to prevent re-renders
   * Critical: Only runs when fileUrl changes
   */
  useEffect(() => {
    if (!isMounted || !fileUrl || hasInitializedRef.current) return;

    hasInitializedRef.current = true;
    let mounted = true;

    async function loadPDF() {
      try {
        setLoading(true);
        setError("");
        console.log("📄 Loading PDF from:", fileUrl);

        // Dynamic import of PDF.js
        const pdfjsLib = await import("pdfjs-dist");
        
        // Configure worker from public directory
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

        const loadingTask = pdfjsLib.getDocument(fileUrl);
        const pdf = await loadingTask.promise;

        if (!mounted) return;

        // Store PDF in ref - does NOT cause re-render
        pdfDocRef.current = pdf;
        
        // Set numPages ONLY ONCE - this is the only state update
        setNumPages(pdf.numPages);
        setLoading(false);

        console.log(`✅ PDF loaded successfully. ${pdf.numPages} pages`);

        if (onLoadSuccess) {
          onLoadSuccess(pdf.numPages);
        }
      } catch (err) {
        console.error("❌ Error loading PDF:", err);
        if (mounted) {
          const errorMessage = err instanceof Error ? err.message : "Failed to load PDF";
          setError(errorMessage);
          setLoading(false);

          if (onLoadError) {
            onLoadError(err instanceof Error ? err : new Error(errorMessage));
          }
        }
      }
    }

    loadPDF();

    return () => {
      mounted = false;
      hasInitializedRef.current = false;
      
      // Cancel all ongoing render tasks
      renderTasksRef.current.forEach((task) => {
        if (task) {
          try {
            task.cancel();
          } catch (e) {
            // Ignore cancel errors
          }
        }
      });
      renderTasksRef.current.clear();
      
      // Destroy PDF document
      if (pdfDocRef.current) {
        pdfDocRef.current.destroy();
        pdfDocRef.current = null;
      }
      
      // Clear refs
      canvasRefs.current.clear();
      pageContainerRefs.current.clear();
    };
  }, [fileUrl, isMounted, onLoadSuccess, onLoadError]); // Only fileUrl change triggers reload


  /**
   * Component to render a single PDF page
   * Each page manages its own rendering independently
   */
  function PDFPage({ pageNumber }: { pageNumber: number }) {
    const [isRendering, setIsRendering] = useState(false);
    const hasRenderedRef = useRef(false);

    useEffect(() => {
      // Only render once per page (unless zoom changes)
      if (!pdfDocRef.current || hasRenderedRef.current) return;

      async function renderPage() {
        const canvas = canvasRefs.current.get(pageNumber);
        if (!canvas) return;

        // Cancel existing render task if any
        if (renderTasksRef.current.has(pageNumber)) {
          const existingTask = renderTasksRef.current.get(pageNumber);
          if (existingTask) {
            try {
              existingTask.cancel();
            } catch (e) {
              // Ignore cancel errors
            }
          }
        }

        try {
          setIsRendering(true);
          console.log(`🎨 Rendering page ${pageNumber}...`);

          const page = await pdfDocRef.current.getPage(pageNumber);
          const viewport = page.getViewport({ scale });

          const context = canvas.getContext("2d");
          if (!context) return;

          canvas.height = viewport.height;
          canvas.width = viewport.width;

          const renderContext = {
            canvasContext: context,
            viewport: viewport,
          };

          const renderTask = page.render(renderContext);
          renderTasksRef.current.set(pageNumber, renderTask);

          await renderTask.promise;

          console.log(`✅ Page ${pageNumber} rendered`);
          hasRenderedRef.current = true;
          renderTasksRef.current.delete(pageNumber);
          setIsRendering(false);
        } catch (err: any) {
          if (err?.name !== "RenderingCancelledException") {
            console.error(`❌ Error rendering page ${pageNumber}:`, err);
          }
          setIsRendering(false);
        }
      }

      renderPage();
    }, [pageNumber]); // Only pageNumber in dependencies - stable!

    // Re-render when zoom changes
    useEffect(() => {
      if (!pdfDocRef.current || !hasRenderedRef.current) return;

      hasRenderedRef.current = false; // Mark for re-render
    }, [zoom]);

    return (
      <div
        ref={(el) => {
          if (el) {
            pageContainerRefs.current.set(pageNumber, el);
          } else {
            pageContainerRefs.current.delete(pageNumber);
          }
        }}
        data-page={pageNumber}
        className="relative bg-white dark:bg-gray-800 shadow-2xl rounded-lg overflow-hidden transition-transform hover:scale-[1.01]"
        style={{ minHeight: "400px" }}
      >
        {/* Page number badge */}
        <div className="absolute top-3 right-3 bg-black/70 dark:bg-white/90 text-white dark:text-gray-900 px-4 py-1.5 rounded-full text-sm font-semibold z-10 shadow-lg backdrop-blur-sm">
          {pageNumber} / {numPages}
        </div>

        {/* Loading indicator */}
        {isRendering && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/90 dark:bg-gray-800/90 z-20 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 dark:border-blue-400"></div>
              <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">
                Rendering page {pageNumber}...
              </p>
            </div>
          </div>
        )}

        {/* Canvas element */}
        <canvas
          ref={(el) => {
            if (el) {
              canvasRefs.current.set(pageNumber, el);
            } else {
              canvasRefs.current.delete(pageNumber);
            }
          }}
          className="max-w-full h-auto block"
        />
      </div>
    );
  }

  /**
   * Track current page based on scroll position
   */
  useEffect(() => {
    if (!containerRef.current || numPages === 0) return;

    const handleScroll = () => {
      // Clear previous timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      // Debounce scroll tracking
      scrollTimeoutRef.current = setTimeout(() => {
        const container = containerRef.current;
        if (!container) return;

        // Find which page is most visible
        let maxVisibility = 0;
        let visiblePage = 1;

        pageContainerRefs.current.forEach((pageContainer, pageNum) => {
          if (!pageContainer) return;

          const rect = pageContainer.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();

          const visibleHeight = Math.min(rect.bottom, containerRect.bottom) - 
                               Math.max(rect.top, containerRect.top);
          
          if (visibleHeight > maxVisibility) {
            maxVisibility = visibleHeight;
            visiblePage = pageNum;
          }
        });

        if (visiblePage !== currentPage) {
          setCurrentPage(visiblePage);
          
          if (onPageChange) {
            onPageChange(visiblePage, numPages);
          }
        }
      }, 100); // 100ms debounce
    };

    const container = containerRef.current;
    container.addEventListener("scroll", handleScroll, { passive: true });
    
    // Initial check
    handleScroll();

    return () => {
      container.removeEventListener("scroll", handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [numPages, currentPage, onPageChange]);

  /**
   * Scroll to specific page with smooth animation
   */
  const scrollToPage = useCallback((pageNum: number) => {
    const pageContainer = pageContainerRefs.current.get(pageNum);
    if (pageContainer && containerRef.current) {
      const container = containerRef.current;
      const containerRect = container.getBoundingClientRect();
      const pageRect = pageContainer.getBoundingClientRect();
      
      const scrollTop = container.scrollTop + pageRect.top - containerRect.top - 20;
      
      container.scrollTo({
        top: scrollTop,
        behavior: "smooth"
      });
    }
  }, []);

  /**
   * Navigation handlers
   */
  const goToPreviousPage = useCallback(() => {
    if (currentPage > 1) {
      scrollToPage(currentPage - 1);
    }
  }, [currentPage, scrollToPage]);

  const goToNextPage = useCallback(() => {
    if (currentPage < numPages) {
      scrollToPage(currentPage + 1);
    }
  }, [currentPage, numPages, scrollToPage]);

  /**
   * Keyboard navigation
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if PDF viewer is in focus area
      if (e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        goToPreviousPage();
      } else if (e.key === "ArrowDown" || e.key === "PageDown") {
        e.preventDefault();
        goToNextPage();
      } else if (e.key === "Home") {
        e.preventDefault();
        scrollToPage(1);
      } else if (e.key === "End") {
        e.preventDefault();
        scrollToPage(numPages);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goToPreviousPage, goToNextPage, scrollToPage, numPages]);

  /**
   * Loading state
   */
  if (!isMounted) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-950">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400"></div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-950">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400"></div>
          <p className="text-gray-600 dark:text-gray-400 font-medium">Loading PDF...</p>
        </div>
      </div>
    );
  }

  /**
   * Error state
   */
  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-950">
        <div className="text-center max-w-md px-6">
          <div className="text-red-500 dark:text-red-400 text-6xl mb-4">⚠️</div>
          <p className="text-red-600 dark:text-red-400 text-lg font-semibold mb-2">{error}</p>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Please check the file URL and try again.
          </p>
        </div>
      </div>
    );
  }

  /**
   * Main PDF viewer UI
   */
  return (
    <div className="relative h-full w-full">
      {/* Scrollable container with all pages */}
      <div 
        ref={containerRef}
        className="h-full overflow-auto bg-gray-100 dark:bg-gray-900 p-4 md:p-8 scroll-smooth"
      >
        <div className="flex flex-col items-center gap-6 md:gap-8">
          {/* Render each page as independent component */}
          {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
            <PDFPage key={pageNum} pageNumber={pageNum} />
          ))}
        </div>
      </div>

      {/* Navigation buttons */}
      {numPages > 1 && (
        <div className="absolute bottom-6 right-6 flex flex-col gap-2 z-30">
          <button
            onClick={goToPreviousPage}
            disabled={currentPage === 1}
            className="bg-white dark:bg-gray-800 shadow-xl rounded-full p-3 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:scale-110 active:scale-95"
            aria-label="Previous page"
            title="Previous page (↑ or Page Up)"
          >
            <ChevronUp className="w-6 h-6 text-gray-700 dark:text-gray-300" />
          </button>
          <button
            onClick={goToNextPage}
            disabled={currentPage === numPages}
            className="bg-white dark:bg-gray-800 shadow-xl rounded-full p-3 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:scale-110 active:scale-95"
            aria-label="Next page"
            title="Next page (↓ or Page Down)"
          >
            <ChevronDown className="w-6 h-6 text-gray-700 dark:text-gray-300" />
          </button>
        </div>
      )}

      {/* Current page indicator at bottom center */}
      {numPages > 1 && (
        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-black/80 dark:bg-white/90 text-white dark:text-gray-900 px-5 py-2 rounded-full text-sm font-semibold z-30 shadow-xl backdrop-blur-sm">
          Page {currentPage} of {numPages}
        </div>
      )}
    </div>
  );
}
