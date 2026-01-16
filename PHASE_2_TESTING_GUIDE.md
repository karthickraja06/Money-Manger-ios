# 🧪 PHASE 2 TESTING GUIDE - GET APIs & FILTERING

## Overview

Phase 2 adds all read endpoints with:
- ✅ GET /accounts (list)
- ✅ GET /accounts/:id (detail)
- ✅ GET /accounts/summary/all (aggregations)
- ✅ GET /transactions (with filters)
- ✅ GET /transactions/:id (detail)
- ✅ GET /transactions/stats/aggregate (stats)
- ✅ GET /dashboard/* (7 dashboard endpoints)
- ✅ PATCH endpoints (updates)
- ✅ DELETE endpoints

**Authentication:** API key via `x-api-key` header

---

## Setup

### 1. Create Test Data (Phase 1)
First, ingest some transactions using Phase 1 endpoints:

```bash
# Send 5 transactions via POST /ingest/transaction
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

Create varied transactions (debits, credits, different banks) for comprehensive testing.

### 2. Start Server
```bash
cd backend
npm start
```

---

## Test Cases

### ✅ Test 1: GET /accounts (List all accounts)

```bash
curl http://localhost:3000/accounts \
  -H "x-api-key: your_secret_api_key_here"
```

**Expected Response (200):**
```json
{
  "status": "ok",
  "total": 2,
  "accounts": [
    {
      "id": "507f1f77bcf86cd799439012",
      "bank_name": "hdfc",
      "account_number": "1234",
      "account_holder": "John Doe",
      "current_balance": 10450,
      "balance_source": "sms",
      "balance_confidence": "high",
      "account_type": "bank",
      "transaction_count": 3
    },
    {
      "id": "507f1f77bcf86cd799439013",
      "bank_name": "icici",
      "account_number": "5678",
      "current_balance": 50000,
      "balance_source": "sms",
      "balance_confidence": "high",
      "account_type": "bank",
      "transaction_count": 2
    }
  ]
}
```

**Verification:**
- ✅ All accounts listed
- ✅ transaction_count calculated
- ✅ balance_source and balance_confidence present

---

### ✅ Test 2: GET /accounts/:id (Account detail)

```bash
curl http://localhost:3000/accounts/507f1f77bcf86cd799439012 \
  -H "x-api-key: your_secret_api_key_here"
```

**Expected Response (200):**
```json
{
  "status": "ok",
  "account": {
    "id": "507f1f77bcf86cd799439012",
    "bank_name": "hdfc",
    "current_balance": 10450,
    "balance_source": "sms"
  },
  "recent_transactions": [
    {
      "id": "507f1f77bcf86cd799439014",
      "amount": 500,
      "type": "debit",
      "merchant": "Amazon.in",
      "transaction_time": "2026-01-11T01:44:00Z"
    }
  ],
  "stats": {
    "total_transactions": 3,
    "total_debit": 1500,
    "total_credit": 5000
  }
}
```

**Verification:**
- ✅ Account detail displayed
- ✅ Recent transactions (max 10)
- ✅ Stats calculated correctly

---

### ✅ Test 3: GET /accounts/summary/all (All accounts summary)

```bash
curl http://localhost:3000/accounts/summary/all \
  -H "x-api-key: your_secret_api_key_here"
```

**Expected Response (200):**
```json
{
  "status": "ok",
  "summary": {
    "total_accounts": 2,
    "total_balance": 60450,
    "accounts_with_balance": 2,
    "accounts_without_balance": 0,
    "by_type": {
      "bank": 2,
      "cash": 0,
      "wallet": 0,
      "credit_card": 0
    }
  }
}
```

---

### ✅ Test 4: GET /transactions (List with no filters)

```bash
curl "http://localhost:3000/transactions" \
  -H "x-api-key: your_secret_api_key_here"
```

**Expected Response (200):**
```json
{
  "status": "ok",
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "pages": 1
  },
  "stats": {
    "total_items": 5,
    "total_debit": 1500,
    "total_credit": 5000,
    "net_amount": 3500
  },
  "transactions": [
    {
      "id": "507f1f77bcf86cd799439014",
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

**Verification:**
- ✅ All transactions listed
- ✅ Pagination info correct
- ✅ Stats calculated correctly

---

### ✅ Test 5: GET /transactions with Date Range Filter

```bash
curl "http://localhost:3000/transactions?start_date=2026-01-10&end_date=2026-01-12" \
  -H "x-api-key: your_secret_api_key_here"
```

**Expected:**
- Only transactions between Jan 10-12 returned
- Stats updated for filtered range

---

### ✅ Test 6: GET /transactions with Type Filter

```bash
curl "http://localhost:3000/transactions?type=debit,atm" \
  -H "x-api-key: your_secret_api_key_here"
```

**Expected:**
- Only debit and ATM transactions returned
- total_credit = 0 in stats

---

### ✅ Test 7: GET /transactions with Merchant Search

```bash
curl "http://localhost:3000/transactions?merchant=amazon" \
  -H "x-api-key: your_secret_api_key_here"
```

**Expected:**
- Partial match: "amazon", "AMAZON", "Amazon.in" all match
- Case-insensitive search

---

### ✅ Test 8: GET /transactions with Account Filter

```bash
curl "http://localhost:3000/transactions?account_ids=507f1f77bcf86cd799439012,507f1f77bcf86cd799439013" \
  -H "x-api-key: your_secret_api_key_here"
```

**Expected:**
- Only transactions from specified accounts

---

### ✅ Test 9: GET /transactions with Amount Range

```bash
curl "http://localhost:3000/transactions?min_amount=100&max_amount=1000" \
  -H "x-api-key: your_secret_api_key_here"
```

**Expected:**
- Only transactions with amount between 100-1000

---

### ✅ Test 10: GET /transactions with Pagination

```bash
curl "http://localhost:3000/transactions?page=1&limit=5" \
  -H "x-api-key: your_secret_api_key_here"
```

**Expected:**
- Only 5 transactions per page
- Pagination.pages = ceil(total / limit)
- Skip = (page-1) * limit

---

### ✅ Test 11: GET /transactions with Sorting

```bash
# Sort by amount, ascending
curl "http://localhost:3000/transactions?sort_by=amount&order=asc" \
  -H "x-api-key: your_secret_api_key_here"
```

**Expected:**
- Transactions sorted by amount (low to high)

---

### ✅ Test 12: GET /transactions/:id (Transaction detail)

```bash
curl http://localhost:3000/transactions/507f1f77bcf86cd799439014 \
  -H "x-api-key: your_secret_api_key_here"
```

**Expected Response (200):**
```json
{
  "status": "ok",
  "transaction": {
    "id": "507f1f77bcf86cd799439014",
    "amount": 500,
    "original_amount": 500,
    "net_amount": 500,
    "type": "debit",
    "merchant": "Amazon.in",
    "receiver_name": null,
    "sender_name": null,
    "category": null,
    "tags": [],
    "transaction_time": "2026-01-11T01:44:00Z",
    "linked_refunds": [],
    "original_transaction": null
  }
}
```

---

### ✅ Test 13: GET /transactions/stats/aggregate

```bash
curl "http://localhost:3000/transactions/stats/aggregate" \
  -H "x-api-key: your_secret_api_key_here"
```

**Expected Response (200):**
```json
{
  "status": "ok",
  "summary": {
    "total_transactions": 5,
    "total_debit": 1500,
    "total_credit": 5000,
    "net_amount": 3500,
    "avg_transaction": 1300,
    "min_transaction": 250,
    "max_transaction": 5000
  },
  "by_type": [
    { "_id": "debit", "count": 2, "total": 1000, "avg": 500 },
    { "_id": "credit", "count": 3, "total": 5000, "avg": 1666.67 }
  ],
  "top_merchants": [
    { "_id": "Amazon.in", "count": 2, "total": 1000 },
    { "_id": "Flipkart", "count": 1, "total": 500 }
  ],
  "by_category": []
}
```

---

### ✅ Test 14: GET /dashboard/summary

```bash
curl http://localhost:3000/dashboard/summary \
  -H "x-api-key: your_secret_api_key_here"
```

**Expected Response (200):**
```json
{
  "status": "ok",
  "current_month": {
    "expense": 1500,
    "income": 5000,
    "net_savings": 3500,
    "transaction_count": 5
  },
  "last_month": {
    "income": 0
  },
  "accounts": {
    "total_balance": 60450,
    "count": 2,
    "active": 2
  }
}
```

**Verification:**
- ✅ Current month calculated from this month's transactions
- ✅ net_savings = income - expense
- ✅ total_balance = sum of all account balances

---

### ✅ Test 15: GET /dashboard/recent

```bash
curl http://localhost:3000/dashboard/recent \
  -H "x-api-key: your_secret_api_key_here"
```

**Expected Response (200):**
```json
{
  "status": "ok",
  "recent_transactions": [
    {
      "id": "...",
      "amount": 500,
      "type": "debit",
      "merchant": "Amazon.in",
      "transaction_time": "2026-01-13T14:30:00Z"
    }
  ],
  "account_cards": [
    {
      "id": "...",
      "bank_name": "hdfc",
      "current_balance": 10450,
      "account_type": "bank"
    }
  ]
}
```

---

### ✅ Test 16: GET /dashboard/trends (12-month trends)

```bash
curl http://localhost:3000/dashboard/trends \
  -H "x-api-key: your_secret_api_key_here"
```

**Expected Response (200):**
```json
{
  "status": "ok",
  "trends": [
    { "month": "2025-01", "income": 0, "expense": 0, "net": 0 },
    { "month": "2025-02", "income": 0, "expense": 0, "net": 0 },
    ...
    { "month": "2026-01", "income": 5000, "expense": 1500, "net": 3500 }
  ]
}
```

---

### ✅ Test 17: GET /dashboard/category-breakdown

```bash
curl http://localhost:3000/dashboard/category-breakdown \
  -H "x-api-key: your_secret_api_key_here"
```

**Expected Response (200):**
```json
{
  "status": "ok",
  "categories": [
    { "_id": "Uncategorized", "total": 1500, "count": 2, "avg": 750 }
  ]
}
```

---

### ✅ Test 18: GET /dashboard/top-merchants

```bash
curl "http://localhost:3000/dashboard/top-merchants?limit=5" \
  -H "x-api-key: your_secret_api_key_here"
```

**Expected Response (200):**
```json
{
  "status": "ok",
  "merchants": [
    { "_id": "Amazon.in", "total": 1000, "count": 2, "avg": 500, "latest": "2026-01-11T01:44:00Z" },
    { "_id": "Flipkart", "total": 500, "count": 1, "avg": 500, "latest": "2026-01-12T10:30:00Z" }
  ]
}
```

---

### ✅ Test 19: GET /dashboard/daily-heatmap

```bash
curl http://localhost:3000/dashboard/daily-heatmap \
  -H "x-api-key: your_secret_api_key_here"
```

**Expected Response (200):**
```json
{
  "status": "ok",
  "days": 90,
  "heatmap": [
    { "date": "2026-01-11", "debit": 500, "credit": 0, "count": 1 },
    { "date": "2026-01-12", "debit": 0, "credit": 5000, "count": 1 }
  ]
}
```

---

### ✅ Test 20: GET /dashboard/account-wise

```bash
curl http://localhost:3000/dashboard/account-wise \
  -H "x-api-key: your_secret_api_key_here"
```

**Expected Response (200):**
```json
{
  "status": "ok",
  "accounts": [
    {
      "account": {
        "bank_name": "hdfc",
        "account_number": "1234"
      },
      "balance": 10450,
      "debit": 1000,
      "credit": 2000,
      "net": 1000,
      "transaction_count": 3
    }
  ]
}
```

---

### ✅ Test 21: PATCH /accounts/:id (Update account)

```bash
curl -X PATCH http://localhost:3000/accounts/507f1f77bcf86cd799439012 \
  -H "Content-Type: application/json" \
  -H "x-api-key: your_secret_api_key_here" \
  -d '{
    "is_active": false
  }'
```

**Expected Response (200):**
```json
{
  "status": "ok",
  "account": {
    "id": "507f1f77bcf86cd799439012",
    "is_active": false
  }
}
```

---

### ✅ Test 22: PATCH /transactions/:id (Update transaction)

```bash
curl -X PATCH http://localhost:3000/transactions/507f1f77bcf86cd799439014 \
  -H "Content-Type: application/json" \
  -H "x-api-key: your_secret_api_key_here" \
  -d '{
    "category": "Shopping",
    "tags": ["online", "urgent"],
    "notes": "Birthday gift for mom"
  }'
```

**Expected Response (200):**
```json
{
  "status": "ok",
  "transaction": {
    "id": "507f1f77bcf86cd799439014",
    "category": "Shopping",
    "tags": ["online", "urgent"],
    "notes": "Birthday gift for mom"
  }
}
```

---

### ✅ Test 23: DELETE /transactions/:id (Delete transaction)

```bash
curl -X DELETE http://localhost:3000/transactions/507f1f77bcf86cd799439014 \
  -H "x-api-key: your_secret_api_key_here"
```

**Expected Response (200):**
```json
{
  "status": "ok",
  "message": "Transaction deleted"
}
```

---

### ✅ Test 24: Missing API Key

```bash
curl http://localhost:3000/accounts
```

**Expected Response (401):**
```json
{
  "error": "Unauthorized",
  "code": "MISSING_API_KEY",
  "message": "x-api-key header required"
}
```

---

### ✅ Test 25: Invalid API Key

```bash
curl http://localhost:3000/accounts \
  -H "x-api-key: wrong_key"
```

**Expected Response (401):**
```json
{
  "error": "Unauthorized",
  "code": "INVALID_API_KEY",
  "message": "Invalid API key"
}
```

---

## Combined Filter Example

```bash
# Date range + Type + Merchant + Pagination
curl "http://localhost:3000/transactions?start_date=2026-01-10&end_date=2026-01-15&type=debit,atm&merchant=amazon&page=1&limit=10" \
  -H "x-api-key: your_secret_api_key_here"
```

---

## Performance Testing

### Bulk Query (1000+ transactions)
```bash
# Ingest 1000 transactions over several minutes
# Then test:
curl "http://localhost:3000/transactions?page=1&limit=100" \
  -H "x-api-key: your_secret_api_key_here"

# Should respond in < 500ms
```

### Aggregation Query
```bash
curl "http://localhost:3000/transactions/stats/aggregate?start_date=2026-01-01&end_date=2026-01-31" \
  -H "x-api-key: your_secret_api_key_here"

# Should respond in < 1000ms
```

---

## Postman Collection

Save this as `phase2.postman_collection.json`:

```json
{
  "info": {
    "name": "Phase 2 - GET APIs",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "GET /accounts",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "x-api-key",
            "value": "{{API_KEY}}"
          }
        ],
        "url": "{{BASE_URL}}/accounts"
      }
    },
    {
      "name": "GET /transactions",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "x-api-key",
            "value": "{{API_KEY}}"
          }
        ],
        "url": "{{BASE_URL}}/transactions"
      }
    },
    {
      "name": "GET /dashboard/summary",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "x-api-key",
            "value": "{{API_KEY}}"
          }
        ],
        "url": "{{BASE_URL}}/dashboard/summary"
      }
    }
  ]
}
```

---

## Test Checklist

- [ ] All 25 tests passing
- [ ] Filters working correctly (date, type, merchant, amount)
- [ ] Pagination working (page, limit)
- [ ] Sorting working (sort_by, order)
- [ ] Aggregations returning correct stats
- [ ] Dashboard endpoints responding
- [ ] Authentication enforced (401 without key)
- [ ] Performance < 1 sec for most queries
- [ ] No console errors

---

**Generated:** Jan 14, 2026  
**Status:** Ready for Phase 2 execution
