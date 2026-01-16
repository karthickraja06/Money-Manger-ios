# 🚀 BACKEND IMPLEMENTATION ROADMAP (PHASES)

**Tailored for: Personal Money Manager (Axio-Style)**  
**Status:** Ready to execute  
**Last Updated:** Jan 14, 2026

---

## 📋 PHASE OVERVIEW

| Phase | Goal | Estimated Time | Status |
|-------|------|---|--------|
| **Phase 1** | Core ingestion, parsing, dedup, balance logic | 3-5 hours | ✅ Complete |
| **Phase 2** | GET APIs, filters, aggregations | 4-6 hours | ✅ Complete |
| **Phase 3** | Refund linking, budgets, categories | 5-7 hours | ✅ Complete |
| **Phase 4** | Analytics, trends, dashboards | 4-5 hours | 📋 Planned |
| **Phase 5** | Auth improvements, BYOB, scaling | 6-8 hours | 📋 Planned |

---

## 🔴 PHASE 1: CORE INGESTION & LEDGER LOGIC (FOUNDATION)

### Goals
✅ SMS parsing (bank, amount, type, merchant)  
✅ Account auto-creation & balance management  
✅ Transaction creation with deduplication  
✅ Retry-safe idempotency  
✅ Receiver/Sender extraction  
✅ Error handling & logging  

### API Endpoints Implemented
- `POST /ingest/transaction` (iOS Shortcut webhook)

### Tasks

#### 1.1 Update Transaction Model (with all required fields)
**File:** `backend/src/models/Transaction.js`

```javascript
const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({
  // User & Account
  user_id: { type: String, required: true, index: true },
  account_id: { type: mongoose.Schema.Types.ObjectId, ref: "Account", index: true },

  // Amount
  amount: { type: Number, required: true },
  original_amount: { type: Number, required: true },
  net_amount: { type: Number, required: true }, // after refunds
  type: { type: String, enum: ["debit", "credit", "atm", "cash", "unknown"], default: "unknown" },

  // Merchant & Receiver/Sender Info
  merchant: { type: String, default: "UNKNOWN" },
  receiver_name: { type: String, default: null }, // Person/Bank who received
  sender_name: { type: String, default: null },   // Person/Bank who sent
  account_holder: { type: String, default: null }, // Full name if available

  // Bank Info
  bank_name: { type: String, required: true, index: true },
  account_number: { type: String, default: null }, // Last 4 digits typically

  // Raw Data & Deduplication
  raw_message: { type: String, required: true },
  dedup_hash: { type: String, unique: true, sparse: true, index: true },
  source: { type: String, default: "ios_shortcut" },

  // Transaction Timing
  transaction_time: { type: Date, required: true, index: true },
  received_time: { type: Date, default: Date.now },
  time_confidence: { type: String, enum: ["exact", "estimated"], default: "exact" },

  // Categorization (Phase 3)
  category: { type: String, default: null },
  tags: [String],
  notes: { type: String, default: null },

  // Refund System (Phase 3)
  is_refund_of: { type: mongoose.Schema.Types.ObjectId, ref: "Transaction", default: null },
  linked_refunds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Transaction" }],
  
  // Metadata
  visit_count: { type: Number, default: 1 }, // How many times same merchant
  created_at: { type: Date, default: Date.now, index: true },
  updated_at: { type: Date, default: Date.now }
});

// Compound index for dedup
transactionSchema.index({ 
  user_id: 1, 
  bank_name: 1, 
  amount: 1, 
  type: 1, 
  merchant: 1, 
  transaction_time: 1 
});

module.exports = mongoose.model("Transaction", transactionSchema);
```

---

#### 1.2 Update Account Model (balance source tracking)
**File:** `backend/src/models/Account.js`

```javascript
const mongoose = require("mongoose");

const accountSchema = new mongoose.Schema({
  // User & Identification
  user_id: { type: String, required: true, index: true },
  bank_name: { type: String, required: true },
  account_number: { type: String, default: null }, // Last 4 digits
  account_holder: { type: String, default: null }, // Full name if available

  // Balance Tracking
  current_balance: { type: Number, default: null },
  balance_source: { 
    type: String, 
    enum: ["sms", "calculated", "unknown"], 
    default: "unknown"
  },
  balance_confidence: { type: String, enum: ["high", "medium", "low"], default: "low" },
  last_balance_update_at: { type: Date, default: null },

  // Metadata
  created_from_sms: { type: Boolean, default: true },
  is_active: { type: Boolean, default: true },
  account_type: { type: String, enum: ["bank", "cash", "wallet", "credit_card"], default: "bank" },
  
  created_at: { type: Date, default: Date.now, index: true },
  updated_at: { type: Date, default: Date.now }
});

// Ensure one account per user per bank + account_number
accountSchema.index({ user_id: 1, bank_name: 1, account_number: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("Account", accountSchema);
```

---

#### 1.3 Enhanced Parser Service (extract receiver/sender)
**File:** `backend/src/services/parser.service.js`

```javascript
const regex = require("../utils/regex");

/**
 * Parse SMS message and extract all financial + personal info
 * @param {string} text - Raw SMS message
 * @returns {object | null} Parsed data or null if not transaction
 */
module.exports.parseMessage = (text) => {
  // Must have amount + currency
  const amountMatch = text.match(regex.amount);
  if (!amountMatch) return null;

  const amount = Number(amountMatch[2].replace(/,/g, ""));

  // Determine transaction type
  let type = "unknown";
  if (regex.debit.test(text)) type = "debit";
  else if (regex.credit.test(text)) type = "credit";
  else if (regex.atm.test(text)) type = "atm";

  // Extract bank name
  const bankMatch = text.match(regex.bank);
  const bank_name = bankMatch ? bankMatch[1] : "UNKNOWN";

  // Extract merchant
  const merchantMatch = text.match(regex.merchant);
  const merchant = merchantMatch ? merchantMatch[2].trim() : "UNKNOWN";

  // Extract balance if present (SMS authoritative source)
  let balance = null;
  const balanceMatch = text.match(regex.balance);
  if (balanceMatch) {
    balance = Number(balanceMatch[4].replace(/,/g, ""));
  }

  // 🆕 Extract receiver/sender/account holder names
  let receiver_name = null;
  let sender_name = null;
  let account_holder = null;

  // Pattern: "to John Doe" or "from Jane Smith"
  const toMatch = text.match(/to\s+([A-Za-z\s]+?)(?:\.|,|at|on)/i);
  const fromMatch = text.match(/from\s+([A-Za-z\s]+?)(?:\.|,|at|on)/i);

  if (toMatch) receiver_name = toMatch[1].trim();
  if (fromMatch) sender_name = fromMatch[1].trim();

  // Pattern: "Account holder: John Doe" or similar
  const holderMatch = text.match(/account\s+holder[:\s]+([A-Za-z\s]+?)(?:\.|,|A\/c)/i);
  if (holderMatch) account_holder = holderMatch[1].trim();

  // Extract transaction time (if present)
  let transaction_time = null;
  let time_confidence = "estimated";

  const timeMatch = text.match(regex.time); // HH:MM AM/PM
  if (timeMatch) {
    // If we have time, it's more accurate
    transaction_time = parseTimeFromSMS(timeMatch[0], new Date());
    time_confidence = "exact";
  }

  return {
    amount,
    original_amount: amount,
    net_amount: amount,
    type,
    bank_name,
    merchant,
    receiver_name,
    sender_name,
    account_holder,
    balance_from_sms: balance,
    transaction_time,
    time_confidence
  };
};

/**
 * Parse time from SMS format (e.g., "01:44 AM")
 */
function parseTimeFromSMS(timeStr, fallbackDate) {
  try {
    const [time, period] = timeStr.split(/\s+/);
    let [hours, minutes] = time.split(":").map(Number);

    if (period.toUpperCase() === "PM" && hours !== 12) hours += 12;
    if (period.toUpperCase() === "AM" && hours === 12) hours = 0;

    const parsed = new Date(fallbackDate);
    parsed.setHours(hours, minutes, 0, 0);
    return parsed;
  } catch (e) {
    return fallbackDate; // Fallback to received time
  }
}

module.exports.parseTimeFromSMS = parseTimeFromSMS;
```

---

#### 1.4 Enhanced Account Service (auto-create + balance update)
**File:** `backend/src/services/account.service.js`

```javascript
const Account = require("../models/Account");
const crypto = require("crypto");

/**
 * Get or create account, update balance if SMS contains it
 * @param {string} user_id
 * @param {string} bank_name
 * @param {object} parsed - Parsed SMS data
 * @returns {object} Account document
 */
module.exports.getOrCreateAccountAndUpdateBalance = async (
  user_id,
  bank_name,
  parsed
) => {
  // Normalize bank name (HDFC, HDFC Bank → hdfc)
  const normalizedBank = normalizeBankName(bank_name);

  // Try to find existing account
  let account = await Account.findOne({
    user_id,
    bank_name: normalizedBank
  });

  // Create if doesn't exist
  if (!account) {
    account = new Account({
      user_id,
      bank_name: normalizedBank,
      account_number: parsed.account_number || null,
      account_holder: parsed.account_holder || null,
      created_from_sms: true,
      account_type: detectAccountType(normalizedBank)
    });
  }

  // 🔥 Update balance from SMS (SMS is authoritative)
  if (parsed.balance_from_sms !== null) {
    account.current_balance = parsed.balance_from_sms;
    account.balance_source = "sms";
    account.balance_confidence = "high";
    account.last_balance_update_at = new Date();
  }

  // Update account holder if we extracted it
  if (parsed.account_holder && !account.account_holder) {
    account.account_holder = parsed.account_holder;
  }

  account.updated_at = new Date();
  await account.save();

  return account;
};

/**
 * Update balance via calculated method (debit/credit from transactions)
 */
module.exports.updateBalanceCalculated = async (accountId, type, amount) => {
  const account = await Account.findById(accountId);
  if (!account) return null;

  if (account.current_balance === null) {
    // Can't calculate without starting balance
    account.balance_source = "unknown";
    account.balance_confidence = "low";
  } else {
    if (type === "debit" || type === "atm") {
      account.current_balance -= amount;
    } else if (type === "credit") {
      account.current_balance += amount;
    }

    account.balance_source = "calculated";
    account.balance_confidence = "medium"; // Lower confidence than SMS
    account.last_balance_update_at = new Date();
  }

  account.updated_at = new Date();
  await account.save();
  return account;
};

/**
 * Generate deduplication hash
 * Hash = SHA256(user_id | bank_name | amount | type | merchant | transaction_time)
 */
module.exports.generateDedupHash = (user_id, bank_name, amount, type, merchant, transaction_time) => {
  const key = `${user_id}|${bank_name}|${amount}|${type}|${merchant}|${transaction_time.toISOString()}`;
  return crypto.createHash("sha256").update(key).digest("hex");
};

/**
 * Check if transaction already exists (dedup)
 */
module.exports.isDuplicateTransaction = async (dedupHash) => {
  const existing = await require("../models/Transaction").findOne({ dedup_hash: dedupHash });
  return existing ? true : false;
};

/**
 * Normalize bank names (HDFC Bank, HDFC, HDFC_BANK → hdfc)
 */
function normalizeBankName(name) {
  return name
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/_BANK$/i, "")
    .toLowerCase();
}

/**
 * Detect account type from bank name
 */
function detectAccountType(bankName) {
  if (bankName.includes("credit")) return "credit_card";
  if (bankName.includes("wallet") || bankName.includes("upi")) return "wallet";
  if (bankName.includes("cash")) return "cash";
  return "bank";
}

module.exports.normalizeBankName = normalizeBankName;
module.exports.detectAccountType = detectAccountType;
```

---

#### 1.5 Enhanced Regex Utils (receiver/sender patterns)
**File:** `backend/src/utils/regex.js`

```javascript
module.exports = {
  // Amount: Rs. 500, Rs 500, ₹500, INR 500
  amount: /(?:Rs\.?|₹|INR)\s*(\s*)(\d+(?:,\d{3})*(?:\.\d{2})?)/gi,

  // Transaction type
  debit: /debited|debit|sent|withdrawn|paid|spent|purchase/i,
  credit: /credited|credit|received|received|deposited|refund/i,
  atm: /atm|withdrawal|cash withdrawal/i,

  // Bank name
  bank: /(HDFC|ICICI|SBI|Axis|YES|Kotak|RBL|IndusInd|IDBI|PNB|BOI|Union|Canara|Bob|Boi)\s*(?:Bank)?/i,

  // Merchant (usually after "at" or after specific patterns)
  merchant: /(at|from|to|via)\s+([A-Za-z0-9\s&.'-]+?)(?:\s+on|\s+at|\s+,|\.|\z)/i,

  // Balance: "Available balance: Rs. 10,450"
  balance: /(balance|available|remaining)[:\s]*(?:of\s+)?(?:Rs\.?|₹|INR)\s*(\s*)(\d+(?:,\d{3})*(?:\.\d{2})?)/i,

  // Time: "01:44 AM", "1:44 PM"
  time: /\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)/,

  // Currency patterns
  rupee: /Rs\.?|₹|INR/,

  // Common UPI patterns
  upi_id: /[a-zA-Z0-9._-]+@[a-zA-Z]{3,}/,

  // Phone number
  phone: /\+?91?\s*\d{10}/
};
```

---

#### 1.6 Enhanced Ingest Route (complete dedup + balance logic)
**File:** `backend/src/routes/ingest.routes.js`

```javascript
const express = require("express");
const router = express.Router();

const Transaction = require("../models/Transaction");
const { parseMessage } = require("../services/parser.service");
const {
  getOrCreateAccountAndUpdateBalance,
  updateBalanceCalculated,
  generateDedupHash,
  isDuplicateTransaction
} = require("../services/account.service");

/**
 * POST /ingest/transaction
 * iOS Shortcut webhook for transaction ingestion
 */
router.post("/transaction", async (req, res) => {
  try {
    // ========================
    // 1️⃣ API KEY VALIDATION
    // ========================
    const apiKey = req.headers["x-api-key"];
    if (apiKey !== process.env.API_KEY) {
      return res.status(401).json({ 
        error: "Unauthorized",
        code: "INVALID_API_KEY"
      });
    }

    // ========================
    // 2️⃣ REQUEST VALIDATION
    // ========================
    const { user_id, raw_message, received_at, source } = req.body;

    if (!user_id || !raw_message) {
      return res.status(400).json({
        error: "Missing required fields: user_id, raw_message",
        code: "INVALID_REQUEST"
      });
    }

    // ========================
    // 3️⃣ PARSE SMS MESSAGE
    // ========================
    const parsed = parseMessage(raw_message);

    if (!parsed) {
      // Non-transaction message (e.g., promotional)
      return res.status(200).json({
        status: "ignored",
        reason: "non-transaction_message",
        message: "SMS does not contain transaction data"
      });
    }

    // ========================
    // 4️⃣ NORMALIZE DATES SAFELY
    // ========================
    let receivedTime = new Date(received_at);
    if (isNaN(receivedTime.getTime())) {
      receivedTime = new Date();
    }

    let transactionTime = parsed.transaction_time || receivedTime;

    // ========================
    // 5️⃣ GENERATE DEDUP HASH
    // ========================
    const dedupHash = generateDedupHash(
      user_id,
      parsed.bank_name,
      parsed.amount,
      parsed.type,
      parsed.merchant,
      transactionTime
    );

    // ========================
    // 6️⃣ CHECK FOR DUPLICATES
    // ========================
    const isDuplicate = await isDuplicateTransaction(dedupHash);

    if (isDuplicate) {
      return res.status(200).json({
        status: "duplicate",
        reason: "dedup_hash_matched",
        message: "Transaction already ingested",
        dedup_hash: dedupHash
      });
    }

    // ========================
    // 7️⃣ GET OR CREATE ACCOUNT
    // ========================
    const account = await getOrCreateAccountAndUpdateBalance(
      user_id,
      parsed.bank_name,
      parsed
    );

    // ========================
    // 8️⃣ CREATE TRANSACTION DOCUMENT
    // ========================
    const transaction = new Transaction({
      user_id,
      account_id: account._id,
      amount: parsed.amount,
      original_amount: parsed.original_amount,
      net_amount: parsed.net_amount,
      type: parsed.type,
      merchant: parsed.merchant,
      receiver_name: parsed.receiver_name,
      sender_name: parsed.sender_name,
      account_holder: parsed.account_holder,
      bank_name: parsed.bank_name,
      raw_message,
      dedup_hash: dedupHash,
      source: source || "ios_shortcut",
      transaction_time: transactionTime,
      received_time: receivedTime,
      time_confidence: parsed.time_confidence
    });

    await transaction.save();

    // ========================
    // 9️⃣ UPDATE BALANCE (if no SMS balance, calculate it)
    // ========================
    if (parsed.balance_from_sms === null) {
      // SMS didn't have balance, so calculate it
      await updateBalanceCalculated(account._id, parsed.type, parsed.amount);
    }

    // ========================
    // ✅ SUCCESS RESPONSE
    // ========================
    return res.status(201).json({
      status: "ingested",
      transaction_id: transaction._id,
      account_id: account._id,
      dedup_hash: dedupHash,
      account: {
        bank_name: account.bank_name,
        current_balance: account.current_balance,
        balance_source: account.balance_source
      },
      transaction: {
        amount: transaction.amount,
        type: transaction.type,
        merchant: transaction.merchant,
        receiver_name: transaction.receiver_name,
        sender_name: transaction.sender_name,
        transaction_time: transaction.transaction_time
      }
    });

  } catch (error) {
    console.error("❌ Ingestion Error:", error);

    // Database-specific errors
    if (error.code === 11000) {
      return res.status(409).json({
        error: "Duplicate transaction detected",
        code: "DUPLICATE_KEY",
        field: Object.keys(error.keyPattern)[0]
      });
    }

    return res.status(500).json({
      error: "Internal server error",
      code: "INTERNAL_ERROR",
      message: error.message
    });
  }
});

/**
 * GET /ingest/health
 * Health check for iOS Shortcut
 */
router.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

module.exports = router;
```

---

#### 1.7 Error Handling Middleware
**File:** `backend/src/middleware/errorHandler.js`

```javascript
/**
 * Global error handling middleware
 */
module.exports = (err, req, res, next) => {
  console.error("🔴 Error:", err.message);

  // Validation error
  if (err.name === "ValidationError") {
    return res.status(400).json({
      error: "Validation failed",
      code: "VALIDATION_ERROR",
      details: err.message
    });
  }

  // Cast error (invalid ObjectId)
  if (err.name === "CastError") {
    return res.status(400).json({
      error: "Invalid ID format",
      code: "CAST_ERROR"
    });
  }

  // Duplicate key
  if (err.code === 11000) {
    return res.status(409).json({
      error: "Resource already exists",
      code: "DUPLICATE_KEY"
    });
  }

  // Default error
  res.status(500).json({
    error: "Internal server error",
    code: "INTERNAL_ERROR"
  });
};
```

Add to `app.js`:
```javascript
const errorHandler = require("./middleware/errorHandler");
app.use(errorHandler);
```

---

#### 1.8 Environment Variables (.env template)
**File:** `backend/.env`

```env
# Database
MONGO_URI=mongodb+srv://user:password@cluster.mongodb.net/money_manager

# Server
PORT=3000
NODE_ENV=production

# Security
API_KEY=your_secret_api_key_here

# Logging
LOG_LEVEL=info
```

---

### Testing Phase 1

#### Test Case: Valid Transaction
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

**Expected Response:**
```json
{
  "status": "ingested",
  "transaction_id": "...",
  "account_id": "...",
  "dedup_hash": "sha256...",
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

#### Test Case: Duplicate Detection
```bash
# Send same transaction twice
# First → ingested
# Second → duplicate (same dedup_hash)
```

#### Test Case: Balance Update
```bash
# Send transaction with balance → account.current_balance updated
# Send transaction without balance → balance calculated
```

---

## 🟡 PHASE 2: READ APIs & FILTERING

### Endpoints to Build
- `GET /accounts` - List all accounts
- `GET /accounts/:id` - Account details
- `GET /transactions` - List transactions with filters
- `GET /transactions/:id` - Transaction detail
- `GET /dashboard/summary` - Dashboard stats
- `GET /dashboard/recent` - Recent 5 transactions

### Filters Supported
- Date range (start_date, end_date)
- Transaction type (debit, credit, atm, cash)
- Account (multi-select)
- Merchant search
- Refund status

### Aggregations
- Total debit / credit per period
- Category spending
- Account balance trends
- Top merchants

---

## 🟠 PHASE 3: REFUND LINKING & BUDGETS ✅ COMPLETE

### Implementation Summary
**Files Created:**
- `backend/src/models/Budget.js` - Budget model with monthly limits
- `backend/src/models/Category.js` - Category model with auto-categorization
- `backend/src/services/budget.service.js` - Budget calculations & status
- `backend/src/services/refund.service.js` - Refund linking & net spend
- `backend/src/routes/budgets.routes.js` - Budget CRUD & category management

**Files Modified:**
- `backend/src/routes/transactions.routes.js` - Added 6 refund endpoints
- `backend/src/app.js` - Registered budgets route

### Endpoints Implemented
**Budgets:**
- `GET /budgets` - List all with current status
- `GET /budgets/alerts` - Budget alerts (exceeding, near limit)
- `GET /budgets/:category` - Category budget status
- `POST /budgets` - Create/update budget
- `PATCH /budgets/:category` - Update budget settings
- `DELETE /budgets/:category` - Delete budget

**Refunds:**
- `POST /transactions/:id/link-refund` - Link refund to original
- `DELETE /transactions/:id/unlink-refund` - Unlink refund
- `GET /transactions/:id/potential-refunds` - Find refund candidates
- `GET /transactions/refunds/pairs` - List all refund pairs
- `POST /transactions/refunds/auto-link` - Auto-link refunds
- `GET /transactions/refunds/net-spend` - Net spend after refunds

**Categories:**
- `POST /budgets/categories` - Create custom category
- `GET /budgets/categories` - List categories
- `PATCH /budgets/categories/:id` - Update category
- `POST /budgets/auto-categorize` - Auto-categorize transactions
- `POST /budgets/init-defaults` - Initialize default budgets

### Features
✅ Budget creation with monthly limits & alert thresholds  
✅ Spent tracking per category  
✅ Budget alerts (exceeding, near limit)  
✅ Refund linking (original + refund pair)  
✅ Potential refund candidates (same amount, 7-day window)  
✅ Auto-linking refunds  
✅ Net spend calculation (debits - refunds)  
✅ Custom categories with merchant patterns  
✅ Keyword-based auto-categorization  
✅ Default category mappings (grocery, dining, transport, etc)  
✅ Category transaction counting  

---

## 🔴 PHASE 4: ANALYTICS & DASHBOARDS

### Endpoints
- `GET /analytics/trends` - Monthly trends
- `GET /analytics/categories` - Category breakdown
- `GET /analytics/merchants` - Merchant leaderboard
- `GET /analytics/heatmap` - Daily spend calendar
- `GET /analytics/accounts-health` - Account health

### Features
- Time series data
- Comparative analysis (month-to-month)
- Anomaly flags
- Savings rate calculation

---

## 🟣 PHASE 5: AUTH & SCALING

### Security Enhancements
- OAuth2 / JWT (replace API key)
- Rate limiting
- Request signing
- Encryption at rest

### Scalability
- Connection pooling
- Caching layer (Redis)
- Kafka for event streaming
- Background job workers

### Multi-User Support
- User isolation
- Team sharing
- Audit logs
- Data export

---

## 📊 IMPLEMENTATION CHECKLIST

### Phase 1 ✅
- [x] Update Transaction model
- [x] Update Account model  
- [x] Enhance parser (receiver/sender extraction)
- [x] Enhanced account service (dedup + balance)
- [x] Update regex utils
- [x] Enhanced ingest route (complete)
- [x] Error handling middleware
- [x] Test dedup + balance logic
- [x] Deploy to Render

### Phase 2 ✅
- [x] Build GET /accounts endpoint
- [x] Build GET /transactions endpoint with filters
- [x] Build GET /dashboard/summary
- [x] Implement aggregations
- [x] Add pagination
- [x] Performance optimization

### Phase 3 ✅
- [x] Create Budget model
- [x] Create Category model
- [x] Budget management endpoints
- [x] Auto-categorization logic
- [x] Refund linking endpoints
- [x] Net spend calculation
- [x] Merchant pattern matching
- [x] Category default initialization

- [ ] Anomaly detection logic

### Phase 5
- [ ] User authentication (JWT)
- [ ] Rate limiting middleware
- [ ] Redis caching
- [ ] Kafka integration
- [ ] Background workers
- [ ] Audit logging

---

## 🔗 DEPENDENCIES (Already in package.json)

```json
{
  "express": "^5.2.1",
  "mongoose": "^9.1.2",
  "mongodb": "^7.0.0",
  "cors": "^2.8.5",
  "dotenv": "^17.2.3",
  "uuid": "^13.0.0"
}
```

### To Add Later
```json
{
  "jsonwebtoken": "^9.x",
  "bcryptjs": "^2.x",
  "redis": "^4.x",
  "express-rate-limit": "^7.x",
  "kafkajs": "^2.x",
  "bull": "^4.x"
}
```

---

## 🚀 QUICK START (Phase 1)

```bash
# 1. Install dependencies
cd backend
npm install

# 2. Set up .env
cp .env.example .env
# Edit .env with your MongoDB URI and API key

# 3. Run server
npm start

# 4. Test ingestion
curl -X POST http://localhost:3000/ingest/transaction ...
```

---

## 📝 NOTES

- **Receiver/Sender Extraction:** Parser now tries to extract person/bank names from SMS patterns
- **Deduplication:** Hash-based, handles iOS retries gracefully
- **Balance Logic:** SMS is authoritative, calculated as fallback
- **Idempotency:** Safe to replay requests without data corruption
- **Scalability:** Designed for Kafka + background workers in Phase 5

---

## 📝 PHASE 3 DETAILED IMPLEMENTATION NOTES

### Database Schema Changes

**Budget Collection:**
```json
{
  "user_id": "my_iphone",
  "category": "Dining",
  "monthly_limit": 5000,
  "alert_threshold": 80,
  "spent_this_month": 3200,
  "reset_day": 1,
  "is_active": true,
  "notes": "Lunch and dinner expenses",
  "timestamps": {}
}
```

**Category Collection:**
```json
{
  "user_id": "my_iphone",
  "name": "Restaurant",
  "parent_category": "Dining",
  "keywords": ["zomato", "swiggy", "restaurant"],
  "merchant_patterns": [".*restaurant.*", ".*cafe.*"],
  "color": "#FF6B6B",
  "is_active": true,
  "transaction_count": 45
}
```

### Service Functions

**budget.service.js exports:**
- `getOrCreateDefaultBudgets(user_id)` - Initialize 10 default budgets
- `calculateCategorySpent(user_id, category)` - Sum debits for month
- `getBudgetStatus(user_id, category)` - Full status with percentage
- `getAllBudgetsWithStatus(user_id)` - All budgets with current data
- `updateBudgetSpent(user_id, category)` - Sync spent amount
- `getBudgetAlerts(user_id)` - Exceeding + near limit
- `createCategory(user_id, name, parent, keywords)` - Custom category
- `autoCategorizeMerchant(user_id, merchant)` - Map merchant to category
- `autoCategorizeTransactions(user_id, limit)` - Batch categorization

**refund.service.js exports:**
- `linkRefund(user_id, original_tx_id, refund_tx_id)` - Create pair
- `unlinkRefund(user_id, original_tx_id)` - Remove pair
- `getRefundPairs(user_id)` - All linked pairs
- `getPotentialRefunds(user_id, original_tx_id)` - Candidates (7-day window)
- `calculateNetSpend(user_id, startDate, endDate)` - Debits - refunds
- `autoLinkRefunds(user_id)` - Auto-link matching refunds

### Key Logic Flows

**Budget Status Calculation:**
1. Fetch budget record for (user_id, category)
2. Sum all debit transactions for current month where category matches
3. Calculate percentage = (spent / monthly_limit) * 100
4. Determine status: exceeding (>100%), near limit (>=threshold), ok (<threshold)
5. Return: spent, remaining, percentage, alert status

**Refund Linking:**
1. Validate original is debit, refund is credit
2. Verify amounts match exactly
3. Create bidirectional references
4. Set refund_status="refunded" on original
5. Set is_refund=true on refund transaction

**Auto-Categorization:**
1. Check custom categories for merchant pattern matches
2. Check keyword matches in category keywords
3. Fall back to default merchant mappings
4. If no match found, return "Other"
5. Update transaction.category field

### Testing Examples

**Create Budget:**
```bash
curl -X POST http://localhost:3000/budgets \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "category": "Dining",
    "monthly_limit": 5000,
    "alert_threshold": 80
  }'
```

**Link Refund:**
```bash
curl -X POST http://localhost:3000/transactions/ORIGINAL_ID/link-refund \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"refund_tx_id": "REFUND_ID"}'
```

**Get Budget Status:**
```bash
curl http://localhost:3000/budgets/Dining \
  -H "x-api-key: YOUR_API_KEY"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "category": "Dining",
    "monthly_limit": 5000,
    "spent": 3200,
    "remaining": 1800,
    "percentage": 64,
    "transaction_count": 12,
    "alert_threshold": 80,
    "is_exceeding": false,
    "is_near_limit": false
  }
}
```

### Integration with Existing Code

Phase 3 integrates with:
- **Phase 1 Models:** Uses Transaction dedup_hash, is_refund, original_transaction_id fields
- **Phase 1 Ingest:** Categorizes new transactions via auto-categorization
- **Phase 2 Filters:** Category field now populated, enables filtering by category
- **Phase 2 Dashboard:** Can aggregate by category for pie charts

### Next Steps (Phase 4)

After Phase 3:
1. Add more sophisticated anomaly detection for refunds
2. Implement recurring transaction detection (same merchant, ~same day)
3. Add merchant intelligence (typical categories)
4. Build spending trends by category over time
5. Implement savings goals tracking

---

**END OF PHASE ROADMAP**

Generated: Jan 14, 2026  
Phase 3 Complete: Jan 14, 2026  
For questions: See design doc in project root
