# SMS Parser Testing Guide

## How Issues Were Addressed

### 1️⃣ **"Aura 15" False Positive - FIXED ✅**

**Problem:** Captured "Aura 15" as merchant name from non-transactional data messages.

**How Fixed:**
- **Stopword filtering** in `merchant.clean()`:
  ```javascript
  const stopwords = ['aura', 'data', 'gb', 'mb', ...];
  merchant = merchant.replace(regex.merchant_stopwords, ' ');
  ```
- **Non-transactional filter** blocks entire message:
  ```javascript
  /(\d+%\s+)?data\s+(?:over|remaining|used|consumed)/i
  ```

**Test Case:**
```bash
curl -X POST 'http://localhost:3000/ingest/transaction' \
  -H 'Content-Type: application/json' \
  -H 'x-api-key: YOUR_API_KEY' \
  -d '{
    "user_id": "test_user",
    "raw_message": "Aura 15 data plan offer - 50% data over for Rs.50. Recharge now!",
    "received_at": "2026-03-07T10:00:00Z",
    "source": "ios_shortcut"
  }'
```

**Expected Result:**
```json
{
  "status": "ignored",
  "reason": "non_transaction_message",
  "message": "SMS does not contain transaction data"
}
```

---

### 2️⃣ **Duplicate Accounts Issue - FIXED ✅**

**Problem:** Only 2 HDFC tiles visible despite transactions from ICICI, SBI, Axis, etc.

**How Fixed:**
- **Bank name normalization** in `extractBank()`:
  ```javascript
  const standardName = {
    hdfc: 'HDFC',
    icici: 'ICICI',
    axis: 'Axis',
    sbi: 'SBI',
    kotak: 'Kotak',
    yes: 'YES Bank',
    // ... all major banks
  };
  ```
- **Keyword-based matching** (handles variations):
  ```javascript
  for (const [bankCode, keywords] of Object.entries(regex.bank.keywords)) {
    for (const keyword of keywords) {
      if (messageLower.includes(keyword)) {
        // ... normalize to standard name
      }
    }
  }
  ```

**Test Cases:**

**Test 1: ICICI Transaction**
```bash
curl -X POST 'http://localhost:3000/ingest/transaction' \
  -H 'Content-Type: application/json' \
  -H 'x-api-key: YOUR_API_KEY' \
  -d '{
    "user_id": "test_user",
    "raw_message": "Debit alert: Rs.500 debited from your ICICI Bank A/C XXXX1234 at ABC STORE on 07/03/26. Ref: ICL12345",
    "received_at": "2026-03-07T10:00:00Z",
    "source": "ios_shortcut"
  }'
```

**Expected Result:**
```json
{
  "status": "ok",
  "bank_name": "ICICI",  // ← Normalized
  "merchant": "ABC STORE",
  "amount": 500,
  "parsing_confidence": "high"
}
```

**Test 2: SBI Transaction**
```bash
curl -X POST 'http://localhost:3000/ingest/transaction' \
  -H 'Content-Type: application/json' \
  -H 'x-api-key: YOUR_API_KEY' \
  -d '{
    "user_id": "test_user",
    "raw_message": "Payment of Rs.1500 made to XYZ SHOP from State Bank of India A/C ending XXXX5678 on 07-Mar-2026 14:30",
    "received_at": "2026-03-07T14:30:00Z",
    "source": "ios_shortcut"
  }'
```

**Expected Result:**
```json
{
  "status": "ok",
  "bank_name": "SBI",  // ← Normalized
  "merchant": "XYZ SHOP",
  "amount": 1500,
  "parsing_confidence": "high"
}
```

**Verification in Frontend:**
- Should see separate tiles: "HDFC", "ICICI", "SBI", "Axis", etc.
- Each bank's transactions grouped under correct tile

---

### 3️⃣ **Non-Transactional Messages - FIXED ✅**

**Problem:** Data recharge, KYC, balance updates captured as transactions.

**How Fixed:**
- **Non-transactional filter patterns** in `isNonTransactional()`:
  ```javascript
  patterns: [
    /(\d+%\s+)?data\s+(?:over|remaining|used|consumed|rollover|validity)/i,
    /recharge\s+(?:plan|package|offer|validity|expired)/i,
    /kyc|aadhar|pan|verification|identity/i,
    /(?:update|reset|change)\s+(?:password|pin|phone|email)/i,
    /(?:offer|reward|cashback|bonus|promotion)/i,
    // ... more patterns
  ]
  ```

**Test Cases:**

**Test 1: Data Recharge (Should be IGNORED)**
```bash
curl -X POST 'http://localhost:3000/ingest/transaction' \
  -H 'Content-Type: application/json' \
  -H 'x-api-key: YOUR_API_KEY' \
  -d '{
    "user_id": "test_user",
    "raw_message": "50% data over. Recharge for Rs.50 now. Plan validity: 31 days",
    "received_at": "2026-03-07T10:00:00Z",
    "source": "ios_shortcut"
  }'
```

**Expected Result:**
```json
{
  "status": "ignored",
  "reason": "non_transaction_message",
  "detail": "Pattern matched: data recharge"
}
```

**Test 2: KYC Message (Should be IGNORED)**
```bash
curl -X POST 'http://localhost:3000/ingest/transaction' \
  -H 'Content-Type: application/json' \
  -H 'x-api-key: YOUR_API_KEY' \
  -d '{
    "user_id": "test_user",
    "raw_message": "Complete your KYC verification on Aadhar now for unrestricted banking. Click here: https://link.com",
    "received_at": "2026-03-07T10:00:00Z",
    "source": "ios_shortcut"
  }'
```

**Expected Result:**
```json
{
  "status": "ignored",
  "reason": "non_transaction_message",
  "detail": "Pattern matched: KYC verification"
}
```

**Test 3: Offer Message (Should be IGNORED)**
```bash
curl -X POST 'http://localhost:3000/ingest/transaction' \
  -H 'Content-Type: application/json' \
  -H 'x-api-key: YOUR_API_KEY' \
  -d '{
    "user_id": "test_user",
    "raw_message": "Exclusive cashback offer! Get Rs.500 bonus on your first transfer. Use code WELCOME500",
    "received_at": "2026-03-07T10:00:00Z",
    "source": "ios_shortcut"
  }'
```

**Expected Result:**
```json
{
  "status": "ignored",
  "reason": "non_transaction_message",
  "detail": "Pattern matched: promotional offer"
}
```

---

### 4️⃣ **Mandate & Duplicate SMS - FIXED ✅**

**Problem:** Mandate messages not distinguished; duplicate SMS from bank confirmation.

**How Fixed:**
- **Mandate detection** in `isMandate()`:
  ```javascript
  mandate: {
    pattern: /(?:mandate|standing\s+instruction|recurring|auto[\s-]?debit|auto[\s-]?pay|scheduled\s+payment|emandate)/i
  }
  ```
- **Dedup hash** in Cloudflare worker and backend:
  ```javascript
  const dedupHash = crypto
    .createHash('sha256')
    .update(`${user_id}-${received_at}-${raw_message}`)
    .digest('hex');
  ```

**Test Cases:**

**Test 1: Mandate Setup (Should be marked as mandate=true)**
```bash
curl -X POST 'http://localhost:3000/ingest/transaction' \
  -H 'Content-Type: application/json' \
  -H 'x-api-key: YOUR_API_KEY' \
  -d '{
    "user_id": "test_user",
    "raw_message": "Mandate established for Rs.5000 EMI auto-debit to FINTECH LTD on 5th of each month. Ref: MND987654",
    "received_at": "2026-03-07T10:00:00Z",
    "source": "ios_shortcut"
  }'
```

**Expected Result:**
```json
{
  "status": "ok",
  "merchant": "FINTECH LTD",
  "amount": 5000,
  "is_mandate": true,
  "parsing_confidence": "medium"
}
```

**Test 2: Duplicate Detection (Same SMS sent twice - second should be ignored)**
```bash
# First attempt - should succeed
curl -X POST 'http://localhost:3000/ingest/transaction' \
  -H 'Content-Type: application/json' \
  -H 'x-api-key: YOUR_API_KEY' \
  -d '{
    "user_id": "test_user",
    "raw_message": "Sent Rs.250 to John from HDFC Bank A/C XXXX1234 on 07/03/26 at 14:30",
    "received_at": "2026-03-07T14:30:00Z",
    "source": "ios_shortcut"
  }'

# Response (first):
# {"status": "ok", "id": "tx_123", "parsing_confidence": "high"}

# Second attempt - EXACT SAME MESSAGE
curl -X POST 'http://localhost:3000/ingest/transaction' \
  -H 'Content-Type: application/json' \
  -H 'x-api-key: YOUR_API_KEY' \
  -d '{
    "user_id": "test_user",
    "raw_message": "Sent Rs.250 to John from HDFC Bank A/C XXXX1234 on 07/03/26 at 14:30",
    "received_at": "2026-03-07T14:30:00Z",
    "source": "ios_shortcut"
  }'

# Response (second):
# {"status": "duplicate", "message": "Transaction already ingested", "id": "tx_123"}
```

**Expected Result:**
- First call: Creates transaction, returns 201
- Second call: Returns 409 Conflict, no duplicate created

---

### 5️⃣ **Google Login Integration - ADDED ✅**

**How Implemented:**

**Backend (`auth.routes.js`):**
- `POST /auth/google` - Verify Google token, create user session
- `GET /auth/me` - Get current authenticated user
- `POST /auth/logout` - Destroy session

**Frontend (`auth.service.ts`):**
- `verifyGoogleToken()` - Send credential to backend
- `getCurrentUser()` - Check if user is logged in
- `logout()` - Clear session

**Test Case:**

**Step 1: Get Google credential from frontend**
```typescript
// In React component
import { GoogleLogin, CredentialResponse } from '@react-oauth/google';
import { verifyGoogleToken } from '@/services/auth';

function LoginComponent() {
  const handleSuccess = async (credentialResponse: CredentialResponse) => {
    try {
      const result = await verifyGoogleToken(credentialResponse);
      console.log('Logged in:', result.user.email);
    } catch (err) {
      console.error('Login failed:', err);
    }
  };

  return (
    <GoogleLogin
      onSuccess={handleSuccess}
      onError={() => console.error('Login Failed')}
    />
  );
}
```

**Step 2: Backend verifies token**
```bash
curl -X POST 'http://localhost:3000/auth/google' \
  -H 'Content-Type: application/json' \
  -d '{
    "token": "eyJhbGciOiJSUzI1NiIs... <Google ID token>"
  }'
```

**Expected Result:**
```json
{
  "status": "ok",
  "user": {
    "id": "user_123",
    "email": "user@example.com",
    "name": "John Doe",
    "picture": "https://lh3.googleusercontent.com/..."
  }
}
```

**Step 3: Check authenticated session**
```bash
curl -X GET 'http://localhost:3000/auth/me' \
  -H 'Cookie: connect.sid=...'
```

**Expected Result:**
```json
{
  "user": {
    "id": "user_123",
    "email": "user@example.com",
    "name": "John Doe",
    "auth_provider": "google"
  }
}
```

---

## Confidence Scoring Examples

### High Confidence (6-7 factors match)
```
Message: "Debit alert: Rs.1250 debited from your HDFC Bank A/C XXXX1988 at ABC STORE on 07/03/26. Ref: REF123456"

Factors:
✓ Type: debit
✓ Amount: 1250
✓ Merchant: ABC STORE
✓ Bank: HDFC
✓ Account: 1988
✓ Reference: REF123456
✓ Date: 07/03/26

Confidence: HIGH → Auto-ingested
```

### Medium Confidence (3-5 factors match)
```
Message: "Amount of Rs.500 sent successfully to XYZ"

Factors:
✓ Type: sent (debit)
✓ Amount: 500
✓ Merchant: XYZ
✗ Bank: missing
✗ Reference: missing

Confidence: MEDIUM → Ingested but flagged for review
```

### Low Confidence (<3 factors match)
```
Message: "Rs. 100 paid"

Factors:
✓ Type: paid (debit)
✓ Amount: 100
✗ Merchant: missing
✗ Bank: missing

Confidence: LOW → Manual review required
```

---

## Rendering Logs Checklist

After deployment, check Render logs for these patterns:

```
✅ Good transaction:
[PARSER] Amount extracted: 1250
[PARSER] Merchant extracted: ABC STORE
[PARSER] Bank detected: HDFC
[PARSER] Confidence: high (7/7 factors)

❌ Non-transactional filtered:
[PARSER] Non-transactional message detected: data recharge pattern

❌ Duplicate prevented:
[INGEST] Duplicate transaction detected - dedup_hash match
```

---

## Quick Reference

| Issue | Fix Location | Test Command |
|-------|--------------|--------------|
| Aura 15 | `regex.merchant.clean()` + `isNonTransactional()` | See Test 1-3 above |
| Duplicate accounts | `extractBank()` normalization | See Test 1-2 above |
| Non-transactional | `isNonTransactional()` patterns | See Test 3-1 to 3-3 |
| Mandates | `isMandate()` detection | See Test 4-1 |
| Duplicates | Dedup hash SHA-256 | See Test 4-2 |
| Google Login | `auth.routes.js` + `auth.service.ts` | See Test 5-1 to 5-3 |

