# Money Manager Frontend

Personal finance management application with budget tracking, transaction management, and refund linking.

## 🚀 Features

### Phase 1-2 (Complete)
- ✅ Dashboard with balance overview
- ✅ Account management
- ✅ Transaction listing & filtering
- ✅ Real-time balance tracking

### Phase 3 (Complete)
- ✅ Budget creation & tracking
- ✅ Budget alerts (exceeding, near limit)
- ✅ Refund linking to transactions
- ✅ Net spend calculation (after refunds)
- ✅ Custom categories with auto-categorization
- ✅ Category-based filtering & organization

## 📱 Pages

| Page | Route | Features |
|------|-------|----------|
| Dashboard | `/` | Balance overview, budget alerts, recent transactions |
| Accounts | `/accounts` | Account list, balances, transaction counts |
| Transactions | `/transactions` | Transaction list, category filtering, refund indicators |
| Budgets | `/budgets` | Budget management, spending limits, alerts |
| Refunds | `/refunds` | Link/unlink refunds, net spend calculation |
| Categories | `/categories` | Create custom categories, keywords, patterns |

## 🛠️ Setup

### Prerequisites
- Node.js 16+
- npm or yarn
- Backend running on http://localhost:3000

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## 🔌 API Integration

The frontend connects to the backend API:

```
http://localhost:3000/budgets      - Budget operations
http://localhost:3000/categories   - Category operations
http://localhost:3000/transactions - Transaction operations (refunds)
```

### Mock API
For development, the `services/api.ts` includes mock data that simulates backend responses with realistic delays.

## 📊 Components

### Pages
- **Dashboard** - Overview with alerts and recent activity
- **Accounts** - Manage bank accounts
- **Transactions** - View and categorize transactions
- **Budgets** - Create and track spending limits
- **Refunds** - Link refunds to original transactions
- **Categories** - Manage transaction categories

### Layout Components
- **AppLayout** - Main layout wrapper
- **TopBar** - Header with title
- **Sidebar** - Desktop navigation
- **BottomNav** - Mobile bottom navigation

## 🎨 Styling

Uses Tailwind CSS with responsive design:
- Mobile-first approach
- Dark mode ready
- Accessibility features

## 📦 Key Dependencies

```json
{
  "react": "^18.x",
  "react-router-dom": "^6.x",
  "lucide-react": "^latest",
  "tailwindcss": "^3.x",
  "zustand": "^4.x"
}
```

## 🔄 State Management

Uses Zustand for simple state management:
- Accounts
- Transactions
- Budgets
- Categories
- Selected month

## 🧪 Testing API Endpoints

### Budget Endpoints
```bash
# Get all budgets
curl http://localhost:3000/budgets \
  -H "x-api-key: YOUR_API_KEY"

# Create budget
curl -X POST http://localhost:3000/budgets \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"category":"Dining","monthlyLimit":5000}'

# Get budget alerts
curl http://localhost:3000/budgets/alerts \
  -H "x-api-key: YOUR_API_KEY"
```

### Refund Endpoints
```bash
# Get refund pairs
curl http://localhost:3000/transactions/refunds/pairs \
  -H "x-api-key: YOUR_API_KEY"

# Link refund
curl -X POST http://localhost:3000/transactions/ORIGINAL_ID/link-refund \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"refund_tx_id":"REFUND_ID"}'

# Get net spend
curl http://localhost:3000/transactions/refunds/net-spend \
  -H "x-api-key: YOUR_API_KEY" \
  -d 'start_date=2026-01-01&end_date=2026-01-31'
```

## 🎯 Phase 3 Integration Details

### Frontend → Backend Data Flow

**Budgets:**
1. User creates budget in Budget page
2. Frontend sends POST /budgets
3. Backend stores budget, returns status
4. Frontend displays percentage, alerts, remaining

**Refunds:**
1. User selects original & refund transaction
2. Frontend sends POST /transactions/:id/link-refund
3. Backend creates bidirectional link
4. Frontend updates refund pair list
5. Net spend recalculated automatically

**Categories:**
1. User creates category with keywords
2. Frontend sends POST /budgets/categories
3. New transactions auto-categorized
4. Frontend shows category tags on transactions

### Component Updates

**Transactions Page:**
- Added category filter chips
- Shows category tags below each transaction
- Shows refund link indicators

**Dashboard:**
- Added budget alerts at top
- Shows budget categories needing attention
- Color-coded alerts (yellow for near limit, red for exceeded)

**Transaction Cards:**
- Category badges
- Refund link status
- Tags display (when available)

## 🚀 Deployment

### Development
```bash
npm run dev  # Runs on http://localhost:5173
```

### Production
```bash
npm run build
npm run preview
```

Then deploy the `dist/` directory to your hosting platform.

## 📝 Environment Variables

Create `.env.local`:
```
VITE_API_URL=http://localhost:3000
VITE_API_KEY=your_api_key_here
```

## 🔗 Related Documents

- [Backend Implementation Phases](../BACKEND_IMPLEMENTATION_PHASES.md)
- [Phase 1-2 Integration Guide](../PHASE_1_2_INTEGRATION_GUIDE.md)
- [Refund Service Docs](../backend/src/services/refund.service.js)
- [Budget Service Docs](../backend/src/services/budget.service.js)

## 📚 Type Definitions

See `src/types/index.ts` for all interface definitions:
- `Budget` - Budget status with spent/remaining
- `Category` - Custom category with keywords
- `RefundPair` - Linked refund to original transaction
- `NetSpend` - Aggregate net spending data
- `BudgetAlert` - Alert status for budgets

## 🐛 Troubleshooting

### Budgets not showing
- Ensure backend is running
- Check API key in headers
- Verify CORS enabled

### Categories not auto-applying
- Ensure transaction.category field is set
- Check keyword matches in category setup
- Use merchant name that matches patterns

### Refund linking fails
- Verify original is debit, refund is credit
- Check amounts match exactly
- Ensure transactions are from same user

---

**Version:** 1.0 (Phase 3 Complete)  
**Last Updated:** Jan 14, 2026

