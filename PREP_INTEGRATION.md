# PREP Checker API Integration

## Overview

This integration connects your PDF accessibility checker app with the PREP Checker API to perform automated accessibility analysis on uploaded PDFs.

## Environment Variables

Add these to your `.env.local` file (DO NOT COMMIT):

```bash
# Supabase (already configured)
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>

# Database (already configured)
DATABASE_URL=<your-neon-postgres-url>

# PREP Checker API (REQUIRED - ADD THESE)
PREP_API_ID=prepapi_FRYBIERLJO
PREP_APP_KEY=9VOK2XKUNAYXP2C8VFB10R

# Optional polling configuration
PREP_POLL_INTERVAL_MS=3000  # Poll every 3 seconds
PREP_POLL_MAX_ATTEMPTS=20   # Max 60 seconds (20 × 3s)
```

## Database Migration

After adding the new table schema, run:

```bash
npx drizzle-kit push
```

This will create the `pdf_analyses` table in your Neon database.

## API Endpoints

### 1. Initiate Analysis
**POST** `/api/checker/initiate`

Starts an accessibility check for a PDF.

**Request:**
```json
{
  "pdfId": "uuid-of-pdf"
}
```

**Response:**
```json
{
  "ok": true,
  "source_id": "1423",
  "analysisId": "uuid",
  "message": "Accessibility check initiated successfully"
}
```

### 2. Check Status
**POST** `/api/checker/status`

Checks the current status and fetches results when complete.

**Request:**
```json
{
  "analysisId": "uuid"
}
```
OR
```json
{
  "source_id": "1423"
}
```

**Response (in-progress):**
```json
{
  "ok": true,
  "status": "in-progress",
  "source_id": "1423",
  "analysisId": "uuid"
}
```

**Response (completed):**
```json
{
  "ok": true,
  "status": "completed",
  "source_id": "1423",
  "analysisId": "uuid",
  "result": {
    "checkerData": { ... },
    "file_url": "https://download-url..."
  },
  "report_url": "https://download-url..."
}
```

### 3. Get Analysis
**GET** `/api/checker/analysis?pdfId=<uuid>`

Retrieves the latest analysis results for a PDF.

**Response:**
```json
{
  "ok": true,
  "analysis": {
    "id": "uuid",
    "status": "completed",
    "reportUrl": "https://...",
    "issues": [
      {
        "id": "issue-1",
        "type": "missing_alt_text",
        "severity": "high",
        "page": 2,
        "description": "Image missing alt text",
        "fix_suggestions": ["Add descriptive alt text"]
      }
    ],
    "createdAt": "2025-01-15T...",
    "updatedAt": "2025-01-15T..."
  },
  "pdf": {
    "id": "uuid",
    "fileName": "document.pdf",
    "accessibilityScore": 76
  }
}
```

## Frontend Integration

### Analyze Button + Polling

```typescript
const [analyzing, setAnalyzing] = useState(false);
const [status, setStatus] = useState('');

async function runAccessibilityCheck(pdfId: string) {
  try {
    setAnalyzing(true);
    setStatus('Initiating...');

    // Step 1: Initiate the check
    const initResponse = await fetch('/api/checker/initiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pdfId }),
    });

    const { ok, source_id, analysisId } = await initResponse.json();

    if (!ok) {
      throw new Error('Failed to initiate check');
    }

    setStatus('Processing...');

    // Step 2: Poll for status
    const pollInterval = 3000; // 3 seconds
    const maxAttempts = 20; // 60 seconds total
    let attempts = 0;

    const poll = async () => {
      if (attempts >= maxAttempts) {
        setStatus('Timeout - check later');
        setAnalyzing(false);
        return;
      }

      attempts++;

      const statusResponse = await fetch('/api/checker/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysisId }),
      });

      const statusData = await statusResponse.json();

      if (statusData.status === 'completed') {
        setStatus('Complete!');
        setAnalyzing(false);
        // Refresh UI to show results
        loadAnalysisResults(pdfId);
      } else if (statusData.status === 'failed') {
        setStatus('Failed: ' + statusData.error);
        setAnalyzing(false);
      } else {
        // Still processing, poll again
        setTimeout(poll, pollInterval);
      }
    };

    // Start polling
    setTimeout(poll, pollInterval);

  } catch (error) {
    console.error('Error:', error);
    setStatus('Error: ' + error.message);
    setAnalyzing(false);
  }
}
```

### Display Results

```typescript
const [analysis, setAnalysis] = useState(null);

async function loadAnalysisResults(pdfId: string) {
  const response = await fetch(`/api/checker/analysis?pdfId=${pdfId}`);
  const { ok, analysis } = await response.json();

  if (ok && analysis) {
    setAnalysis(analysis);
  }
}

// In your JSX:
{analysis && analysis.status === 'completed' && (
  <div>
    <h3>Accessibility Score: {pdf.accessibilityScore}%</h3>
    
    {analysis.reportUrl && (
      <a href={analysis.reportUrl} download>
        Download Full Report
      </a>
    )}

    <h4>Issues Found ({analysis.issues.length})</h4>
    {analysis.issues.map((issue) => (
      <div key={issue.id} className={`issue-${issue.severity}`}>
        <strong>{issue.type}</strong> (Page {issue.page})
        <p>{issue.description}</p>
        <ul>
          {issue.fix_suggestions.map((suggestion, i) => (
            <li key={i}>{suggestion}</li>
          ))}
        </ul>
      </div>
    ))}
  </div>
)}
```

## Testing Checklist

- [ ] Upload a PDF to the app
- [ ] Click "Analyze" button in Report tab
- [ ] Verify `/api/checker/initiate` returns `source_id` and `analysisId`
- [ ] Poll `/api/checker/status` until status is `completed`
- [ ] Check database `pdf_analyses` table has `rawReport` and `reportUrl`
- [ ] Verify Report tab displays issues list
- [ ] Click download link - should download report
- [ ] Try with different user - should be blocked (403)
- [ ] Check that `pdf.accessibilityScore` is updated

## Security Notes

- ✅ All endpoints verify Clerk authentication
- ✅ PDF ownership is checked before allowing operations
- ✅ SUPABASE_SERVICE_ROLE_KEY is only used server-side
- ✅ PREP API credentials are only in server environment
- ⚠️ NEVER commit `.env.local` to Git
- ⚠️ Use `.gitignore` to exclude sensitive files

## Troubleshooting

### "PREP API credentials not configured"
- Ensure `PREP_API_ID` and `PREP_APP_KEY` are in `.env.local`
- Restart your dev server after adding env vars

### "Failed to download PDF"
- Check `SUPABASE_SERVICE_ROLE_KEY` is correct
- Verify PDF URL format is valid

### Status stuck at "in-progress"
- PREP API may take 30-60 seconds for large files
- Increase `PREP_POLL_MAX_ATTEMPTS` if needed

### "Analysis not found"
- Ensure you're passing correct `pdfId` or `analysisId`
- Check user owns the PDF

## File Structure

```
src/
├── app/api/checker/
│   ├── initiate/route.ts     # Start analysis
│   ├── status/route.ts       # Check status
│   └── analysis/route.ts     # Get results
├── db/schema.ts              # Database tables
└── lib/prepClient.ts         # PREP API client
```

## Next Steps

1. **Run Database Migration**: `npx drizzle-kit push`
2. **Update Report Tab UI**: Add "Analyze" button and polling logic
3. **Test with Sample PDF**: Upload and analyze a PDF
4. **Style Issues List**: Make it look good!
5. **Add Error Handling**: Show user-friendly messages

## Support

For PREP Checker API questions, contact:
- rajat.prakash@continualengine.com
- shubham.doval@continualengine.com
- support@continualengine.com
