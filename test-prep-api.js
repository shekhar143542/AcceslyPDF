// Test PREP API connection
const PREP_API_ID = "prepapi_FRYBIERLJO";
const PREP_APP_KEY = "9VOK2XKUNAYXP2C8VFB10R";
const TEST_PDF_URL = "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";

async function testPrepAPI() {
  console.log('🧪 Testing PREP API connection...\n');
  
  try {
    console.log('📡 Sending test request to PREP Analyze API...');
    console.log('API ID:', PREP_API_ID);
    console.log('PDF URL:', TEST_PDF_URL);
    console.log('');
    
    const response = await fetch('https://api-pdfservice.continualengine.com/pdf-content/pdf/analyze/', {
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

    console.log('📊 Response Status:', response.status, response.statusText);
    console.log('');

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Error Response:', errorText);
      return;
    }

    const data = await response.json();
    console.log('✅ Success! Response:', JSON.stringify(data, null, 2));
    
    if (data.source_id) {
      console.log('\n✅ Got source_id:', data.source_id);
      console.log('🔍 Now testing status check...\n');
      
      // Test status check
      const statusResponse = await fetch(
        `https://api-pdfservice.continualengine.com/pdf-content/pdf/check-status/?source_id=${data.source_id}`,
        {
          method: 'GET',
          headers: {
            'api-id': PREP_API_ID,
            'app-key': PREP_APP_KEY,
          },
        }
      );

      console.log('📊 Status Response:', statusResponse.status, statusResponse.statusText);
      const statusData = await statusResponse.json();
      console.log('📋 Status Data:', JSON.stringify(statusData, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testPrepAPI();
