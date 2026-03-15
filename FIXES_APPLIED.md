# Fixes Applied - March 15, 2026

## 1. ✅ Account Sync Endpoint - Duplicate Route Fixed
**File**: `backend/src/routes/accounts.routes.js`
**Issue**: Had two `/sync/flush` endpoints defined, second was overwriting the first
**Fix**: 
- Removed duplicate endpoint
- `/sync/flush` now calls SMS ingest worker before recalculating balances
- Added `/sync/queue` for background async syncing
- When you click "Sync" button:
  1. Calls `https://sms-ingest.karthickrajab02.workers.dev/flush` to ingest SMS
  2. Waits 2 seconds for SMS to be processed
  3. Recalculates all account balances from transactions

**Working Endpoints**:
```bash
POST /accounts/sync/flush       # SYNCHRONOUS - executes immediately
POST /accounts/sync/queue       # ASYNCHRONOUS - background processing
```

---

## 2. ✅ Re-parse Functionality - Safe Update Strategy
**File**: `backend/src/services/reparse.service.js`
**Issue**: Was updating amount, type, and category which would cause balance recalculation issues
**Fix**: Now only updates SAFE fields:
- ✅ Updates: `merchant`, `bank_name`, `reference_number`, `transaction_time`
- ❌ Never updates: `amount`, `type`, `category` (preserved for balance integrity)

**How Re-parse Works**:
1. Reads raw SMS message
2. Re-parses it to extract merchant name, bank name, reference number, time
3. Updates transaction in DB
4. Balance calculations remain untouched

---

## 3. ✅ Transaction Sorting - Newest First
**File**: `frontend/src/pages/Transactions.tsx`
**Status**: Already correct
**Details**: 
- Transactions sorted by `transactionDate` newest to oldest
- When you edit a transaction, it re-fetches and re-sorts automatically
- Sorting uses `transaction_time` from SMS (not edit time)

---

## 4. ✅ Recent Transactions - "View All" Navigation
**File**: `frontend/src/pages/Dashboard.tsx`
**Issue**: "View All" button in Recent Transactions section had empty onClick
**Fix**: 
- Added `useNavigate` hook
- Button now navigates to `/transactions` page
- Users can now click "View All" to see all transactions

---

## 5. ✅ Bottom Sheet UI - No Navigation Overlap
**File**: `frontend/src/components/BottomSheet.tsx`
**Issue**: "Update bank accounts" sheet was covering the bottom navigation
**Fix**: 
- Changed positioning from `bottom-0` to `bottom-20` (leaves space for nav)
- Added `overflow-y-auto` for proper scrolling
- Made header sticky for better UX
- Added bottom padding (pb-6) to prevent content from being hidden
- Calculated max-height: `calc(100vh - 80px)` for proper sizing

**Result**: 
- Sheet slides up above navigation
- Can scroll through content
- Navigation always accessible

---

## Summary of Changes

| Issue | File | Status | Solution |
|-------|------|--------|----------|
| Duplicate sync endpoint | accounts.routes.js | ✅ Fixed | Removed duplicate, now calls SMS worker |
| Re-parse updating amounts | reparse.service.js | ✅ Fixed | Only updates merchant/bank_name/time |
| Transactions sorting | Transactions.tsx | ✅ Working | Already correct, newest first |
| View All navigation | Dashboard.tsx | ✅ Fixed | Added navigate to /transactions |
| Bottom sheet overlay | BottomSheet.tsx | ✅ Fixed | Positioned above nav with scrolling |

---

## Testing Instructions

### Test Sync Functionality
```bash
# Trigger sync (calls SMS worker + recalculates balances)
curl -X POST http://localhost:3000/accounts/sync/flush \
  -H "Content-Type: application/json" \
  -H "x-api-key: ios_secret_key_123" \
  -d '{}'

# Response should show updated accounts
# Example: {"status":"ok","updated_count":2,"total_accounts":8,"results":[...]}
```

### Test Re-parse
```bash
# Re-parse all transactions
curl -X POST http://localhost:3000/reparse/transactions \
  -H "Content-Type: application/json" \
  -H "x-api-key: ios_secret_key_123" \
  -d '{"transaction_ids": []}'

# Response shows which transactions were updated
```

### Frontend Testing
1. **Click Sync button** - Should sync with SMS worker immediately
2. **Click "View All"** in Recent Transactions - Should navigate to /transactions page
3. **Edit a transaction** - Should stay sorted by newest first
4. **Open Update Accounts** - Should not cover bottom navigation, should be scrollable

---

## Backend Restart Required
After these changes, restart your backend:
```bash
cd backend
npm start
```

Or push to production for Render.com to auto-deploy:
```bash
git add -A
git commit -m "Fix: sync endpoint, reparse safety, bottom sheet UI"
git push
```
