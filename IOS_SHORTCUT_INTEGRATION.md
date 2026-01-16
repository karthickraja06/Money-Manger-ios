# 📱 iOS SHORTCUT INTEGRATION GUIDE

## Overview

Your iOS Shortcut will:
1. Trigger when SMS arrives
2. Extract message text
3. Send to backend via HTTPS
4. Receive confirmation

**No background processing needed** - Event-driven only ✅

---

## Shortcut Logic Flow

```
SMS Received
    ↓
Contains "Rs", "₹", "INR"?
    ├─ YES → Extract raw text
    └─ NO → Ignore
    ↓
Build JSON payload
    ↓
POST to backend webhook
    ↓
Receive response
    ↓
Log result (optional notification)
```

---

## Shortcut Configuration

### Step 1: Get Webhook URL

Your backend URL:
```
https://your-backend.render.com/ingest/transaction
```

Or locally:
```
http://localhost:3000/ingest/transaction
```

### Step 2: Build Shortcut (iOS/Shortcuts app)

**Trigger:** When Message is Received

**Condition:** Message contains any of:
- Rs
- ₹
- INR

**Actions:**

1. **Get message details**
   - Body (full SMS text)
   - Received Date/Time

2. **Build JSON payload**
   ```
   Dictionary:
   - user_id: "my_iphone"
   - raw_message: [Message body]
   - received_at: [Timestamp]
   - source: "ios_shortcut"
   ```

3. **Send HTTPS POST**
   ```
   URL: https://your-backend.render.com/ingest/transaction
   Method: POST
   Headers:
   - Content-Type: application/json
   - x-api-key: {YOUR_API_KEY}
   Body: [JSON from step 2]
   ```

4. **Handle response** (optional)
   ```
   If response status = 201 or 200:
     Show notification: "✅ Transaction recorded"
   Else:
     Show notification: "❌ Failed to record"
   ```

---

## Shortcut (Pseudocode)

```
Automation:
  Trigger: "Receive Message"
  Filter: Body contains "Rs" OR body contains "₹" OR body contains "INR"

Actions:
  1. Get Body of Message → smsText
  2. Get Received Date of Message → receivedTime
  3. Format receivedTime as ISO 8601
  4. Create Dictionary:
     - "user_id": "my_iphone"
     - "raw_message": smsText
     - "received_at": receivedTime
     - "source": "ios_shortcut"
  5. Send HTTP POST:
     - URL: "https://your-backend.render.com/ingest/transaction"
     - Method: POST
     - Headers:
       - "Content-Type": "application/json"
       - "x-api-key": "{YOUR_API_KEY}"
     - Body: Dictionary (JSON encoded)
  6. Get response
  7. (Optional) Show notification: "Txn recorded" or error
```

---

## Example Payloads Shortcut Will Send

### Example 1: Debit Transaction
```json
{
  "user_id": "my_iphone",
  "raw_message": "Rs. 500 debited from HDFC Bank to Amazon.in on 11 Jan at 1:44 AM. Available balance Rs. 10,450",
  "received_at": "2026-01-11T01:45:10.000Z",
  "source": "ios_shortcut"
}
```

### Example 2: Credit Transaction
```json
{
  "user_id": "my_iphone",
  "raw_message": "Rs. 5000 credited to your ICICI Account from Salary",
  "received_at": "2026-01-12T09:30:00.000Z",
  "source": "ios_shortcut"
}
```

### Example 3: ATM Withdrawal
```json
{
  "user_id": "my_iphone",
  "raw_message": "₹2000 withdrawn from ATM at XYZ Branch",
  "received_at": "2026-01-13T14:22:30.000Z",
  "source": "ios_shortcut"
}
```

---

## Backend Response Examples

### Success (201)
```json
{
  "status": "ingested",
  "transaction_id": "507f1f77bcf86cd799439011",
  "account_id": "507f1f77bcf86cd799439012",
  "dedup_hash": "abc123..."
}
```

### Duplicate (200)
```json
{
  "status": "duplicate",
  "reason": "dedup_hash_matched",
  "message": "Transaction already ingested"
}
```

### Ignored (200)
```json
{
  "status": "ignored",
  "reason": "non-transaction_message",
  "message": "SMS does not contain transaction data"
}
```

### Error (4xx/5xx)
```json
{
  "error": "Unauthorized",
  "code": "INVALID_API_KEY"
}
```

---

## Testing Your Shortcut

### Test 1: Valid Transaction
1. Open iPhone Messages
2. Send yourself SMS:
   ```
   Rs. 500 debited from HDFC Bank to Amazon.in on 11 Jan at 1:44 AM. Available balance Rs. 10,450
   ```
3. Shortcut triggers automatically
4. Check notification: "✅ Transaction recorded"
5. Verify in MongoDB

### Test 2: Duplicate SMS
1. Forward the same SMS to yourself again
2. Shortcut triggers
3. Backend returns `status: "duplicate"`
4. Notification: "Already recorded"

### Test 3: Non-Transaction
1. Send SMS:
   ```
   Check out our bank's new app features!
   ```
2. Shortcut might trigger
3. Backend returns `status: "ignored"`
4. No transaction created

---

## Best Practices

### ✅ DO:
- Keep user_id consistent (e.g., device identifier)
- Send exact SMS text (parsing happens on backend)
- Include `received_at` timestamp
- Add notification feedback (UX improvement)
- Test with test SMS first (many banks allow this)

### ❌ DON'T:
- Parse SMS on iOS (let backend handle it)
- Send modified/cleaned text (send raw)
- Filter transactions (let backend decide)
- Retry on failure (could duplicate)
- Store password/API key in shortcut source (use secure storage)

---

## Troubleshooting

### Shortcut doesn't trigger
- Check automation is enabled
- Verify filter condition (contains "Rs", etc.)
- Ensure SMS is from bank (not contact)
- Check device has internet

### Request times out
- Backend might be sleeping (Render free tier)
- Check webhook URL is correct
- Test URL in browser first
- Check network connectivity

### "Unauthorized" error
- Verify x-api-key header value
- Ensure API_KEY matches in backend .env
- Check header name is exactly `x-api-key`

### Transaction not appearing in app
- Check backend response status
- If `status: "duplicate"` - transaction already exists
- Check MongoDB for data
- Verify user_id matches

### Performance (slow)
- First request might be slow (Render wake-up)
- Subsequent requests should be < 1s
- Add timeout handling in shortcut (10s)

---

## Advanced: Retry Logic

**Phase 2 Enhancement:** Add client-side retry

```
On POST failure:
  Save to Notes app / Files
  Retry every hour
  Show notification when synced

Prevents data loss if network drops
```

---

## Security Notes

### Threat: API Key Exposure
- **Current:** API key visible in Shortcut source
- **Phase 5 Solution:** Switch to JWT + refresh tokens
- **Interim:** Use environment-specific keys

### Threat: Replay Attack
- **Current:** Dedup prevents duplicate ingestion
- **Future:** Add request signature (HMAC-SHA256)

### Threat: Man-in-the-middle
- **Current:** HTTPS only
- **Future:** Certificate pinning for iOS app

---

## Example: Complete Shortcut URL

```
POST https://your-backend.render.com/ingest/transaction
Headers:
  Content-Type: application/json
  x-api-key: abc123def456ghi789

Body:
{
  "user_id": "my_iphone",
  "raw_message": "Rs. 500 debited from HDFC Bank to Amazon.in on 11 Jan at 1:44 AM. Available balance Rs. 10,450",
  "received_at": "2026-01-11T01:45:10.000Z",
  "source": "ios_shortcut"
}
```

---

## Deployment Steps

1. **Configure backend**
   ```bash
   # Set these in .env or Render environment
   API_KEY=your_secure_api_key
   MONGO_URI=your_mongodb_connection
   ```

2. **Deploy to Render**
   ```bash
   git push origin main
   # Render auto-deploys
   ```

3. **Get webhook URL**
   ```
   https://your-app-name.onrender.com/ingest/transaction
   ```

4. **Update iOS Shortcut**
   - Open Shortcut editor
   - Find "Send HTTP POST" action
   - Update URL to production webhook

5. **Test end-to-end**
   - Send test SMS to phone
   - Check notification
   - Verify in dashboard

---

## Monitoring

### Check Webhook Status
```bash
curl https://your-backend.render.com/ingest/health
# Should return: { "status": "ok" }
```

### View Recent Transactions
```bash
# In MongoDB
db.transactions.find().sort({ created_at: -1 }).limit(10)
```

### Check for Errors
```bash
# In backend logs (Render dashboard)
docker logs <container_id> | grep "❌"
```

---

## Migration (if backend URL changes)

1. Note new webhook URL
2. Update iOS Shortcut
3. No data loss (all in MongoDB)
4. Continue sending transactions

---

## Example Shortcut Script (iOS 16+)

```
Ask for [user_id] with default value "my_iphone"
Ask for [api_key] with password input (sensitive)
Ask for [webhook_url]

Automation Trigger: Receive Message
Filter: Body contains "Rs"

Actions:
  Get Body → smsText
  Get Received Date → timestamp
  Format timestamp as ISO 8601
  
  POST request:
    URL: webhook_url
    Method: POST
    Headers:
      Content-Type: application/json
      x-api-key: api_key
    Body: {
      "user_id": user_id,
      "raw_message": smsText,
      "received_at": timestamp,
      "source": "ios_shortcut"
    }
  
  If response contains "ingested":
    Show notification "✅ Recorded"
  Else if response contains "duplicate":
    Show notification "📋 Already recorded"
  Else:
    Show notification "❌ Error"
```

---

## Frequently Asked Questions

**Q: Will this drain my battery?**  
A: No. Shortcut runs only when SMS arrives (< 1 second). Request is fired and forgotten.

**Q: Does it work offline?**  
A: No. But in Phase 2, we'll add local queue (via Notes app) that syncs when online.

**Q: What if my phone is asleep?**  
A: iOS wakes it up automatically for incoming SMS. Shortcut triggers regardless.

**Q: Can other people see my transactions?**  
A: No. Each user_id is isolated. Change user_id in shortcut if sharing device.

**Q: How often does it trigger?**  
A: Only when SMS arrives (bank sends notifications instantly).

---

**Generated:** Jan 14, 2026  
**Status:** Ready for production deployment
