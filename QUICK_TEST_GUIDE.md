# 🎯 Quick Test Guide - Transaction Management Features

## What Changed?

### ✅ Transaction Edit Modal
- **Centered on screen** (no longer at bottom)
- **Category field** now editable (was missing)
- **Merchant & Amount** both editable
- **Refund linking** for debits only

### ✅ Sync Updates Automatically  
- Edit transaction → Automatically reloads dashboard
- All totals update without manual refresh
- Budget calculations refresh instantly

### ✅ Refund Linking in Modal (New)
- Open debit transaction → Edit → Link Refund section
- Shows credits from today back 30 days
- Click credit to link → saves automatically

### ✅ Proper Headers
- API key: `ios_secret_key_123`
- Content-Type: `application/json`
- Both sent automatically

---

## 5-Minute Test

### Step 1: Edit Transaction Amount
```
1. Transactions page
2. Click ANY transaction
3. Click "Edit Transaction"
4. Change amount: 100 → 250
5. Click "Save Changes"
✅ Message: "Transaction updated successfully"
✅ Modal closes
✅ Amount updated in list
```

### Step 2: Update Merchant Name
```
1. Click same transaction
2. Edit → Change merchant name
3. Save
✅ Merchant updated in transaction list
```

### Step 3: Set Category
```
1. Click transaction (one without category)
2. Edit → Category field shows "Unknown"
3. Type: "Groceries"
4. Save
✅ Category shows in list
✅ Persisted in backend
```

### Step 4: Link Refund (Debit Only)
```
1. Click DEBIT (red) transaction
2. Edit → Scroll down
3. See "Link Refund" section ← ONLY for debits!
4. Click "+ Link Refund"
5. See credit transactions (green ones)
6. Click one credit
✅ Shows "✓ Refund Linked"
7. Save
✅ In view mode: shows linked refund details
```

### Step 5: Check Modal is Centered
```
1. Click transaction
2. Modal should appear in CENTER
3. NOT at bottom of screen
4. All fields clearly visible
✅ No "aria-hidden" warning in console
```

---

## Expected Behavior After Changes

| Action | Before | After |
|--------|--------|-------|
| Edit transaction amount | N/A (not working) | ✅ Works, updates DB |
| Edit merchant name | N/A | ✅ Works |
| Edit category | N/A | ✅ Works |
| Modal position | Bottom of screen | Center of screen |
| Category field | Missing | Shows & editable |
| Refund linking | Separate tab | In edit modal (debit only) |
| Dashboard refresh | Manual | Automatic |
| aria-hidden warning | ❌ Shows warning | ✅ No warning |

---

## If Something Doesn't Work

### "Cannot find module updateTransaction"
**Fix**: Backend might not return transaction properly
```bash
# Check backend response format
curl -X PATCH 'http://localhost:3000/transactions/[id]' \
  -H 'Content-Type: application/json' \
  -H 'x-api-key: ios_secret_key_123' \
  -d '{"category":"Groceries"}'
  
# Should return: { "status": "ok", "transaction": {...} }
```

### Modal still at bottom
**Fix**: Clear cache
```
Cmd+Shift+Delete → All time → Clear
Browser → Refresh (Cmd+R)
```

### "Link Refund" section missing
**Fix**: 
- Make sure you clicked a DEBIT (red) transaction
- CREDIT (green) transactions won't have refund section

### Update button does nothing
**Fix**: Check headers are being sent
```
DevTools → Network → Find PATCH request
→ Headers tab
→ Verify x-api-key: ios_secret_key_123
```

---

## Code Changes Summary

| Component | Change | Impact |
|-----------|--------|--------|
| api.ts | Added updateTransaction() | Enables backend calls |
| Transactions.tsx | Wired handleUpdateTransaction | Auto-save & reload |
| TransactionDetail.tsx | Complete rewrite | Centered, category, refund link |
| transactions.routes.js | Accept merchant/amount | Backend stores updates |

---

## Console Logs to Expect

When you edit and save:
```
✅ [Transactions] Updated transaction: {...}
✅ [Store] loadTransactions success: 75 transactions
✅ Success message appears
```

If error:
```
❌ [Transactions] Error updating transaction: [error]
❌ Failed to update transaction
```

---

## Next: Sync Across Merchants

When category is changed for a merchant:
```
Future Feature:
1. User edits transaction → sets category "Groceries"
2. System finds all transactions from same merchant
3. Marks all as "Groceries"
4. New transactions from merchant → auto "Groceries"
```

Status: Foundation ready, backend logic pending.

---

**Ready to test? Start with Step 1 above! 🚀**
