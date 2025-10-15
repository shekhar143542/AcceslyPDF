'use client';

import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Header from "@/components/Header";
import { FileText, TrendingUp, CheckCircle } from "lucide-react";
import PDFCard from "@/components/PDFCard";

// Sample data matching the image
const sampleDocuments = [
  {
    id: "1",
    filename: "Annual Report 2024.pdf",
    uploadedAt: "about 2 hours ago",
    score: 85,
    status: "good" as const,
    size: "2.4 MB"
  },
  {
    id: "2", 
    filename: "Product Catalog.pdf",
    uploadedAt: "1 day ago",
    score: 92,
    status: "excellent" as const,
    size: "5.1 MB"
  },
  {
    id: "3",
    filename: "User Manual v3.pdf", 
    uploadedAt: "2 days ago",
    score: 68,
    status: "good" as const,
    size: "1.8 MB"
  },
  {
    id: "4",
    filename: "Marketing Brochure.pdf",
    uploadedAt: "3 days ago", 
    score: 78,
    status: "good" as const,
    size: "3.2 MB"
  }
];

export default function DashboardPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push("/");
    }
  }, [isLoaded, isSignedIn, router]);

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

  // Calculate stats
  const totalPDFs = sampleDocuments.length;
  const avgAccessibility = Math.round(
    sampleDocuments.reduce((sum, doc) => sum + doc.score, 0) / sampleDocuments.length
  );
  const fullyCompliant = sampleDocuments.filter(doc => doc.score >= 90).length;
  
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      <Header />
      
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

          {/* PDF Documents Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {sampleDocuments.map((document) => (
              <PDFCard key={document.id} document={document} />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}


