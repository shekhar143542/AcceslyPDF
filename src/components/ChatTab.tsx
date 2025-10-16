'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Mic, Bot, Loader2 } from 'lucide-react';

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
    content: "Hello! I'm your PDF accessibility assistant. I can help you check and fix accessibility issues in your document. You can type or use voice commands: say 'start' to begin recording, then 'stop' to send your message!",
    timestamp: '11:36 AM'
  }
];

// Global refs for cross-effect communication
const isListeningRef = { current: false } as { current: boolean };
const startRecordingRef = { current: ((fromVoiceCommand?: boolean) => {}) as (fromVoiceCommand?: boolean) => void };
const stopRecordingRef = { current: (() => {}) as () => void };

export default function ChatTab() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [inputValue, setInputValue] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  // Audio recording refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const sendAfterStopRef = useRef(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Sync refs for cross-effect communication
  useEffect(() => { 
    isListeningRef.current = isListening; 
  }, [isListening]);

  /**
   * Voice Activity Detection (VAD)
   * Monitors audio levels and auto-stops recording after silence
   */
  const detectVoiceActivity = () => {
    if (!analyserRef.current) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const SILENCE_THRESHOLD = 30; // Adjust for sensitivity (0-255, lower = more sensitive)
    const SILENCE_DURATION = 1500; // 1.5 seconds of silence before auto-stop

    const checkAudioLevel = () => {
      if (!analyserRef.current || !isListeningRef.current) return;

      analyser.getByteFrequencyData(dataArray);

      // Calculate average volume
      const average = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;

      console.log('🎵 Audio level:', average.toFixed(2));

      if (average > SILENCE_THRESHOLD) {
        // Voice detected - clear any existing silence timeout
        if (silenceTimeoutRef.current) {
          console.log('🗣️ Voice detected, clearing silence timeout');
          clearTimeout(silenceTimeoutRef.current);
          silenceTimeoutRef.current = null;
        }
      } else {
        // Silence detected - start countdown if not already started
        if (!silenceTimeoutRef.current) {
          console.log('🤫 Silence detected, starting timeout');
          silenceTimeoutRef.current = setTimeout(() => {
            console.log('⏹️ Auto-stopping due to silence');
            stopRecordingRef.current();
          }, SILENCE_DURATION);
        }
      }

      // Continue checking
      requestAnimationFrame(checkAudioLevel);
    };

    checkAudioLevel();
  };

  /**
   * Start audio recording
   * @param fromVoiceCommand - If true, will auto-send message after transcription
   */
  const startRecording = async (fromVoiceCommand = false) => {
    try {
      console.log('🎤 Starting recording...', fromVoiceCommand ? '(from voice command)' : '(manual)');

      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Reset audio chunks
      audioChunksRef.current = [];

      // Set up audio context for voice activity detection
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyserRef.current = analyser;

      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);

      // Start voice activity detection
      detectVoiceActivity();

      // If started from voice command, set flag to auto-send
      if (fromVoiceCommand) {
        sendAfterStopRef.current = true;
        console.log('✅ Auto-send enabled');
      }

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      // Collect audio data chunks
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          console.log('📦 Audio chunk received, size:', event.data.size);
        }
      };

      // When recording stops, transcribe the audio
      mediaRecorder.onstop = () => {
        console.log('⏹️ Recording stopped, creating audio blob');
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        console.log('📄 Audio blob created, size:', audioBlob.size);
        transcribeAudio(audioBlob);

        // Stop all tracks and clean up
        stream.getTracks().forEach(track => {
          track.stop();
          console.log('🛑 Track stopped:', track.kind);
        });
        
        if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
        }
        analyserRef.current = null;

        // Clear any pending silence timeout
        if (silenceTimeoutRef.current) {
          clearTimeout(silenceTimeoutRef.current);
          silenceTimeoutRef.current = null;
        }
      };

      mediaRecorder.start();
      setIsListening(true);
      console.log('✅ Recording started successfully');
    } catch (error: any) {
      console.error('❌ Error accessing microphone:', error);
      
      if (error.name === 'NotAllowedError') {
        alert('Microphone access denied. Please allow microphone access in your browser settings.');
      } else if (error.name === 'NotFoundError') {
        alert('No microphone found. Please connect a microphone and try again.');
      } else {
        alert('Could not access microphone. Please check your permissions and try again.');
      }
    }
  };

  /**
   * Stop audio recording
   */
  const stopRecording = () => {
    console.log('🛑 Stopping recording...');
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsListening(false);
      console.log('✅ Recording stopped');
    }
  };

  /**
   * Transcribe audio using OpenAI Whisper
   */
  const transcribeAudio = async (audioBlob: Blob) => {
    try {
      console.log('📝 Starting transcription...');
      setIsTranscribing(true);

      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');

      const response = await fetch('/api/ai/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Transcription failed');
      }

      const data = await response.json();
      console.log('✅ Transcription successful:', data.text);

      if (data.success && data.text) {
        // If triggered by voice command, send directly to chat
        if (sendAfterStopRef.current) {
          console.log('📤 Auto-sending message...');
          setInputValue(data.text);
          setTimeout(() => {
            handleSendMessage();
            sendAfterStopRef.current = false;
          }, 100);
        } else {
          // Append transcribed text to input
          console.log('📝 Adding transcription to input');
          setInputValue(prev => prev + (prev ? ' ' : '') + data.text);
        }
      }
    } catch (error: any) {
      console.error('❌ Transcription error:', error);
      alert(error.message || 'Failed to transcribe audio. Please try again.');
    } finally {
      setIsTranscribing(false);
    }
  };

  // Sync recording functions to refs for voice command access
  useEffect(() => {
    startRecordingRef.current = startRecording;
  }, []);

  useEffect(() => {
    stopRecordingRef.current = stopRecording;
  }, []);

  /**
   * Background Voice Command Listener
   * Continuously listens for "start" and "stop" commands
   */
  useEffect(() => {
    console.log('🎧 Initializing voice command listener...');

    // Check for browser support
    const SpeechRecognitionClass = (window as any).SpeechRecognition || 
                                   (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognitionClass) {
      console.warn('⚠️ SpeechRecognition not supported in this browser');
      console.warn('💡 Voice commands disabled. Manual mic button still works.');
      return;
    }

    let commandRecognition: any = null;
    let isCommandActive = false;
    let restartTimer: any = null;

    const startCommandRecognition = () => {
      if (commandRecognition) return;

      console.log('🎙️ Starting background voice command recognition...');
      commandRecognition = new SpeechRecognitionClass();
      commandRecognition.continuous = true;      // Keep listening
      commandRecognition.interimResults = false; // Only final results
      commandRecognition.lang = 'en-US';

      commandRecognition.onresult = (event: any) => {
        // Extract transcript from all results
        let transcript = '';
        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i];
          if (result && result[0] && result[0].transcript) {
            transcript += result[0].transcript.trim().toLowerCase() + ' ';
          }
        }
        transcript = transcript.trim();
        
        console.log('🗣️ Voice command heard:', transcript);

        // Listen for 'start' command
        if (!isListeningRef.current && /\bstart\b/.test(transcript) && !isCommandActive) {
          console.log('✅ "START" command detected');
          isCommandActive = true;
          startRecordingRef.current(true); // Pass true for voice command mode
        } 
        // Listen for 'stop' command
        else if (isListeningRef.current && /\bstop\b/.test(transcript)) {
          console.log('✅ "STOP" command detected');
          stopRecordingRef.current();
          isCommandActive = false;
        }
      };

      // Handle errors and restart
      commandRecognition.onerror = (e: any) => {
        console.error('❌ Voice command error:', e.error);
        try {
          commandRecognition?.stop();
        } catch (err) {
          // Ignore if already stopped
        }
        
        // Restart after error (except permission denied)
        if (e.error !== 'not-allowed') {
          if (restartTimer) clearTimeout(restartTimer);
          restartTimer = setTimeout(() => {
            console.log('🔄 Restarting voice command recognition...');
            try {
              commandRecognition && commandRecognition.start();
            } catch (err) {
              // Ignore if already started
            }
          }, 500);
        }
      };

      // Auto-restart when recognition ends
      commandRecognition.onend = () => {
        console.log('⏹️ Voice command recognition ended, restarting...');
        if (restartTimer) clearTimeout(restartTimer);
        restartTimer = setTimeout(() => {
          try {
            commandRecognition && commandRecognition.start();
          } catch (err) {
            // Ignore if already started
          }
        }, 500);
      };

      try {
        commandRecognition.start();
        console.log('✅ Voice command listener started successfully');
        console.log('💡 Say "start" to begin recording, "stop" to end and send');
      } catch (err) {
        console.error('❌ Failed to start voice command listener:', err);
      }
    };

    startCommandRecognition();

    // Cleanup on unmount
    return () => {
      console.log('🧹 Cleaning up voice command listener...');
      
      if (restartTimer) {
        clearTimeout(restartTimer);
        restartTimer = null;
      }
      
      if (commandRecognition) {
        commandRecognition.onresult = null;
        commandRecognition.onerror = null;
        commandRecognition.onend = null;
        try {
          commandRecognition.stop();
        } catch (err) {
          // Ignore if already stopped
        }
        commandRecognition = null;
      }
    };
  }, []);

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
    if (isListening) {
      stopRecording();
    } else {
      startRecording(false); // Manual click, don't auto-send
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
            disabled={isTranscribing}
            className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
              isListening
                ? 'bg-red-600 hover:bg-red-700 animate-pulse'
                : isTranscribing
                ? 'bg-yellow-500 cursor-not-allowed'
                : 'bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 border border-gray-300 dark:border-slate-600'
            }`}
            title={
              isListening 
                ? 'Stop recording (or say "stop")' 
                : isTranscribing
                ? 'Transcribing...'
                : 'Start voice input (or say "start")'
            }
          >
            {isTranscribing ? (
              <Loader2 className="w-4 h-4 text-white animate-spin" />
            ) : (
              <Mic className={`w-4 h-4 ${isListening ? 'text-white' : 'text-gray-600 dark:text-gray-300'}`} />
            )}
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
