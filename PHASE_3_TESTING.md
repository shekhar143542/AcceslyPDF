# Phase 3 Testing Guide

## 🧪 Quick Test Checklist

### Prerequisites
- [x] Dependencies installed (`openai`, `sharp`, `pdf-parse`)
- [ ] OpenAI API key configured in `.env.local`
- [x] Dev server running on port 3001
- [x] UI buttons visible in ReportTab

### Test 1: Alt Text Generation (AI) 🤖

**Test PDF Requirements:**
- PDF with 2-3 images
- Images missing alt text
- Clear, recognizable images (photos, icons, diagrams)

**Steps:**
1. Upload test PDF
2. Wait for PREP analysis to complete
3. Verify image issues appear in report
4. Look for purple/blue "Generate Alt Text (AI)" button
5. Note the estimated cost displayed (e.g., "$0.06" for 3 images)
6. Click the button
7. Confirm the dialog prompt
8. Wait for AI processing (loading spinner should appear)
9. Verify success message with:
   - Number of images processed
   - Actual cost
   - New accessibility score

**Expected Results:**
✅ Button appears when image issues exist
✅ Cost estimate shown: `$X.XX` (0.02 per image)
✅ Loading state: "Generating AI Alt Text..."
✅ Success alert: "Generated alt text for N images!"
✅ Issues marked as fixed (green background)
✅ Score increases to 95-100%
✅ Fixed PDF available for download

**What Good Alt Text Looks Like:**
- "A smiling woman holding a laptop in an office"
- "Red circular stop sign icon"
- "Bar chart showing quarterly sales growth"
- Under 125 characters
- Descriptive but concise

### Test 2: Color Contrast Analysis (AI) 🎨

**Test PDF Requirements:**
- PDF with low-contrast text
- Gray text on white background
- Light colors that fail WCAG

**Steps:**
1. Upload test PDF with contrast issues
2. Wait for PREP analysis to complete
3. Verify contrast issues appear in report
4. Look for pink/orange "Analyze Contrast (AI)" button
5. Click the button
6. Confirm the dialog prompt
7. Wait for analysis (loading spinner should appear)
8. Verify success message with:
   - AA failure count
   - AAA failure count
   - New accessibility score

**Expected Results:**
✅ Button appears when contrast issues exist
✅ Loading state: "Analyzing Contrast..."
✅ Success alert with AA/AAA failure counts
✅ Contrast issues marked as fixed
✅ Score increases
✅ Fixed PDF available for download

**WCAG Compliance Levels:**
- **AA**: 4.5:1 for normal text, 3:1 for large text
- **AAA**: 7:1 for normal text, 4.5:1 for large text

### Test 3: Error Handling 🚨

**Test Missing API Key:**
1. Remove or comment out `OPENAI_API_KEY` in `.env.local`
2. Restart dev server
3. Try generating alt text
4. Verify error message: "Make sure OPENAI_API_KEY is configured"

**Test Invalid API Key:**
1. Set `OPENAI_API_KEY=sk-invalid123` in `.env.local`
2. Restart dev server
3. Try generating alt text
4. Verify error message about invalid authentication

**Expected Results:**
✅ Clear error messages
✅ Helpful troubleshooting tips
✅ No crashes or blank screens
✅ Loading state stops properly

### Test 4: UI States 🎭

**Test Button Visibility:**
- Upload PDF with only title issues → No AI buttons
- Upload PDF with image issues → Alt text button visible
- Upload PDF with contrast issues → Contrast button visible
- Upload PDF with both → Both buttons visible
- Fix all issues manually → AI buttons disappear

**Test Loading States:**
- Click "Generate Alt Text" → Button shows spinner
- Button text changes to "Generating AI Alt Text..."
- Button is disabled during processing
- Other buttons remain functional

**Expected Results:**
✅ Conditional rendering works correctly
✅ Loading states are smooth
✅ No UI freezing
✅ Buttons re-enable after completion

### Test 5: Cost Estimation 💰

**Verify Cost Display:**
- 1 image → "$0.02"
- 5 images → "$0.10"
- 10 images → "$0.20"
- 50 images → "$1.00"

**Verify Cost in Results:**
- Check success alert shows actual cost
- Compare estimated vs. actual cost
- Verify cost is reasonable

**Expected Results:**
✅ Cost estimate displayed before operation
✅ Actual cost shown in success message
✅ Costs match expectations (~$0.02/image)
✅ No unexpected charges

## 🐛 Common Issues & Solutions

### Issue: "Button not appearing"
**Solution:**
- Check if PDF has relevant issues (images for alt text, colors for contrast)
- Wait for PREP analysis to complete
- Verify issues are marked as unfixed
- Check browser console for errors

### Issue: "OpenAI API key not configured"
**Solution:**
```bash
# Open .env.local and add:
OPENAI_API_KEY=sk-proj-your-actual-key-here

# Restart dev server:
npm run dev
```

### Issue: "AI generation failed"
**Possible Causes:**
1. Invalid API key → Check OpenAI dashboard
2. Insufficient credits → Add credits to account
3. Rate limit exceeded → Wait 1 minute and retry
4. Network error → Check internet connection
5. PDF image extraction failed → Try different PDF

### Issue: "Image extraction placeholder"
**Note:** The current implementation uses placeholder logic for image extraction. Full implementation requires:
1. Parse PDF structure with pdf-parse
2. Extract embedded images
3. Convert to base64 for OpenAI
4. This is part of Week 2 improvements

### Issue: "Cost higher than expected"
**Causes:**
- Using high-detail mode (currently set to low-detail)
- Processing duplicate images
- Multiple retry attempts

**Solution:**
- Check OpenAI usage dashboard
- Verify image count matches expectations
- Review API call logs

## 📊 Performance Benchmarks

### Expected Timings:
- Alt text for 1 image: ~3-5 seconds
- Alt text for 5 images: ~8-12 seconds (parallel processing)
- Alt text for 10 images: ~15-20 seconds
- Contrast analysis: ~2-3 seconds (any number of issues)

### Memory Usage:
- Small PDF (1-2 MB): ~50-100 MB
- Medium PDF (5-10 MB): ~150-250 MB
- Large PDF (20+ MB): ~400-600 MB

### API Rate Limits:
- OpenAI Free Tier: 3 requests/min
- OpenAI Paid Tier: 3,500 requests/min
- Implement batching for large PDFs

## ✅ Success Criteria

Phase 3 is working correctly if:

1. ✅ AI buttons appear conditionally based on issue types
2. ✅ Cost estimates are displayed and accurate
3. ✅ Alt text is generated with good quality (<125 chars, descriptive)
4. ✅ Contrast analysis provides WCAG-compliant results
5. ✅ Issues are marked as fixed after AI processing
6. ✅ Accessibility scores update correctly (95-100%)
7. ✅ Fixed PDFs are available for download
8. ✅ Error handling works gracefully
9. ✅ Loading states are smooth and responsive
10. ✅ No console errors or warnings

## 🎯 Test Scenarios

### Scenario A: Perfect Path
1. Upload PDF with 3 images and 2 contrast issues
2. Generate alt text for all images ($0.06)
3. Analyze contrast for all issues
4. Verify score reaches 100%
5. Download fixed PDF
6. Re-upload fixed PDF
7. Verify no issues remain

### Scenario B: Partial Fixing
1. Upload PDF with 10 images
2. Fix 5 images manually
3. Generate alt text for remaining 5 with AI
4. Verify only unfixed images processed
5. Cost should be $0.10 (not $0.20)

### Scenario C: Multiple Rounds
1. Upload PDF
2. Generate alt text
3. Fix some issues manually
4. Generate alt text again for new issues
5. Verify no duplicate processing
6. Verify cumulative cost tracking

## 📝 Manual Testing Checklist

- [ ] Install dependencies successfully
- [ ] Add OpenAI API key to .env.local
- [ ] Restart dev server
- [ ] Upload PDF with images
- [ ] Wait for analysis
- [ ] See "Generate Alt Text (AI)" button
- [ ] Click button and confirm
- [ ] Wait for processing
- [ ] See success message with cost
- [ ] Verify issues marked as fixed
- [ ] Download fixed PDF
- [ ] Upload PDF with contrast issues
- [ ] See "Analyze Contrast (AI)" button
- [ ] Click button and confirm
- [ ] Wait for analysis
- [ ] See AA/AAA failure counts
- [ ] Verify contrast issues fixed
- [ ] Test with missing API key
- [ ] Verify error handling works
- [ ] Check browser console for errors
- [ ] Verify no crashes or freezes

## 🚀 Ready for Production?

Before deploying to production:

1. **Environment Variables**
   - [ ] Add `OPENAI_API_KEY` to production environment
   - [ ] Verify all other env vars are set
   - [ ] Use separate API keys for dev/prod

2. **Security**
   - [ ] API keys stored securely (not in git)
   - [ ] Rate limiting implemented
   - [ ] Usage monitoring enabled
   - [ ] Billing alerts configured

3. **Performance**
   - [ ] Test with large PDFs (20+ MB)
   - [ ] Verify parallel processing works
   - [ ] Monitor API response times
   - [ ] Check memory usage

4. **Error Handling**
   - [ ] All error cases handled gracefully
   - [ ] User-friendly error messages
   - [ ] Logging for debugging
   - [ ] Fallback behavior defined

5. **Cost Management**
   - [ ] Usage tracking implemented
   - [ ] Cost alerts configured
   - [ ] User notifications for expensive operations
   - [ ] Monthly budget limits set

---

**Test Status**: Ready to test after OpenAI API key configuration

**Next Steps**: 
1. Add OpenAI API key to `.env.local`
2. Run through manual testing checklist
3. Report any issues found
4. Proceed to Week 2 features (OCR, tables)
