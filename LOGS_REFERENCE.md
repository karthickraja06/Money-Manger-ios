# Expected Logs - Complete Reference

## When Everything Works (High Confidence)

### Input:
```
"Debit alert: Rs.1,250.00 debited from your HDFC Bank A/C XXXX1988 at KALANJIYAM STORES on 07/03/26 10:45 AM. Ref: REF601048839131"
```

### Console Output (Render Logs):
```
[PARSER] ========== PARSE START ==========
[PARSER] Input length: 156
[PARSER] Type: debit
[PARSER] Amount extracted: 1250
[PARSER] Merchant extracted: KALANJIYAM STORES
[PARSER] Bank detected: HDFC
[PARSER] Account extracted: 1988
[PARSER] Reference: REF601048839131
[PARSER] Date: 2026-03-07T10:45:00.000Z
[PARSER] Card payment: false
[PARSER] Mandate: false
[PARSER] Confidence: high (7/7 factors)
[PARSER] ========== PARSE SUCCESS ==========

[INGEST] ✓ Transaction saved - ID: 65e8d3c2a1b9f4e7c2d1a9b8
```

### Database Record Created:
```json
{
  "_id": "65e8d3c2a1b9f4e7c2d1a9b8",
  "user_id": "my_iphone",
  "account_id": "65e8d3c1a1b9f4e7c2d1a9b7",
  "amount": 1250,
  "type": "debit",
  "merchant": "KALANJIYAM STORES",
  "bank_name": "HDFC",
  "account_number": "1988",
  "reference_id": "REF601048839131",
  "transaction_time": "2026-03-07T10:45:00Z",
  "is_card_payment": false,
  "is_mandate": false,
  "status": "completed",
  "_parsing_confidence": "high",
  "created_at": "2026-03-07T10:45:30Z"
}
```

---

## When Aura 15 (Non-Transactional) - BLOCKED ✅

### Input:
```
"50% data over. Recharge for Rs.50 now. Plan validity: 31 days"
```

### Console Output:
```
[PARSER] ========== PARSE START ==========
[PARSER] Input length: 56
[PARSER] ❌ Non-transactional message detected
[PARSER] Pattern matched: /(\d+%\s+)?data\s+(?:over|remaining|used|consumed|rollover|validity)/i
[PARSER] ========== PARSE FAILED ==========

[INGEST] Status: ignored
[INGEST] Reason: non_transaction_message
```

### HTTP Response:
```
HTTP/2 200
{
  "status": "ignored",
  "reason": "non_transaction_message",
  "message": "SMS does not contain transaction data"
}
```

---

## When Bank Normalization - Multiple Banks ✅

### Test Sequence: ICICI → SBI → Axis

#### Transaction 1: ICICI
```
Input: "Debit alert: Rs.500 debited from your ICICI Bank A/C XXXX1234 at ABC STORE on 07/03/26"

[PARSER] Bank detected: ICICI
[PARSER] Confidence: high (7/7 factors)
[INGEST] ✓ Transaction saved - ID: tx_001
[INGEST] Account created: bank_name="ICICI"
```

#### Transaction 2: SBI
```
Input: "Payment of Rs.1500 from State Bank of India A/C XXXX5678 to XYZ SHOP on 07-Mar-2026"

[PARSER] Bank detected: SBI
[PARSER] Confidence: high (7/7 factors)
[INGEST] ✓ Transaction saved - ID: tx_002
[INGEST] Account created: bank_name="SBI"
```

#### Transaction 3: Axis
```
Input: "Debit Rs.750 from Axis Bank Savings A/C ending XXXX9012 at PQR Store 07/03/26"

[PARSER] Bank detected: Axis
[PARSER] Confidence: high (7/7 factors)
[INGEST] ✓ Transaction saved - ID: tx_003
[INGEST] Account created: bank_name="Axis"
```

### Frontend Result:
```
Accounts Tiles:
├── HDFC (existing)
├── ICICI (NEW)
├── SBI (NEW)
└── Axis (NEW)
```

---

## When Duplicate Detected - SECOND SMS REJECTED ✅

### First SMS:
```
Input: "Sent Rs.250 to John from HDFC Bank A/C XXXX1234 on 07/03/26 at 14:30"

[INGEST] POST /ingest/transaction body: { "user_id": "my_iphone", ... }
[INGEST] API Key check - received: present, expected: set
[PARSER] Amount extracted: 250
[PARSER] Bank detected: HDFC
[PARSER] Confidence: high (6/7 factors)
[INGEST] ✓ Transaction saved - ID: tx_dedup_001
[INGEST] ========== INGEST SUCCESS ==========

HTTP/2 201
{
  "status": "ok",
  "message": "Transaction ingested successfully",
  "id": "tx_dedup_001",
  "parsing_confidence": "high"
}
```

### Second SMS (IDENTICAL):
```
Input: "Sent Rs.250 to John from HDFC Bank A/C XXXX1234 on 07/03/26 at 14:30"

[INGEST] POST /ingest/transaction body: { "user_id": "my_iphone", ... }
[INGEST] API Key check - received: present, expected: set
[INGEST] ⚠ Duplicate transaction detected - dedup_hash match
[INGEST] ========== INGEST SKIPPED ==========

HTTP/2 409
{
  "status": "duplicate",
  "message": "Transaction already ingested",
  "id": "tx_dedup_001"
}
```

### Result:
- ✅ First SMS: Transaction created
- ❌ Second SMS: Rejected (no duplicate created)
- Database has 1 transaction, not 2

---

## When Mandate Detected - MARKED ✅

### Input:
```
"Mandate established for Rs.5000 monthly auto-debit to FINTECH LTD on 5th. Ref: MND987654"
```

### Console Output:
```
[PARSER] ========== PARSE START ==========
[PARSER] Type: debit
[PARSER] Amount extracted: 5000
[PARSER] Merchant extracted: FINTECH LTD
[PARSER] Bank detected: (not found - will be UNKNOWN)
[PARSER] Reference: MND987654
[PARSER] Mandate: true ← KEY DIFFERENCE
[PARSER] Confidence: medium (5/7 factors)
[PARSER] ========== PARSE SUCCESS ==========

[INGEST] ✓ Transaction saved with is_mandate=true
```

### Database Record:
```json
{
  "amount": 5000,
  "merchant": "FINTECH LTD",
  "is_mandate": true,
  "_parsing_confidence": "medium",
  "created_at": "2026-03-07T10:00:00Z"
}
```

### Frontend Display:
```
Transaction marked with "📆 Recurring" badge
Last 4 digits: ...5000 (EMI)
```

---

## When KYC Message - BLOCKED ✅

### Input:
```
"Complete your KYC verification on Aadhar now. Click link: https://..."
```

### Console Output:
```
[PARSER] ========== PARSE START ==========
[PARSER] Input length: 78
[PARSER] ❌ Non-transactional message detected
[PARSER] Pattern matched: /kyc|aadhar|pan|verification|identity/i
[PARSER] ========== PARSE FAILED ==========

[INGEST] Status: ignored
```

---

## When Offer/Promotion - BLOCKED ✅

### Input:
```
"Exclusive cashback offer! Get Rs.500 cashback on your first transfer. Use code WELCOME500"
```

### Console Output:
```
[PARSER] ========== PARSE START ==========
[PARSER] ❌ Non-transactional message detected
[PARSER] Pattern matched: /(?:offer|reward|cashback|bonus|promotion)/i
[PARSER] ========== PARSE FAILED ==========
```

---

## When Low Confidence - INGESTED BUT FLAGGED ⚠️

### Input:
```
"Rs.100 payment done"
```

### Console Output:
```
[PARSER] ========== PARSE START ==========
[PARSER] Type: debit
[PARSER] Amount extracted: 100
[PARSER] Merchant extracted: (not found)
[PARSER] Bank detected: (not found)
[PARSER] ❌ NO MERCHANT DETECTED
[PARSER] Confidence: low (2/7 factors)
[PARSER] ========== PARSE SUCCESS (WITH WARNING) ==========

[INGEST] ✓ Transaction saved with _requires_review=true
```

### Database Record:
```json
{
  "amount": 100,
  "merchant": "UNIDENTIFIED",
  "bank_name": null,
  "account_number": null,
  "_parsing_confidence": "low",
  "_requires_review": true,
  "created_at": "2026-03-07T10:00:00Z"
}
```

### Frontend Display:
```
Transaction shown with:
⚠️ "UNIDENTIFIED" merchant (yellow highlight)
💬 "Needs Review" tag
```

---

## Log Patterns to Look For

### ✅ Success Pattern:
```
[PARSER] Amount extracted
[PARSER] Merchant extracted
[PARSER] Bank detected
[PARSER] Confidence: high
[INGEST] ✓ Transaction saved
```

### ❌ Filtered Pattern:
```
[PARSER] Non-transactional message detected
[INGEST] Status: ignored
```

### ⚠️ Duplicate Pattern:
```
[INGEST] Duplicate transaction detected
[INGEST] dedup_hash match
```

### 🔄 Mandate Pattern:
```
[PARSER] Mandate: true
[INGEST] is_mandate=true
```

---

## Common Issues & Fixes

| Log Message | Cause | Fix |
|-------------|-------|-----|
| `Cannot read properties of undefined` | Old regex.js still in use | Restart backend server |
| `Confidence: low (1/7)` | Only amount matched | Check merchant/bank keywords |
| `Duplicate detected (expected)` | Same SMS twice | Normal - dedup working |
| `Bank detected: null` | Bank name not in keywords | Add to `regex.bank.keywords` |
| `Non-transactional detected` | Message matched filter | Check `regex.nonTransaction.patterns` |

---

## Debug Mode (Optional)

Add this to `parser.service.js` for verbose logging:

```javascript
const DEBUG = process.env.PARSER_DEBUG === 'true';

if (DEBUG) {
  console.log('[PARSER DEBUG] All patterns tested:');
  console.log('  contextual:', patterns[0].test(rawMessage));
  console.log('  direct:', patterns[1].test(rawMessage));
  console.log('  reference:', patterns[2].test(rawMessage));
}
```

Enable with: `PARSER_DEBUG=true npm start`

