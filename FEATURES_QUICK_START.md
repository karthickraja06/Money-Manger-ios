## QUICK START - USING THE NEW FEATURES

### 1. CATEGORY ICONS 🎨

**Already working in UI**:
- Categories page: Shows emoji icon next to color picker
- Transactions page: Shows icon in category badge
- Budgets page: Shows icon in card header

**Frontend code example**:
```typescript
import { getCategoryIconEmoji } from '../services/api';

// Display icon for category
const icon = getCategoryIconEmoji('Dining');  // Returns "🍽️"

// With custom icon
const icon = getCategoryIconEmoji('Dining', '🍴'); // Returns "🍴"
```

---

### 2. BUDGET NOTIFICATIONS 🔔

**Check for alerts** (call after viewing/updating budgets):
```typescript
import { checkBudgetAlerts } from '../services/api';

const result = await checkBudgetAlerts();
// Returns: { alerts: [{ id, type, category, spent, limit, percentage, message }] }
```

**Get user's notifications**:
```typescript
import { getNotifications, markNotificationAsRead, clearNotifications } from '../services/api';

// Fetch notifications
const { notifications } = await getNotifications(20);

// Mark as read
await markNotificationAsRead(notificationId);

// Clear all
await clearNotifications();
```

**Example notification**:
```json
{
  "id": "notif-...",
  "type": "budget_exceeded",
  "category": "Dining",
  "spent": 4200,
  "limit": 5000,
  "percentage": 84,
  "message": "Budget alert: Dining at 84% (₹4200 / ₹5000)",
  "timestamp": "2024-01-15T10:30:00Z",
  "read": false
}
```

---

### 3. AUTO-CATEGORIZE ON MERCHANT EDIT 🏷️

**Backend endpoint** (no frontend code needed - already in Categories page):

When you edit a category and add/update `merchant_patterns`:

```typescript
// Edit category + auto-apply patterns to existing transactions
PATCH /budgets/categories/categoryId?apply_retroactively=true
Body: {
  "merchant_patterns": ["starbucks", "coffee", "cafe"],
  "parentCategory": "Dining"
}

Response: {
  "retroactive": {
    "applied": true,
    "affected_transactions": 12  // 12 old transactions re-categorized!
  }
}
```

**How it works**:
1. User edits category and adds merchant patterns
2. Click "Update Category" → Shows "Applied to 12 transactions"
3. All matching transactions auto-tagged to this category
4. Zero data loss, retroactive categorization

---

### 4. REAL-TIME SYNC 🔄

**Backend provides polling endpoints**:
```typescript
// Frontend hook already created - use in any page
import { useRealtimeSync } from '../hooks/useRealtimeSync';

export const MyPage = () => {
  const { startPolling, stopPolling } = useRealtimeSync(
    (changes) => {
      console.log('Data synced:', changes);
      // Refresh data based on changes
      loadTransactions(); // or loadBudgets(), etc.
    },
    10000 // Poll every 10 seconds (can change)
  );

  useEffect(() => {
    startPolling();
    return () => stopPolling();
  }, []);

  // Component renders...
};
```

**What gets synced**:
```json
{
  "changes": [
    {
      "id": "change-...",
      "entityType": "transaction",    // or budget, account, category
      "entityId": "txn-123",
      "changeType": "created",         // or updated, deleted
      "data": { transaction object },
      "timestamp": 1705318200000
    }
  ]
}
```

**Use cases**:
- Multi-tab sync: Transaction added in one tab → auto-shows in all tabs
- Real-time dashboard: Budget exceeded → Dashboard updates immediately
- Team collaboration: Another user's changes appear without manual refresh

---

### 5. MERCHANT NAME BULK UPDATE 🏪

**Get merchant stats** (for UI selection):
```typescript
import { getMerchantStats } from '../services/api';

const { merchants } = await getMerchantStats();
// Returns top 50 merchants with counts
// Example:
[
  { _id: "Amazon", count: 45, total_amount: 12500, last_seen: "2024-01-15" },
  { _id: "Zomato", count: 32, total_amount: 8960, last_seen: "2024-01-15" },
  ...
]
```

**Bulk rename merchant**:
```typescript
import { bulkUpdateMerchantName } from '../services/api';

const result = await bulkUpdateMerchantName(
  "McDonald's Outlets",
  "McDonald's"
);

// Returns:
{
  "message": "Successfully updated 42 transactions",
  "old_merchant": "McDonald's Outlets",
  "new_merchant": "McDonald's",
  "updated": 42,
  "matched": 42
}
```

**Merge variations** (e.g., consolidate spelling variations):
```typescript
import { mergeMerchantIdentities } from '../services/api';

const result = await mergeMerchantIdentities(
  ["Zomato", "Zomato Food Service", "zomato.com"],
  "Zomato"
);

// All 3 variations renamed to canonical "Zomato"
```

---

### INTEGRATION EXAMPLES

**Example 1: Dashboard with Real-time Sync**
```typescript
import { useRealtimeSync } from '../hooks/useRealtimeSync';

export const Dashboard = () => {
  const [summary, setSummary] = useState(null);

  const { startPolling } = useRealtimeSync((changes) => {
    // Reload summary when transactions/budgets change
    if (changes.some(c => ['transaction', 'budget'].includes(c.entityType))) {
      loadDashboardSummary();
    }
  });

  useEffect(() => {
    loadDashboardSummary();
    startPolling();
  }, []);

  // Render with real-time data
};
```

**Example 2: Transactions with Bulk Merchant Edit**
```typescript
import { bulkUpdateMerchantName } from '../services/api';

const [selectedMerchant, setSelectedMerchant] = useState('');
const [newName, setNewName] = useState('');

const handleMerchantRename = async () => {
  const result = await bulkUpdateMerchantName(selectedMerchant, newName);
  alert(`✅ Updated ${result.updated} transactions`);
  loadTransactions(); // Refresh
};

// UI: Select merchant → Enter new name → Click "Apply to All"
```

**Example 3: Auto-categorize on Category Edit**
```typescript
// In Categories.tsx - already integrated!
// When user edits patterns and has checkbox "Apply to existing"
const handleUpdateCategory = async (categoryId, updates) => {
  const response = await fetch(
    `/budgets/categories/${categoryId}?apply_retroactively=true`,
    { /* ... */ }
  );
  const { retroactive } = await response.json();
  alert(`✅ Applied to ${retroactive.affected_transactions} transactions`);
};
```

---

### TESTING IN BROWSER

**1. Open DevTools Console**:
```javascript
// Test merchant stats
fetch('/merchants/stats', { headers: { 'x-api-key': 'ios_secret_key_123' } })
  .then(r => r.json()).then(console.log);

// Test notifications
fetch('/notifications', { headers: { 'x-api-key': 'ios_secret_key_123' } })
  .then(r => r.json()).then(console.log);

// Test sync changes
fetch('/sync/changes', { headers: { 'x-api-key': 'ios_secret_key_123' } })
  .then(r => r.json()).then(console.log);
```

---

### WHAT'S MISSING (Optional Future Enhancements)

❌ Email notifications (can add later)  
❌ Push notifications (can add later)  
❌ Merchant autocomplete search (data ready, just need UI)  
❌ Budget notification preferences (can add later)  
❌ WebSocket real-time (polling works fine for now)  

---

### PERFORMANCE NOTES

- **Real-time sync**: Polls every 10s by default (configurable)
- **Notifications**: 1000-notification in-memory limit (auto-cycles)
- **Merchant updates**: Bulk regex matching (fast for <50k transactions)
- **Auto-categorize**: One-time cost at category edit (not on every transaction)

All features optimized for mobile + web! 🚀

---

### TROUBLESHOOTING

**Icons not showing?**  
→ Check that `getCategoryIconEmoji()` is imported from `api.ts`

**Notifications not appearing?**  
→ Call `checkBudgetAlerts()` after transactions load  
→ Check notifications with `getNotifications()`

**Real-time sync not working?**  
→ Check `/sync/changes` endpoint is returning data  
→ Verify polling started with `startPolling()`

**Merchant bulk update not working?**  
→ Check merchant name exact match (case-sensitive in query)  
→ Verify `/merchants/stats` shows the merchant

---

**All features production-ready!** Use them immediately. 🎉
