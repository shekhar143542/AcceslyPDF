# 📊 Accessibility Score Synchronization Update

## Problem
When fixing accessibility issues in the PDF viewer (Report tab - Image 1), the accessibility score would update correctly there. However, the Dashboard (Recent Uploads - Image 2) would not show the updated score until the page was manually refreshed.

## Root Cause
The two views operate independently:
- **Report Tab**: Updates issues in real-time when fixed
- **Dashboard**: Fetches PDF data from the database but wasn't notified of updates

Even though the backend was correctly updating the database with new scores, the Dashboard had no mechanism to know when to refetch the data.

## Solution Implemented

### 1. **Event-Based Communication** 
Added browser events to notify the Dashboard when scores are updated:

#### In ReportTab.tsx
After fixing issues, we now trigger an update event:
```typescript
// Notify dashboard to refetch (trigger update)
localStorage.setItem('pdfScoreUpdated', Date.now().toString());
window.dispatchEvent(new Event('pdfScoreUpdated'));
```

This happens in 4 places:
- ✅ `fixIssue()` - When a single issue is fixed
- ✅ `fixAllIssues()` - When all issues are fixed
- ✅ `handleGenerateAltText()` - When AI generates alt text
- ✅ `handleAnalyzeContrast()` - When AI analyzes contrast

### 2. **Dashboard Listeners**
Added event listeners in Dashboard to catch these updates:

#### Immediate Event Listener
```typescript
window.addEventListener('pdfScoreUpdated', handleScoreUpdate);
```
Catches events in the same window (same tab).

#### Focus Event Listener
```typescript
window.addEventListener('focus', handleFocus);
```
When you switch back to the Dashboard tab, it checks localStorage for recent updates (within 30 seconds) and refetches if needed.

#### Periodic Auto-Refresh
```typescript
setInterval(() => {
  if (isSignedIn && !isLoading) {
    fetchPDFs();
  }
}, 30000); // Every 30 seconds
```
Ensures Dashboard stays fresh even if events are missed.

## How It Works

### Scenario 1: Same Tab Navigation
1. User opens PDF viewer and fixes issues
2. Event triggers: `localStorage` + `window.dispatchEvent()`
3. User clicks "Back to Dashboard"
4. Dashboard detects recent update via focus event
5. Dashboard refetches PDF list
6. ✅ Updated score displays immediately

### Scenario 2: Multiple Tabs
1. User has Dashboard open in Tab A
2. User opens PDF viewer in Tab B and fixes issues
3. Event triggers: `localStorage` updated
4. User switches back to Tab A (Dashboard)
5. Focus event fires, checks localStorage
6. Dashboard refetches PDF list
7. ✅ Updated score displays immediately

### Scenario 3: Long Session
1. User has Dashboard open for extended period
2. Auto-refresh runs every 30 seconds
3. If any scores were updated in the background
4. Dashboard automatically displays latest data
5. ✅ Always showing fresh scores

## Files Modified

### 1. `src/components/ReportTab.tsx`
- Added event triggers in `fixIssue()` (line ~138)
- Added event triggers in `fixAllIssues()` (line ~172)
- Added event triggers in `handleGenerateAltText()` (line ~221)
- Added event triggers in `handleAnalyzeContrast()` (line ~282)

### 2. `src/app/dashboard/page.tsx`
- Added `pdfScoreUpdated` event listener (line ~37)
- Added `focus` event listener with timestamp check (line ~42)
- Added 30-second auto-refresh interval (line ~82)

## Benefits

✅ **Real-time Updates**: Dashboard reflects changes within seconds
✅ **Cross-tab Support**: Works even with multiple tabs open
✅ **No Manual Refresh**: Users don't need to refresh the page
✅ **Fallback Mechanism**: Auto-refresh ensures data consistency
✅ **Minimal Impact**: Uses efficient event-driven architecture
✅ **User Experience**: Seamless synchronization between views

## Technical Details

### Event Flow
```
Fix Issue → API Update DB → localStorage + Event → Dashboard Listens → Refetch → Updated UI
```

### Storage Schema
```typescript
localStorage.setItem('pdfScoreUpdated', Date.now().toString());
// Key: 'pdfScoreUpdated'
// Value: Unix timestamp (milliseconds)
```

### Event Names
- `pdfScoreUpdated` - Custom event for score updates
- `focus` - Native browser event for tab/window focus

## Testing

### Test Case 1: Single Issue Fix
1. Open PDF viewer
2. Click "Fix Issue" on any issue
3. Navigate back to Dashboard
4. **Expected**: Score updates automatically

### Test Case 2: Fix All Issues
1. Open PDF viewer
2. Click "Fix All Issues"
3. Navigate back to Dashboard
4. **Expected**: Score updates to 100% automatically

### Test Case 3: AI Alt Text
1. Open PDF viewer with image issues
2. Click "Generate Alt Text (AI)"
3. Navigate back to Dashboard
4. **Expected**: Score updates after generation

### Test Case 4: Multiple Tabs
1. Open Dashboard in Tab A
2. Open PDF viewer in Tab B
3. Fix issues in Tab B
4. Switch to Tab A
5. **Expected**: Dashboard refetches and shows new score

### Test Case 5: Long Session
1. Keep Dashboard open for 60+ seconds
2. Fix issues in another tab
3. Wait for auto-refresh (30 seconds)
4. **Expected**: Score updates without any action

## Performance Considerations

- ✅ **Minimal Overhead**: Event listeners have negligible performance impact
- ✅ **Smart Refetch**: Only fetches when changes detected or on interval
- ✅ **Timestamp Check**: Prevents unnecessary refetches (30-second window)
- ✅ **Cleanup**: Event listeners properly removed on unmount

## Future Enhancements

### Potential Improvements:
1. **WebSocket/SSE**: Real-time push notifications for instant updates
2. **Optimistic Updates**: Update UI before API response
3. **Delta Updates**: Only fetch changed records instead of full list
4. **Loading Indicators**: Show subtle indicator during background refresh
5. **User Preference**: Allow users to disable auto-refresh

## Conclusion

The Dashboard and Report Tab now work together seamlessly. When you fix accessibility issues, the score updates everywhere automatically - no manual refresh needed! 🎉

---

**Implementation Date**: October 16, 2025
**Status**: ✅ Complete and Tested
**Server Running**: Port 3003
