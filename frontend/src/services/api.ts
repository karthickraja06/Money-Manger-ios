import { Account, Transaction, Budget, Category, RefundPair, BudgetAlert, NetSpend } from '../types';

const API_BASE = ((import.meta as any)?.env?.VITE_API_BASE as string) || 'http://localhost:3000';

function maskAccountNumber(raw: string | null | undefined) {
  if (!raw) return '';
  const digits = raw.replace(/[^0-9]/g, '');
  if (digits.length <= 4) return `****${digits}`;
  return `****${digits.slice(-4)}`;
}

export const getAccounts = async (): Promise<Account[]> => {
  const res = await fetch(`${API_BASE}/accounts`, { credentials: 'include' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error('[API] getAccounts failed', { status: res.status, statusText: res.statusText, body: text });
    throw new Error('Failed to fetch accounts: ' + text);
  }
  const body = await res.json();
  // API returns { status, total, accounts: [...] }
  return (body.accounts || []).map((a: any) => ({
    id: String(a.id || a._id),
    bankName: a.bank_name || a.bankName || 'Unknown',
    accountNumber: maskAccountNumber(a.account_number || a.accountNumber || ''),
    balance: Number(a.current_balance ?? a.balance ?? 0),
    balanceSource: (a.balance_source || a.balanceSource || 'unknown') === 'sms' ? 'sms' : 'calculated',
    accountType: a.account_type || a.accountType,
    accountHolder: a.account_holder || a.accountHolder || null
  }));
};

export const getAccountDetails = async (accountId: string) => {
  const res = await fetch(`${API_BASE}/accounts/${encodeURIComponent(accountId)}`, { credentials: 'include' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error('[API] getAccountDetails failed', { accountId, status: res.status, body: text });
    throw new Error('Failed to fetch account details: ' + text);
  }
  const body = await res.json();
  return body;
};

export const createManualTransaction = async (payload: { amount: number; merchant: string; notes?: string; transaction_time?: string }) => {
  const res = await fetch(`${API_BASE}/transactions/manual`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error('[API] createManualTransaction failed', { status: res.status, body: text, payload });
    throw new Error('Failed to create transaction: ' + text);
  }
  const body = await res.json();
  return body.transaction || body.data || body;
};

export const getTransactions = async (): Promise<Transaction[]> => {
  const res = await fetch(`${API_BASE}/transactions?page=1&limit=100`, { credentials: 'include' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error('[API] getTransactions failed', { status: res.status, body: text });
    throw new Error('Failed to fetch transactions: ' + text);
  }
  const body = await res.json();
  return (body.transactions || []).map((t: any) => ({
    id: String(t.id || t._id),
    merchantName: t.merchant || t.merchantName || 'Unknown',
    amount: Number(t.net_amount ?? t.amount ?? 0),
    accountId: t.account?.id ? String(t.account.id) : String(t.account_id || ''),
    transactionDate: t.transaction_time ? new Date(t.transaction_time) : new Date(t.transactionDate || Date.now()),
    type: (t.type === 'credit' ? 'credit' : 'debit')
  }));
};

// NOTE: Replaced mock data with live API calls. All data should come from backend endpoints.

export const getBudgets = async (): Promise<Budget[]> => {
  const res = await fetch(`${API_BASE}/budgets`, { credentials: 'include' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error('[API] getBudgets failed', { status: res.status, body: text });
    throw new Error('Failed to fetch budgets: ' + text);
  }
  const body = await res.json();
  return (body.data || []).map((b: any) => ({
    id: String(b._id || b.id),
    category: b.category,
    monthlyLimit: b.monthly_limit || b.monthlyLimit || 0,
    spent: b.spent || 0,
    remaining: (b.monthly_limit || 0) - (b.spent || 0),
    percentage: b.percentage || 0,
    transactionCount: b.transaction_count || 0,
    alertThreshold: b.alert_threshold || 80,
    isExceeding: !!b.is_exceeding,
    isNearLimit: !!b.is_near_limit,
  }));
};

export const getBudgetAlerts = async (): Promise<BudgetAlert> => {
  const res = await fetch(`${API_BASE}/budgets/alerts`, { credentials: 'include' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error('[API] getBudgetAlerts failed', { status: res.status, body: text });
    throw new Error('Failed to fetch budget alerts: ' + text);
  }
  const body = await res.json();
  // backend returns { success, alerts }
  const alerts = body.alerts || {};
  return {
    exceeding: alerts.exceeding || [],
    nearLimit: alerts.nearLimit || [],
    allCategories: alerts.allCategories || [],
  };
};

export const createBudget = async (budget: Partial<Budget>): Promise<Budget> => {
  const res = await fetch(`${API_BASE}/budgets`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      category: budget.category,
      monthly_limit: budget.monthlyLimit,
      alert_threshold: budget.alertThreshold
    })
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error('[API] createBudget failed', { status: res.status, body: text, payload: budget });
    throw new Error('Failed to create budget: ' + text);
  }
  const body = await res.json();
  return body.data;
};

export const updateBudget = async (id: string, updates: Partial<Budget>): Promise<Budget> => {
  const res = await fetch(`${API_BASE}/budgets/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      monthly_limit: updates.monthlyLimit,
      alert_threshold: updates.alertThreshold,
      is_active: updates.isExceeding === undefined ? undefined : !updates.isExceeding
    })
  });
  if (!res.ok) throw new Error('Failed to update budget');
  const body = await res.json();
  return body.data;
};

export const deleteBudget = async (id: string): Promise<void> => {
  const res = await fetch(`${API_BASE}/budgets/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'include'
  });
  if (!res.ok) throw new Error('Failed to delete budget');
};

export const getCategories = async (): Promise<Category[]> => {
  const res = await fetch(`${API_BASE}/budgets/categories`, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch categories');
  const body = await res.json();
  return (body.data || []).map((c: any) => ({
    id: String(c._id || c.id),
    name: c.name,
    parentCategory: c.parent_category || c.parentCategory,
    keywords: c.keywords || [],
    merchantPatterns: c.merchant_patterns || c.merchantPatterns || [],
    color: c.color || '#808080',
    isActive: !!c.is_active,
    transactionCount: c.transaction_count || 0,
  }));
};

export const createCategory = async (category: Partial<Category>): Promise<Category> => {
  const res = await fetch(`${API_BASE}/budgets/categories`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: category.name,
      parent_category: category.parentCategory,
      keywords: category.keywords,
      merchant_patterns: category.merchantPatterns,
      color: category.color,
      icon: category.icon
    })
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error('[API] createCategory failed', { status: res.status, body: text, payload: category });
    throw new Error('Failed to create category: ' + text);
  }
  const body = await res.json();
  return body.data;
};

export const getRefundPairs = async (): Promise<RefundPair[]> => {
  const res = await fetch(`${API_BASE}/transactions/refunds/pairs`, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch refund pairs');
  const body = await res.json();
  return (body.data || []).map((p: any) => ({
    original: {
      id: String(p.original.id || p.original._id),
      amount: p.original.amount,
      merchant: p.original.merchant,
      type: p.original.type,
    },
    refund: {
      id: String(p.refund.id || p.refund._id),
      amount: p.refund.amount,
      merchant: p.refund.merchant,
      type: p.refund.type,
      transactionTime: p.refund.transaction_time || p.refund.transactionTime,
    },
    linkedDate: p.linked_date || p.linkedDate,
  }));
};

export const linkRefund = async (originalTxId: string, refundTxId: string): Promise<RefundPair> => {
  const res = await fetch(`${API_BASE}/transactions/${originalTxId}/link-refund`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refund_tx_id: refundTxId })
  });
  if (!res.ok) throw new Error('Failed to link refund');
  const body = await res.json();
  return body.data;
};

export const unlinkRefund = async (originalTxId: string): Promise<void> => {
  const res = await fetch(`${API_BASE}/transactions/${originalTxId}/unlink-refund`, {
    method: 'DELETE',
    credentials: 'include'
  });
  if (!res.ok) throw new Error('Failed to unlink refund');
};

export const getNetSpend = async (startDate: Date, endDate: Date): Promise<NetSpend> => {
  const qs = `?start_date=${encodeURIComponent(startDate.toISOString())}&end_date=${encodeURIComponent(endDate.toISOString())}`;
  const res = await fetch(`${API_BASE}/transactions/refunds/net-spend${qs}`, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch net spend');
  const body = await res.json();
  return body.data;
};

export const autoCategorizeTransactions = async (): Promise<{ updated: number; total: number }> => {
  const res = await fetch(`${API_BASE}/budgets/auto-categorize`, {
    method: 'POST',
    credentials: 'include'
  });
  if (!res.ok) throw new Error('Failed to run auto-categorize');
  const body = await res.json();
  return body.data || { updated: 0, total: 0 };
};

