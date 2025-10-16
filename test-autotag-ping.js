/**
 * Simple test script to verify PREP AutoTag API credentials
 * Run this to test if the AutoTag /process/ping/ endpoint works
 */

const PREP_API_ID = 'prepapi_FRYBIERLJO';
const PREP_APP_KEY = '9VOK2XKUNAYXP2C8VFB10R';

async function testAutoTagPing() {
  console.log('🧪 Testing PREP AutoTag /process/ping/ endpoint...\n');

  // Test with a dummy process ID (should return error about invalid ID, but not 500)
  const testProcessId = 12345;

  console.log('📋 Request details:');
  console.log('  URL:', 'https://api-pdfservice.continualengine.com/v1/process/ping/');
  console.log('  Method: POST');
  console.log('  Headers:', {
    'api-id': PREP_API_ID,
    'app-key': PREP_APP_KEY,
    'Content-Type': 'application/json'
  });
  console.log('  Body:', JSON.stringify({ processid: testProcessId }));
  console.log('');

  try {
    const response = await fetch(
      'https://api-pdfservice.continualengine.com/v1/process/ping/',
      {
        method: 'POST',
        headers: {
          'api-id': PREP_API_ID,
          'app-key': PREP_APP_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          processid: testProcessId
        }),
      }
    );

    console.log('📡 Response:');
    console.log('  Status:', response.status, response.statusText);
    console.log('  Headers:', Object.fromEntries(response.headers.entries()));

    const responseText = await response.text();
    console.log('  Body preview:', responseText.substring(0, 500));

    if (responseText.includes('<html') || responseText.includes('<h1>')) {
      console.log('\n❌ ERROR: API returned HTML error page!');
      console.log('This usually means:');
      console.log('  1. The endpoint URL is wrong');
      console.log('  2. The credentials do not have access to AutoTag API');
      console.log('  3. The AutoTag feature is not enabled for your account');
    } else {
      console.log('\n✅ Got JSON response (credentials work!)');
      try {
        const data = JSON.parse(responseText);
        console.log('  Parsed data:', data);
      } catch {
        console.log('  Could not parse as JSON');
      }
    }

  } catch (error) {
    console.error('\n❌ Request failed:', error);
  }
}

testAutoTagPing();
