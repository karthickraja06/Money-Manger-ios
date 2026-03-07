# Balance Extraction Testing Guide

## 6️⃣ **Balance Extraction - NEW ✅**

**Feature:** Extract "Available Balance: Rs. X" from SMS and store in account.

**How It Works:**
- Parser extracts balance using cascading regex patterns:
  1. `contextual`: "Available Balance: Rs. 5000"
  2. `short`: "Bal: 10,000" or "Current balance Rs 2500"
  3. `postTransaction`: "Available balance after transaction Rs. 5000"
- Balance is validated (must be positive, < 10 crore)
- Stored in `transaction.current_balance` and `account.current_balance`
- Sets `balance_source` to "sms" (high confidence)

---

## Test 6-1: Balance in Transaction SMS

**Scenario:** HDFC bank sends transaction SMS with balance info.

```bash
curl -X POST 'http://localhost:3000/ingest/transaction' \
  -H 'Content-Type: application/json' \
  -H 'x-api-key: YOUR_API_KEY' \
  -d '{
    "user_id": "test_user",
    "raw_message": "HDFC BANK: Your account A/C XXXX1234 has been debited by Rs. 2,500 for AMAZON PURCHASES on 07-Mar-26 11:30 IST. Available Balance: Rs. 45,000. Ref TXN123456",
    "received_at": "2026-03-07T11:30:00Z",
    "source": "ios_shortcut"
  }'
```

**Expected Parser Output:**
```
[PARSER] Amount extracted: 2500
[PARSER] Merchant extracted: AMAZON PURCHASES
[PARSER] Bank detected: HDFC
[PARSER] Account: 1234
[PARSER] Balance extracted: 45000
[PARSER] Confidence: high (8/8 factors)
```

**Expected Ingest Response:**
```json
{
  "status": "ingested",
  "transaction_id": "...",
  "account_id": "...",
  "message": "Transaction ingested successfully"
}
```

**Database Check:**
```bash
# Get account
db.accounts.findOne({ user_id: "test_user", bank_name: "HDFC" })

# Should show:
{
  "_id": ObjectId(...),
  "user_id": "test_user",
  "bank_name": "HDFC",
  "current_balance": 45000,  ✅ Updated from SMS
  "balance_source": "sms",
  "balance_confidence": "high",
  "last_balance_update_at": ISODate("2026-03-07T11:30:00.000Z")
}
```

---

## Test 6-2: Multiple Transactions - Balance Updates

**Scenario:** Send 3 transactions to see balance update each time.

**Transaction 1:**
```bash
curl -X POST 'http://localhost:3000/ingest/transaction' \
  -H 'Content-Type: application/json' \
  -H 'x-api-key: YOUR_API_KEY' \
  -d '{
    "user_id": "test_user_2",
    "raw_message": "ICICI BANK: Amount Rs. 1000 debited from A/C ****8765 for ZOMATO on 06-Mar. Bal: 50,000",
    "received_at": "2026-03-06T18:00:00Z",
    "source": "ios_shortcut"
  }'
```

**Transaction 2:**
```bash
curl -X POST 'http://localhost:3000/ingest/transaction' \
  -H 'Content-Type: application/json' \
  -H 'x-api-key: YOUR_API_KEY' \
  -d '{
    "user_id": "test_user_2",
    "raw_message": "ICICI BANK: Amount Rs. 500 credited to A/C ****8765 from SALARY on 07-Mar. Balance: 50,500",
    "received_at": "2026-03-07T06:00:00Z",
    "source": "ios_shortcut"
  }'
```

**Transaction 3:**
```bash
curl -X POST 'http://localhost:3000/ingest/transaction' \
  -H 'Content-Type: application/json' \
  -H 'x-api-key: YOUR_API_KEY' \
  -d '{
    "user_id": "test_user_2",
    "raw_message": "ICICI BANK: Amount Rs. 200 debited from A/C ****8765 for STARBUCKS COFFEE on 07-Mar. Available balance Rs. 50,300 after this transaction",
    "received_at": "2026-03-07T09:30:00Z",
    "source": "ios_shortcut"
  }'
```

**Expected Result:**
After each transaction, the account's `current_balance` should be updated to the SMS balance:
- After TX1: `current_balance = 50,000`
- After TX2: `current_balance = 50,500`
- After TX3: `current_balance = 50,300`

**Database Check:**
```bash
db.accounts.findOne({ user_id: "test_user_2", bank_name: "ICICI" })
# Should show current_balance: 50300 (last SMS balance)
```

---

## Test 6-3: Short Form Balance

**Scenario:** Bank sends SMS with short balance format "Bal: X".

```bash
curl -X POST 'http://localhost:3000/ingest/transaction' \
  -H 'Content-Type: application/json' \
  -H 'x-api-key: YOUR_API_KEY' \
  -d '{
    "user_id": "test_user_3",
    "raw_message": "SBI: You have made a payment of Rs. 5,000 to ELECTRICITY BILL on 07-Mar-26. Bal: 1,25,000 INR",
    "received_at": "2026-03-07T15:00:00Z",
    "source": "ios_shortcut"
  }'
```

**Expected Parser Output:**
```
[PARSER] Amount extracted: 5000
[PARSER] Merchant extracted: ELECTRICITY BILL
[PARSER] Bank detected: SBI
[PARSER] Balance extracted: 125000
[PARSER] Confidence: high (8/8 factors)
```

**Console Log Check:**
```bash
# Should show balance extraction successful
[PARSER] Balance extracted: 125000
```

---

## Test 6-4: No Balance in SMS (Fallback)

**Scenario:** SMS doesn't contain balance - should still ingest transaction, calculate balance instead.

```bash
curl -X POST 'http://localhost:3000/ingest/transaction' \
  -H 'Content-Type: application/json' \
  -H 'x-api-key: YOUR_API_KEY' \
  -d '{
    "user_id": "test_user_4",
    "raw_message": "AXIS BANK: Debit of Rs. 3,500 has been made to your A/C ****4321 for FLIPKART on 07-Mar-26 14:20 IST. Ref: AXS789456123",
    "received_at": "2026-03-07T14:20:00Z",
    "source": "ios_shortcut"
  }'
```

**Expected Parser Output:**
```
[PARSER] Amount extracted: 3500
[PARSER] Merchant extracted: FLIPKART
[PARSER] Bank detected: Axis
[PARSER] Account: 4321
[PARSER] Balance extracted: null  (not present in SMS)
[PARSER] Confidence: medium (7/8 factors - missing balance)
```

**Expected Behavior:**
- Transaction still ingested successfully
- `account.current_balance` calculated from existing balance ± transaction amount
- `balance_source` set to "calculated"
- `balance_confidence` set to "medium"

**Database Check:**
```bash
db.accounts.findOne({ user_id: "test_user_4", bank_name: "Axis" })
# Should show:
{
  "balance_source": "calculated",  ← Not from SMS
  "balance_confidence": "medium"
}
```

---

## Test 6-5: Manual Sync/Flush to Recalculate Balances

**Scenario:** After ingesting multiple transactions, manually flush to recalculate all balances.

**Step 1: Ingest 2 transactions with balance:**
```bash
# TX1: Balance 50,000
curl -X POST 'http://localhost:3000/ingest/transaction' \
  -H 'Content-Type: application/json' \
  -H 'x-api-key: YOUR_API_KEY' \
  -d '{
    "user_id": "test_flush_user",
    "raw_message": "HDFC: Rs. 1000 debited for COFFEE. Bal: 50,000",
    "received_at": "2026-03-01T10:00:00Z",
    "source": "ios_shortcut"
  }'

# TX2: Balance 49,500 (after 500 purchase)
curl -X POST 'http://localhost:3000/ingest/transaction' \
  -H 'Content-Type: application/json' \
  -H 'x-api-key: YOUR_API_KEY' \
  -d '{
    "user_id": "test_flush_user",
    "raw_message": "HDFC: Rs. 500 debited for LUNCH. Bal: 49,500",
    "received_at": "2026-03-02T13:00:00Z",
    "source": "ios_shortcut"
  }'
```

**Step 2: Manually flush to recalculate:**
```bash
curl -X POST 'http://localhost:3000/accounts/sync/flush' \
  -H 'Content-Type: application/json'
```

**Expected Response:**
```json
{
  "status": "ok",
  "message": "Sync completed",
  "updated_count": 1,
  "total_accounts": 1,
  "results": [
    {
      "account_id": "...",
      "bank_name": "HDFC",
      "user_id": "test_flush_user",
      "old_balance": 49500,
      "new_balance": 49500,
      "tx_count": 2,
      "balance_source": "calculated"
    }
  ]
}
```

**Console Log:**
```
[ACCOUNTS] Sync/Flush started - recalculating all balances
[ACCOUNTS] Processing account HDFC (test_flush_user)
[ACCOUNTS] Starting balance: 50000
[ACCOUNTS] Applying 2 transactions
[ACCOUNTS] After TX1 (debit 1000): 49000
[ACCOUNTS] After TX2 (debit 500): 48500  ✅ Recalculated
[ACCOUNTS] Sync completed - 1 accounts updated
```

---

## Summary of Balance Extraction

| Test # | Scenario | Expected Balance | Balance Source | Status |
|--------|----------|------------------|----------------|--------|
| 6-1 | Full balance info | 45,000 | SMS | ✅ High confidence |
| 6-2 | Multiple updates | 50,300 | SMS (latest) | ✅ Updates correctly |
| 6-3 | Short form "Bal:" | 125,000 | SMS | ✅ Extracts short form |
| 6-4 | No balance in SMS | Calculated | Calculated | ✅ Fallback works |
| 6-5 | Manual flush | Recalculated | Calculated | ✅ Sync recalculates |
