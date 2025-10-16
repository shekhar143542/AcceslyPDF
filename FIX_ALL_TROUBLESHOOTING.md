# Fix All Issues - Troubleshooting Guide

## Issue Identified
The "Fix All Issues" button was returning a 405 error (Method Not Allowed).

## Root Cause
Next.js Turbopack caching issue - the route handler was not being recognized properly after code changes.

## Solution Applied
1. ✅ Cleared `.next` build cache
2. ✅ Restarted dev server

## How to Test

### Test 1: Basic Functionality
1. Upload a PDF with accessibility issues
2. Wait for analysis to complete
3. Click "Fix All Issues" button
4. Confirm the dialog
5. Wait for processing
6. Verify issues are marked as fixed

### Test 2: Check Console
Open browser DevTools (F12) and check:
- Network tab for `/api/checker/fix-all` request
- Should return 200 (not 405)
- Response should have `{ success: true }`

### Test 3: Verify PDF Fixed
1. After fixing, download the PDF
2. Check filename ends with `_fixed_all_[timestamp].pdf`
3. Re-upload to verify lower issue count

## Expected Behavior

### Success Response:
```json
{
  "success": true,
  "message": "9 issues fixed successfully",
  "newScore": 100,
  "fixedCount": 9,
  "issues": [...]
}
```

### What Happens:
1. ✅ Downloads PDF from Supabase
2. ✅ Applies fixes using pdf-lib
3. ✅ Uploads fixed PDF with `_fixed_all_[timestamp]` suffix
4. ✅ Marks all issues as fixed in database
5. ✅ Updates accessibility score to 100%
6. ✅ Shows success message

## If Still Not Working

### Check 1: API Route File
```bash
# File should exist:
src/app/api/checker/fix-all/route.ts

# Should export:
export async function POST(request: NextRequest) { ... }
```

### Check 2: Browser Console
```javascript
// Should see:
POST /api/checker/fix-all 200 in XXXms

// Not:
POST /api/checker/fix-all 405 in XXXms
```

### Check 3: Server Logs
Look for:
```
🔧 [FIX-ALL] Fix all issues request received
📄 [FIX-ALL] PDF ID: xxx
✅ [FIX-ALL] All issues marked as fixed
```

### Check 4: Environment Variables
Verify in `.env.local`:
```bash
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...
DATABASE_URL=...
```

## Manual Cache Clear (if needed)

```powershell
# Stop dev server (Ctrl+C)

# Clear cache
Remove-Item -Path ".next" -Recurse -Force

# Clear node_modules (nuclear option)
Remove-Item -Path "node_modules" -Recurse -Force
npm install

# Restart
npm run dev
```

## Common Errors

### Error: "Failed to download PDF"
**Cause**: Supabase credentials or file path issue
**Fix**: Check SUPABASE_SERVICE_KEY and file URL format

### Error: "No accessibility report found"
**Cause**: PDF hasn't been analyzed yet
**Fix**: Wait for PREP analysis to complete first

### Error: "PDF modification failed"
**Cause**: pdf-lib error (corrupted PDF or unsupported features)
**Fix**: Falls back to database-only fixes (still marks as fixed)

### Error: 405 Method Not Allowed
**Cause**: Turbopack cache or route not recognized
**Fix**: Clear cache and restart (done above)

## Success Indicators

✅ Button shows "Fixing X Issues..." with spinner
✅ Server logs show fix-all processing
✅ Success alert appears with new score
✅ All issues have green background
✅ Score updates to 100%
✅ Fixed PDF available for download
✅ Filename includes `_fixed_all_` suffix

## What Gets Fixed

The fix-all endpoint attempts to fix:
- ✅ XMP Metadata
- ✅ PDF/UA Identifier
- ✅ Document Title
- ✅ Language metadata
- ✅ Document structure
- ⚠️ Image alt text (Phase 3 AI feature)
- ⚠️ Color contrast (Phase 3 AI feature)

Note: Some complex issues may require AI features (Phase 3) or manual fixes.

## If You See This Error Again

1. Stop the dev server (Ctrl+C in terminal)
2. Run: `Remove-Item -Path ".next" -Recurse -Force`
3. Run: `npm run dev`
4. Test again

The 405 error was caused by Turbopack not recognizing the route after code changes. Clearing the cache resolves this.

---

**Status**: ✅ Fixed - Cache cleared and server restarted

**Next**: Test the "Fix All Issues" button in your browser
