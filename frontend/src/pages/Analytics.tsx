import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Calendar, Filter } from 'lucide-react';
import {
  ChartsPanel,
  InsightsPanel,
} from '../components/Charts';

export const Analytics = () => {
  const navigate = useNavigate();
  const { transactions, accounts, selectedMonth, setSelectedMonth } = useStore();
  const [displayMonth, setDisplayMonth] = useState(selectedMonth);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [showAccountFilter, setShowAccountFilter] = useState(false);

  // Auto-select all accounts on first load
  useEffect(() => {
    if (selectedAccountIds.length === 0 && accounts.length > 0) {
      setSelectedAccountIds(accounts.map((a) => a.id));
    }
  }, [accounts]);

  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const date = new Date(e.target.value);
    setDisplayMonth(date);
    setSelectedMonth(date);
  };

  const toggleAccount = (accountId: string) => {
    setSelectedAccountIds((prev) =>
      prev.includes(accountId)
        ? prev.filter((id) => id !== accountId)
        : [...prev, accountId]
    );
  };

  const toggleAllAccounts = () => {
    if (selectedAccountIds.length === accounts.length) {
      setSelectedAccountIds([]);
    } else {
      setSelectedAccountIds(accounts.map((a) => a.id));
    }
  };

  const monthInputValue = displayMonth.toISOString().split('T')[0];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <h1 className="text-2xl font-bold">Analytics & Insights</h1>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white border-b border-gray-200 sticky top-16 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
          {/* Month Selector */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gray-600" />
              <label className="text-sm font-medium text-gray-700">Select Month:</label>
              <input
                type="month"
                value={monthInputValue}
                onChange={handleMonthChange}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Account Filter */}
          <div className="relative">
            <button
              onClick={() => setShowAccountFilter(!showAccountFilter)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors font-medium"
            >
              <Filter className="w-4 h-4" />
              Accounts ({selectedAccountIds.length}/{accounts.length})
            </button>

            {showAccountFilter && (
              <div className="absolute top-full left-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-50 w-80">
                <div className="space-y-3">
                  {/* Select All */}
                  <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-gray-50 rounded">
                    <input
                      type="checkbox"
                      checked={selectedAccountIds.length === accounts.length && accounts.length > 0}
                      onChange={toggleAllAccounts}
                      className="w-4 h-4 rounded"
                    />
                    <span className="font-medium">Select All Accounts</span>
                  </label>

                  <div className="border-t border-gray-200 pt-2 max-h-64 overflow-y-auto">
                    {accounts.map((account) => (
                      <label
                        key={account.id}
                        className="flex items-center gap-3 cursor-pointer p-2 hover:bg-gray-50 rounded"
                      >
                        <input
                          type="checkbox"
                          checked={selectedAccountIds.includes(account.id)}
                          onChange={() => toggleAccount(account.id)}
                          className="w-4 h-4 rounded"
                        />
                        <div className="flex-1">
                          <p className="font-medium text-sm">{account.bankName}</p>
                          <p className="text-xs text-gray-500">
                            •••• {account.accountNumber.slice(-4)}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Selected Accounts Display */}
          {selectedAccountIds.length > 0 && selectedAccountIds.length < accounts.length && (
            <div className="flex flex-wrap gap-2">
              {accounts
                .filter((a) => selectedAccountIds.includes(a.id))
                .map((account) => (
                  <div
                    key={account.id}
                    className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm flex items-center gap-2"
                  >
                    {account.bankName} (•••• {account.accountNumber.slice(-4)})
                    <button
                      onClick={() => toggleAccount(account.id)}
                      className="ml-1 hover:text-blue-900 font-bold"
                    >
                      ×
                    </button>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Key Insights */}
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4">Key Insights</h2>
          <InsightsPanel
            transactions={transactions}
            accounts={accounts}
            selectedMonth={displayMonth}
          />
        </div>

        {/* Charts */}
        <div className="mb-8">
          <ChartsPanel
            transactions={transactions}
            accounts={accounts}
            selectedMonth={displayMonth}
            selectedAccounts={selectedAccountIds.length > 0 ? selectedAccountIds : undefined}
          />
        </div>
      </div>
    </div>
  );
};
