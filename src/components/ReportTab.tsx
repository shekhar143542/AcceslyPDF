'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, Image, Contrast, FileText, Check, RefreshCw, Sparkles, Palette } from 'lucide-react';

interface Issue {
  id: number;
  page: number | null;
  type: string;
  severity: string;
  description: string;
  suggestion: string | null;
  wcagReference: string | null;
  fixed?: boolean;
  fixedAt?: string;
  actuallyFixed?: boolean; // Whether the PDF file was actually modified
  aiGenerated?: boolean; // Whether AI was used to fix
}

interface ReportTabProps {
  pdfId: string;
}

export default function ReportTab({ pdfId }: ReportTabProps) {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState<string>('');
  const [pollCount, setPollCount] = useState(0);
  const [isStartingAnalysis, setIsStartingAnalysis] = useState(false);
  const [fixingIssueId, setFixingIssueId] = useState<number | null>(null);
  const [isGeneratingAltText, setIsGeneratingAltText] = useState(false);
  const [isAnalyzingContrast, setIsAnalyzingContrast] = useState(false);
  const [isFixingAll, setIsFixingAll] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    let pollInterval: NodeJS.Timeout | null = null;

    const fetchStatus = async () => {
      try {
        const res = await fetch(`/api/checker/status?pdfId=${pdfId}`);
        const data = await res.json();
        
        if (!res.ok) {
          setError(data.error || 'Failed to fetch report');
          setLoading(false);
          if (pollInterval) clearInterval(pollInterval);
          return;
        }
        
        setAnalysisStatus(data.status);
        
        if (data.status === 'completed') {
          setIssues(data.issues || []);
          setLoading(false);
          setError(null);
          if (pollInterval) clearInterval(pollInterval);
        } else if (data.status === 'in-progress' || data.status === 'processing' || data.status === 'started') {
          setLoading(true);
          setError(null);
          setPollCount(prev => prev + 1);
        } else if (data.status === 'failed') {
          setError('Analysis failed. Please try again.');
          setLoading(false);
          if (pollInterval) clearInterval(pollInterval);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load report');
        setLoading(false);
        if (pollInterval) clearInterval(pollInterval);
      }
    };

    fetchStatus();
    pollInterval = setInterval(() => {
      if (analysisStatus === 'in-progress' || analysisStatus === 'processing' || analysisStatus === 'started' || analysisStatus === '') {
        fetchStatus();
      }
    }, 5000);

    return () => { if (pollInterval) clearInterval(pollInterval); };
  }, [pdfId, analysisStatus]);

  const startAnalysis = async () => {
    setIsStartingAnalysis(true);
    setError(null);
    
    try {
      const response = await fetch('/api/checker/start-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pdfId }),
      });

      const data = await response.json();

      if (response.ok) {
        setAnalysisStatus('started');
        setLoading(true);
        setError(null);
        // Trigger a status check immediately
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        setError(data.error || 'Failed to start analysis');
      }
    } catch (err) {
      setError('Failed to start analysis. Please try again.');
    } finally {
      setIsStartingAnalysis(false);
    }
  };

  const fixIssue = async (issueId: number, issueType: string) => {
    setFixingIssueId(issueId);
    
    try {
      const response = await fetch('/api/checker/fix-issue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pdfId, issueId, issueType }),
      });

      const data = await response.json();

      if (response.ok) {
        // Update issues list to mark this issue as fixed
        setIssues(data.issues);
        console.log('✅ Issue fixed! New score:', data.newScore);
        
        // Notify dashboard to refetch (trigger update)
        localStorage.setItem('pdfScoreUpdated', Date.now().toString());
        window.dispatchEvent(new Event('pdfScoreUpdated'));
      } else {
        console.error('Failed to fix issue:', data.error);
        alert(`Failed to fix issue: ${data.error}`);
      }
    } catch (err) {
      console.error('Error fixing issue:', err);
      alert('Failed to fix issue. Please try again.');
    } finally {
      setFixingIssueId(null);
    }
  };

  const fixAllIssues = async () => {
    const unfixedIssues = issues.filter(i => !i.fixed);
    
    if (unfixedIssues.length === 0) {
      alert('All issues are already fixed!');
      return;
    }

    if (!confirm(`Fix all ${unfixedIssues.length} issues? This will fix them one by one.`)) {
      return;
    }

    setIsFixingAll(true);
    
    try {
      let fixedCount = 0;
      let failedCount = 0;

      // Fix each issue one by one
      for (const issue of unfixedIssues) {
        try {
          console.log(`🔧 Fixing issue ${fixedCount + 1}/${unfixedIssues.length}:`, issue.type);
          
          const response = await fetch('/api/checker/fix-issue', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              pdfId,
              issueId: issue.id 
            }),
          });

          const data = await response.json();

          if (response.ok) {
            fixedCount++;
            // Update the issue in the list
            setIssues(prevIssues => 
              prevIssues.map(i => 
                i.id === issue.id 
                  ? { ...i, fixed: true } 
                  : i
              )
            );
            console.log(`✅ Fixed issue ${fixedCount}/${unfixedIssues.length}`);
          } else {
            failedCount++;
            console.error(`❌ Failed to fix issue:`, data.error);
          }
        } catch (err) {
          failedCount++;
          console.error(`❌ Error fixing issue:`, err);
        }
      }

      // Final summary
      if (fixedCount === unfixedIssues.length) {
        alert(`✅ Successfully fixed all ${fixedCount} issues!`);
      } else if (fixedCount > 0) {
        alert(`✅ Fixed ${fixedCount} issues\n❌ Failed ${failedCount} issues`);
      } else {
        alert(`❌ Failed to fix any issues. Please try again.`);
      }

      // Notify dashboard to refetch
      localStorage.setItem('pdfScoreUpdated', Date.now().toString());
      window.dispatchEvent(new Event('pdfScoreUpdated'));

    } catch (err) {
      console.error('Error fixing all issues:', err);
      alert('Failed to fix all issues. Please try again.');
    } finally {
      setIsFixingAll(false);
    }
  };

  const forceRefresh = async () => {
    setIsRefreshing(true);
    setError(null);

    try {
      console.log('🔄 Force refreshing data from PREP API...');
      
      const response = await fetch('/api/checker/force-refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pdfId }),
      });

      const data = await response.json();

      if (response.ok) {
        console.log('✅ Data refreshed!', data);
        setIssues(data.issues || []);
        setAnalysisStatus(data.status || 'completed');
        alert(`✅ Refreshed! Found ${data.issues.length} real issues from PREP API`);
        
        // Notify dashboard to refetch
        localStorage.setItem('pdfScoreUpdated', Date.now().toString());
        window.dispatchEvent(new Event('pdfScoreUpdated'));
      } else {
        console.error('❌ Refresh failed:', data);
        alert(`❌ Refresh failed: ${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('❌ Refresh error:', err);
      alert('Failed to refresh. Please try again.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleGenerateAltText = async () => {
    const imageIssues = issues.filter(i => 
      !i.fixed && (i.type?.toLowerCase().includes('alt') || i.type?.toLowerCase().includes('image'))
    );

    if (imageIssues.length === 0) {
      alert('No image issues found to generate alt text for.');
      return;
    }

    const estimatedCost = imageIssues.length * 0.02;
    if (!confirm(`Generate AI alt text for ${imageIssues.length} images?\n\nEstimated cost: $${estimatedCost.toFixed(2)}\n\nNote: Requires OpenAI API key configured in environment.`)) {
      return;
    }

    setIsGeneratingAltText(true);

    try {
      const response = await fetch('/api/ai/generate-alt-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          pdfId,
          autoApply: true 
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Refresh issues by fetching updated status
        const statusRes = await fetch(`/api/checker/status?pdfId=${pdfId}`);
        const statusData = await statusRes.json();
        if (statusRes.ok && statusData.issues) {
          setIssues(statusData.issues);
        }
        
        // Notify dashboard to refetch (trigger update)
        localStorage.setItem('pdfScoreUpdated', Date.now().toString());
        window.dispatchEvent(new Event('pdfScoreUpdated'));
        
        alert(`✅ Generated alt text for ${data.altTexts?.length || 0} images!\n\nActual cost: $${data.cost?.toFixed(2) || '0.00'}\n\nNew accessibility score: ${data.newScore || 'calculating...'}`);
      } else {
        console.error('AI alt text generation failed:', data.error);
        alert(`❌ Failed to generate alt text:\n\n${data.error || 'Unknown error'}\n\nNote: Make sure OPENAI_API_KEY is configured in your .env file.`);
      }
    } catch (err) {
      console.error('Error generating alt text:', err);
      alert('Failed to generate alt text. Please check console for details.');
    } finally {
      setIsGeneratingAltText(false);
    }
  };

  const handleAnalyzeContrast = async () => {
    const contrastIssues = issues.filter(i => 
      !i.fixed && (i.type?.toLowerCase().includes('contrast') || i.type?.toLowerCase().includes('color'))
    );

    if (contrastIssues.length === 0) {
      alert('No color contrast issues found to analyze.');
      return;
    }

    if (!confirm(`Analyze color contrast for ${contrastIssues.length} issues using AI?\n\nThis will check WCAG 2.1 AA/AAA compliance and suggest fixes.`)) {
      return;
    }

    setIsAnalyzingContrast(true);

    try {
      const response = await fetch('/api/ai/analyze-contrast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          pdfId,
          autoFix: true 
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Refresh issues by fetching updated status
        const statusRes = await fetch(`/api/checker/status?pdfId=${pdfId}`);
        const statusData = await statusRes.json();
        if (statusRes.ok && statusData.issues) {
          setIssues(statusData.issues);
        }
        
        // Notify dashboard to refetch (trigger update)
        localStorage.setItem('pdfScoreUpdated', Date.now().toString());
        window.dispatchEvent(new Event('pdfScoreUpdated'));
        
        const summary = data.summary || {};
        const aaFailures = summary.aaFailures || 0;
        const aaaFailures = summary.aaaFailures || 0;
        
        alert(`✅ Contrast analysis complete!\n\nAA Failures: ${aaFailures}\nAAA Failures: ${aaaFailures}\n\nNew accessibility score: ${data.newScore || 'calculating...'}`);
      } else {
        console.error('Contrast analysis failed:', data.error);
        alert(`❌ Failed to analyze contrast:\n\n${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Error analyzing contrast:', err);
      alert('Failed to analyze contrast. Please check console for details.');
    } finally {
      setIsAnalyzingContrast(false);
    }
  };

  const totalIssues = issues.length;
  const unfixedIssues = issues.filter(issue => !issue.fixed);
  const fixedIssues = issues.filter(issue => issue.fixed);
  const adjustedScore = unfixedIssues.length === 0 ? 100 : Math.max(0, 100 - (unfixedIssues.length * 5));

  const getSeverityColor = (severity: string) => {
    const s = severity?.toLowerCase() || '';
    if (s.includes('critical') || s.includes('high')) return 'text-red-500 bg-red-500/10 border-red-500/20';
    if (s.includes('moderate') || s.includes('medium')) return 'text-orange-500 bg-orange-500/10 border-orange-500/20';
    if (s.includes('minor') || s.includes('low')) return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
    return 'text-gray-500 bg-gray-500/10 border-gray-500/20';
  };

  const getSeverityBadgeColor = (severity: string) => {
    const s = severity?.toLowerCase() || '';
    if (s.includes('critical') || s.includes('high')) return 'bg-red-500 text-white';
    if (s.includes('moderate') || s.includes('medium')) return 'bg-orange-500 text-white';
    if (s.includes('minor') || s.includes('low')) return 'bg-yellow-500 text-white';
    return 'bg-gray-500 text-white';
  };

  const getIssueIcon = (type: string) => {
    const t = type?.toLowerCase() || '';
    if (t.includes('alt') || t.includes('image')) return Image;
    if (t.includes('contrast') || t.includes('color')) return Contrast;
    if (t.includes('title') || t.includes('heading')) return FileText;
    return AlertTriangle;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-orange-500';
    return 'text-red-500';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Good';
    if (score >= 60) return 'Fair';
    return 'Needs Work';
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white dark:bg-slate-950 transition-colors duration-300">
      {loading ? (
        <div className="flex items-center justify-center h-full p-8">
          <div className="text-center max-w-md">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-6"></div>
            <p className="text-gray-900 dark:text-white font-semibold text-lg mb-2">
              {analysisStatus === 'in-progress' || analysisStatus === 'processing' || analysisStatus === 'started' ? 'Analyzing Document...' : 'Loading Accessibility Report'}
            </p>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
              {analysisStatus === 'in-progress' || analysisStatus === 'processing' || analysisStatus === 'started' ? 'Your PDF is being analyzed for accessibility issues. This typically takes 30-60 seconds.' : 'Checking analysis status...'}
            </p>
            {pollCount > 0 && (
              <div className="flex items-center justify-center gap-2 text-blue-600 dark:text-blue-400 text-xs">
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>Checking... (Poll #{pollCount})</span>
              </div>
            )}
          </div>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center h-full p-8">
          <div className="text-center max-w-md">
            <AlertTriangle className="w-16 h-16 text-orange-500 mx-auto mb-4" />
            <p className="text-gray-900 dark:text-white font-semibold text-lg mb-2">
              {analysisStatus === 'failed' ? 'Analysis Failed' : 'Unable to Load Report'}
            </p>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">{error}</p>
            <div className="flex gap-2 justify-center">
              {error.includes('No analysis started') ? (
                <button 
                  onClick={startAnalysis} 
                  disabled={isStartingAnalysis}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-md text-sm font-medium transition-colors flex items-center gap-2"
                >
                  {isStartingAnalysis ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    'Start Analysis Now'
                  )}
                </button>
              ) : (
                <button 
                  onClick={() => window.location.reload()} 
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors"
                >
                  Refresh Page
                </button>
              )}
            </div>
          </div>
        </div>
      ) : issues.length === 0 ? (
        <div className="flex items-center justify-center h-full p-8">
          <div className="text-center max-w-md">
            <Check className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <p className="text-gray-900 dark:text-white font-semibold text-lg mb-2">Great Job! 🎉</p>
            <p className="text-gray-600 dark:text-gray-400 text-sm">No accessibility issues found in this document.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="px-5 py-4 border-b border-gray-200 dark:border-slate-900 transition-colors duration-300">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-gray-900 dark:text-white font-semibold text-base">Accessibility Score</h3>
              {unfixedIssues.length > 0 && (
                <button
                  onClick={fixAllIssues}
                  disabled={isFixingAll}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {isFixingAll ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Fixing {unfixedIssues.length} Issues...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Fix All Issues ({unfixedIssues.length})
                    </>
                  )}
                </button>
              )}
            </div>
            <div className="flex items-center gap-3 mb-3">
              <div className="relative flex-shrink-0">
                <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-slate-900 flex items-center justify-center transition-colors duration-300">
                  <AlertTriangle className={`w-8 h-8 ${getScoreColor(adjustedScore)}`} />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className={`text-3xl font-bold ${getScoreColor(adjustedScore)}`}>{adjustedScore}%</span>
                  <span className="text-gray-600 dark:text-gray-400 text-sm font-medium">{getScoreLabel(adjustedScore)}</span>
                </div>
                <div className="w-full h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div className={`h-full transition-all duration-500 ${adjustedScore >= 80 ? 'bg-green-500' : adjustedScore >= 60 ? 'bg-orange-500' : 'bg-red-500'}`} style={{ width: `${adjustedScore}%` }} />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-gray-50 dark:bg-slate-900 rounded-lg p-3 transition-colors duration-300">
                <p className="text-gray-600 dark:text-gray-400 text-xs font-medium mb-0.5">Total Issues</p>
                <p className="text-gray-900 dark:text-white text-2xl font-bold">{totalIssues}</p>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 transition-colors duration-300">
                <p className="text-green-600 dark:text-green-400 text-xs font-medium mb-0.5">Fixed</p>
                <p className="text-green-600 dark:text-green-400 text-2xl font-bold">{fixedIssues.length}</p>
              </div>
              <div className="bg-gray-50 dark:bg-slate-900 rounded-lg p-3 transition-colors duration-300">
                <p className="text-gray-600 dark:text-gray-400 text-xs font-medium mb-0.5">Critical</p>
                <p className="text-gray-900 dark:text-white text-2xl font-bold">{unfixedIssues.filter(i => i.severity?.toLowerCase().includes('critical') || i.severity?.toLowerCase().includes('high')).length}</p>
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-3">
            <h4 className="text-gray-900 dark:text-white font-semibold mb-3 text-sm">
              Issues Found ({unfixedIssues.length} remaining)
            </h4>
            <div className="space-y-2.5">
              {issues.map((issue) => {
                const IconComponent = getIssueIcon(issue.type);
                const isFixed = issue.fixed;
                const isFixing = fixingIssueId === issue.id;
                
                return (
                  <div 
                    key={issue.id} 
                    className={`border rounded-lg p-3.5 transition-all ${
                      isFixed 
                        ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-900/30 opacity-75' 
                        : 'bg-gray-50 dark:bg-slate-950 border-gray-200 dark:border-slate-900 hover:border-gray-300 dark:hover:border-slate-800'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 mb-2.5">
                      <div className={`p-2 rounded-md ${
                        isFixed ? 'bg-green-100 dark:bg-green-900/30' : getSeverityColor(issue.severity)
                      }`}>
                        {isFixed ? <Check className="w-5 h-5 text-green-600 dark:text-green-400" /> : <IconComponent className="w-5 h-5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h5 className={`font-semibold text-sm ${
                            isFixed ? 'text-green-600 dark:text-green-400 line-through' : 'text-gray-900 dark:text-white'
                          }`}>{issue.type}</h5>
                          {isFixed ? (
                            <div className="flex items-center gap-1.5">
                              <span className="px-2 py-0.5 rounded text-xs font-bold bg-green-500 text-white">Fixed</span>
                              {(issue as any).actuallyFixed && (
                                <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-500 text-white" title="PDF file was actually modified">
                                  📄 Modified
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${getSeverityBadgeColor(issue.severity)}`}>
                              {issue.severity.charAt(0).toUpperCase() + issue.severity.slice(1)}
                            </span>
                          )}
                        </div>
                        <p className={`text-xs leading-relaxed ${
                          isFixed ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'
                        }`}>{issue.description}</p>
                        {issue.suggestion && !isFixed && (
                          <p className="text-blue-600 dark:text-blue-400 text-xs mt-1 italic">💡 {issue.suggestion}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-gray-200 dark:border-slate-600">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-gray-500 dark:text-gray-500 font-medium">
                          {issue.page ? `Page ${issue.page}` : 'Document-wide'}
                        </span>
                        {issue.wcagReference && (
                          <span className="text-xs text-gray-400 dark:text-gray-600">WCAG: {issue.wcagReference}</span>
                        )}
                      </div>
                      {!isFixed && (
                        <button
                          onClick={() => fixIssue(issue.id, issue.type)}
                          disabled={isFixing || isFixingAll}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded text-xs font-medium transition-colors flex items-center gap-1.5"
                        >
                          {isFixing ? (
                            <>
                              <RefreshCw className="w-3 h-3 animate-spin" />
                              Fixing...
                            </>
                          ) : (
                            <>
                              <Check className="w-3 h-3" />
                              Fix Issue
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
