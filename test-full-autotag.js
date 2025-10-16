/**
 * Test the full AutoTag upload workflow
 */

const fs = require('fs');

const PREP_API_ID = 'prepapi_FRYBIERLJO';
const PREP_APP_KEY = '9VOK2XKUNAYXP2C8VFB10R';

async function testUpload() {
  console.log('🧪 Testing PREP AutoTag upload endpoint...\n');

  // Find a PDF file in the project
  const pdfPath = './test.pdf'; // You'll need a test PDF
  
  // For now, let's just test with a minimal PDF
  const minimalPDF = Buffer.from(
    '%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/Resources <<\n/Font <<\n/F1 <<\n/Type /Font\n/Subtype /Type1\n/BaseFont /Helvetica\n>>\n>>\n>>\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n>>\nendobj\n4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n/F1 12 Tf\n50 700 Td\n(Test) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\n0000000317 00000 n\ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n410\n%%EOF'
  );

  console.log('📋 Creating FormData with PDF...');
  
  const FormData = require('form-data');
  const formData = new FormData();
  formData.append('pdf1', minimalPDF, { filename: 'test.pdf', contentType: 'application/pdf' });
  formData.append('auto_tag', 'true');

  console.log('📤 Uploading to:', 'https://api-pdfservice.continualengine.com/v1/process/auto-tag/');
  console.log('📋 Headers:', {
    'api-id': PREP_API_ID,
    'app-key': PREP_APP_KEY,
  });

  try {
    const fetch = (await import('node-fetch')).default;
    
    const response = await fetch(
      'https://api-pdfservice.continualengine.com/v1/process/auto-tag/',
      {
        method: 'POST',
        headers: {
          'api-id': PREP_API_ID,
          'app-key': PREP_APP_KEY,
          ...formData.getHeaders(),
        },
        body: formData,
      }
    );

    console.log('\n📡 Upload Response:');
    console.log('  Status:', response.status, response.statusText);

    const responseText = await response.text();
    console.log('  Body:', responseText);

    if (response.ok || response.status === 201) {
      try {
        const data = JSON.parse(responseText);
        console.log('\n✅ Upload successful! Process ID:', data.id);
        console.log('\n🧪 Now testing /process/ping/ with this real process ID...\n');
        
        // Now test ping with the real process ID
        await testPing(data.id);
      } catch {
        console.log('Could not parse response as JSON');
      }
    } else {
      console.log('\n❌ Upload failed');
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
}

async function testPing(processId) {
  console.log('📋 Testing /process/ping/ with process ID:', processId);
  
  const fetch = (await import('node-fetch')).default;
  
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
        processid: processId
      }),
    }
  );

  console.log('📡 Ping Response:');
  console.log('  Status:', response.status, response.statusText);

  const responseText = await response.text();
  console.log('  Body:', responseText);

  if (responseText.includes('<h1>')) {
    console.log('\n❌ Still getting HTML error!');
  } else {
    console.log('\n✅ Got JSON response!');
  }
}

testUpload();
