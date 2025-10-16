# PREP Document Checker Integration - Complete Implementation

## 🎯 Overview

This document explains the complete PREP Document Checker API integration for real-time accessibility analysis of PDF documents.

## 📋 What Was Implemented

### 1. **Database Schema Updates** (`src/db/schema.ts`)

Added four new columns to the `pdfs` table:
- `prepSourceId`: Stores the source_id from PREP API
- `analysisStatus`: Tracks analysis state ('started', 'in-progress', 'completed', 'failed')
- `reportUrl`: Downloadable report URL from PREP
- `rawReport`: JSONB column storing normalized issues array

### 2. **API Route: Start Analysis** (`src/app/api/checker/start-analysis/route.ts`)

**Endpoint**: `POST /api/checker/start-analysis`

**Request Body**:
```json
{
  "pdfId": "uuid-of-pdf"
}
```

**Flow**:
1. Authenticates user with Clerk
2. Fetches PDF from database and validates ownership
3. Checks if analysis already started (prevents duplicates)
4. Calls PREP Analyze API:
   ```
   POST https://api-pdfservice.continualengine.com/pdf-content/pdf/analyze/
   Headers: api-id, app-key
   Body: { apiKey, apiId, fileUrl }
   ```
5. Extracts `source_id` from response
6. Updates database:
   - `prepSourceId = source_id`
   - `analysisStatus = 'started'`
7. Returns success response

**Response**:
```json
{
  "success": true,
  "message": "Analysis started successfully",
  "sourceId": "prep-source-id"
}
```

### 3. **API Route: Check Status** (`src/app/api/checker/status/route.ts`)

**Endpoint**: `GET /api/checker/status?pdfId={pdfId}`

**Flow**:
1. Authenticates user
2. Fetches PDF and validates
3. Checks if analysis has started
4. Returns cached results if already completed
5. Calls PREP Check Status API:
   ```
   GET https://api-pdfservice.continualengine.com/pdf-content/pdf/check-status/?source_id={sourceId}
   Headers: api-id, app-key
   ```
6. Processes response based on status:
   - **completed**: Normalizes issues and updates database
   - **in-progress**: Returns progress status
   - **failed**: Updates status and returns error

**Response (In Progress)**:
```json
{
  "ok": true,
  "status": "in-progress",
  "issues": []
}
```

**Response (Completed)**:
```json
{
  "ok": true,
  "status": "completed",
  "reportUrl": "https://...",
  "issues": [
    {
      "id": 1,
      "page": 2,
      "type": "Missing Alt Text",
      "severity": "critical",
      "description": "Image is missing alternative text",
      "suggestion": "Add descriptive alt text",
      "wcagReference": "WCAG 2.1 Level A"
    }
  ]
}
```

### 4. **Updated Upload Route** (`src/app/api/upload/route.ts`)

Added automatic analysis trigger after successful upload:
- Calls `/api/checker/start-analysis` internally
- Non-blocking: Upload succeeds even if analysis fails to start
- Logs any analysis trigger errors as warnings

### 5. **Updated ReportTab Component** (`src/components/ReportTab.tsx`)

**Complete Rewrite**:
- ✅ Removed all hardcoded/placeholder issues
- ✅ Accepts `pdfId` as prop
- ✅ Polls `/api/checker/status` every 5 seconds
- ✅ Shows loading state with poll count
- ✅ Displays real issues from PREP API
- ✅ Handles error states gracefully
- ✅ Shows "No issues found" when clean
- ✅ Calculates dynamic accessibility score

**States**:
1. **Loading**: Spinner with "Analyzing Document..." and poll counter
2. **Error**: Error message with refresh button
3. **Empty**: "Great Job! 🎉 No issues found"
4. **Issues Found**: Full issue list with:
   - Severity badges (critical, moderate, minor)
   - Issue type icons
   - Page numbers
   - Descriptions and suggestions
   - WCAG references
   - Accessibility score display

### 6. **Updated AIAssistant Component** (`src/components/AIAssistant.tsx`)

- Added `pdfId` prop
- Passes `pdfId` to `ReportTab` component

### 7. **Updated PDF Viewer Page** (`src/app/pdf-viewer/[id]/page.tsx`)

- Passes PDF ID to `AIAssistant` component
- Enables ReportTab to fetch analysis for correct PDF

## 🔄 Complete Workflow

```
1. USER UPLOADS PDF
   ↓
2. Upload Route (/api/upload)
   - Saves to database
   - Triggers analysis
   ↓
3. Start Analysis Route (/api/checker/start-analysis)
   - Calls PREP Analyze API
   - Saves source_id
   - Sets status = 'started'
   ↓
4. USER OPENS PDF VIEWER
   - Navigates to Report tab
   ↓
5. ReportTab Component
   - Starts polling every 5 seconds
   - Fetches /api/checker/status
   ↓
6. Status Route (/api/checker/status)
   - Checks PREP API for results
   - Returns in-progress OR completed
   ↓
7. WHEN COMPLETED
   - Issues normalized and cached
   - ReportTab displays real issues
   - Polling stops
```

## 🧪 Testing Instructions

### 1. Upload a PDF

```bash
# Make sure server is running on port 3001
npm run dev
```

1. Go to http://localhost:3001
2. Sign in with Clerk
3. Upload a PDF file
4. Check console logs for:
   ```
   ✅ Metadata saved to database with ID: xxx
   📡 Triggering PREP accessibility analysis...
   ✅ Analysis started: prep-source-id
   ```

### 2. Monitor Analysis

1. Open the uploaded PDF
2. Click the "Report" tab
3. You should see:
   - Loading spinner
   - "Analyzing Document..."
   - Poll counter increasing every 5 seconds
   - Console logs showing polling activity

### 3. View Results

After 30-60 seconds:
- Loading stops
- Issues appear (or "No issues found")
- Accessibility score calculated
- Issues show:
  - Type and severity
  - Description
  - Page number
  - Suggestions
  - WCAG references

### 4. Check Database

```sql
SELECT 
  id, 
  file_name, 
  prep_source_id, 
  analysis_status, 
  report_url,
  raw_report
FROM pdfs
WHERE user_id = 'your-clerk-user-id';
```

Expected values:
- `prep_source_id`: "source_id_xxx"
- `analysis_status`: "completed"
- `report_url`: "https://..."
- `raw_report`: JSON array of issues

## 🔍 API Endpoints Reference

### PREP API Endpoints Used

1. **Analyze PDF**
   ```
   POST https://api-pdfservice.continualengine.com/pdf-content/pdf/analyze/
   Headers:
     api-id: prepapi_FRYBIERLJO
     app-key: <your-app-key>
   Body:
     {
       "apiKey": "<your-app-key>",
       "apiId": "prepapi_FRYBIERLJO",
       "fileUrl": "https://..."
     }
   ```

2. **Check Status**
   ```
   GET https://api-pdfservice.continualengine.com/pdf-content/pdf/check-status/?source_id={id}
   Headers:
     api-id: prepapi_FRYBIERLJO
     app-key: <your-app-key>
   ```

### Our API Endpoints

1. **Start Analysis**
   ```
   POST /api/checker/start-analysis
   Body: { pdfId: "uuid" }
   ```

2. **Check Status**
   ```
   GET /api/checker/status?pdfId={uuid}
   ```

## 📊 Issue Normalization

PREP API responses vary in structure. Our code handles:

```typescript
// Possible locations for issues in PREP response
- prepData.result?.checkerData
- prepData.result?.issues
- prepData.checkerData
- prepData.issues

// Normalized to:
{
  id: number,
  page: number | null,
  type: string,
  severity: string,
  description: string,
  suggestion: string | null,
  wcagReference: string | null
}
```

## 🐛 Debugging

### Check Console Logs

Frontend (Browser):
```
🔍 [ReportTab] Fetching status for pdfId: xxx
📡 [ReportTab] Response status: 200
📊 [ReportTab] Response data: {...}
✅ [ReportTab] Analysis completed!
```

Backend (Terminal):
```
🚀 [START-ANALYSIS] New analysis request received
✅ [START-ANALYSIS] User authenticated: user_xxx
📡 [START-ANALYSIS] Calling PREP Analyze API...
🎯 [START-ANALYSIS] Source ID received: xxx
💾 [START-ANALYSIS] Database updated successfully

🔍 [STATUS] Status check request received
📡 [STATUS] Calling PREP Check Status API...
🎉 [STATUS] Analysis completed!
📋 [STATUS] Found X issues
✅ [STATUS] Normalized X issues
💾 [STATUS] Database updated with results
```

### Common Issues

1. **"No analysis started for this PDF"**
   - Analysis wasn't triggered
   - Check upload logs
   - Manually call `/api/checker/start-analysis`

2. **"PREP API error: 403"**
   - Check API credentials in `.env.local`
   - Verify PREP_API_ID and PREP_APP_KEY

3. **Polling doesn't stop**
   - PREP API might be slow
   - Check PREP API status directly
   - Verify source_id is correct

4. **No issues showing**
   - Check if analysis actually completed
   - Look at `raw_report` in database
   - Verify issue normalization logic

## 🔐 Environment Variables Required

```env
# PREP API Credentials
PREP_API_ID=prepapi_FRYBIERLJO
PREP_APP_KEY=your-app-key-here

# Database
DATABASE_URL=your-neon-connection-string

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx
CLERK_SECRET_KEY=sk_test_xxx

# Supabase Storage
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx
SUPABASE_SERVICE_ROLE_KEY=eyJxxx
```

## ✅ Implementation Checklist

- [x] Database schema updated with PREP fields
- [x] Start analysis endpoint created
- [x] Status check endpoint created
- [x] Upload route triggers analysis automatically
- [x] ReportTab displays real issues
- [x] Polling mechanism implemented
- [x] Error handling added
- [x] Loading states implemented
- [x] Console logging for debugging
- [x] Issue normalization logic
- [x] WCAG references displayed
- [x] Accessibility score calculation
- [x] Database migrations applied

## 🚀 Next Steps

1. **Test with Real PDFs**: Upload various PDFs with accessibility issues
2. **Monitor Performance**: Check PREP API response times
3. **Error Handling**: Test error scenarios (invalid PDFs, API failures)
4. **UI Polish**: Add animations, better loading indicators
5. **Caching**: Consider caching completed analyses
6. **Webhooks**: Implement PREP webhooks if available (to avoid polling)

## 📞 Support

If you encounter issues:
1. Check console logs (browser and terminal)
2. Verify environment variables
3. Test PREP API directly with Postman/cURL
4. Check database for correct data
5. Review this documentation

PREP API Support:
- rajat.prakash@continualengine.com
- shubham.doval@continualengine.com
- support@continualengine.com
