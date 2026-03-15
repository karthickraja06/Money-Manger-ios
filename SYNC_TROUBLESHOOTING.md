# Sync System Troubleshooting & Debugging Guide

## Quick Status Check

### Check Backend Health
```bash
curl https://your-api-url/health
```

Expected response:
```json
{
  "status": "ok",
  "sync_service": {
    "isRunning": true,
    "queueStatus": {
      "queueSize": 0,
      "isProcessing": false,
      "pendingUsers": [],
      "queueDetails": []
    }
  }
}
```

### Check Sync Queue Status
```bash
curl -H "x-api-key: ios_secret_key_123" https://your-api-url/sync/status
```

Expected response:
```json
{
  "status": "ok",
  "queueSize": 2,
  "isProcessing": true,
  "pendingUsers": ["user123", "user456"],
  "queueDetails": [
    {
      "userId": "user123",
      "queuedAt": 1234567890,
      "attempts": 0
    }
  ]
}
```

---

## Common Issues & Solutions

### Issue 1: Queue Growing Indefinitely

**Symptoms:**
- Queue never empties
- `queueSize` keeps increasing
- Sync status shows `isProcessing: false` but queue full

**Causes:**
- Backend crashed and restarted
- Database connection issues
- Queue persisted from before

**Solution:**
```bash
# Clear the queue (emergency)
curl -X POST -H "x-api-key: ios_secret_key_123" \
  https://your-api-url/sync/clear-queue
```

**Prevention:**
- Monitor database connections
- Check server logs for errors
- Set up alerting for queue > 50 items

### Issue 2: Sync Never Completes

**Symptoms:**
- `isProcessing: true` but never changes
- Same user in queue for hours
- Transactions not updated

**Causes:**
- Hanging database query
- Connection timeout
- Account with millions of transactions

**Solution:**
```bash
# 1. Check server logs
tail -f logs/app.log | grep SYNC-SERVICE

# 2. Check if database is responsive
# In MongoDB shell:
db.transactions.count()  # Should return quickly

# 3. If stuck, restart backend service
# This will drop queue but may be necessary
```

### Issue 3: Sync Running but Balances Not Updating

**Symptoms:**
- Queue processing correctly
- Sync completes successfully
- But balances in dashboard don't change

**Causes:**
- Frontend not refreshing after sync
- Transaction data corrupted
- Calculation logic bug

**Solution:**
```tsx
// In frontend - manually refresh dashboard
// Dashboard.tsx - add this to verify:

const handleManualRefresh = async () => {
  await loadAccounts();
  await loadTransactions();
  alert('Data refreshed');
};
```

Then:
1. Trigger sync (backend queues it)
2. Wait 5-10 seconds
3. Click refresh in dashboard
4. Check if balances updated

### Issue 4: High API Response Times During Sync

**Symptoms:**
- API calls slow during sync
- Dashboard takes 30+ seconds to load
- Other endpoints blocked

**Expected Behavior:**
- Sync should NOT block other requests
- Dashboard should load in < 2 seconds always

**If Not Meeting Expectations:**
- Check if sync service is truly non-blocking
- Verify `queueProcessing` runs in background
- Monitor server CPU/memory during sync

```bash
# Monitor server resources
top -p $(pgrep -f "node src/server.js")
```

### Issue 5: Queue at Max Capacity (100 items)

**Symptoms:**
- Sync requests returning "queue full"
- `queueSize: 100` and won't decrease
- New users can't queue

**Solution:**
1. **Wait** - if processing, it will eventually drain
2. **Check** - is `isProcessing: true`?
3. **Clear** - if stuck for > 1 hour:
```bash
curl -X POST -H "x-api-key: ios_secret_key_123" \
  https://your-api-url/sync/clear-queue
```

**Monitor:**
```bash
# Set up a cron job to monitor
# Run every 5 minutes
0/5 * * * * curl -s https://your-api-url/health | grep queueSize
```

---

## Backend Logs to Check

### When Investigating Issues

**1. Transaction Ingestion:**
```
[INGEST] Processing message
[INGEST] Parsed: debit 500 from Starbucks
[INGEST] Queuing background sync for user: user123
```

**2. Sync Processing:**
```
[SYNC-SERVICE] User user123 queued for sync
[SYNC-SERVICE] Processing sync for user: user123
[SYNC-SERVICE] account_name - 5000 → 4500
[SYNC-SERVICE] Sync completed for user user123
```

**3. Errors:**
```
[SYNC-SERVICE] Failed to sync user user456 after 3 attempts: Connection timeout
[SYNC-SERVICE] Queue cleared (45 items removed)
```

### Key Metrics to Monitor

```javascript
// Add to logs/metrics collection
{
  timestamp: "2024-01-15T10:30:00Z",
  event: "sync_complete",
  userId: "user123",
  duration_ms: 250,
  accounts_updated: 3,
  transactions_processed: 45,
  status: "success"
}
```

---

## Performance Baseline

### Expected Metrics

| Metric | Value | Status |
|--------|-------|--------|
| Queue processing time | 100-500ms per user | ✅ Normal |
| Max queue size | 100 users | ✅ Design limit |
| Sync retry delay | 5 seconds | ✅ Configurable |
| Min sync interval | 60 seconds per user | ✅ Prevents hammering |
| API response (no sync) | < 100ms | ✅ Normal |
| API response (queuing) | < 50ms | ✅ Non-blocking |
| Max attempts per user | 3 tries | ✅ Then drop |

---

## Testing Scenarios

### Scenario 1: Single User Sync
```
1. User logs in
2. Check: triggerBackgroundSync() called?
3. Check: User queued in backend?
4. Wait: 5-10 seconds for processing
5. Verify: Balances updated?
```

### Scenario 2: Batch Ingest (Multiple Users)
```
1. Send 10 SMS messages in batch
2. Check: All 10 users queued?
3. Wait: Processing 1-2 seconds per user = ~20 seconds total
4. Verify: All balances updated?
5. Check: No queue residue?
```

### Scenario 3: Concurrent API Traffic During Sync
```
1. Trigger: Background sync for user1
2. Meanwhile: User2 fetches accounts (should be instant)
3. Meanwhile: User3 creates transaction (should queue immediately)
4. Verify: All requests complete independently
5. Check: No timeouts or hangs
```

### Scenario 4: Queue at Capacity
```
1. Queue: 99 users already
2. Send: 100th user sync request
3. Verify: Accepted and queued
4. Send: 101st user sync request
5. Check: Rejected with "queue full" OR oldest dropped
6. Monitor: Queue processing to completion
```

---

## Emergency Procedures

### If Sync Service Unresponsive

**Step 1:** Check health endpoint
```bash
curl https://your-api-url/health
```

**Step 2:** If down, restart backend
```bash
# Stop process
pm2 stop all

# Check logs for errors
pm2 logs

# Restart
pm2 start src/server.js
```

**Step 3:** If queue corrupted, clear it
```bash
curl -X POST -H "x-api-key: ios_secret_key_123" \
  https://your-api-url/sync/clear-queue
```

**Step 4:** Notify users to refresh app
```
"Sync service restarted. Please refresh your app."
```

### Escalation Path

1. **User Reports Issue** → Check `/health` endpoint
2. **Check Queue Status** → GET `/sync/status`
3. **If Hung** → Review backend logs (last 100 lines)
4. **If Degraded** → Clear queue and restart
5. **If Critical** → Disable sync temporarily, revert to manual sync

```javascript
// Disable background sync temporarily (in app.js)
// Comment out:
// app.use(syncService.processQueue);
// Instead use manual endpoint only
```

---

## Monitoring Dashboard Template

```plaintext
=== SYNC SERVICE HEALTH ===
Status: ✅ RUNNING
Queue Size: 0 / 100
Is Processing: false
Pending Users: []
Last Activity: 30 seconds ago

API Health:
- Accounts: ✅ 50ms
- Transactions: ✅ 120ms
- Sync Endpoint: ✅ 35ms

Recent Events:
[10:45] Sync completed for user: user123 (5 accounts)
[10:40] User queued: user456
[10:35] Transaction ingested (Apple, ₹2000)

Alerts:
⚠️  None

Next Action: Monitor for 5 minutes
```

---

## Debug Mode

Enable detailed logging:

```javascript
// In sync.service.js - add debug flag
const DEBUG = process.env.DEBUG_SYNC === 'true';

if (DEBUG) {
  console.log('[SYNC-SERVICE] [DEBUG] Queue details:', syncQueue);
  console.log('[SYNC-SERVICE] [DEBUG] Processing state:', this.isProcessing);
}
```

Run with debug:
```bash
DEBUG_SYNC=true npm start
```

---

## Common Questions

**Q: Is sync blocking user requests?**
A: No. Check `isProcessing` flag - should be independent.

**Q: How long does sync take?**
A: 100-500ms per user. With 100 users: ~10-50 seconds total.

**Q: What if server restarts?**
A: Queue is in-memory only. Will be lost. (Future: add Redis persistence)

**Q: Can I disable sync?**
A: Yes - set `ENABLE_SYNC=false` environment variable (not yet implemented).

**Q: Should users see sync status?**
A: Optional. Could add status bar: "Syncing in background..."

---

## Next Steps

1. **Deploy** and monitor for 24 hours
2. **Set up alerts** for queue > 50 items
3. **Log metrics** to analytics dashboard
4. **Add Redis** for persistent queue (Phase 2)
5. **Implement WebSocket** for real-time updates (Phase 3)
