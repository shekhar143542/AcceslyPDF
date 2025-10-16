import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * POST /api/ai/transcribe
 * 
 * Transcribes audio file to text using OpenAI Whisper API
 * 
 * @param request - FormData containing audio file
 * @returns JSON response with transcribed text
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🎤 Transcription request received');

    // Parse form data
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;

    // Validate audio file
    if (!audioFile) {
      console.error('❌ No audio file provided');
      return NextResponse.json(
        { success: false, error: 'No audio file provided' },
        { status: 400 }
      );
    }

    console.log('📝 Audio file details:', {
      name: audioFile.name,
      size: audioFile.size,
      type: audioFile.type,
    });

    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      console.error('❌ OpenAI API key not configured');
      return NextResponse.json(
        { success: false, error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    // Send to OpenAI Whisper API for transcription
    console.log('🔄 Sending to OpenAI Whisper API...');
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'en', // Optional: specify language for better accuracy
      prompt: 'PDF accessibility, WCAG compliance, document analysis', // Context hint
    });

    console.log('✅ Transcription successful:', transcription.text);

    return NextResponse.json({
      success: true,
      text: transcription.text,
    });
  } catch (error: any) {
    console.error('❌ Transcription error:', error);

    // Handle specific OpenAI API errors
    if (error.status === 429) {
      console.error('💳 API quota exceeded');
      return NextResponse.json(
        { 
          success: false, 
          error: 'API quota exceeded. Please check your OpenAI account and upgrade if needed.' 
        },
        { status: 429 }
      );
    }

    if (error.status === 401) {
      console.error('🔑 Invalid API key');
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid API key. Please check your OpenAI configuration in .env.local' 
        },
        { status: 401 }
      );
    }

    if (error.status === 400) {
      console.error('📄 Invalid audio file format');
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid audio file format. Please try recording again.' 
        },
        { status: 400 }
      );
    }

    // Generic error
    return NextResponse.json(
      { 
        success: false, 
        error: 'Transcription failed. Please try again.' 
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ai/transcribe
 * 
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Transcription API is running',
    whisperModel: 'whisper-1',
  });
}
