/**
 * ===========================================
 * PREP CHECKER API CLIENT
 * ===========================================
 * 
 * Client library for interacting with PREP Checker API
 * 
 * API Documentation: https://api-pdfservice.continualengine.com
 * 
 * Required Environment Variables:
 * - PREP_API_ID: Your PREP API ID (e.g., prepapi_FRYBIERLJO)
 * - PREP_APP_KEY: Your PREP API Key (e.g., 9VOK2XKUNAYXP2C8VFB10R)
 * 
 * DO NOT COMMIT THESE VALUES TO GIT!
 */

const PREP_BASE_URL = 'https://api-pdfservice.continualengine.com';
const PREP_API_ID = process.env.PREP_API_ID!;
const PREP_APP_KEY = process.env.PREP_APP_KEY!;

// ==========================================
// TYPE DEFINITIONS
// ==========================================

export interface PrepInitResponse {
  message: string;
  source_id: string;
}

export interface PrepStatusResponse {
  file_id: string;
  status: 'in-progress' | 'completed' | 'failed';
  result?: {
    checkerData: any;
    file_url?: string;
  };
  error?: string;
}

export interface PrepIssue {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  page: number;
  description: string;
  fix_suggestions: string[];
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Upload PDF file to PREP Checker and initiate accessibility check
 * 
 * @param pdfFile - PDF file as Buffer or Blob
 * @param fileName - Original filename
 * @returns Promise with source_id
 */
export async function uploadToPrep(
  pdfFile: Buffer | Blob,
  fileName: string
): Promise<PrepInitResponse> {
  try {
    console.log('📡 Uploading to PREP Checker API...');
    console.log('📍 Base URL:', PREP_BASE_URL);
    console.log('📄 File:', fileName);
    console.log('🔑 API ID:', PREP_API_ID ? '✓ Set' : '✗ Missing');
    console.log('🔐 API Key:', PREP_APP_KEY ? '✓ Set (ending: ***' + PREP_APP_KEY.slice(-4) + ')' : '✗ Missing');

    // Validate credentials
    if (!PREP_API_ID || !PREP_APP_KEY) {
      throw new Error('PREP API credentials not configured. Please set PREP_API_ID and PREP_APP_KEY in .env');
    }

    // Create FormData for multipart upload
    const formData = new FormData();
    
    // Field name MUST be 'pdf1' according to PREP API docs
   if (pdfFile instanceof Buffer) {
  const arrayBuffer = pdfFile.buffer.slice(
    pdfFile.byteOffset,
    pdfFile.byteOffset + pdfFile.byteLength
  );
  const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
  formData.append('pdf1', blob, fileName);
} else {
  formData.append('pdf1', pdfFile as Blob, fileName);
}


    // Make API request
    const response = await fetch(
      `${PREP_BASE_URL}/pdf-content/pdf/accessibility-check-init/`,
      {
        method: 'POST',
        headers: {
          'api-id': PREP_API_ID,
          'app-key': PREP_APP_KEY,
          // Note: Do NOT set Content-Type header - browser/Node will set it automatically with boundary
        },
        body: formData,
      }
    );

    console.log('📊 Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ PREP API error:', errorText);
      throw new Error(`PREP API failed (${response.status}): ${errorText}`);
    }

    const result: PrepInitResponse = await response.json();
    console.log('✅ Init successful:', result);

    // Validate response structure
    if (!result.source_id) {
      throw new Error('Invalid response from PREP API: missing source_id');
    }

    return result;
  } catch (error) {
    console.error('❌ Error uploading to PREP:', error);
    throw error;
  }
}

/**
 * Check the status of an accessibility check
 * 
 * @param sourceId - Source ID from init response
 * @returns Promise with status and results
 */
export async function checkStatusWithPrep(
  sourceId: string
): Promise<PrepStatusResponse> {
  try {
    console.log(`🔍 Checking status for source_id: ${sourceId}`);

    // Validate credentials
    if (!PREP_API_ID || !PREP_APP_KEY) {
      throw new Error('PREP API credentials not configured');
    }

    // Make API request
    const response = await fetch(
      `${PREP_BASE_URL}/pdf-content/pdf/check-status/`,
      {
        method: 'POST',
        headers: {
          'api-id': PREP_API_ID,
          'app-key': PREP_APP_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'doc-checker',
          source_id: sourceId,
        }),
      }
    );

    console.log('📊 Status response:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Status check error:', errorText);
      throw new Error(`Status check failed (${response.status}): ${errorText}`);
    }

    const result: PrepStatusResponse = await response.json();
    console.log('📊 Status:', result.status);

    return result;
  } catch (error) {
    console.error('❌ Error checking status:', error);
    throw error;
  }
}

/**
 * Parse PREP Checker raw report into normalized issues array
 * 
 * @param rawReport - Raw JSON from PREP Checker
 * @returns Array of normalized issues
 */
export function parseCheckerReport(rawReport: any): PrepIssue[] {
  try {
    console.log('🔄 Parsing checker report...');

    // The exact structure depends on what PREP returns
    // Adapt this based on actual API response
    const issues: PrepIssue[] = [];

    // Try to extract issues from various possible structures
    const checkerData = rawReport?.checkerData || rawReport?.result?.checkerData || rawReport;

    if (Array.isArray(checkerData?.issues)) {
      checkerData.issues.forEach((issue: any, index: number) => {
        issues.push({
          id: issue.id || `issue-${index}`,
          type: issue.type || issue.title || 'Unknown Issue',
          severity: normalizeSeverity(issue.severity || issue.level),
          page: issue.page || issue.location?.page || 0,
          description: issue.description || issue.message || '',
          fix_suggestions: Array.isArray(issue.suggestions)
            ? issue.suggestions
            : issue.suggestion
            ? [issue.suggestion]
            : [],
        });
      });
    }

    console.log(`✅ Parsed ${issues.length} issues`);
    return issues;
  } catch (error) {
    console.error('❌ Error parsing report:', error);
    return [];
  }
}

/**
 * Normalize severity levels to consistent format
 */
function normalizeSeverity(severity: any): 'low' | 'medium' | 'high' | 'critical' {
  const severityStr = String(severity || '').toLowerCase();
  
  if (severityStr.includes('critical') || severityStr.includes('severe')) {
    return 'critical';
  }
  if (severityStr.includes('high') || severityStr.includes('major')) {
    return 'high';
  }
  if (severityStr.includes('medium') || severityStr.includes('moderate')) {
    return 'medium';
  }
  return 'low';
}

/**
 * Calculate accessibility score from issues
 * 
 * @param totalChecks - Total number of checks performed
 * @param issues - Array of issues found
 * @returns Score from 0-100
 */
export function calculateAccessibilityScore(
  totalChecks: number,
  issues: PrepIssue[]
): number {
  if (totalChecks === 0) return 0;

  // Weight issues by severity
  const criticalWeight = 5;
  const highWeight = 3;
  const mediumWeight = 2;
  const lowWeight = 1;

  let totalDeductions = 0;

  issues.forEach((issue) => {
    switch (issue.severity) {
      case 'critical':
        totalDeductions += criticalWeight;
        break;
      case 'high':
        totalDeductions += highWeight;
        break;
      case 'medium':
        totalDeductions += mediumWeight;
        break;
      case 'low':
        totalDeductions += lowWeight;
        break;
    }
  });

  // Calculate score (higher deductions = lower score)
  const maxPossibleDeductions = totalChecks * criticalWeight;
  const score = Math.max(0, Math.min(100, 
    100 - (totalDeductions / maxPossibleDeductions) * 100
  ));

  return Math.round(score);
}
