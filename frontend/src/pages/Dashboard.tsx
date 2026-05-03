import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { formatCurrency, calculateTotalBalance, calculateMonthlyExpense, filterTransactionsByMonth, toTitleCase } from '../utils/formatters';
import { TrendingUp, TrendingDown, AlertCircle, ChevronRight, RefreshCw } from 'lucide-react';
import { getBudgetAlerts, getAccountDetails, createManualTransaction, syncAccountBalances, updateAccountBalance } from '../services/api';
import { BottomSheet } from '../components/BottomSheet';
import { Budget } from '../types';

const BANK_LOGOS: Record<string, string> = {
  hdfc: '/spendlens/bank-logos/hdfc.png',
  HDFC: '/spendlens/bank-logos/hdfc.png',
  icici: '/spendlens/bank-logos/icici.png',
  'indian bank': '/spendlens/bank-logos/indian-bank.png',
  'state bank of india': '/spendlens/bank-logos/sbi.png',
  axis: '/spendlens/bank-logos/axis.png',
  airtel: '/spendlens/bank-logos/airtel.png',
  'paytm payments bank': '/spendlens/bank-logos/paytm.png',
  default: '/spendlens/bank-logos/default.png',
  cash: '/spendlens/bank-logos/cash.png'
};

// Credit card backgrounds for each bank
const CARD_BACKGROUNDS: Record<string, string> = {
  hdfc: '/creditcard/backgrounds/hdfc.png',
  HDFC: '/creditcard/backgrounds/hdfc.png',
  icici: '/creditcard/backgrounds/icici.png',
  axis: '/creditcard/backgrounds/axis.png',
  sbi: '/creditcard/backgrounds/sbi.png',
  'state bank of india': '/creditcard/backgrounds/sbi.png',
  'indian bank': '/creditcard/backgrounds/indianbank.png',
  airtel: '/creditcard/backgrounds/airtel.png',
  paytm: '/creditcard/backgrounds/paytm.png',
  default: '/creditcard/backgrounds/default.png'
};

function getBankLogo(bankName: string) {
  if (!bankName) return '/bank-logos/default.png';
  const key = bankName.trim().toLowerCase();
  return BANK_LOGOS[key] || '/bank-logos/default.png';
}

function getCardBackground(bankName: string) {
  if (!bankName) return CARD_BACKGROUNDS.default;
  const key = bankName.trim().toLowerCase();
  return CARD_BACKGROUNDS[key] || CARD_BACKGROUNDS.default;
}

function getUpiCircleSpend(transactions: any[]) {
  const grouped = new Map<string, { name: string; amount: number; count: number }>();

  for (const tx of transactions) {
    if (tx.type !== 'debit') continue;
    
    // Include if tagged as upi_circle OR has upi_circle in tags
    const isUpiCircle = tx.tags && (tx.tags.includes('upi_circle') || tx.tags.includes('upi circle'));
    if (!isUpiCircle) continue;
    
    const name = tx.merchantName || tx.receiverName || 'Unknown';
    if (!name || name === 'Transaction' || name === 'Statement Import' || name === 'Unknown') continue;
    
    const key = name.trim().toUpperCase();
    const current = grouped.get(key) || { name, amount: 0, count: 0 };
    current.amount += Number(tx.amount || 0);
    current.count += 1;
    grouped.set(key, current);
  }

  return Array.from(grouped.values())
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);
}

const AccountDetailSheet = ({
  account,
  details,
  onUpdated,
}: {
  account: any;
  details: any;
  onUpdated: () => Promise<void> | void;
}) => {
  const [editBalance, setEditBalance] = useState<number | ''>('');
  const [editTime, setEditTime] = useState<string>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (account) {
      setEditBalance(account.balance ?? 0);
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const initial = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(
        now.getHours()
      )}:${pad(now.getMinutes())}`;
      setEditTime(initial);
    }
  }, [account]);

  const handleSaveBalance = async () => {
    if (editBalance === '') return;
    setSaving(true);
    try {
      const asOf = editTime ? new Date(editTime) : undefined;
      await updateAccountBalance(account.id, Number(editBalance), asOf);
      await onUpdated();
      alert('Account balance updated.');
    } catch (err) {
      console.error('[Dashboard] Failed to update balance from sheet', err);
      alert('Failed to update balance. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const recentTx =
    details.recent_transactions || details.account?.recent_transactions || [];

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">
            {details.account?.bank_name || account.bankName}
          </h3>
          <p className="text-sm text-gray-500">
            {details.account?.account_number || account.accountNumber}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500 mb-1">Current balance</p>
          <p className="text-2xl font-bold">
            {formatCurrency(account.balance ?? 0)}
          </p>
        </div>
      </div>

      <div className="mt-2 rounded-lg border border-gray-200 p-3 space-y-2">
        <p className="text-xs font-medium text-gray-700 mb-1">
          Edit balance from SMS
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">New balance</label>
            <input
              type="number"
              value={editBalance as any}
              onChange={(e) =>
                setEditBalance(e.target.value === '' ? '' : Number(e.target.value))
              }
              className="w-full px-3 py-2 border rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Balance as of</label>
            <input
              type="datetime-local"
              value={editTime}
              onChange={(e) => setEditTime(e.target.value)}
              className="w-full px-3 py-2 border rounded text-sm"
            />
            <p className="mt-1 text-[11px] text-gray-500">
              All debits/credits after this time will be applied on top of this amount.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={handleSaveBalance}
            disabled={saving}
            className="px-4 py-1.5 rounded bg-blue-600 text-white text-sm disabled:bg-gray-400"
          >
            {saving ? 'Saving...' : 'Save balance'}
          </button>
        </div>
      </div>

      <div className="pt-2">
        <h4 className="text-sm font-semibold mb-2">Recent transactions</h4>
        {recentTx.length === 0 ? (
          <p className="text-xs text-gray-500">No transactions for this account.</p>
        ) : (
          <div className="space-y-2">
            {recentTx.map((tx: any) => (
              <div key={tx.id || tx._id} className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">
                    {tx.merchant || tx.merchantName}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(
                      tx.transaction_time || tx.transactionDate || tx.transaction_time
                    ).toLocaleString()}
                  </p>
                </div>
                <div
                  className={`font-semibold text-sm ${
                    tx.type === 'debit' ? 'text-red-600' : 'text-green-600'
                  }`}
                >
                  {(tx.type === 'debit' ? '-' : '+') +
                    formatCurrency(tx.amount || tx.net_amount)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export const Dashboard = () => {
  const { accounts, transactions, selectedMonth, loadAccounts, loadTransactions, theme, lastSyncedAt } = useStore();
  const [budgetAlerts, setBudgetAlerts] = useState<Budget[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [hiddenBalances, setHiddenBalances] = useState<Set<string>>(new Set());

  const toggleBalanceVisibility = (accountId: string) => {
    const newHidden = new Set(hiddenBalances);
    if (newHidden.has(accountId)) {
      newHidden.delete(accountId);
    } else {
      newHidden.add(accountId);
    }
    setHiddenBalances(newHidden);
  };

  useEffect(() => {
    console.log('[Dashboard] Store data loaded:', {
      accountsCount: accounts.length,
      transactionsCount: transactions.length,
      accounts: accounts,
      transactions: transactions.slice(0, 3) // Log first 3 for debugging
    });
    // Only load alerts on mount, not on every re-render
    loadBudgetAlerts();
  }, []); // Empty dependency array - run only once on mount

  const loadBudgetAlerts = async () => {
    try {
      const data = await getBudgetAlerts();
      setBudgetAlerts([...data.exceeding, ...data.nearLimit]);
    } catch (error) {
      console.warn('[Dashboard] Budget alerts unavailable:', error instanceof Error ? error.message : String(error));
      // Silently fail - budgets are optional
      setBudgetAlerts([]);
    }
  };

  const handleSyncBalances = async () => {
    setSyncing(true);
    try {
      const result = await syncAccountBalances();
      console.log('[Dashboard] Sync result:', result);
      // Reload accounts and transactions to reflect updated data
      await loadAccounts();
      await loadTransactions();
      alert(`✅ Sync complete! Updated ${result.updated_count || 0} accounts.`);
    } catch (error) {
      console.error('[Dashboard] Sync failed:', error);
      alert(`❌ Sync failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setSyncing(false);
    }
  };

  const totalBalance = calculateTotalBalance(accounts);
  const monthlyExpense = calculateMonthlyExpense(transactions, selectedMonth);

  // Show recent transactions for the selected month
  const recentTransactions = filterTransactionsByMonth(transactions, selectedMonth)
    .sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime())
    .slice(0, 5);
  const upiCircleSpend = getUpiCircleSpend(filterTransactionsByMonth(transactions, selectedMonth));

  const [isAccountExpanded, setIsAccountExpanded] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<any | null>(null);
  const [accountDetails, setAccountDetails] = useState<any | null>(null);
  const [showCashForm, setShowCashForm] = useState(false);
  const [cashAmount, setCashAmount] = useState<number | ''>('');
  const [cashMerchant, setCashMerchant] = useState('Cash Spend');
  const [cashNotes, setCashNotes] = useState('');

  const openAccount = async (account: any) => {
    setSelectedAccount(account);
    setIsAccountExpanded(true);
    try {
      const details = await getAccountDetails(account.id);
      setAccountDetails(details.account ? details : { account: account });
    } catch (err) {
      console.error('Failed to fetch account details', err);
      setAccountDetails({ account });
    }
  };

  const closeAccount = () => {
    setIsAccountExpanded(false);
    setSelectedAccount(null);
    setAccountDetails(null);
  };

  const openCashForm = () => setShowCashForm(true);
  const closeCashForm = () => setShowCashForm(false);

  const submitCashSpend = async () => {
    if (!cashAmount || Number(cashAmount) <= 0) return alert('Please enter a valid amount');
    try {
      console.log('[Dashboard] Creating cash transaction:', { amount: cashAmount, merchant: cashMerchant, notes: cashNotes });
      await createManualTransaction({ 
        amount: Number(cashAmount), 
        merchant: cashMerchant, 
        notes: cashNotes, 
        transaction_time: new Date().toISOString() 
      });
      console.log('[Dashboard] Cash transaction created, reloading data...');
      // reload data
      await loadTransactions();
      await loadAccounts();
      setCashAmount('');
      setCashMerchant('Cash Spend');
      setCashNotes('');
      closeCashForm();
      alert('Cash spend recorded successfully!');
    } catch (err) {
      console.error('Failed to create cash spend:', err);
      alert(`Failed to create cash spend: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="mb-8 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Money Manager</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {lastSyncedAt ? `Last synced ${new Date(lastSyncedAt).toLocaleString()}` : 'Showing cached data, sync in progress...'}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleSyncBalances}
            disabled={syncing}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            title="Sync and refresh account balances from transactions"
          >
            <RefreshCw size={18} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Syncing...' : 'Sync'}
          </button>
        </div>
      </div>

      {budgetAlerts.length > 0 && (
        <div className="mb-8 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-yellow-600 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="font-semibold text-yellow-800">Budget Alerts</p>
              <p className="text-sm text-yellow-700 mt-1">
                {budgetAlerts.map(b => b.category).join(', ')} need attention
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="rounded-2xl shadow-sm border border-emerald-500/20 bg-gradient-to-br from-emerald-500/15 via-slate-900 to-slate-900 p-6">
          <div className="flex items-start justify-between mb-2">
            <p className="text-sm text-emerald-100/80">Total Balance</p>
            <button
              onClick={() => {
                const allHidden = accounts.every(a => hiddenBalances.has(a.id));
                if (allHidden) {
                  setHiddenBalances(new Set());
                } else {
                  setHiddenBalances(new Set(accounts.map(a => a.id)));
                }
              }}
              className="text-emerald-100 hover:text-emerald-50 transition-colors"
              title={accounts.every(a => hiddenBalances.has(a.id)) ? 'Show all balances' : 'Hide all balances'}
            >
              {accounts.every(a => hiddenBalances.has(a.id)) ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-4.803m5.596-3.856a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0M15 12a3 3 0 11-6 0 3 3 0 016 0zm6 0c0 1.657-.672 3.157-1.757 4.243A6 6 0 0121 12a6 6 0 00-9.243-5.243" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>
          <h3 className="text-4xl font-bold text-white">
            {accounts.some(a => hiddenBalances.has(a.id)) ? '••••••••' : formatCurrency(totalBalance)}
          </h3>
          <p className="text-xs text-emerald-100/70 mt-2">Across all accounts</p>
          <div className="mt-4">
            <button onClick={openCashForm} className="inline-flex items-center gap-2 px-3 py-2 bg-emerald-400 text-slate-950 font-semibold rounded-lg hover:bg-emerald-300 transition-colors">Add Cash Spend</button>
          </div>
        </div>

        <div className="rounded-2xl shadow-sm border border-red-500/20 bg-gradient-to-br from-red-500/10 via-slate-900 to-slate-900 p-6">
          <p className="text-sm text-red-100/80 mb-2">Monthly Expense</p>
          <h3 className="text-4xl font-bold text-red-300">
            {formatCurrency(monthlyExpense)}
          </h3>
          <p className="text-xs text-red-100/70 mt-2">This month</p>
        </div>
      </div>

      {/* Accounts horizontal carousel (primary visible, others swipeable) */}
      <div className="mb-6">
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">Accounts</p>
        <div className="flex gap-4 overflow-x-auto pb-2">
          {accounts.map((account) => {
            const isDark = theme === 'dark';
            const logoSrc = getBankLogo(account.bankName);
            return (
              <button
                key={account.id}
                onClick={() => openAccount(account)}
                className={`min-w-[280px] max-w-sm flex-shrink-0 rounded-2xl border transition-all shadow-sm hover:shadow-md ${
                  isDark ? 'bg-[#111827] border-[#1f2937] text-gray-100' : 'bg-white border-gray-200 text-gray-900'
                }`}
              >
                <div className="flex h-full">
                  {/* Left colored strip with logo */}
                  <div className={`${isDark ? 'bg-[#1f2937]' : 'bg-blue-50'} rounded-l-2xl w-20 flex flex-col items-center justify-center gap-3`}>
                    <div className="w-10 h-10 rounded-xl bg-white/90 flex items-center justify-center overflow-hidden shadow-sm">
                      <img src={logoSrc} alt={account.bankName} className="w-8 h-8 object-contain" />
                    </div>
                  </div>

                  {/* Right content */}
                  <div className="flex-1 px-4 py-3 flex flex-col justify-between">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs text-gray-500 mb-1 truncate">
                          {account.accountNumber || '••••'}
                        </p>
                        <p className="text-sm font-semibold truncate">
                          {account.bankName}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex items-end justify-between">
                      <div>
                        <p className="text-[11px] text-gray-500 mb-1">
                          Available balance
                        </p>
                        <p className="text-2xl font-bold">
                          {hiddenBalances.has(account.id) ? '••••••••' : formatCurrency(account.balance)}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleBalanceVisibility(account.id);
                        }}
                        className="text-gray-400 hover:text-gray-100 transition-colors cursor-pointer"
                        title={hiddenBalances.has(account.id) ? 'Show balance' : 'Hide balance'}
                      >
                        {hiddenBalances.has(account.id) ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-4.803m5.596-3.856a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0M15 12a3 3 0 11-6 0 3 3 0 016 0zm6 0c0 1.657-.672 3.157-1.757 4.243A6 6 0 0121 12a6 6 0 00-9.243-5.243" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </div>
                        <span
                          className={`text-[10px] px-2 py-1 rounded-full ${
                            account.balanceSource === 'sms'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/40'
                              : 'bg-gray-500/10 text-gray-300 border border-gray-500/40'
                          }`}
                        >
                          {account.balanceSource === 'sms' ? 'SMS balance' : 'Calculated'}
                        </span>
                        <ChevronRight size={18} className="text-gray-400" />
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Credit cards horizontal scroll */}
      {accounts.filter(a => a.accountType === 'credit_card').length > 0 && (
        <div className="mb-6 md:mb-8">
          <p className="text-sm text-gray-600 mb-3 font-medium">Credit Cards</p>
          <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 snap-x snap-mandatory">
            {accounts.filter(a => a.accountType === 'credit_card').map((card) => (
              <div 
                key={card.id} 
                className="flex-shrink-0 w-80 snap-center h-40 rounded-2xl p-5 text-white shadow-lg transform transition-all hover:shadow-xl bg-cover bg-center relative overflow-hidden"
                style={{ backgroundImage: `url('${getCardBackground(card.bankName)}')` }}
              >
                {/* Overlay for better text readability */}
                <div className="absolute inset-0 bg-gradient-to-br from-black/30 to-black/10 pointer-events-none" />
                
                <div className="h-full flex flex-col justify-between relative z-10">
                  <div>
                    <p className="text-xs opacity-90 font-medium">{card.bankName}</p>
                    <p className="text-sm font-mono mt-2 opacity-95">•••• {card.accountNumber?.slice(-4) || '••••'}</p>
                  </div>
                  
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-xs opacity-85 font-medium">Outstanding</p>
                      <p className="text-2xl font-bold mt-1">{formatCurrency(Math.abs(card.balance))}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs opacity-85">Balance</p>
                      <p className="text-sm font-semibold">{card.balanceSource === 'sms' ? 'SMS' : 'Calc'}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Transactions - Horizontal Scrollable */}
      <div className="mb-6 md:mb-8">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Recent Transactions</h3>
        </div>
        
        {recentTransactions.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 px-6 py-8 text-center text-gray-500">
            No transactions found
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4 md:mx-0 md:px-0 snap-x snap-mandatory">
            {recentTransactions.map((txn) => {
              const isDebit = txn.type === 'debit';

              return (
                <div
                  key={txn.id}
                  className="flex-shrink-0 w-48 snap-center bg-white rounded-2xl border border-gray-200 p-4 hover:shadow-md transition-shadow"
                >
                  {/* Icon */}
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 ${
                    isDebit ? 'bg-red-100' : 'bg-green-100'
                  }`}>
                    {isDebit ? (
                      <TrendingDown size={24} className="text-red-600" />
                    ) : (
                      <TrendingUp size={24} className="text-green-600" />
                    )}
                  </div>

                  {/* Content */}
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {toTitleCase(txn.merchantName)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1 truncate">
                    {toTitleCase(txn.category || 'Uncategorized')}
                  </p>

                  {/* Amount and Date */}
                  <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between">
                    <p className="text-xs text-gray-500">
                      {txn.transactionDate.toLocaleDateString('en-IN', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                    <p className={`font-bold text-sm ${
                      isDebit ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {isDebit ? '-' : '+'}{formatCurrency(txn.amount)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* UPI Circle Spend - Modern chips/cards */}
      <div className="mb-8 rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-500/10 via-slate-900 to-slate-900 p-4 md:p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-violet-100">UPI Circle</h3>
          <span className="text-xs text-violet-200/80">Top people this month</span>
        </div>
        {upiCircleSpend.length === 0 ? (
          <p className="text-sm text-violet-100/70">No UPI circle transactions found yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {upiCircleSpend.map((person) => (
              <div key={person.name} className="rounded-xl border border-violet-400/20 bg-black/20 p-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-violet-500/20 border border-violet-300/40 flex items-center justify-center text-violet-100 font-semibold">
                    {person.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{person.name}</p>
                    <p className="text-xs text-violet-100/70">{person.count} spends</p>
                  </div>
                </div>
                <p className="mt-3 text-base font-semibold text-violet-100">{formatCurrency(person.amount)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
      <BottomSheet open={isAccountExpanded} onClose={closeAccount}>
        {accountDetails && selectedAccount ? (
          <AccountDetailSheet
            account={selectedAccount}
            details={accountDetails}
            onUpdated={async () => {
              await loadAccounts();
            }}
          />
        ) : (
          <div className="text-center text-gray-500 py-8">Loading...</div>
        )}
      </BottomSheet>
      <BottomSheet open={showCashForm} onClose={closeCashForm}>
        <div>
          <h3 className="text-lg font-semibold mb-2">Add Cash Spend</h3>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-gray-600">Amount</label>
              <input type="number" value={cashAmount as any} onChange={(e) => setCashAmount(e.target.value === '' ? '' : Number(e.target.value))} className="w-full mt-1 p-2 border rounded" />
            </div>
            <div>
              <label className="text-sm text-gray-600">Merchant</label>
              <input value={cashMerchant} onChange={(e) => setCashMerchant(e.target.value)} className="w-full mt-1 p-2 border rounded" />
            </div>
            <div>
              <label className="text-sm text-gray-600">Notes</label>
              <textarea value={cashNotes} onChange={(e) => setCashNotes(e.target.value)} className="w-full mt-1 p-2 border rounded" />
            </div>

            <div className="flex items-center justify-end gap-2">
              <button onClick={closeCashForm} className="px-3 py-2 rounded border">Cancel</button>
              <button onClick={submitCashSpend} className="px-3 py-2 bg-indigo-600 text-white rounded">Save</button>
            </div>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
};
