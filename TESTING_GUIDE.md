# Quick Testing Guide - PREP Integration

## 🎯 Quick Start

### 1. Start Development Server

```powershell
npm run dev
```

Server should start on **http://localhost:3001** (port 3000 is in use)

### 2. Upload & Analyze Workflow

#### Step 1: Upload a PDF
1. Navigate to http://localhost:3001
2. Sign in with your Clerk account
3. Click "Upload PDF" button
4. Select a PDF file
5. Click "Upload"

**Expected Console Output**:
```
📤 Upload request from user: user_xxx
📄 File received: document.pdf (12345 bytes)
✅ File uploaded to Supabase: https://...
✅ Metadata saved to database with ID: abc-123
📡 Triggering PREP accessibility analysis...
✅ Analysis started: source_id_xxx
```

#### Step 2: Open PDF Viewer
1. Click on the uploaded PDF card
2. You'll be redirected to `/pdf-viewer/[id]`
3. The PDF will load on the left side
4. AI Assistant panel is on the right

#### Step 3: View Report Tab
1. Click the "Report" tab in the AI Assistant panel
2. You should see:
   - **Loading State**: 
     - Spinning loader
     - "Analyzing Document..."
     - "Your PDF is being analyzed for accessibility issues..."
     - Poll counter: "Checking... (Poll #1)", "#2", etc.

**Expected Browser Console Output**:
```
🔍 [ReportTab] Fetching status for pdfId: abc-123
🔍 [ReportTab] Poll count: 0
📡 [ReportTab] Response status: 200
📊 [ReportTab] Response data: { "ok": true, "status": "in-progress", "issues": [] }
⏳ [ReportTab] Analysis in progress, will poll again in 5 seconds...
```

#### Step 4: Wait for Completion (30-60 seconds)
The ReportTab will automatically poll every 5 seconds.

**When Completed**:
```
✅ [ReportTab] Analysis completed!
✅ [ReportTab] Issues: [{ id: 1, type: "Missing Alt Text", ... }]
```

**UI Will Show**:
- Accessibility Score (e.g., "75% - Fair")
- Total Issues count
- Critical Issues count
- List of issues with:
  - Icon (based on type)
  - Severity badge (red/orange/yellow)
  - Description
  - Suggestion (💡)
  - Page number
  - WCAG reference

**If No Issues**:
```
✅ Great Job! 🎉
No accessibility issues found in this document.
```

## 🧪 Test Cases

### Test Case 1: Normal PDF with Issues
**Steps**:
1. Upload a PDF with accessibility issues
2. Wait for analysis to complete
3. Verify issues are displayed

**Expected**:
- Loading → Issues displayed
- Score calculated correctly
- All issue fields populated

### Test Case 2: Clean PDF
**Steps**:
1. Upload a fully accessible PDF
2. Wait for analysis to complete

**Expected**:
- Loading → "Great Job! 🎉" message
- Score: 100%
- No issues list

### Test Case 3: Already Analyzed PDF
**Steps**:
1. Refresh the page after analysis completes
2. Navigate to Report tab again

**Expected**:
- Instant results (no loading)
- Data loaded from cache
- No API calls to PREP

### Test Case 4: Error Handling
**Steps**:
1. Temporarily disable PREP API credentials
2. Upload a PDF

**Expected**:
- Error message displayed
- "Refresh Page" button available
- Console shows error details

## 📊 Database Verification

Open your Neon database console or use SQL:

```sql
SELECT 
  id,
  file_name,
  prep_source_id,
  analysis_status,
  report_url,
  LENGTH(raw_report::text) as report_size
FROM pdfs
ORDER BY created_at DESC
LIMIT 5;
```

**Expected Values After Upload**:
- `prep_source_id`: `"source_id_xxx"` ✓
- `analysis_status`: `"started"` ✓

**Expected Values After Completion**:
- `prep_source_id`: `"source_id_xxx"` ✓
- `analysis_status`: `"completed"` ✓
- `report_url`: `"https://..."` ✓
- `raw_report`: JSON array with issues ✓

**View Raw Report**:
```sql
SELECT raw_report 
FROM pdfs 
WHERE id = 'your-pdf-id';
```

## 🔍 API Testing (Manual)

### Test Start Analysis Endpoint

```powershell
# Replace {pdfId} with actual UUID from database
curl -X POST http://localhost:3001/api/checker/start-analysis `
  -H "Content-Type: application/json" `
  -d '{"pdfId": "your-pdf-id-here"}'
```

**Expected Response**:
```json
{
  "success": true,
  "message": "Analysis started successfully",
  "sourceId": "source_id_xxx"
}
```

### Test Status Endpoint

```powershell
# Replace {pdfId} with actual UUID
curl http://localhost:3001/api/checker/status?pdfId=your-pdf-id-here
```

**Expected Response (In Progress)**:
```json
{
  "ok": true,
  "status": "in-progress",
  "issues": []
}
```

**Expected Response (Completed)**:
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
      "description": "Image on page 2 is missing alternative text",
      "suggestion": "Add descriptive alt text to all images",
      "wcagReference": "WCAG 2.1 Level A - 1.1.1"
    }
  ]
}
```

## 🚨 Troubleshooting

### Issue: "No analysis started for this PDF"

**Cause**: Analysis wasn't triggered during upload

**Solution**:
1. Check upload logs in terminal
2. Manually trigger analysis:
```powershell
curl -X POST http://localhost:3001/api/checker/start-analysis `
  -H "Content-Type: application/json" `
  -d '{"pdfId": "your-pdf-id"}'
```

### Issue: Loading Never Stops

**Cause**: PREP API is slow or stuck

**Solution**:
1. Check terminal logs for PREP API responses
2. Check database: `SELECT analysis_status, prep_source_id FROM pdfs WHERE id='...'`
3. Test PREP API directly:
```powershell
curl "https://api-pdfservice.continualengine.com/pdf-content/pdf/check-status/?source_id=YOUR_SOURCE_ID" `
  -H "api-id: prepapi_FRYBIERLJO" `
  -H "app-key: YOUR_APP_KEY"
```

### Issue: "PREP API error: 403"

**Cause**: Invalid credentials

**Solution**:
1. Check `.env.local`:
```env
PREP_API_ID=prepapi_FRYBIERLJO
PREP_APP_KEY=your-correct-key
```
2. Restart dev server:
```powershell
# Ctrl+C to stop
npm run dev
```

### Issue: ReportTab Not Receiving pdfId

**Cause**: Props not passed correctly

**Solution**:
1. Check browser console for errors
2. Verify PDF Viewer page passes `pdfId` to AIAssistant
3. Verify AIAssistant passes `pdfId` to ReportTab

## ✅ Success Indicators

### Upload Success
- ✅ PDF appears in dashboard
- ✅ Console shows "Analysis started"
- ✅ Database has `prep_source_id`

### Analysis Success
- ✅ ReportTab shows loading state
- ✅ Poll counter increments
- ✅ Console logs show polling activity
- ✅ After 30-60s, issues appear OR "No issues" message

### Database Success
- ✅ `analysis_status` = "completed"
- ✅ `raw_report` contains JSON array
- ✅ `report_url` has download link

## 📝 Sample Test Data

Create a test PDF with these accessibility issues:
1. Image without alt text
2. Low contrast text
3. Missing document title
4. Improper heading structure
5. Form fields without labels

This will generate multiple issues across different severity levels for thorough testing.

## 🎉 Expected Final Result

After following all steps, you should see:

**Report Tab Display**:
```
┌─────────────────────────────────┐
│ Accessibility Score             │
│                                 │
│  ⚠️  75%  Fair                 │
│  ██████████░░░░░  (75%)        │
│                                 │
│  Total Issues: 5   Critical: 2  │
└─────────────────────────────────┘

Issues Found (5)

┌─────────────────────────────────┐
│ 🖼️  Missing Alt Text            │
│ [CRITICAL]                      │
│ Image on page 2 is missing...  │
│ 💡 Add descriptive alt text     │
│                                 │
│ Page 2  •  WCAG: 1.1.1         │
└─────────────────────────────────┘

[... more issues ...]
```

## 🔄 Full Flow Diagram

```
User Action          Backend              PREP API           Database
────────────────────────────────────────────────────────────────────
1. Upload PDF  →
                  /api/upload
                      ↓
                  Save metadata  ───────→  INSERT pdfs
                      ↓
                  /api/checker/start-analysis
                      ↓              Analyze PDF  →
                      ↓              ← source_id
                      ↓
                  Update DB     ───────→  UPDATE pdfs
                                         SET prep_source_id
                                         SET analysis_status='started'

2. Open Report Tab →
                  useEffect polling
                      ↓
                  /api/checker/status
                      ↓              Check Status →
                  (every 5s)         ← in-progress
                      ↓
                  Return status
                      ↓
3. Wait 30-60s...
                  /api/checker/status
                      ↓              Check Status →
                      ↓              ← completed + issues
                      ↓
                  Normalize issues
                      ↓
                  Update DB     ───────→  UPDATE pdfs
                                         SET analysis_status='completed'
                                         SET raw_report=issues
                      ↓
                  Return issues
                      ↓
4. View Issues  ←  Display in UI
```

## 📞 Need Help?

1. Check terminal logs (backend)
2. Check browser console (frontend)
3. Check database values
4. Review `PREP_IMPLEMENTATION_GUIDE.md`
5. Test PREP API directly
6. Contact PREP support if API issues persist
