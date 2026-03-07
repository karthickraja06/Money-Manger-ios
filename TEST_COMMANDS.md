# Test Commands - Copy & Paste Ready

## Verification Commands

### Verify updateTransaction Function Exists
```bash
grep -n "export const updateTransaction" frontend/src/services/api.ts
```
**Expected**: Line number like `318` or similar

### Verify Backend Accepts Merchant Field
```bash
grep -n "merchant !== undefined" backend/src/routes/transactions.routes.js
```
**Expected**: Should find the line that checks merchant

### Verify Modal is Centered
```bash
grep "top-1/2" frontend/src/components/TransactionDetail.tsx | grep -c "top-1/2"
```
**Expected**: At least 1 result (the modal uses top-1/2)

### Verify aria-hidden is Removed (Accessibility Fix)
```bash
grep "aria-hidden" frontend/src/components/TransactionDetail.tsx
```
**Expected**: NO results (empty output = success!)

### Verify Refund Linking in Modal
```bash
grep -n "Link Refund" frontend/src/components/TransactionDetail.tsx
```
**Expected**: Find the refund linking section

### Verify Category Field Exists
```bash
grep -n "category" frontend/src/components/TransactionDetail.tsx | head -10
```
**Expected**: Multiple hits showing category field

---

## Backend Route Test

### Test Transaction Update Endpoint
```bash
curl -X PATCH 'http://localhost:3000/transactions/[TRANSACTION_ID]' \
  -H 'Content-Type: application/json' \
  -H 'x-api-key: ios_secret_key_123' \
  -H 'Authorization: Bearer [YOUR_TOKEN]' \
  -d '{
    "merchant": "Test Merchant",
    "amount": 999,
    "type": "debit",
    "category": "Testing"
  }'
```

**Expected Response**:
```json
{
  "status": "ok",
  "transaction": {
    "id": "...",
    "merchant": "Test Merchant",
    "amount": 999,
    "type": "debit",
    "category": "Testing",
    ...
  },
  "changes": {
    "merchant": "Old Name",
    "amount": 500
  }
}
```

### Test Sync Endpoint Headers
```bash
curl -X POST 'http://localhost:3000/accounts/sync/flush' \
  -H 'Content-Type: application/json' \
  -H 'x-api-key: ios_secret_key_123' \
  -H 'Authorization: Bearer [YOUR_TOKEN]' \
  -d '{}'
```

**Expected**: Should work (not 404)

---

## Browser Console Tests

### Check Headers Being Sent
1. Open DevTools: `Cmd+Option+I`
2. Go to **Network** tab
3. Click transaction to open modal
4. Click "Edit" → change something → click "Save"
5. In Network, find the `PATCH` request to `/transactions/...`
6. Click on it → **Headers** tab
7. Verify in **Request Headers**:
   ```
   x-api-key: ios_secret_key_123
   content-type: application/json
   ```

### Check for aria-hidden Warning
1. Open DevTools: `Cmd+Option+I`
2. Go to **Console** tab
3. Click transaction → modal opens
4. **Expected**: No warning about "aria-hidden"
5. If you see it: page wasn't reloaded after code change

### Check Transaction Update Logging
1. Open **Console** tab
2. Click transaction → Edit → change amount → Save
3. **Expected logs**:
   ```
   [Transactions] Updated transaction: Object
   [Store] loadTransactions success: X transactions
   ```

### Check Refund Date Range
1. Click any DEBIT transaction
2. Edit → scroll to "Link Refund"
3. Click "+ Link Refund"
4. Credits shown should be:
   - Today's date or earlier
   - 30+ days earlier or later
   - NOT from 60 days ago

---

## Live Testing Flow

### Test 1: Sync Button (30 seconds)
```
Dashboard → Click blue "Sync ↻" button
→ See spinner
→ Shows "Sync successful! Updated X accounts"
→ Check Network: POST /accounts/sync/flush returns 200
```

### Test 2: Edit Transaction (1 minute)
```
Transactions → Click any transaction
→ Modal opens CENTERED on screen
→ Click "Edit Transaction"
→ Change merchant: "AuraGold" → "AuraGold Updated"
→ Change amount: 25 → 50
→ Change category: [empty] → "Testing"
→ Click "Save Changes"
→ Message: "Transaction updated successfully"
→ Check: Network shows PATCH 200 OK
→ Verify: Transaction list shows new values
```

### Test 3: Refund Linking (1 minute)
```
Transactions → Find DEBIT (red) transaction
→ Click it
→ Edit → Scroll down
→ See "Link Refund" section (only for debit!)
→ Click "+ Link Refund"
→ See list of CREDIT (green) transactions
→ Verify date range: last 30 days from debit date
→ Click one credit
→ Shows "✓ Refund Linked"
→ Save
→ Verify in view mode: shows linked refund
```

### Test 4: Dashboard Auto-Update (1 minute)
```
Edit transaction amount: 100 → 1000
→ Save
→ Go to Dashboard
→ Check total spend updated
→ Go back to Transactions
→ Amount still 1000
→ Refresh page (Cmd+R)
→ Amount STILL 1000 (persisted in DB)
```

### Test 5: Modal Accessibility (30 seconds)
```
Open DevTools Console
Click transaction
→ No "aria-hidden" warning
Tab through fields
→ All focusable with Tab key
Click outside modal
→ Modal closes
→ Console: no errors
```

---

## Debugging Commands

### If Update Fails - Check API Response
```bash
# In Frontend Console, run:
fetch('http://localhost:3000/transactions/[ID]', {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'ios_secret_key_123'
  },
  body: JSON.stringify({
    merchant: "Test",
    amount: 500,
    category: "Debug"
  })
})
.then(r => r.json())
.then(d => console.log('Response:', d))
.catch(e => console.error('Error:', e))
```

### If Modal Won't Center - Check CSS
```bash
# Run in Console:
const modal = document.querySelector('[role="dialog"]')
const styles = window.getComputedStyle(modal)
console.log('Left:', styles.left)
console.log('Top:', styles.top)
console.log('Transform:', styles.transform)
```
**Expected**: 
- `left: 50%`
- `top: 50%`
- `transform: translate(-50%, -50%)`

### If Refund Not Showing - Check Date Range
```bash
# In Console, when modal is open:
const modal = document.querySelector('[role="dialog"]')
console.log(modal.innerText)
# Should show refund section with credits listed
```

---

## Success Indicators

| Feature | Success Sign |
|---------|--------------|
| Sync button | Shows spinner → success message |
| Edit transaction | Amount updates in list immediately |
| Category field | Can type & saves to backend |
| Modal centered | Appears in middle of screen |
| Refund linking | Shows credit list, can click to link |
| auto-dashboard update | No manual refresh needed |
| Accessibility | No warnings in console |
| Persistence | Data stays after page reload |

---

## Quick Sanity Check (< 1 minute)

Run all these in order:

```bash
# 1. Check files were modified
ls -la frontend/src/components/TransactionDetail.tsx
# Should show today's date

# 2. Check API function exists
grep "updateTransaction" frontend/src/services/api.ts
# Should find it

# 3. Check no syntax errors
node -c backend/src/routes/transactions.routes.js
# Should return: No syntax errors

# 4. Check frontend compiles
# (This is automatic in npm run dev, watch for errors)
```

---

**All tests passing? Ready to commit and deploy! 🚀**
