import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { Dashboard, Accounts, Transactions, Budgets, Refunds, Categories, Analytics } from './pages';

function App() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/accounts" element={<Accounts />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/budgets" element={<Budgets />} />
        <Route path="/refunds" element={<Refunds />} />
        <Route path="/categories" element={<Categories />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppLayout>
  );
}

export default App;
