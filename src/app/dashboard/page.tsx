'use client';

import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Header from "@/components/Header";
import { FileText, TrendingUp, CheckCircle } from "lucide-react";
import PDFCard from "@/components/PDFCard";

// Type for PDF document from API
type PDFDocument = {
  id: string;
  userId: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  uploadStatus: string;
  accessibilityScore: number | null;
  createdAt: string;
  updatedAt: string;
};

export default function DashboardPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();
  const [documents, setDocuments] = useState<PDFDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refetchTrigger, setRefetchTrigger] = useState(0); // Trigger for refetch

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push("/");
    }
  }, [isLoaded, isSignedIn, router]);

  // Listen for score updates from other tabs/windows
  useEffect(() => {
    const handleScoreUpdate = () => {
      console.log('🔔 Score update detected, refetching PDFs...');
      handleRefetch();
    };

    // Listen for custom event
    window.addEventListener('pdfScoreUpdated', handleScoreUpdate);

    // Also listen for window focus to catch updates from other tabs
    const handleFocus = () => {
      const lastUpdate = localStorage.getItem('pdfScoreUpdated');
      if (lastUpdate) {
        const timeSinceUpdate = Date.now() - parseInt(lastUpdate);
        // Refetch if update was in last 30 seconds
        if (timeSinceUpdate < 30000) {
          console.log('🔔 Recent score update detected on focus, refetching...');
          handleRefetch();
        }
      }
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('pdfScoreUpdated', handleScoreUpdate);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // Fetch PDFs from API
  useEffect(() => {
    const fetchPDFs = async () => {
      if (!isSignedIn) return;

      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch('/api/upload', {
          cache: 'no-store', // Don't cache the response
        });
        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Failed to fetch PDFs');
        }

        console.log('📊 Fetched PDFs:', result.data);
        setDocuments(result.data || []);
      } catch (err) {
        console.error('❌ Error fetching PDFs:', err);
        setError(err instanceof Error ? err.message : 'Failed to load PDFs');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPDFs();

    // Set up periodic refresh every 30 seconds to catch any updates
    const intervalId = setInterval(() => {
      if (isSignedIn && !isLoading) {
        console.log('🔄 Auto-refreshing PDF list...');
        fetchPDFs();
      }
    }, 30000);

    return () => clearInterval(intervalId);
  }, [isSignedIn, refetchTrigger]); // Re-fetch when refetchTrigger changes

  // Function to trigger refetch
  const handleRefetch = () => {
    console.log('🔄 Refetching PDFs...');
    setRefetchTrigger(prev => prev + 1);
  };

  // Function to handle PDF deletion
  const handleDeletePDF = (id: string) => {
    console.log('🗑️ PDF deleted, refreshing list...');
    // Trigger refetch to update the list
    handleRefetch();
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-lg text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!isSignedIn) {
    return null;
  }

  // Format documents for PDFCard component
  const formattedDocuments = documents.map(doc => {
    const uploadDate = new Date(doc.createdAt);
    const now = new Date();
    const diffMs = now.getTime() - uploadDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    let timeAgo = '';
    if (diffMins < 1) timeAgo = 'just now';
    else if (diffMins < 60) timeAgo = `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    else if (diffHours < 24) timeAgo = `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    else timeAgo = `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    
    return {
      id: doc.id,
      filename: doc.fileName,
      uploadedAt: timeAgo,
      score: doc.accessibilityScore || 0,
      status: (doc.accessibilityScore || 0) >= 90 ? 'excellent' as const : 'good' as const,
      size: `${(doc.fileSize / 1024 / 1024).toFixed(2)} MB`
    };
  });

  // Calculate stats
  const totalPDFs = documents.length;
  const avgAccessibility = totalPDFs > 0
    ? Math.round(
        documents.reduce((sum, doc) => sum + (doc.accessibilityScore || 0), 0) / totalPDFs
      )
    : 0;
  const fullyCompliant = documents.filter(doc => (doc.accessibilityScore || 0) >= 90).length;
  
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      <Header onUploadSuccess={handleRefetch} />
      
      {/* Main Content */}
      <main className="pt-24 px-6 pb-8">
        <div className="max-w-7xl mx-auto">
          {/* Page Title */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Your PDF Documents
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              Manage and monitor your PDF accessibility compliance
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* Total PDFs */}
            <div className="bg-white dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <span className="text-gray-600 dark:text-gray-400 text-sm font-medium">Total PDFs</span>
                <FileText className="w-8 h-8 text-blue-500" />
              </div>
              <div className="text-4xl font-bold text-gray-900 dark:text-white">{totalPDFs}</div>
            </div>

            {/* Avg. Accessibility */}
            <div className="bg-white dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <span className="text-gray-600 dark:text-gray-400 text-sm font-medium">Avg. Accessibility</span>
                <TrendingUp className="w-8 h-8 text-green-500" />
              </div>
              <div className="text-4xl font-bold text-gray-900 dark:text-white">{avgAccessibility}%</div>
            </div>

            {/* Fully Compliant */}
            <div className="bg-white dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <span className="text-gray-600 dark:text-gray-400 text-sm font-medium">Fully Compliant</span>
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
              <div className="text-4xl font-bold text-gray-900 dark:text-white">{fullyCompliant}</div>
            </div>
          </div>

          {/* Recent Uploads Section */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Recent Uploads</h2>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="text-center py-12">
              <div className="text-lg text-gray-600 dark:text-gray-400">Loading your PDFs...</div>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
              <p className="text-red-600 dark:text-red-400">❌ {error}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !error && documents.length === 0 && (
            <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-12 text-center">
              <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                No PDFs yet
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Upload your first PDF to get started
              </p>
            </div>
          )}

          {/* PDF Documents Grid */}
          {!isLoading && !error && documents.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {formattedDocuments.map((document) => (
                <PDFCard 
                  key={document.id} 
                  document={document}
                  onDelete={handleDeletePDF}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}


