import { useState } from 'react';
import { useStore } from '../store';
import { formatCurrency } from '../utils/formatters';
import { updateAccountBalance } from '../services/api';

export const Accounts = () => {
  const { accounts, loadAccounts } = useStore();
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editBalance, setEditBalance] = useState<number | ''>('');
  const [saving, setSaving] = useState(false);
  const [editBalanceTime, setEditBalanceTime] = useState<string>('');
  const [hiddenBalances, setHiddenBalances] = useState<Set<string>>(new Set());

  const formatDateTimeLocal = (date: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const toggleBalanceVisibility = (accountId: string) => {
    const newHidden = new Set(hiddenBalances);
    if (newHidden.has(accountId)) {
      newHidden.delete(accountId);
    } else {
      newHidden.add(accountId);
    }
    setHiddenBalances(newHidden);
  };

  const startEdit = (accountId: string, currentBalance: number) => {
    setEditingAccountId(accountId);
    setEditBalance(currentBalance);
    setEditBalanceTime(formatDateTimeLocal(new Date()));
  };

  const cancelEdit = () => {
    setEditingAccountId(null);
    setEditBalance('');
    setEditBalanceTime('');
  };

  const saveEdit = async () => {
    if (!editingAccountId || editBalance === '') return;
    setSaving(true);
    try {
      const asOf = editBalanceTime ? new Date(editBalanceTime) : undefined;
      await updateAccountBalance(editingAccountId, Number(editBalance), asOf);
      await loadAccounts();
      cancelEdit();
      alert('Account balance updated.');
    } catch (err) {
      console.error('[Accounts] Failed to update balance', err);
      alert('Failed to update balance. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Accounts</h2>
        <p className="text-gray-600 dark:text-gray-300">Manage all your bank accounts in one place.</p>
      </div>

      {accounts.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-12 text-center">
          <p className="text-gray-500 dark:text-gray-300">No accounts found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 hover:shadow-md transition-shadow hover:border-violet-300 dark:hover:border-violet-500/40"
            >
              <div className="mb-6">
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">Bank Name</p>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white truncate" title={account.bankName}>
                  {account.bankName}
                </h3>
              </div>

              <div className="mb-6 pb-6 border-b border-gray-100 dark:border-slate-800">
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">Account Number</p>
                <p className="text-lg font-mono text-gray-700 dark:text-gray-200 break-all">
                  {account.accountNumber}
                </p>
              </div>

              <div className="mb-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">Current Balance</p>
                  <button
                    onClick={() => toggleBalanceVisibility(account.id)}
                    className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                    title={hiddenBalances.has(account.id) ? 'Show balance' : 'Hide balance'}
                  >
                    {hiddenBalances.has(account.id) ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-4.803m5.596-3.856a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0M15 12a3 3 0 11-6 0 3 3 0 016 0zm6 0c0 1.657-.672 3.157-1.757 4.243A6 6 0 0121 12a6 6 0 00-9.243-5.243" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                  {hiddenBalances.has(account.id) ? '••••••••' : formatCurrency(account.balance)}
                </p>
                {editingAccountId === account.id && (
                  <div className="mt-3 space-y-3">
                    <input
                      type="number"
                      value={editBalance as any}
                      onChange={(e) =>
                        setEditBalance(e.target.value === '' ? '' : Number(e.target.value))
                      }
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 rounded text-sm"
                      placeholder="Enter new balance"
                    />
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-300 mb-1">
                        Balance as of
                      </label>
                      <input
                        type="datetime-local"
                        value={editBalanceTime}
                        onChange={(e) => setEditBalanceTime(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 rounded text-sm"
                      />
                      <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                        We will apply all debits/credits after this time to keep the balance accurate.
                      </p>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={cancelEdit}
                        className="px-3 py-1 rounded border border-slate-300 dark:border-slate-700 text-sm"
                        disabled={saving}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={saveEdit}
                        className="px-3 py-1 rounded bg-violet-500 text-white text-sm disabled:bg-gray-400"
                        disabled={saving}
                      >
                        {saving ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <span
                  className={`text-xs font-medium px-3 py-1 rounded-full ${
                    account.balanceSource === 'sms'
                      ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  {account.balanceSource === 'sms' ? 'SMS Update' : 'Calculated'}
                </span>
                {editingAccountId !== account.id && (
                  <button
                    onClick={() => startEdit(account.id, account.balance)}
                    className="text-xs text-violet-600 dark:text-violet-300 hover:text-violet-700 dark:hover:text-violet-200 underline"
                  >
                    Edit balance
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
