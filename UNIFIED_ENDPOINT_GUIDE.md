# Unified Endpoint Guide

## Architecture (One Endpoint: `/ingest/transaction`)

```
iOS Shortcut
   ↓ single message { user_id, raw_message, ... }
Backend /ingest/transaction ← SINGLE MODE (messages undefined)
   ↓

Cloudflare Worker
   ↓ batch { messages: [{ id, data: {...} }] }
Backend /ingest/transaction ← BATCH MODE (messages is Array)
   ↓ MongoDB
```

---

## How Single vs Batch Detection Works (3 Examples)

### Example 1: SINGLE MODE (iOS Shortcut)
```json
{
  "user_id": "john123",
  "raw_message": "HDFC: Rs.500 debited from X1234 on 01-Mar-26",
  "received_at": "2026-03-01T10:30:00Z",
  "source": "ios_shortcut"
}
```

**Detection:**
```javascript
const { messages, user_id, raw_message, ... } = req.body;
const isBatch = Array.isArray(messages); // false ✓ → SINGLE MODE
```

---

### Example 2: BATCH MODE (Cloudflare Worker)
```json
{
  "messages": [
    {
      "id": "hash_abc123",
      "data": {
        "user_id": "john123",
        "raw_message": "HDFC: Rs.500 debited from X1234 on 01-Mar-26",
        "received_at": "2026-03-01T10:30:00Z",
        "source": "cloudflare_worker",
        "ingested_at": 1704067200000
      }
    },
    {
      "id": "hash_def456",
      "data": {
        "user_id": "john123",
        "raw_message": "ICICI: Rs.200 credited on 01-Mar-26",
        "received_at": "2026-03-01T10:45:00Z",
        "source": "cloudflare_worker",
        "ingested_at": 1704067200000
      }
    }
  ]
}
```

**Detection:**
```javascript
const { messages, user_id, raw_message, ... } = req.body;
const isBatch = Array.isArray(messages); // true ✓ → BATCH MODE

if (isBatch) {
  // Loop through messages[0], messages[1], etc.
  for (const msg of messages) {
    const uid = msg.data.user_id;       // "john123"
    const rm = msg.data.raw_message;    // "HDFC: Rs.500 debited..."
    // Process each one
  }
}
```

---

### Example 3: EMPTY BATCH (Edge case)
```json
{
  "messages": []
}
```

**Detection:**
```javascript
const isBatch = Array.isArray(messages); // true ✓ → BATCH MODE

if (isBatch) {
  console.log(`Processing ${messages.length} messages`); // 0
  const results = [];
  for (const msg of messages) { } // Loop doesn't execute
  return { ok: true, results: [] }; // Return empty results
}
```

---

## Decision Logic in Code

```javascript
router.post("/transaction", async (req, res) => {
  const { messages, user_id, raw_message, received_at, source } = req.body;

  // ✅ ONE DECISION POINT
  const isBatch = Array.isArray(messages);
  
  console.log(`Mode: ${isBatch ? "BATCH" : "SINGLE"}`);

  if (isBatch) {
    // ========================
    // BATCH: messages = [...]
    // ========================
    console.log(`Processing ${messages.length} messages`);
    const results = [];

    for (const msg of messages) {
      // Extract from nested structure
      const { id, data } = msg;
      const { user_id: uid, raw_message: rm, received_at: ra, source: src } = data;
      
      // Process each message
      const result = await processSingleMessage(uid, rm, ra, src);
      results.push({ id, ...result });
    }

    return res.json({ ok: true, results });
  } else {
    // ========================
    // SINGLE: user_id, raw_message, ... at root
    // ========================
    console.log(`Processing single message for user: ${user_id}`);
    
    if (!user_id || !raw_message) {
      return res.status(400).json({ error: "Missing fields" });
    }

    // Process directly (same function as batch uses)
    const result = await processSingleMessage(user_id, raw_message, received_at, source);
    
    return res.status(201).json({
      status: result.status,
      transaction_id: result.transaction_id,
      // ... etc
    });
  }
});
```

---

## Why This Design?

| Aspect | Single | Batch | Unified |
|--------|--------|-------|---------|
| **Source** | iOS Shortcut | Cloudflare Worker | Both ✓ |
| **Payload** | Direct fields | Nested in `messages[].data` | Auto-detected ✓ |
| **Processing** | One message at a time | Multiple messages | Reuses same logic ✓ |
| **DB Save** | One `transaction.save()` | N `transaction.save()` calls | Same function ✓ |
| **Scalability** | Limited | Handles batches | Both ✓ |

---

## Testing

### Test SINGLE MODE:
```powershell
$body = @{
  user_id = "john123"
  raw_message = "HDFC: Rs.500 debited from X1234 on 01-Mar-26"
  received_at = "2026-03-01T10:30:00Z"
  source = "ios_shortcut"
} | ConvertTo-Json

Invoke-WebRequest -Uri "https://money-manger-ios.onrender.com/ingest/transaction" `
  -Method POST `
  -Headers @{"Content-Type"="application/json"; "x-api-key"="API_KEY"} `
  -Body $body
```

Backend logs:
```
📦 [INGEST] Mode: SINGLE
📌 [INGEST] user_id: john123, message: HDFC: ...
✅ [INGEST] Complete: <tx_id>
```

---

### Test BATCH MODE:
```powershell
$body = @{
  messages = @(
    @{
      id = "hash1"
      data = @{
        user_id = "john123"
        raw_message = "HDFC: Rs.500 debited"
        received_at = "2026-03-01T10:30:00Z"
        source = "cloudflare_worker"
      }
    }
  )
} | ConvertTo-Json -Depth 10

Invoke-WebRequest -Uri "https://money-manger-ios.onrender.com/ingest/transaction" `
  -Method POST `
  -Headers @{"Content-Type"="application/json"; "x-api-key"="RENDER_API_KEY"} `
  -Body $body
```

Backend logs:
```
📦 [INGEST] Mode: BATCH
📦 [INGEST] Processing 1 messages
✅ [INGEST] Batch complete. Results: [...]
```

---

## Diagnostic Endpoint: `/ingest/test`

Test parsing without authentication:

```powershell
$body = @{
  raw_message = "HDFC: Rs.500 debited from X1234 on 01-Mar-26 at 10:30 AM. Bal: Rs.5000"
} | ConvertTo-Json

Invoke-WebRequest -Uri "https://money-manger-ios.onrender.com/ingest/test" `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body $body
```

Response shows:
- ✅ Parsing result
- ✅ MongoDB connection status
- ✅ Account creation capability

Use this to debug if data isn't reaching the DB.

---

## Why Data Might Not Be Saving

1. **Parsing fails** → Check regex.js, raw_message format
2. **DB connection fails** → Check MONGO_URI env var
3. **Duplicate detected** → Same message sent twice
4. **API key mismatch** → Check `API_KEY` or `RENDER_API_KEY` env vars
5. **Account creation fails** → Check Account model schema

Use `/ingest/test` endpoint to isolate which step fails.
