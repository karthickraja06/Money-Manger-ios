import { Account, Transaction, Budget, Category, RefundPair, BudgetAlert, NetSpend } from '../types';

const API_BASE = ((import.meta as any)?.env?.VITE_API_BASE as string) || 'https://money-manger-ios.onrender.com';
const API_KEY = 'ios_secret_key_123'; // Default API key for all frontend requests
const REQUEST_TIMEOUT = 30000; // 30 seconds (reduced from 45 to handle cold starts better)

console.log('[API] Configured API_BASE:', API_BASE);

function maskAccountNumber(raw: string | null | undefined) {
  if (!raw) return '';
  const digits = raw.replace(/[^0-9]/g, '');
  if (digits.length <= 4) return `****${digits}`;
  return `****${digits.slice(-4)}`;
}

function getHeaders() {
  return {
    'Content-Type': 'application/json',
    'x-api-key': API_KEY
  };
}

/**
 * Fetch with timeout - improved error handling
 */
async function fetchWithRetry(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      // Add cache control for better performance
      cache: 'no-store'
    });
    clearTimeout(timeoutId);
    return res;
  } catch (error) {
    clearTimeout(timeoutId);
    
    // Handle abort errors more gracefully
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        console.error(`[API] Request timeout (${REQUEST_TIMEOUT}ms): ${url}`);
        throw new Error(`Request timeout after ${REQUEST_TIMEOUT / 1000}s - Server may be starting up`);
      }
      console.error(`[API] ${url} - ${error.message}`);
    }
    
    throw error;
  }
}

export const getAccounts = async (): Promise<Account[]> => {
  const res = await fetchWithRetry(`${API_BASE}/accounts`, { 
    headers: getHeaders()
  });
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
    accountHolder: a.account_holder || a.accountHolder || null,
    accountNickname: a.account_nickname || null
  }));
};

export const getAccountDetails = async (accountId: string) => {
  const res = await fetchWithRetry(`${API_BASE}/accounts/${encodeURIComponent(accountId)}`, { 
    headers: getHeaders()
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error('[API] getAccountDetails failed', { accountId, status: res.status, body: text });
    throw new Error('Failed to fetch account details: ' + text);
  }
  const body = await res.json();
  return body;
};

export const updateAccountBalance = async (accountId: string, currentBalance: number, balanceAsOf?: Date): Promise<Account> => {
  const res = await fetchWithRetry(`${API_BASE}/accounts/${encodeURIComponent(accountId)}`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify({
      current_balance: currentBalance,
      balance_as_of: balanceAsOf ? balanceAsOf.toISOString() : undefined
    })
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error('[API] updateAccountBalance failed', { status: res.status, body: text });
    throw new Error('Failed to update account balance: ' + text);
  }

  const body = await res.json();
  const a = body.account || body.data || body;
  return {
    id: String(a.id || a._id),
    bankName: a.bank_name || a.bankName || 'Unknown',
    accountNumber: maskAccountNumber(a.account_number || a.accountNumber || ''),
    balance: Number(a.current_balance ?? a.balance ?? 0),
    balanceSource: (a.balance_source || a.balanceSource || 'unknown') === 'sms' ? 'sms' : 'calculated',
    accountType: a.account_type || a.accountType,
    accountHolder: a.account_holder || a.accountHolder || null,
    accountNickname: a.account_nickname || null
  };
};

export const updateAccountNickname = async (accountId: string, nickname: string): Promise<Account> => {
  const res = await fetchWithRetry(`${API_BASE}/accounts/${encodeURIComponent(accountId)}`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify({
      account_nickname: nickname || null
    })
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error('[API] updateAccountNickname failed', { status: res.status, body: text });
    throw new Error('Failed to update account nickname: ' + text);
  }

  const body = await res.json();
  const a = body.account || body.data || body;
  return {
    id: String(a.id || a._id),
    bankName: a.bank_name || a.bankName || 'Unknown',
    accountNumber: maskAccountNumber(a.account_number || a.accountNumber || ''),
    balance: Number(a.current_balance ?? a.balance ?? 0),
    balanceSource: (a.balance_source || a.balanceSource || 'unknown') === 'sms' ? 'sms' : 'calculated',
    accountType: a.account_type || a.accountType,
    accountHolder: a.account_holder || a.accountHolder || null,
    accountNickname: a.account_nickname || null
  };
};

export const createManualTransaction = async (payload: { amount: number; merchant: string; notes?: string; transaction_time?: string }) => {
  const res = await fetchWithRetry(`${API_BASE}/transactions/manual`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error('[API] createManualTransaction failed', { status: res.status, body: text, payload });
    throw new Error(`Failed to create transaction: ${res.status} ${text}`);
  }
  const body = await res.json();
  console.log('[API] createManualTransaction success:', body);
  return body.transaction || body.data || body;
};

export interface TransactionsQuery {
  page?: number;
  limit?: number;
  startDate?: Date;
  endDate?: Date;
}

export interface TransactionsPage {
  transactions: Transaction[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

/**
 * Paginated transactions fetch with optional date range.
 * This is future‑proof for larger ranges (multi‑month, custom ranges).
 */
export const getTransactionsPage = async (query: TransactionsQuery = {}): Promise<TransactionsPage> => {
  const params = new URLSearchParams();
  params.set('page', String(query.page ?? 1));
  params.set('limit', String(query.limit ?? 50));

  if (query.startDate) {
    params.set('start_date', query.startDate.toISOString());
  }
  if (query.endDate) {
    params.set('end_date', query.endDate.toISOString());
  }

  const url = `${API_BASE}/transactions?${params.toString()}`;

  const res = await fetchWithRetry(url, { 
    headers: getHeaders()
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error('[API] getTransactionsPage failed', { status: res.status, body: text, url });
    throw new Error('Failed to fetch transactions: ' + text);
  }

  const body = await res.json();
  const mapped: Transaction[] = (body.transactions || []).map((t: any) => ({
    id: String(t.id || t._id),
    merchantName: t.merchant || t.merchantName || 'Unknown',
    amount: Number(t.net_amount ?? t.amount ?? 0),
    accountId: t.account?.id ? String(t.account.id) : String(t.account_id || ''),
    transactionDate: t.transaction_time ? new Date(t.transaction_time) : new Date(t.transactionDate || Date.now()),
    type: (t.type === 'credit' || t.type === 'credit' ? 'credit' : 'debit'),
    category: t.category || undefined,
    tags: t.tags || [],
    notes: t.notes || undefined,
    receiverName: t.receiver_name || t.receiverName || undefined,
    senderName: t.sender_name || t.senderName || undefined,
    refundLinkedId: t.is_refund_of || t.refundLinkedId || undefined,
    isRefund: !!t.is_refund_of,
    linked_refunds: t.linked_refunds || [],
    is_refund_of: t.is_refund_of || undefined,
  }));

  const pagination = body.pagination || {
    page: query.page ?? 1,
    limit: query.limit ?? mapped.length,
    total: mapped.length,
    pages: 1
  };

  return { transactions: mapped, pagination };
};

/**
 * Backwards‑compatible helper used by the global store today.
 * Internally uses the paginated API (first page only).
 */
export const getTransactions = async (): Promise<Transaction[]> => {
  const { transactions } = await getTransactionsPage({ page: 1, limit: 100 });
  return transactions;
};

// NOTE: Replaced mock data with live API calls. All data should come from backend endpoints.

export const getBudgets = async (): Promise<Budget[]> => {
  const res = await fetchWithRetry(`${API_BASE}/budgets`, { 
    headers: getHeaders()
  });
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
  const res = await fetchWithRetry(`${API_BASE}/budgets/alerts`, { 
    headers: getHeaders()
  });
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
  const res = await fetchWithRetry(`${API_BASE}/budgets`, {
    method: 'POST',
    
    headers: getHeaders(),
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
  const res = await fetchWithRetry(`${API_BASE}/budgets/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    
    headers: getHeaders(),
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
  const res = await fetchWithRetry(`${API_BASE}/budgets/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    
    headers: getHeaders()
  });
  if (!res.ok) throw new Error('Failed to delete budget');
};

export const getCategories = async (): Promise<Category[]> => {
  const res = await fetchWithRetry(`${API_BASE}/budgets/categories`, { 
    headers: getHeaders()
  });
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
  const res = await fetchWithRetry(`${API_BASE}/budgets/categories`, {
    method: 'POST',
    
    headers: getHeaders(),
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
  const res = await fetchWithRetry(`${API_BASE}/transactions/refunds/pairs`, { 
    headers: getHeaders()
  });
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
  const res = await fetchWithRetry(`${API_BASE}/transactions/${originalTxId}/link-refund`, {
    method: 'POST',
    
    headers: getHeaders(),
    body: JSON.stringify({ refund_tx_id: refundTxId })
  });
  if (!res.ok) throw new Error('Failed to link refund');
  const body = await res.json();
  return body.data;
};

export const unlinkRefund = async (originalTxId: string): Promise<void> => {
  const res = await fetchWithRetry(`${API_BASE}/transactions/${originalTxId}/unlink-refund`, {
    method: 'DELETE',
    
    headers: getHeaders()
  });
  if (!res.ok) throw new Error('Failed to unlink refund');
};

export const getNetSpend = async (startDate: Date, endDate: Date): Promise<NetSpend> => {
  const qs = `?start_date=${encodeURIComponent(startDate.toISOString())}&end_date=${encodeURIComponent(endDate.toISOString())}`;
  const res = await fetchWithRetry(`${API_BASE}/transactions/refunds/net-spend${qs}`, { 
    headers: getHeaders()
  });
  if (!res.ok) throw new Error('Failed to fetch net spend');
  const body = await res.json();
  return body.data;
};

export const autoCategorizeTransactions = async (): Promise<{ updated: number; total: number }> => {
  const res = await fetchWithRetry(`${API_BASE}/budgets/auto-categorize`, {
    method: 'POST',
    
    headers: getHeaders()
  });
  if (!res.ok) throw new Error('Failed to run auto-categorize');
  const body = await res.json();
  return body.data || { updated: 0, total: 0 };
};

/**
 * Sync/Flush endpoint: Recalculate all account balances from transactions
 * Useful after bulk SMS ingestion or when user wants to refresh
 */
export const updateTransaction = async (id: string, updates: Partial<Transaction>): Promise<Transaction> => {
  const body: any = {};
  if (updates.category !== undefined) body.category = updates.category;
  if (updates.merchantName !== undefined) body.merchant = updates.merchantName;
  if (updates.amount !== undefined) body.amount = updates.amount;
  if (updates.type !== undefined) body.type = updates.type;
  if (updates.notes !== undefined) body.notes = updates.notes;
  if (updates.tags !== undefined) body.tags = updates.tags;

  const res = await fetchWithRetry(`${API_BASE}/transactions/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error('[API] updateTransaction failed', { status: res.status, body: text });
    throw new Error('Failed to update transaction');
  }

  const responseBody = await res.json();
  console.log('[API] updateTransaction success:', responseBody);
  return responseBody.transaction;
};

export const linkRefundToDebit = async (debitId: string, creditIds: string[]): Promise<any> => {
  const res = await fetchWithRetry(`${API_BASE}/transactions/${encodeURIComponent(debitId)}/link-refunds`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ credit_transaction_ids: creditIds })
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error('[API] linkRefundToDebit failed', { status: res.status, body: text });
    throw new Error('Failed to link refund');
  }

  const responseBody = await res.json();
  console.log('[API] linkRefundToDebit success:', responseBody);
  return responseBody;
};

export const syncAccountBalances = async (): Promise<any> => {
  const res = await fetchWithRetry(`${API_BASE}/accounts/sync/flush`, {
    method: 'POST',
    headers: getHeaders()
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error('[API] syncAccountBalances failed', { status: res.status, body: text });
    throw new Error('Failed to sync balances: ' + text);
  }
  const body = await res.json();
  console.log('[API] syncAccountBalances success:', body);
  return body;
};

export const triggerBackgroundSync = async (): Promise<any> => {
  try {
    // Use shorter timeout for background sync - we don't want to block
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout for background task
    
    const res = await fetch(`${API_BASE}/accounts/sync/flush`, {
      method: 'POST',
      headers: getHeaders(),
      signal: controller.signal,
      cache: 'no-store'
    });
    
    clearTimeout(timeoutId);
    
    if (!res.ok) {
      console.warn('[API] Background sync queue request failed (non-critical)', { status: res.status });
      return null; // Non-blocking - don't throw
    }
    
    const body = await res.json();
    console.log('[API] Background sync queued successfully');
    return body;
  } catch (error) {
    // Silently fail - this is non-critical background work
    const msg = error instanceof Error ? error.message : String(error);
    if (!msg.includes('AbortError')) {
      console.warn('[API] Background sync queue error (non-critical):', msg);
    }
    return null; // Don't throw - this is non-blocking
  }
};

export const getSyncStatus = async (): Promise<any> => {
  try {
    const res = await fetchWithRetry(`${API_BASE}/sync/status`, {
      headers: getHeaders()
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.warn('[API] Failed to get sync status:', error instanceof Error ? error.message : String(error));
    return null;
  }
};

/**
 * Re-parse transactions (all or specific ones)
 * @param transactionIds - Array of transaction IDs to re-parse. If empty, re-parses ALL transactions
 */
export const reparseTransactions = async (transactionIds: string[] = []): Promise<any> => {
  const res = await fetchWithRetry(`${API_BASE}/reparse/transactions`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      transaction_ids: transactionIds
    })
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error('[API] reparseTransactions failed', { status: res.status, body: text });
    throw new Error('Failed to re-parse transactions: ' + text);
  }

  const body = await res.json();
  console.log('[API] reparseTransactions success:', body);
  return body;
};


