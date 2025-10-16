import { NextRequest, NextResponse } from 'next/server';

const PREP_AUTOTAG_BASE_URL = 'https://api-pdfservice.continualengine.com/v1';
const PREP_API_ID = process.env.PREP_API_ID;
const PREP_APP_KEY = process.env.PREP_APP_KEY;

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 [DIAGNOSTIC] Testing PREP AutoTag API credentials...');

    // Test 1: Check if credentials exist
    if (!PREP_API_ID || !PREP_APP_KEY) {
      return NextResponse.json({
        success: false,
        error: 'PREP API credentials not configured',
        details: {
          PREP_API_ID: PREP_API_ID ? 'Set' : 'Missing',
          PREP_APP_KEY: PREP_APP_KEY ? 'Set' : 'Missing',
        }
      });
    }

    console.log('✅ [DIAGNOSTIC] Credentials found');
    console.log('  API ID:', PREP_API_ID.substring(0, 10) + '...');
    console.log('  App Key:', PREP_APP_KEY.substring(0, 5) + '...');

    // Test 2: Try to ping with a dummy process ID
    const testPayloads = [
      { processid: 1 },
      { processid: "1" },
      { processid: 12345 },
    ];

    const results = [];

    for (const payload of testPayloads) {
      console.log(`🧪 [DIAGNOSTIC] Testing payload:`, payload);

      const response = await fetch(
        `${PREP_AUTOTAG_BASE_URL}/process/ping/`,
        {
          method: 'POST',
          headers: {
            'api-id': PREP_API_ID,
            'app-key': PREP_APP_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }
      );

      const responseText = await response.text();
      
      results.push({
        payload,
        status: response.status,
        statusText: response.statusText,
        responsePreview: responseText.substring(0, 200),
        isHTML: responseText.includes('<html') || responseText.includes('<h1>'),
      });

      console.log(`  Status: ${response.status}`);
      console.log(`  Response preview:`, responseText.substring(0, 100));
    }

    return NextResponse.json({
      success: true,
      message: 'AutoTag API diagnostic complete',
      baseUrl: PREP_AUTOTAG_BASE_URL,
      credentials: {
        apiId: PREP_API_ID.substring(0, 10) + '...',
        appKey: PREP_APP_KEY.substring(0, 5) + '...',
      },
      testResults: results,
      recommendations: [
        'If all tests return 500 with HTML error page, your credentials may not have AutoTag API access',
        'If tests return 404, the endpoint URL might be wrong',
        'If tests return 401/403, check your PREP_API_ID and PREP_APP_KEY',
        'Contact Continual Engine to verify your account has AutoTag API access',
      ]
    });

  } catch (error) {
    console.error('❌ [DIAGNOSTIC] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
