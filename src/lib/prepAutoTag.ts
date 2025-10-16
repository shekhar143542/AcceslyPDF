/**
 * PREP AutoTag API Client
 * 
 * Based on PREP AutoTag API documentation
 * Base URL: https://api-pdfservice.continualengine.com/v1/
 * 
 * Workflow:
 * 1. Upload PDF for auto-tagging → get process_id
 * 2. Poll status endpoint → wait for completion
 * 3. Download fixed PDF from returned URL
 */

const PREP_AUTOTAG_BASE_URL = 'https://api-pdfservice.continualengine.com/v1';
const PREP_API_ID = process.env.PREP_API_ID!;
const PREP_APP_KEY = process.env.PREP_APP_KEY!;

export interface AutoTagUploadResponse {
  ok: boolean;
  message: string;
  id: string | number; // process_id (API returns string for alphanumeric, number for numeric)
}

export interface AutoTagStatusResponse {
  url: string | null; // Download URL when completed (field name is 'url', not 'file')
  status: 'in-progress' | 'completed' | 'failed';
  value?: string; // Progress percentage
  error?: string;
}

/**
 * Step 1: Upload PDF for auto-tagging
 */
export async function uploadForAutoTag(
  pdfBuffer: Buffer,
  fileName: string,
  templateId?: number
): Promise<AutoTagUploadResponse> {
  try {
    console.log('📤 [AUTOTAG] Uploading PDF for auto-tagging:', fileName);

    const formData = new FormData();
    
    // Create blob from buffer - convert to Uint8Array first
    const uint8Array = new Uint8Array(pdfBuffer);
    const blob = new Blob([uint8Array], { type: 'application/pdf' });
    formData.append('pdf1', blob, fileName);
    formData.append('auto_tag', 'true');
    
    if (templateId) {
      formData.append('template_id', templateId.toString());
    }

    const response = await fetch(
      `${PREP_AUTOTAG_BASE_URL}/process/auto-tag/`,
      {
        method: 'POST',
        headers: {
          'api-id': PREP_API_ID,
          'app-key': PREP_APP_KEY,
          // Don't set Content-Type - let FormData set it with boundary
        },
        body: formData,
      }
    );

    // According to docs, successful upload returns 201, not 200
    if (!response.ok && response.status !== 201) {
      const errorText = await response.text();
      console.error('❌ [AUTOTAG] Upload failed:', response.status, errorText);
      throw new Error(`AutoTag upload failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ [AUTOTAG] Upload response:', data);

    // According to docs, response has { message: "ok", id: "157303yTsd2" } or { message: "ok", id: 3475 }
    const isSuccess = response.status === 201 || data.message === 'ok';

    return {
      ok: isSuccess,
      message: data.message || 'Upload completed',
      id: data.id, // Keep as-is (can be string or number)
    };
  } catch (error) {
    console.error('❌ [AUTOTAG] Upload error:', error);
    throw error;
  }
}

/**
 * Step 2: Check auto-tagging status and get download URL
 */
export async function checkAutoTagStatus(
  processId: string | number
): Promise<AutoTagStatusResponse> {
  try {
    console.log('🔍 [AUTOTAG] Checking status for process:', processId);

    // Convert to appropriate type based on whether it's numeric
    let processIdValue: string | number = processId;
    
    // If it's a string that contains only digits, convert to number
    if (typeof processId === 'string' && /^\d+$/.test(processId)) {
      processIdValue = parseInt(processId, 10);
      console.log('📋 [AUTOTAG] Converting numeric string to integer:', processIdValue);
    } else if (typeof processId === 'number') {
      console.log('📋 [AUTOTAG] Using process ID as integer:', processIdValue);
    } else {
      console.log('📋 [AUTOTAG] Using process ID as alphanumeric string:', processIdValue);
    }
    
    console.log('📋 [AUTOTAG] Request payload:', { processid: processIdValue });
    console.log('📋 [AUTOTAG] Request URL:', `${PREP_AUTOTAG_BASE_URL}/process/ping/`);
    console.log('📋 [AUTOTAG] Headers:', {
      'api-id': PREP_API_ID ? 'Set (' + PREP_API_ID.substring(0, 10) + '...)' : 'Missing',
      'app-key': PREP_APP_KEY ? 'Set (' + PREP_APP_KEY.substring(0, 5) + '...)' : 'Missing',
      'Content-Type': 'application/json'
    });

    const requestBody = JSON.stringify({
      processid: processIdValue,
    });
    console.log('📋 [AUTOTAG] Request body:', requestBody);

    const response = await fetch(
      `${PREP_AUTOTAG_BASE_URL}/process/ping/`,
      {
        method: 'POST',
        headers: {
          'api-id': PREP_API_ID,
          'app-key': PREP_APP_KEY,
          'Content-Type': 'application/json',
        },
        body: requestBody,
      }
    );

    console.log('📡 [AUTOTAG] Response status:', response.status);
    console.log('📡 [AUTOTAG] Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [AUTOTAG] Status check failed:', response.status);
      console.error('❌ [AUTOTAG] Error response body:', errorText);
      console.error('❌ [AUTOTAG] Request details:', {
        url: `${PREP_AUTOTAG_BASE_URL}/process/ping/`,
        method: 'POST',
        headers: {
          'api-id': PREP_API_ID ? `${PREP_API_ID.substring(0, 10)}...` : 'MISSING',
          'app-key': PREP_APP_KEY ? `${PREP_APP_KEY.substring(0, 5)}...` : 'MISSING',
        },
        body: { processid: processIdValue }
      });
      
      // Check if it's an HTML error page
      if (errorText.includes('<h1>')) {
        throw new Error(`AutoTag API returned HTML error page (${response.status}). This usually means invalid credentials or wrong endpoint. Please verify your PREP_API_ID and PREP_APP_KEY are correct for the AutoTag API.`);
      }
      
      throw new Error(`AutoTag status check failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('📊 [AUTOTAG] Status response:', data);

    // According to docs, the download URL field is 'url', not 'file'
    return {
      url: data.url || null,
      status: data.status === 'completed' ? 'completed' : 
              data.status === 'failed' ? 'failed' : 'in-progress',
      value: data.value,
      error: data.error,
    };
  } catch (error) {
    console.error('❌ [AUTOTAG] Status check error:', error);
    throw error;
  }
}

/**
 * Step 3: Download the auto-tagged PDF
 */
export async function downloadAutoTaggedPDF(
  downloadUrl: string
): Promise<Buffer> {
  try {
    console.log('📥 [AUTOTAG] Downloading auto-tagged PDF from:', downloadUrl);

    const response = await fetch(downloadUrl);

    if (!response.ok) {
      throw new Error(`Download failed: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log('✅ [AUTOTAG] Downloaded PDF, size:', buffer.length);

    return buffer;
  } catch (error) {
    console.error('❌ [AUTOTAG] Download error:', error);
    throw error;
  }
}

/**
 * Complete auto-tag workflow
 * Uploads PDF, polls for completion, downloads result
 */
export async function autoTagPDF(
  pdfBuffer: Buffer,
  fileName: string,
  templateId?: number,
  maxPollAttempts: number = 30,
  pollIntervalMs: number = 5000
): Promise<Buffer> {
  try {
    console.log('🚀 [AUTOTAG] Starting complete auto-tag workflow');

    // Step 1: Upload
    const uploadResult = await uploadForAutoTag(pdfBuffer, fileName, templateId);
    
    if (!uploadResult.ok || !uploadResult.id) {
      throw new Error(`Upload failed: ${uploadResult.message}`);
    }

    const processId = uploadResult.id;
    console.log('✅ [AUTOTAG] Got process ID:', processId);

    // Wait 10 seconds before first status check (give API time to start processing)
    console.log('⏳ [AUTOTAG] Waiting 10 seconds before first status check...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Step 2: Poll for completion
    let attempts = 0;
    let statusResult: AutoTagStatusResponse;

    // Try different request methods if one fails
    const requestMethods = [
      { method: 'POST', useBody: true },
      { method: 'GET', useBody: false },
    ];

    let lastError: any = null;

    while (attempts < maxPollAttempts) {
      attempts++;
      console.log(`⏳ [AUTOTAG] Polling attempt ${attempts}/${maxPollAttempts}...`);

      statusResult = await checkAutoTagStatus(processId);

      if (statusResult.status === 'completed' && statusResult.url) {
        console.log('🎉 [AUTOTAG] Auto-tagging completed!');
        
        // Step 3: Download the fixed PDF
        const fixedPdfBuffer = await downloadAutoTaggedPDF(statusResult.url);
        return fixedPdfBuffer;
      }

      if (statusResult.status === 'failed') {
        throw new Error(`Auto-tagging failed: ${statusResult.error || 'Unknown error'}`);
      }

      // Status is 'in-progress', wait before next poll
      console.log(`⏳ [AUTOTAG] Progress: ${statusResult.value || 'unknown'}%`);
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error(`Auto-tagging timed out after ${maxPollAttempts} attempts`);
  } catch (error) {
    console.error('❌ [AUTOTAG] Complete workflow error:', error);
    throw error;
  }
}
