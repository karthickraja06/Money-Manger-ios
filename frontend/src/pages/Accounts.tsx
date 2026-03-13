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

  const formatDateTimeLocal = (date: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
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
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Accounts</h2>
        <p className="text-gray-600">Manage all your bank accounts in one place.</p>
      </div>

      {accounts.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <p className="text-gray-500">No accounts found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow hover:border-blue-200"
            >
              <div className="mb-6">
                <p className="text-sm text-gray-600 mb-2">Bank Name</p>
                <h3 className="text-xl font-bold text-gray-900 truncate" title={account.bankName}>
                  {account.bankName}
                </h3>
              </div>

              <div className="mb-6 pb-6 border-b border-gray-100">
                <p className="text-sm text-gray-600 mb-2">Account Number</p>
                <p className="text-lg font-mono text-gray-700 break-all">
                  {account.accountNumber}
                </p>
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">Current Balance</p>
                <p className="text-3xl font-bold text-gray-900">
                  {formatCurrency(account.balance)}
                </p>
                {editingAccountId === account.id && (
                  <div className="mt-3 space-y-3">
                    <input
                      type="number"
                      value={editBalance as any}
                      onChange={(e) =>
                        setEditBalance(e.target.value === '' ? '' : Number(e.target.value))
                      }
                      className="w-full px-3 py-2 border rounded text-sm"
                      placeholder="Enter new balance"
                    />
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">
                        Balance as of
                      </label>
                      <input
                        type="datetime-local"
                        value={editBalanceTime}
                        onChange={(e) => setEditBalanceTime(e.target.value)}
                        className="w-full px-3 py-2 border rounded text-sm"
                      />
                      <p className="mt-1 text-[11px] text-gray-500">
                        We will apply all debits/credits after this time to keep the balance accurate.
                      </p>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={cancelEdit}
                        className="px-3 py-1 rounded border text-sm"
                        disabled={saving}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={saveEdit}
                        className="px-3 py-1 rounded bg-blue-600 text-white text-sm disabled:bg-gray-400"
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
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {account.balanceSource === 'sms' ? 'SMS Update' : 'Calculated'}
                </span>
                {editingAccountId !== account.id && (
                  <button
                    onClick={() => startEdit(account.id, account.balance)}
                    className="text-xs text-blue-600 hover:text-blue-700 underline"
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
