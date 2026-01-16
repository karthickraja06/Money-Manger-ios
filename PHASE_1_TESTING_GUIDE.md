# 🧪 PHASE 1 TESTING & VALIDATION GUIDE

## Setup Before Testing

1. **Install dependencies**
```bash
cd backend
npm install
```

2. **Configure environment**
```bash
cp .env.example .env
# Edit .env with:
# - MONGO_URI: Your MongoDB Atlas connection string
# - API_KEY: A secure random string (e.g., use: openssl rand -hex 32)
# - PORT: 3000 (or your preferred port)
# - NODE_ENV: development (for testing)
```

3. **Start server**
```bash
npm start
```

You should see:
```
✅ MongoDB connected
🚀 Server running on port 3000
```

---

## Test Cases

### ✅ Test 1: Health Check
**Goal:** Verify server is running

```bash
curl http://localhost:3000/ingest/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-01-14T10:30:45.123Z"
}
```

---

### ✅ Test 2: Valid Transaction (Debit with Balance)
**Goal:** Ingest a transaction that includes balance (SMS authoritative)

```bash
curl -X POST http://localhost:3000/ingest/transaction \
  -H "Content-Type: application/json" \
  -H "x-api-key: your_secret_api_key_here" \
  -d '{
    "user_id": "my_iphone",
    "raw_message": "Rs. 500 debited from HDFC Bank to Amazon.in on 11 Jan at 1:44 AM. Available balance Rs. 10,450",
    "received_at": "2026-01-11T01:45:10Z",
    "source": "ios_shortcut"
  }'
```

**Expected Response (201):**
```json
{
  "status": "ingested",
  "transaction_id": "507f1f77bcf86cd799439011",
  "account_id": "507f1f77bcf86cd799439012",
  "dedup_hash": "abc123def456...",
  "account": {
    "bank_name": "hdfc",
    "current_balance": 10450,
    "balance_source": "sms"
  },
  "transaction": {
    "amount": 500,
    "type": "debit",
    "merchant": "Amazon.in",
    "receiver_name": null,
    "sender_name": null,
    "transaction_time": "2026-01-11T01:44:00Z"
  }
}
```

**Verification:**
- ✅ `status` = "ingested"
- ✅ `account.balance_source` = "sms" (SMS is authoritative)
- ✅ `account.current_balance` = 10450 (from SMS)

---

### ✅ Test 3: Duplicate Detection
**Goal:** Send same transaction twice, should detect duplicate

**Send 1st time:**
```bash
# Same curl as Test 2
# Response: status = "ingested"
```

**Send 2nd time:**
```bash
# Same curl as Test 2
# Response should be:
```

**Expected Response (200):**
```json
{
  "status": "duplicate",
  "reason": "dedup_hash_matched",
  "message": "Transaction already ingested",
  "dedup_hash": "abc123def456..."
}
```

**Verification:**
- ✅ Second request returns `status: "duplicate"`
- ✅ `dedup_hash` is same for both requests
- ✅ No new transaction created in database

---

### ✅ Test 4: Balance Calculation (No SMS Balance)
**Goal:** When SMS doesn't have balance, system calculates it

**Scenario:**
1. First transaction with balance (Test 2) → account.balance = 10,450
2. Second transaction without balance → should calculate new balance

```bash
curl -X POST http://localhost:3000/ingest/transaction \
  -H "Content-Type: application/json" \
  -H "x-api-key: your_secret_api_key_here" \
  -d '{
    "user_id": "my_iphone",
    "raw_message": "Rs. 1000 credited to HDFC Bank from Salary Deposit on 12 Jan at 9:00 AM",
    "received_at": "2026-01-12T09:01:00Z",
    "source": "ios_shortcut"
  }'
```

**Expected Response (201):**
```json
{
  "status": "ingested",
  "account": {
    "bank_name": "hdfc",
    "current_balance": 11450,  // 10,450 + 1,000
    "balance_source": "calculated"
  },
  "transaction": {
    "amount": 1000,
    "type": "credit",
    "merchant": "Salary Deposit"
  }
}
```

**Verification:**
- ✅ `balance_source` = "calculated" (no SMS balance)
- ✅ `current_balance` = 11,450 (10,450 + 1,000 credit)
- ✅ `balance_confidence` = "medium"

---

### ✅ Test 5: Receiver/Sender Name Extraction
**Goal:** Parser extracts person names from SMS

```bash
curl -X POST http://localhost:3000/ingest/transaction \
  -H "Content-Type: application/json" \
  -H "x-api-key: your_secret_api_key_here" \
  -d '{
    "user_id": "my_iphone",
    "raw_message": "Rs. 5000 transferred to John Doe from your HDFC Account on 13 Jan at 2:30 PM",
    "received_at": "2026-01-13T14:31:00Z",
    "source": "ios_shortcut"
  }'
```

**Expected Response (201):**
```json
{
  "status": "ingested",
  "transaction": {
    "amount": 5000,
    "type": "debit",
    "merchant": "HDFC",
    "receiver_name": "John Doe",   // ✅ Extracted
    "sender_name": null
  }
}
```

**Verification:**
- ✅ `receiver_name` = "John Doe"
- ✅ `sender_name` extracted if pattern "from ..." matches

---

### ✅ Test 6: Time Parsing
**Goal:** Extract transaction time from SMS (not just received time)

```bash
curl -X POST http://localhost:3000/ingest/transaction \
  -H "Content-Type: application/json" \
  -H "x-api-key: your_secret_api_key_here" \
  -d '{
    "user_id": "my_iphone",
    "raw_message": "Rs. 250 debited from HDFC Bank at 3:45 PM on 14 Jan",
    "received_at": "2026-01-14T16:30:00Z",
    "source": "ios_shortcut"
  }'
```

**Expected Response (201):**
```json
{
  "status": "ingested",
  "transaction": {
    "transaction_time": "2026-01-14T15:45:00Z",  // ✅ Parsed 3:45 PM
    "time_confidence": "exact"
  }
}
```

**Verification:**
- ✅ `transaction_time` ≠ `received_time` (parsed from SMS)
- ✅ `time_confidence` = "exact"

---

### ✅ Test 7: Missing API Key (Unauthorized)
**Goal:** Reject requests without API key

```bash
curl -X POST http://localhost:3000/ingest/transaction \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "my_iphone",
    "raw_message": "Rs. 500 debited from HDFC Bank"
  }'
```

**Expected Response (401):**
```json
{
  "error": "Unauthorized",
  "code": "INVALID_API_KEY"
}
```

---

### ✅ Test 8: Invalid API Key
**Goal:** Reject requests with wrong API key

```bash
curl -X POST http://localhost:3000/ingest/transaction \
  -H "Content-Type: application/json" \
  -H "x-api-key: wrong_key" \
  -d '{
    "user_id": "my_iphone",
    "raw_message": "Rs. 500 debited from HDFC Bank"
  }'
```

**Expected Response (401):**
```json
{
  "error": "Unauthorized",
  "code": "INVALID_API_KEY"
}
```

---

### ✅ Test 9: Missing Required Fields
**Goal:** Reject requests without user_id or raw_message

```bash
curl -X POST http://localhost:3000/ingest/transaction \
  -H "Content-Type: application/json" \
  -H "x-api-key: your_secret_api_key_here" \
  -d '{
    "user_id": "my_iphone"
  }'
```

**Expected Response (400):**
```json
{
  "error": "Missing required fields: user_id, raw_message",
  "code": "INVALID_REQUEST"
}
```

---

### ✅ Test 10: Non-Transaction Message (Ignored)
**Goal:** Don't ingest promotional/non-transaction messages

```bash
curl -X POST http://localhost:3000/ingest/transaction \
  -H "Content-Type: application/json" \
  -H "x-api-key: your_secret_api_key_here" \
  -d '{
    "user_id": "my_iphone",
    "raw_message": "Visit our bank website for amazing offers and discounts this month!",
    "received_at": "2026-01-14T10:00:00Z",
    "source": "ios_shortcut"
  }'
```

**Expected Response (200):**
```json
{
  "status": "ignored",
  "reason": "non-transaction_message",
  "message": "SMS does not contain transaction data"
}
```

**Verification:**
- ✅ No transaction created
- ✅ No account created
- ✅ Status = "ignored"

---

### ✅ Test 11: ATM Transaction
**Goal:** Detect and handle ATM withdrawals

```bash
curl -X POST http://localhost:3000/ingest/transaction \
  -H "Content-Type: application/json" \
  -H "x-api-key: your_secret_api_key_here" \
  -d '{
    "user_id": "my_iphone",
    "raw_message": "Rs. 2000 withdrawn from ATM at Branch Road on 14 Jan at 4:20 PM. Available balance Rs. 8450",
    "received_at": "2026-01-14T16:21:00Z",
    "source": "ios_shortcut"
  }'
```

**Expected Response (201):**
```json
{
  "status": "ingested",
  "transaction": {
    "amount": 2000,
    "type": "atm"  // ✅ Detected as ATM
  }
}
```

---

### ✅ Test 12: Multiple Accounts
**Goal:** Multiple bank accounts for same user

**Transaction 1 (HDFC):**
```bash
curl -X POST http://localhost:3000/ingest/transaction \
  -H "Content-Type: application/json" \
  -H "x-api-key: your_secret_api_key_here" \
  -d '{
    "user_id": "my_iphone",
    "raw_message": "Rs. 500 debited from HDFC Bank. Available balance Rs. 10,000",
    "received_at": "2026-01-14T10:00:00Z",
    "source": "ios_shortcut"
  }'
```

**Transaction 2 (ICICI):**
```bash
curl -X POST http://localhost:3000/ingest/transaction \
  -H "Content-Type: application/json" \
  -H "x-api-key: your_secret_api_key_here" \
  -d '{
    "user_id": "my_iphone",
    "raw_message": "Rs. 1000 credited to ICICI Bank Account. Available balance Rs. 50,000",
    "received_at": "2026-01-14T11:00:00Z",
    "source": "ios_shortcut"
  }'
```

**Expected:**
- 2 accounts created: hdfc, icici
- Each with its own balance
- Separate transaction records

---

## Database Verification

After running tests, verify in MongoDB:

### Check Accounts
```javascript
db.accounts.find().pretty()

// Expected output:
{
  "user_id": "my_iphone",
  "bank_name": "hdfc",
  "current_balance": 10450,
  "balance_source": "sms",
  "balance_confidence": "high",
  "account_type": "bank"
}
```

### Check Transactions
```javascript
db.transactions.find().pretty()

// Expected output:
{
  "user_id": "my_iphone",
  "amount": 500,
  "type": "debit",
  "merchant": "Amazon.in",
  "dedup_hash": "abc123...",
  "receiver_name": null,
  "sender_name": null,
  "transaction_time": ISODate("2026-01-11T01:44:00Z")
}
```

### Check Dedup Hash Uniqueness
```javascript
db.transactions.createIndex({ dedup_hash: 1 }, { unique: true, sparse: true })

// Verify index is unique:
db.transactions.getIndexes()
```

---

## Performance Tests

### Test 13: Bulk Ingestion
**Goal:** Handle rapid fire requests (iOS Shortcuts might retry)

```bash
# Run 5 transactions rapidly
for i in {1..5}; do
  curl -X POST http://localhost:3000/ingest/transaction \
    -H "Content-Type: application/json" \
    -H "x-api-key: your_secret_api_key_here" \
    -d "{
      \"user_id\": \"my_iphone\",
      \"raw_message\": \"Rs. $((i * 100)) debited from HDFC Bank to Merchant$i on 14 Jan. Available balance Rs. $((10000 - (i * 100)))\",
      \"received_at\": \"2026-01-14T10:0$i:00Z\",
      \"source\": \"ios_shortcut\"
    }"
done
```

**Expected:**
- All 5 transactions ingested
- Dedup prevents any duplicates
- Response time < 500ms per request

---

## Debugging

### Enable Verbose Logging
Add to `app.js`:
```javascript
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`, req.body);
  next();
});
```

### Check MongoDB Connection
```bash
# In backend directory:
node -e "require('dotenv').config(); const mongoose = require('mongoose'); mongoose.connect(process.env.MONGO_URI).then(() => console.log('✅ Connected')).catch(e => console.error('❌ Failed:', e.message))"
```

### Test API Key
```bash
echo $API_KEY  # If set as environment variable
```

---

## Checklist Before Deployment

- [ ] All 13 tests passing
- [ ] No errors in console logs
- [ ] MongoDB indexes created
- [ ] `.env` configured with real values
- [ ] API_KEY is strong (use `openssl rand -hex 32`)
- [ ] MONGO_URI accessible from server
- [ ] Dedup hash unique constraint verified
- [ ] Health check responds correctly

---

## Next Steps (Phase 2)

Once Phase 1 tests pass:
1. Build GET endpoints (accounts, transactions)
2. Add filtering support
3. Create dashboard aggregations
4. Deploy to Render (production)

---

**Generated:** Jan 14, 2026  
**Status:** Ready for Phase 1 execution
