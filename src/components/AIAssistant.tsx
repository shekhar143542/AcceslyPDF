'use client';

import { useState } from 'react';
import ChatTab from './ChatTab';
import ReportTab from './ReportTab';

interface AIAssistantProps {
  documentName?: string;
  pdfId: string;
}

export default function AIAssistant({ documentName, pdfId }: AIAssistantProps) {
  const [activeTab, setActiveTab] = useState<'chat' | 'report'>('chat');

  return (
    <div className="w-[450px] bg-white dark:bg-slate-950 border-l border-gray-200 dark:border-slate-900 flex flex-col shadow-lg transition-colors duration-300">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-200 dark:border-slate-950 bg-gray-50 dark:bg-slate-950 transition-colors duration-300">
        <div className="flex items-center justify-between">
          <h2 className="text-gray-900 dark:text-white text-lg font-semibold">AI Assistant</h2>
          <button className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-800 transition-colors cursor-pointer">
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-slate-900 bg-gray-50 dark:bg-slate-950/60 transition-colors duration-300">
        <button
          onClick={() => setActiveTab('chat')}
          className={`flex-1 px-5 py-3 text-sm font-medium transition-colors cursor-pointer ${
            activeTab === 'chat'
              ? 'text-gray-900 dark:text-white bg-white dark:bg-slate-950 border-b-2 border-blue-600 dark:border-blue-400'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
          }`}
        >
          Chat
        </button>
        <button
          onClick={() => setActiveTab('report')}
          className={`flex-1 px-5 py-3 text-sm font-medium transition-colors cursor-pointer ${
            activeTab === 'report'
              ? 'text-gray-900 dark:text-white bg-white dark:bg-slate-950 border-b-2 border-blue-600 dark:border-blue-400'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
          }`}
        >
          Report
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'chat' ? <ChatTab /> : <ReportTab pdfId={pdfId} />}
      </div>
    </div>
  );
}
