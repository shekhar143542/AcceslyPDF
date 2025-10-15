'use client';

import { useState } from 'react';
import { AlertTriangle, Image, Contrast, FileText, Sparkles, Check } from 'lucide-react';

interface Issue {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'moderate' | 'minor';
  location: string;
  fixed: boolean;
}

const sampleIssues: Issue[] = [
  {
    id: '1',
    title: 'Missing Alt Text',
    description: 'Image on page 2 is missing alternative text for screen readers',
    severity: 'critical',
    location: 'Page 2, Image 1',
    fixed: false
  },
  {
    id: '2',
    title: 'Low Color Contrast',
    description: 'Text has insufficient contrast ratio (3.2:1), needs at least 4.5:1',
    severity: 'moderate',
    location: 'Page 3, Paragraph 2',
    fixed: false
  },
  {
    id: '3',
    title: 'Missing Document Title',
    description: 'PDF document metadata is missing a proper title for assistive technologies',
    severity: 'moderate',
    location: 'Document Properties',
    fixed: false
  }
];

export default function ReportTab() {
  const [issues, setIssues] = useState<Issue[]>(sampleIssues);
  const [fixingIssue, setFixingIssue] = useState<string | null>(null);

  const totalIssues = issues.length;
  const fixedIssues = issues.filter(issue => issue.fixed).length;
  const score = Math.round(((totalIssues - (totalIssues - fixedIssues)) / totalIssues) * 100);
  const adjustedScore = 75; // Base score from the design

  const handleFixIssue = (issueId: string) => {
    setFixingIssue(issueId);
    
    // Simulate AI fixing the issue
    setTimeout(() => {
      setIssues(prev => 
        prev.map(issue => 
          issue.id === issueId ? { ...issue, fixed: true } : issue
        )
      );
      setFixingIssue(null);
    }, 2000);
  };

  const handleFixAllIssues = () => {
    issues.forEach(issue => {
      if (!issue.fixed) {
        setTimeout(() => {
          handleFixIssue(issue.id);
        }, Math.random() * 1000);
      }
    });
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'text-red-500 bg-red-500/10 border-red-500/20';
      case 'moderate':
        return 'text-orange-500 bg-orange-500/10 border-orange-500/20';
      case 'minor':
        return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
      default:
        return 'text-gray-500 bg-gray-500/10 border-gray-500/20';
    }
  };

  const getSeverityBadgeColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-500 text-white';
      case 'moderate':
        return 'bg-orange-500 text-white';
      case 'minor':
        return 'bg-yellow-500 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  };

  const getIssueIcon = (title: string) => {
    if (title.includes('Alt Text')) return Image;
    if (title.includes('Contrast')) return Contrast;
    if (title.includes('Title')) return FileText;
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
      {/* Accessibility Score Section */}
      <div className="px-5 py-4 border-b border-gray-200 dark:border-slate-900 transition-colors duration-300">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-gray-900 dark:text-white font-semibold text-base">Accessibility Score</h3>
          <button
            onClick={handleFixAllIssues}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-md transition-colors cursor-pointer"
          >
            Fix All Issues
          </button>
        </div>

        {/* Score Display */}
        <div className="flex items-center gap-3 mb-3">
          <div className="relative flex-shrink-0">
            <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-slate-900 flex items-center justify-center transition-colors duration-300">
              <AlertTriangle className={`w-8 h-8 ${getScoreColor(adjustedScore)}`} />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 mb-1">
              <span className={`text-3xl font-bold ${getScoreColor(adjustedScore)}`}>
                {adjustedScore}%
              </span>
              <span className="text-gray-600 dark:text-gray-400 text-sm font-medium">
                {getScoreLabel(adjustedScore)}
              </span>
            </div>
            <div className="w-full h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  adjustedScore >= 80 ? 'bg-green-500' :
                  adjustedScore >= 60 ? 'bg-orange-500' : 
                  'bg-red-500'
                }`}
                style={{ width: `${adjustedScore}%` }}
              />
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-gray-50 dark:bg-slate-900 rounded-lg p-3 transition-colors duration-300">
            <p className="text-gray-600 dark:text-gray-400 text-xs font-medium mb-0.5">Total Issues</p>
            <p className="text-gray-900 dark:text-white text-2xl font-bold">{totalIssues}</p>
          </div>
          <div className="bg-gray-50 dark:bg-slate-900 rounded-lg p-3 transition-colors duration-300">
            <p className="text-gray-600 dark:text-gray-400 text-xs font-medium mb-0.5">Fixed</p>
            <p className="text-gray-900 dark:text-white text-2xl font-bold">{fixedIssues}</p>
          </div>
        </div>
      </div>

      {/* Issues List */}
      <div className="flex-1 overflow-y-auto px-5 py-3 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-slate-600 scrollbar-track-transparent">
        <h4 className="text-gray-900 dark:text-white font-semibold mb-3 text-sm">
          Issues Found ({totalIssues - fixedIssues} remaining)
        </h4>

        <div className="space-y-2.5">
          {issues.map((issue) => {
            const IconComponent = getIssueIcon(issue.title);
            
            return (
              <div
                key={issue.id}
                className={`border rounded-lg p-3.5 transition-all ${
                  issue.fixed
                    ? 'bg-gray-50 dark:bg-slate-950/60 border-gray-200 dark:border-slate-900 opacity-60'
                    : 'bg-gray-50 dark:bg-slate-950 border-gray-200 dark:border-slate-900 hover:border-gray-300 dark:hover:border-slate-800'
                }`}
              >
                {/* Issue Header */}
                <div className="flex items-start gap-2.5 mb-2.5">
                  <div className={`p-2 rounded-md ${getSeverityColor(issue.severity)}`}>
                    {issue.fixed ? (
                      <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
                    ) : (
                      <IconComponent className="w-5 h-5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h5 className={`font-semibold text-sm ${issue.fixed ? 'text-gray-500 dark:text-gray-500 line-through' : 'text-gray-900 dark:text-white'}`}>
                        {issue.title}
                      </h5>
                      {!issue.fixed && (
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${getSeverityBadgeColor(issue.severity)}`}>
                          {issue.severity.charAt(0).toUpperCase() + issue.severity.slice(1)}
                        </span>
                      )}
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 text-xs leading-relaxed">
                      {issue.description}
                    </p>
                  </div>
                </div>

                {/* Location and Fix Button */}
                <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-gray-200 dark:border-slate-600">
                  <span className="text-xs text-gray-500 dark:text-gray-500 font-medium">
                    {issue.location}
                  </span>
                  
                  {/* Fix Button */}
                  {!issue.fixed && (
                    <button
                      onClick={() => handleFixIssue(issue.id)}
                      disabled={fixingIssue === issue.id}
                      className="flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white text-xs font-medium rounded-md transition-colors cursor-pointer disabled:cursor-not-allowed"
                    >
                      {fixingIssue === issue.id ? (
                        <>
                          <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Fixing...</span>
                        </>
                      ) : (
                        <>
                          <span>Fix Issue</span>
                        </>
                      )}
                    </button>
                  )}
                  
                  {issue.fixed && (
                    <span className="flex items-center gap-1 text-green-600 dark:text-green-400 text-xs font-medium">
                      <Check className="w-3.5 h-3.5" />
                      Fixed
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
