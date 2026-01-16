import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { formatCurrency, calculateTotalBalance, calculateMonthlyExpense } from '../utils/formatters';
import { TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import { getBudgetAlerts, Budget } from '../services/api';

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

  const recentTransactions = transactions
    .sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime())
    .slice(0, 5);

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
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-600 mb-2">Monthly Expense</p>
          <h3 className="text-4xl font-bold text-red-600">
            {formatCurrency(monthlyExpense)}
          </h3>
          <p className="text-xs text-gray-500 mt-2">This month</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {accounts.map((account) => (
          <div
            key={account.id}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm text-gray-600 mb-1">{account.bankName}</p>
                <p className="text-xs text-gray-500">{account.accountNumber}</p>
              </div>
              <span
                className={`text-xs font-medium px-2 py-1 rounded ${
                  account.balanceSource === 'sms'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {account.balanceSource === 'sms' ? 'SMS' : 'Calculated'}
              </span>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {formatCurrency(account.balance)}
            </p>
          </div>
        ))}
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
    </div>
  );
};
