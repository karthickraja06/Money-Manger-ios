# 🎯 PHASE 1 + PHASE 2 INTEGRATION GUIDE

## Quick Recap

### Phase 1: Ingestion ✅
- SMS parsing & balance logic
- Deduplication & account creation
- POST /ingest/transaction endpoint

### Phase 2: Read APIs ✅
- GET endpoints for accounts & transactions
- Advanced filtering & aggregations
- Dashboard analytics

---

## Full API Documentation

### BASE URL
```
http://localhost:3000
```

### Authentication
All endpoints (except `/health` and `/ingest/transaction`) require:
```
Header: x-api-key: {YOUR_API_KEY}
```

---

## Complete Endpoint List

### Health & Ingestion (Phase 1)
```
GET  /health                           # Health check
POST /ingest/transaction               # Ingest SMS
GET  /ingest/health                    # Ingest health check
```

### Accounts (Phase 2)
```
GET  /accounts                         # List all accounts
GET  /accounts/:id                     # Account detail
GET  /accounts/summary/all             # Total balance summary
PATCH /accounts/:id                    # Update account
```

### Transactions (Phase 2)
```
GET  /transactions                     # List transactions
GET  /transactions/:id                 # Transaction detail
GET  /transactions/stats/aggregate     # Aggregate stats
PATCH /transactions/:id                # Update transaction
DELETE /transactions/:id               # Delete transaction
```

### Dashboard (Phase 2)
```
GET  /dashboard/summary                # Monthly summary
GET  /dashboard/recent                 # Recent 5 transactions
GET  /dashboard/trends                 # 12-month trends
GET  /dashboard/category-breakdown     # Category spending
GET  /dashboard/top-merchants          # Top merchants
GET  /dashboard/daily-heatmap          # Daily spend calendar
GET  /dashboard/account-wise           # Account breakdown
```

---

## Request/Response Flow

### Typical User Journey

#### 1. SMS Arrives
```
iOS Shortcut triggers
    ↓
Sends: POST /ingest/transaction
```

#### 2. Backend Processes
```
Parse SMS
    ↓
Check for duplicates (dedup_hash)
    ↓
Create/Update account + balance
    ↓
Store transaction
    ↓
Return: { status: "ingested", transaction_id: "..." }
```

#### 3. User Opens Dashboard
```
Frontend calls: GET /dashboard/summary
    ↓
Backend returns: { current_month: {...}, accounts: {...} }
    ↓
Frontend renders UI with balance + expense
```

#### 4. User Views Transactions
```
Frontend calls: GET /transactions?type=debit&page=1&limit=20
    ↓
Backend filters + paginates + returns stats
    ↓
Frontend shows transactions list with filters
```

#### 5. User Updates Transaction
```
Frontend calls: PATCH /transactions/:id { category: "Food" }
    ↓
Backend updates database
    ↓
Future transactions auto-categorize based on merchant
```

---

## Data Flow Diagram

```
┌─────────────┐
│ iOS Phone   │
│  (Shortcut) │
└──────┬──────┘
       │
       │ SMS Arrives
       ↓
┌──────────────────────────────────────┐
│ Phase 1: Ingestion                   │
│  POST /ingest/transaction            │
│  - Parse SMS                         │
│  - Dedup check                       │
│  - Create account                    │
│  - Update balance                    │
│  - Store transaction                 │
└──────┬───────────────────────────────┘
       │
       ↓
┌──────────────────────────────────────┐
│ MongoDB                              │
│  - Accounts collection               │
│  - Transactions collection           │
└──────┬───────────────────────────────┘
       │
       ↓
┌──────────────────────────────────────┐
│ Phase 2: Read APIs                   │
│  GET /accounts                       │
│  GET /transactions (filtered)        │
│  GET /dashboard/*                    │
└──────┬───────────────────────────────┘
       │
       ↓
┌─────────────────┐
│ React Frontend  │
│  (Dashboard UI) │
└─────────────────┘
```

---

## Complete Workflow Example

### Step 1: User receives SMS
```
"Rs. 500 debited from HDFC Bank to Amazon.in on 11 Jan at 1:44 AM. 
 Available balance Rs. 10,450"
```

### Step 2: iOS Shortcut sends webhook
```bash
POST http://localhost:3000/ingest/transaction
{
  "user_id": "my_iphone",
  "raw_message": "Rs. 500 debited...",
  "received_at": "2026-01-11T01:45:10Z",
  "source": "ios_shortcut"
}
```

### Step 3: Backend response
```json
{
  "status": "ingested",
  "transaction_id": "507f...",
  "account_id": "507f...",
  "dedup_hash": "abc123...",
  "account": {
    "bank_name": "hdfc",
    "current_balance": 10450,
    "balance_source": "sms"
  },
  "transaction": {
    "amount": 500,
    "type": "debit",
    "merchant": "Amazon.in",
    "transaction_time": "2026-01-11T01:44:00Z"
  }
}
```

### Step 4: User opens dashboard
```bash
GET http://localhost:3000/dashboard/summary
```

### Step 5: Dashboard response
```json
{
  "current_month": {
    "expense": 500,
    "income": 0,
    "net_savings": -500,
    "transaction_count": 1
  },
  "accounts": {
    "total_balance": 10450,
    "count": 1,
    "active": 1
  }
}
```

### Step 6: User filters transactions
```bash
GET http://localhost:3000/transactions?type=debit&merchant=amazon&start_date=2026-01-01
```

### Step 7: Filtered response
```json
{
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "pages": 1
  },
  "stats": {
    "total_debit": 500,
    "total_credit": 0,
    "net_amount": -500
  },
  "transactions": [
    {
      "id": "507f...",
      "amount": 500,
      "type": "debit",
      "merchant": "Amazon.in",
      "transaction_time": "2026-01-11T01:44:00Z",
      "account": {
        "bank_name": "hdfc",
        "account_holder": "John Doe"
      }
    }
  ]
}
```

---

## Common Queries

### Query 1: Last 7 days expense
```bash
curl "http://localhost:3000/transactions?type=debit,atm&start_date=2026-01-08&end_date=2026-01-14" \
  -H "x-api-key: YOUR_API_KEY"
```

### Query 2: Top spending category
```bash
curl "http://localhost:3000/dashboard/category-breakdown" \
  -H "x-api-key: YOUR_API_KEY"
```

### Query 3: Monthly comparison
```bash
# Get January & December comparison
curl "http://localhost:3000/dashboard/trends" \
  -H "x-api-key: YOUR_API_KEY"
# Look at months: 2025-12 vs 2026-01
```

### Query 4: Refund search
```bash
curl "http://localhost:3000/transactions?refund_status=linked" \
  -H "x-api-key: YOUR_API_KEY"
```

### Query 5: Transaction between two amounts
```bash
curl "http://localhost:3000/transactions?min_amount=100&max_amount=500" \
  -H "x-api-key: YOUR_API_KEY"
```

---

## Error Handling

### 401 Unauthorized (Missing/Invalid API Key)
```json
{
  "error": "Unauthorized",
  "code": "INVALID_API_KEY",
  "message": "x-api-key header required"
}
```

### 404 Not Found
```json
{
  "error": "Transaction not found"
}
```

### 400 Bad Request (Invalid filters)
```json
{
  "error": "Failed to fetch transactions",
  "message": "Invalid ObjectId format"
}
```

### 500 Server Error
```json
{
  "error": "Failed to fetch accounts",
  "message": "MongoDB connection failed"
}
```

---

## Database Schema Reference

### Account Document
```javascript
{
  _id: ObjectId,
  user_id: String,              // "my_iphone"
  bank_name: String,            // "hdfc" (normalized)
  account_number: String,       // "1234" (last 4 digits)
  account_holder: String,       // "John Doe"
  current_balance: Number,      // 10450
  balance_source: String,       // "sms" | "calculated" | "unknown"
  balance_confidence: String,   // "high" | "medium" | "low"
  last_balance_update_at: Date,
  account_type: String,         // "bank" | "cash" | "wallet"
  is_active: Boolean,
  created_at: Date,
  updated_at: Date
}
```

### Transaction Document
```javascript
{
  _id: ObjectId,
  user_id: String,
  account_id: ObjectId,           // Reference to Account
  amount: Number,                 // 500
  original_amount: Number,        // 500 (before refunds)
  net_amount: Number,             // 500 (after refunds)
  type: String,                   // "debit" | "credit" | "atm"
  merchant: String,               // "Amazon.in"
  receiver_name: String,          // "John Doe"
  sender_name: String,            // "Jane Smith"
  account_holder: String,         // "Account owner name"
  bank_name: String,              // "hdfc"
  category: String,               // "Shopping" (Phase 3)
  tags: [String],                 // ["online", "urgent"]
  notes: String,                  // User notes
  raw_message: String,            // Original SMS
  dedup_hash: String,             // SHA256 hash (unique)
  transaction_time: Date,         // Parsed from SMS
  received_time: Date,            // When SMS arrived
  time_confidence: String,        // "exact" | "estimated"
  is_refund_of: ObjectId,         // Reference to original txn (Phase 3)
  linked_refunds: [ObjectId],     // Array of refund txn IDs (Phase 3)
  source: String,                 // "ios_shortcut"
  created_at: Date,
  updated_at: Date
}
```

---

## Deployment Checklist

### Pre-Deployment
- [ ] npm install (all dependencies)
- [ ] .env file configured (MONGO_URI, API_KEY, DEFAULT_USER_ID)
- [ ] Local testing passed (Phase 1 + Phase 2)
- [ ] MongoDB indexes created
- [ ] Database backup taken

### Deployment
- [ ] Deploy to Render
- [ ] Update iOS Shortcut webhook URL (if using Render)
- [ ] Test health endpoint: GET /health
- [ ] Test ingestion: POST /ingest/transaction
- [ ] Test read APIs: GET /accounts, GET /transactions
- [ ] Verify database entries

### Post-Deployment
- [ ] Monitor logs for errors
- [ ] Test iOS Shortcut (send real SMS)
- [ ] Verify dashboard loads
- [ ] Monitor performance (response times)

---

## Next Steps

### Immediate (Phase 3)
1. Add refund linking endpoints
2. Create budget management API
3. Implement auto-categorization
4. Add merchant-category mapping

### Short-term (Phase 4)
1. Advanced analytics endpoints
2. Trend analysis
3. Anomaly detection
4. Export features

### Medium-term (Phase 5)
1. JWT authentication
2. Multi-user support
3. Redis caching
4. Kafka streaming
5. Background workers

---

## Support & Debugging

### Check Server Status
```bash
curl http://localhost:3000/health
```

### View MongoDB Data
```javascript
db.accounts.find().pretty()
db.transactions.find().pretty()
```

### Check API Key
```bash
echo $API_KEY  # Print API key
```

### View Backend Logs
```bash
# If running locally
npm start     # Logs to console

# If on Render
# View in Render dashboard
```

---

## Performance Tips

1. **Use pagination** - Don't fetch all transactions at once
2. **Filter early** - Use start_date/end_date to reduce data
3. **Cache results** - Store dashboard summary in local state
4. **Batch requests** - Combine related queries
5. **Index frequently filtered fields** - Already done for user_id, transaction_time

---

**Generated:** Jan 14, 2026  
**Status:** Phase 1 + Phase 2 Complete
