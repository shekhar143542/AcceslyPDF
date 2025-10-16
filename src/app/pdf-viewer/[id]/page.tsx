'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Download, ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from 'lucide-react';
import AIAssistant from '@/components/AIAssistant';
import PDFViewer from '@/components/PDFViewer';

export default function PDFViewerPage() {
  const params = useParams();
  const router = useRouter();
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [documentName, setDocumentName] = useState('Loading...');
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch PDF metadata from API
  useEffect(() => {
    const fetchPDFData = async () => {
      try {
        const pdfId = params.id as string;
        console.log('📄 Fetching PDF data for ID:', pdfId);

        const response = await fetch(`/api/pdf/${pdfId}`);
        const result = await response.json();

        if (result.success && result.data) {
          setDocumentName(result.data.fileName);
          setFileUrl(result.data.fileUrl);
          console.log('✅ PDF data loaded:', result.data);
        } else {
          console.error('❌ Failed to fetch PDF data:', result.error);
          alert('Failed to load PDF. Please try again.');
          router.push('/dashboard');
        }
      } catch (error) {
        console.error('❌ Error fetching PDF:', error);
        alert('Failed to load PDF. Please try again.');
        router.push('/dashboard');
      } finally {
        setIsLoading(false);
      }
    };

    if (params.id) {
      fetchPDFData();
    }

    // Listen for PDF update events
    const handlePDFUpdate = (event: CustomEvent) => {
      const { pdfId: updatedPdfId, timestamp } = event.detail;
      console.log('🔄 PDF updated event received:', updatedPdfId, 'at', timestamp);
      
      // If this is the same PDF, refetch the data
      if (updatedPdfId === params.id) {
        console.log('🔄 Reloading PDF data with cache-busting...');
        setIsLoading(true);
        
        // Add small delay to ensure Supabase has updated the file
        setTimeout(async () => {
          try {
            const response = await fetch(`/api/pdf/${params.id}`);
            const result = await response.json();

            if (result.success && result.data) {
              // Add cache-busting parameter to force reload
              const newFileUrl = `${result.data.fileUrl}?t=${timestamp}`;
              setFileUrl(newFileUrl);
              setDocumentName(result.data.fileName);
              console.log('✅ PDF data reloaded:', result.data.fileName);
            }
          } catch (error) {
            console.error('❌ Error reloading PDF:', error);
          } finally {
            setIsLoading(false);
          }
        }, 1000); // Wait 1 second for Supabase to update
      }
    };

    window.addEventListener('pdfUpdated', handlePDFUpdate as EventListener);

    return () => {
      window.removeEventListener('pdfUpdated', handlePDFUpdate as EventListener);
    };
  }, [params.id, router]);

  const handleZoomIn = () => {
    if (zoom < 200) setZoom(prev => Math.min(prev + 25, 200));
  };

  const handleZoomOut = () => {
    if (zoom > 25) setZoom(prev => Math.max(prev - 25, 25));
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
      // TODO: Scroll to page
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(prev => prev + 1);
      // TODO: Scroll to page
    }
  };

  const handleDownload = async () => {
    if (!fileUrl || !documentName) {
      alert('PDF not loaded yet. Please wait...');
      return;
    }

    try {
      console.log('📥 Downloading PDF:', documentName);
      console.log('📄 File URL:', fileUrl);

      // Fetch the PDF file
      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch PDF: ${response.status}`);
      }

      // Get the blob
      const blob = await response.blob();
      console.log('✅ PDF blob downloaded, size:', blob.size);

      // Create a temporary download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = documentName; // Use the actual filename
      
      // Append to body, click, and remove
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up the URL object
      window.URL.revokeObjectURL(url);

      console.log('✅ Download initiated:', documentName);
    } catch (error) {
      console.error('❌ Download failed:', error);
      alert('Failed to download PDF. Please try again.');
    }
  };

  const handlePageChange = (page: number, total: number) => {
    setCurrentPage(page);
    setTotalPages(total);
  };

  const handleLoadSuccess = (total: number) => {
    setTotalPages(total);
    console.log(`✅ PDF loaded with ${total} pages`);
  };

  const handleLoadError = (error: Error) => {
    console.error('❌ PDF load error:', error);
    alert(`Failed to load PDF: ${error.message}`);
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
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              {totalPages > 0 ? `Page ${currentPage} of ${totalPages}` : 'Loading...'}
            </p>
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
          <button 
            onClick={handleDownload}
            disabled={!fileUrl}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-5 h-5" />
            <span className="font-medium">Download</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* PDF Viewer Section */}
        <div className="flex-1 overflow-auto bg-gray-100 dark:bg-slate-900 p-6 transition-colors duration-300">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <svg 
                  className="w-16 h-16 mb-4 text-blue-600 dark:text-blue-400 animate-spin mx-auto" 
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
          ) : fileUrl ? (
            <PDFViewer
              fileUrl={fileUrl}
              zoom={zoom}
              onPageChange={handlePageChange}
              onLoadSuccess={handleLoadSuccess}
              onLoadError={handleLoadError}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
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
                <p className="text-red-600 dark:text-red-400">Failed to load PDF</p>
              </div>
            </div>
          )}
        </div>

        {/* AI Assistant Panel */}
        <AIAssistant documentName={documentName} pdfId={params.id as string} />
      </div>
    </div>
  );
}
