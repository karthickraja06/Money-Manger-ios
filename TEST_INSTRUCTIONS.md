# Complete Testing Guide

## Architecture (Unified)

Now with one endpoint: **`POST /ingest/transaction`**

```
iOS Shortcut
   ↓ single message
Backend /ingest/transaction ← SINGLE MODE
   ↓

Cloudflare Worker
   ↓ batch
Backend /ingest/transaction ← BATCH MODE
   ↓ MongoDB
```

---

## Backend URL Configuration

**Worker should point to:**
```
https://money-manger-ios.onrender.com/ingest/transaction
```

Set in Cloudflare dashboard → Worker Secrets:
```
RENDER_URL = https://money-manger-ios.onrender.com/ingest/transaction
RENDER_API_KEY = <your-secret>
```

---

## Test 1: Single Message (iOS Shortcut Mode)

PowerShell:
```powershell
$body = @{
  user_id = "test-user"
  raw_message = "Your A/C X1234 debited by Rs.500 on 01-Mar-26 at 10:30 AM. Bal: Rs.5000"
  received_at = "2026-03-04T10:30:00Z"
  source = "test"
} | ConvertTo-Json

Invoke-WebRequest -Uri "https://money-manger-ios.onrender.com/ingest/transaction" `
  -Method POST `
  -Headers @{"Content-Type"="application/json"; "x-api-key"="YOUR_API_KEY"} `
  -Body $body | Select-Object -ExpandProperty Content
```

Expected response:
```json
{
  "status": "ingested",
  "transaction_id": "...",
  "account_id": "...",
  "dedup_hash": "..."
}
```

Check backend logs → should see `[INGEST] Mode: SINGLE`

---

## Test 2: Batch Messages (Cloudflare Worker Mode)

PowerShell:
```powershell
$body = @{
  messages = @(
    @{
      id = "hash_1"
      data = @{
        user_id = "test-user-2"
        raw_message = "HDFC: Your account X1234 debited Rs.1000 on 01-Mar-26 at 2:15 PM. Balance: Rs.8000"
        received_at = "2026-03-04T14:15:00Z"
        source = "cloudflare_worker"
        ingested_at = 1704067200000
      }
    },
    @{
      id = "hash_2"
      data = @{
        user_id = "test-user-2"
        raw_message = "ICICI: Amount Rs.500 credited to your account X5678 on 01-Mar-26. Balance: Rs.8500"
        received_at = "2026-03-04T14:20:00Z"
        source = "cloudflare_worker"
        ingested_at = 1704067200000
      }
    }
  )
} | ConvertTo-Json -Depth 10

Invoke-WebRequest -Uri "https://money-manger-ios.onrender.com/ingest/transaction" `
  -Method POST `
  -Headers @{"Content-Type"="application/json"; "x-api-key"="YOUR_RENDER_API_KEY"} `
  -Body $body | Select-Object -ExpandProperty Content
```

Expected response:
```json
{
  "ok": true,
  "results": [
    { "id": "hash_1", "status": "ingested", "transaction_id": "...", "dedup_hash": "..." },
    { "id": "hash_2", "status": "ingested", "transaction_id": "...", "dedup_hash": "..." }
  ]
}
```

Check backend logs → should see `[INGEST] Mode: BATCH`

---

## Test 2b: Ingest Single Message into Worker KV

Test the Cloudflare Worker's ingest (stores in KV):

```powershell
$body = @{
  user_id = "test-worker-user"
  raw_message = "HDFC: Your account X1234 debited Rs.1000 on 01-Mar-26 at 2:15 PM. Balance: Rs.8000"
  received_at = "2026-03-04T14:15:00Z"
  source = "ios_shortcut"
} | ConvertTo-Json

Invoke-WebRequest -Uri "https://sms-ingest.karthickrajab02.workers.dev/" `
  -Method POST `
  -ContentType "application/json" `
  -Body $body | Select-Object -ExpandProperty Content
```

Expected response:
```json
{ "ok": true }
```

This stores the message in KV. Check Cloudflare dashboard → KV → SMS_KV namespace to verify.

---

## Test 2c: Manual Flush (Worker → Backend)

Trigger the flush manually to send batched KV messages to backend:

```powershell
Invoke-WebRequest -Uri "https://sms-ingest.karthickrajab02.workers.dev/flush" `
  -Method GET | Select-Object -ExpandProperty Content | ConvertFrom-Json | ConvertTo-Json
```

Expected response:
```json
{
  "ok": true,
  "pushed": 1
}
```

This should:
1. Read all messages from KV
2. Send batch POST to backend `/ingest/transaction`
3. Delete messages from KV on success

Check backend logs to confirm batch was received and processed.

---

## Test 3: Verify MongoDB

MongoDB shell:
```javascript
db.transactions.find({ user_id: "test-user" }).pretty()
db.transactions.find({ user_id: "test-user-2" }).pretty()
```

Should show all ingested documents.

---

## Test 4: Manual Flush Trigger

PowerShell (to trigger cron manually):
```powershell
Invoke-WebRequest -Uri "https://sms-ingest.karthickrajab02.workers.dev/flush" `
  -Method GET | Select-Object -ExpandProperty Content
```

Expected logs:
- Worker: `📤 Sending X messages to: ...`
- Backend: `📥 [INGEST] Received POST request` + `Mode: BATCH`

---

## Check Render Backend Logs

```
Render Dashboard → Backend Service → Logs
```

Should see:
```
📥 [INGEST] Received POST request
🔐 [INGEST] API key check: provided
✓ [INGEST] API key validated
📦 [INGEST] Mode: BATCH
📦 [INGEST] Processing 2 messages
📌 [INGEST] Message: hash_1
  user_id: test-user-2, raw_message: HDFC: ...
  ✓ Parsed: debit 1000 from HDFC
  🔐 Dedup hash: abc123def456...
  🏦 Getting/creating account for HDFC...
  ✓ Account: 507f1f77bcf86cd799439011
  💾 Saving transaction...
  ✅ Transaction saved: 507f1f77bcf86cd799439012
✅ [INGEST] Batch complete. Results: [...]
```

---

## Cleanup

Delete sms.routes.js (no longer needed):
```bash
rm backend/src/routes/sms.routes.js
```

Deploy:
```bash
cd backend && npm start
cd sms-ingest && wrangler deploy
```
