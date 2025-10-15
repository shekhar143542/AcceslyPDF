'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Mic, Bot } from 'lucide-react';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

const initialMessages: Message[] = [
  {
    id: '1',
    type: 'assistant',
    content: "Hello! I'm your PDF accessibility assistant. I can help you check and fix accessibility issues in your document. What would you like me to do?",
    timestamp: '11:36 AM'
  }
];

export default function ChatTab() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [inputValue, setInputValue] = useState('');
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: inputValue,
      timestamp: new Date().toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      })
    };

    setMessages(prev => [...prev, newMessage]);
    setInputValue('');

    // Simulate AI response
    setTimeout(() => {
      const responses = [
        "I've analyzed your request. Let me check the accessibility issues in your document.",
        "I found several accessibility concerns. Would you like me to help you fix them?",
        "I can help you with that. Let me scan through the document for specific issues.",
        "Based on the accessibility standards, I recommend addressing the contrast ratio and alt text issues first."
      ];
      
      const response: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: responses[Math.floor(Math.random() * responses.length)],
        timestamp: new Date().toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit',
          hour12: true 
        })
      };
      
      setMessages(prev => [...prev, response]);
    }, 1000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleMicClick = () => {
    setIsListening(!isListening);
    // In production, implement voice recognition here
    if (!isListening) {
      setTimeout(() => {
        setIsListening(false);
      }, 3000);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-950 transition-colors duration-300">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-slate-600 scrollbar-track-transparent">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 ${
              message.type === 'user' ? 'flex-row-reverse' : 'flex-row'
            }`}
          >
            {/* Avatar */}
            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
              message.type === 'assistant' 
                ? 'bg-blue-600' 
                : 'bg-gray-600 dark:bg-slate-600'
            }`}>
              {message.type === 'assistant' ? (
                <Bot className="w-4 h-4 text-white" />
              ) : (
                <span className="text-white text-xs font-semibold">U</span>
              )}
            </div>

            {/* Message Content */}
            <div className={`flex flex-col max-w-[75%] ${
              message.type === 'user' ? 'items-end' : 'items-start'
            }`}>
              <div className={`rounded-lg px-3 py-2 ${
                message.type === 'user'
                  ? 'bg-blue-600 text-white'
              : 'bg-gray-100 dark:bg-slate-900 text-gray-900 dark:text-gray-100'
              }`}>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {message.content}
                </p>
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-500 mt-1 px-1">
                {message.timestamp}
              </span>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 dark:border-slate-900 p-3 bg-white dark:bg-slate-950 transition-colors duration-300">
        <div className="flex items-end gap-2">
          <div className="flex-1 bg-gray-50 dark:bg-slate-900 rounded-lg border border-gray-300 dark:border-slate-800 focus-within:border-blue-500 dark:focus-within:border-blue-500 transition-colors">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message or click the mic..."
              className="w-full bg-transparent text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-200 px-3 py-2.5 resize-none outline-none overflow-hidden text-sm"
              rows={1}
              style={{
                minHeight: '40px',
                maxHeight: '100px',
              }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = Math.min(target.scrollHeight, 100) + 'px';
              }}
            />
          </div>

          {/* Mic Button */}
          <button
            onClick={handleMicClick}
            className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
              isListening
                ? 'bg-red-600 hover:bg-red-700 animate-pulse'
                : 'bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 border border-gray-300 dark:border-slate-600'
            }`}
            title={isListening ? 'Stop listening' : 'Start voice input'}
          >
            <Mic className={`w-4 h-4 ${isListening ? 'text-white' : 'text-gray-600 dark:text-gray-300'}`} />
          </button>

          {/* Send Button */}
          <button
            onClick={handleSendMessage}
            disabled={!inputValue.trim()}
            className="flex-shrink-0 w-10 h-10 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed rounded-lg flex items-center justify-center transition-colors cursor-pointer"
            title="Send message"
          >
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
