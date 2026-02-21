import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { formatCurrency, calculateTotalBalance, calculateMonthlyExpense, filterTransactionsByMonth } from '../utils/formatters';
import { TrendingUp, TrendingDown, AlertCircle, ChevronRight } from 'lucide-react';
import { getBudgetAlerts, getAccountDetails, createManualTransaction } from '../services/api';
import { BottomSheet } from '../components/BottomSheet';
import { Budget } from '../types';

export const Dashboard = () => {
  const { accounts, transactions, selectedMonth } = useStore();
  const [budgetAlerts, setBudgetAlerts] = useState<Budget[]>([]);

  useEffect(() => {
    loadBudgetAlerts();
  }, []);

  const loadBudgetAlerts = async () => {
    try {
      const data = await getBudgetAlerts();
      setBudgetAlerts([...data.exceeding, ...data.nearLimit]);
    } catch (error) {
      console.error('Error loading budget alerts:', error);
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

  const { loadAccounts, loadTransactions } = useStore();

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
      await createManualTransaction({ amount: Number(cashAmount), merchant: cashMerchant, notes: cashNotes, transaction_time: new Date().toISOString() });
      // reload data
      await loadTransactions();
      await loadAccounts();
      setCashAmount('');
      setCashMerchant('Cash Spend');
      setCashNotes('');
      closeCashForm();
    } catch (err) {
      console.error('Failed to create cash spend', err);
      alert('Failed to create cash spend');
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h2>
        <p className="text-gray-600">Welcome back! Here's your financial overview.</p>
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
          {accounts.map((account, idx) => (
            <button
              key={account.id}
              onClick={() => openAccount(account)}
              className={`min-w-[260px] flex-shrink-0 bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-transform transform ${idx === 0 ? 'scale-100' : 'scale-95'}`}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-sm text-gray-600 mb-1">{account.bankName}</p>
                  <p className="text-xs text-gray-500">{account.accountNumber}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium px-2 py-1 rounded ${account.balanceSource === 'sms' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                    {account.balanceSource === 'sms' ? 'SMS' : 'Calculated'}
                  </span>
                  <ChevronRight size={18} className="text-gray-400" />
                </div>
              </div>

              <p className="text-2xl font-bold text-gray-900">{formatCurrency(account.balance)}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Credit cards stacked preview */}
      <div className="mb-6">
        <p className="text-sm text-gray-600 mb-2">Credit Cards</p>
        <div className="relative h-40">
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
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{txn.merchantName}</p>
                      <p className="text-sm text-gray-500">
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
        {accountDetails ? (
          <div>
            <h3 className="text-lg font-semibold mb-2">{accountDetails.account?.bank_name || selectedAccount?.bankName}</h3>
            <p className="text-sm text-gray-500 mb-4">{accountDetails.account?.account_number || selectedAccount?.accountNumber}</p>

            <div className="space-y-3">
              {(accountDetails.recent_transactions || accountDetails.account?.recent_transactions || []).map((tx: any) => (
                <div key={tx.id || tx._id} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{tx.merchant || tx.merchantName}</p>
                    <p className="text-sm text-gray-500">{new Date(tx.transaction_time || tx.transactionDate || tx.transaction_time).toLocaleString()}</p>
                  </div>
                  <div className={`font-semibold ${tx.type === 'debit' ? 'text-red-600' : 'text-green-600'}`}>{(tx.type === 'debit' ? '-' : '+')}{formatCurrency(tx.amount || tx.net_amount)}</div>
                </div>
              ))}
            </div>
          </div>
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
