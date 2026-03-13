import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { formatCurrency, calculateTotalBalance, calculateMonthlyExpense, filterTransactionsByMonth } from '../utils/formatters';
import { TrendingUp, TrendingDown, AlertCircle, ChevronRight, RefreshCw } from 'lucide-react';
import { getBudgetAlerts, getAccountDetails, createManualTransaction, syncAccountBalances, updateAccountBalance } from '../services/api';
import { BottomSheet } from '../components/BottomSheet';
import { Budget } from '../types';

const BANK_LOGOS: Record<string, string> = {
  hdfc: '/bank-logos/hdfc.png',
  icici: '/bank-logos/icici.png',
  'indian bank': '/bank-logos/indian-bank.png',
  'state bank of india': '/bank-logos/sbi.png',
  axis: '/bank-logos/axis.png',
};

function getBankLogo(bankName: string) {
  if (!bankName) return '/bank-logos/default.png';
  const key = bankName.trim().toLowerCase();
  return BANK_LOGOS[key] || '/bank-logos/default.png';
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
  const { accounts, transactions, selectedMonth, loadAccounts, loadTransactions, theme } = useStore();
  const [budgetAlerts, setBudgetAlerts] = useState<Budget[]>([]);
  const [syncing, setSyncing] = useState(false);

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
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h2>
          <p className="text-gray-600">Welcome back! Here's your financial overview.</p>
        </div>
        <button
          onClick={handleSyncBalances}
          disabled={syncing}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          title="Sync and refresh account balances from transactions"
        >
          <RefreshCw size={18} className={syncing ? 'animate-spin' : ''} />
          {syncing ? 'Syncing...' : 'Sync'}
        </button>
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
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-600 mb-2">Total Balance</p>
          <h3 className="text-4xl font-bold text-gray-900">
            {formatCurrency(totalBalance)}
          </h3>
          <p className="text-xs text-gray-500 mt-2">Across all accounts</p>
          <div className="mt-4">
            <button onClick={openCashForm} className="inline-flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg">Add Cash Spend</button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-600 mb-2">Monthly Expense</p>
          <h3 className="text-4xl font-bold text-red-600">
            {formatCurrency(monthlyExpense)}
          </h3>
          <p className="text-xs text-gray-500 mt-2">This month</p>
        </div>
      </div>

      {/* Accounts horizontal carousel (primary visible, others swipeable) */}
      <div className="mb-6">
        <p className="text-sm text-gray-600 mb-2">Accounts</p>
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
                      <button
                        type="button"
                        className="ml-2 rounded-full border border-gray-600/30 px-1.5 py-1 text-[10px] uppercase tracking-wide"
                      >
                        View
                      </button>
                    </div>

                    <div className="mt-3 flex items-end justify-between">
                      <div>
                        <p className="text-[11px] text-gray-500 mb-1">
                          Available balance
                        </p>
                        <p className="text-2xl font-bold">
                          {formatCurrency(account.balance)}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
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

      {/* Credit cards stacked preview */}
      <div className="mb-24 md:mb-6">
        <p className="text-sm text-gray-600 mb-2">Credit Cards</p>
        <div className="relative h-48">
          {accounts.filter(a => a.accountType === 'credit_card').slice(0,3).map((card, i) => (
            <div key={card.id} className={`absolute left-${i * 4} top-${i * 2} w-72 h-36 rounded-xl shadow-lg transform transition-all`} style={{ left: `${i * 18}px`, top: `${i * 8}px`, zIndex: 10 - i }}>
              <div className="h-full rounded-xl p-4 text-white" style={{ background: 'linear-gradient(90deg,#ff5f6d,#ff9966)' }}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs opacity-90">{card.bankName}</p>
                    <p className="text-sm font-mono mt-1">{card.accountNumber}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm">Outstanding</p>
                    <p className="text-lg font-semibold">{formatCurrency(card.balance)}</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between text-xs opacity-90">
                  <button className="bg-white/20 px-3 py-1 rounded">Set billing cycle</button>
                  <button className="bg-white/10 px-3 py-1 rounded">Flip</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Recent Transactions</h3>
        </div>
        <div className="divide-y divide-gray-200">
          {recentTransactions.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              No transactions found
            </div>
          ) : (
            recentTransactions.map((txn) => {
              const account = accounts.find((a) => a.id === txn.accountId);
              const isDebit = txn.type === 'debit';

              return (
                <div key={txn.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
                  <div className="flex items-center gap-4 flex-1">
                    <div
                      className={`p-2 rounded-lg ${
                        isDebit ? 'bg-red-100' : 'bg-green-100'
                      }`}
                    >
                      {isDebit ? (
                        <TrendingDown size={20} className="text-red-600" />
                      ) : (
                        <TrendingUp size={20} className="text-green-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{txn.merchantName}</p>
                      <p className="text-sm text-gray-500 truncate">
                        {account?.bankName} • {account?.accountNumber}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className={`font-semibold ${
                        isDebit ? 'text-red-600' : 'text-green-600'
                      }`}
                    >
                      {isDebit ? '-' : '+'}{formatCurrency(txn.amount)}
                    </p>
                    <p className="text-sm text-gray-500">
                      {txn.transactionDate.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
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
