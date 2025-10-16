// Test different PREP API endpoint variations
const PREP_API_ID = "prepapi_FRYBIERLJO";
const PREP_APP_KEY = "9VOK2XKUNAYXP2C8VFB10R";
const TEST_PDF_URL = "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";

const endpoints = [
  'https://api-pdfservice.continualengine.com/pdf-content/pdf/analyze/',
  'https://api-pdfservice.continualengine.com/pdf-content/pdf/analyze',
  'https://api-pdfservice.continualengine.com/pdf-content/analyze/',
  'https://api-pdfservice.continualengine.com/pdf-content/analyze',
  'https://api-pdfservice.continualengine.com/api/pdf/analyze/',
  'https://api-pdfservice.continualengine.com/api/pdf/analyze',
  'https://api-pdfservice.continualengine.com/analyze/',
  'https://api-pdfservice.continualengine.com/analyze',
];

async function testEndpoint(url) {
  console.log(`\n🔍 Testing: ${url}`);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'api-id': PREP_API_ID,
        'app-key': PREP_APP_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        apiKey: PREP_APP_KEY,
        apiId: PREP_API_ID,
        fileUrl: TEST_PDF_URL,
      }),
    });

    console.log(`   Status: ${response.status} ${response.statusText}`);
    
    if (response.status !== 404) {
      const text = await response.text();
      console.log(`   ✅ FOUND! Response:`, text.substring(0, 200));
      
      // Try to parse as JSON
      try {
        const data = JSON.parse(text);
        console.log(`   📋 JSON:`, JSON.stringify(data, null, 2));
      } catch (e) {
        console.log(`   ⚠️  Not JSON response`);
      }
    } else {
      console.log(`   ❌ 404 - Not Found`);
    }
    
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }
}

async function testAllEndpoints() {
  console.log('🧪 Testing all possible PREP API endpoints...\n');
  
  for (const endpoint of endpoints) {
    await testEndpoint(endpoint);
    await new Promise(resolve => setTimeout(resolve, 500)); // Wait between requests
  }
  
  console.log('\n✅ Test complete!');
}

testAllEndpoints();
