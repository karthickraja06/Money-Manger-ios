import React, { useState } from 'react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  Line,
} from 'recharts';
import { Account, Transaction } from '../types';
import {
  calculateSpendingByAccount,
  calculateSpendingByCategory,
  calculateMonthlyTrends,
  calculateMerchantSpending,
  generateInsights,
  calculateSpendingByAccountFiltered,
  calculateCategorySpendingFiltered,
} from '../utils/chartHelpers';
import { formatCurrency } from '../utils/formatters';

const COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#F97316', // orange
  '#6366F1', // indigo
  '#14B8A6', // teal
];

interface ChartsProps {
  transactions: Transaction[];
  accounts: Account[];
  selectedMonth: Date;
}

interface TooltipPayload {
  name?: string;
  value?: number;
  payload?: any;
}

const CustomTooltip: React.FC<{ active?: boolean; payload?: TooltipPayload[] }> = ({
  active,
  payload,
}) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white p-2 border border-gray-300 rounded shadow-lg text-xs">
        <p className="font-semibold">{data.name || data.category || data.month || data.merchant}</p>
        {data.amount && <p className="text-gray-600">{formatCurrency(data.amount)}</p>}
        {data.spend && (
          <>
            <p className="text-red-600">Spend: {formatCurrency(data.spend)}</p>
            <p className="text-green-600">Income: {formatCurrency(data.income)}</p>
          </>
        )}
        {data.percentage && <p className="text-gray-600">{data.percentage}%</p>}
        {data.count && <p className="text-gray-600">Transactions: {data.count}</p>}
      </div>
    );
  }
  return null;
};

export const SpendingByAccountChart: React.FC<
  ChartsProps & { selectedAccounts?: string[] }
> = ({ transactions, accounts, selectedMonth, selectedAccounts }) => {
  const data = selectedAccounts
    ? calculateSpendingByAccountFiltered(transactions, accounts, selectedMonth, selectedAccounts)
    : calculateSpendingByAccount(transactions, accounts, selectedMonth);

  if (data.length === 0) {
    return (
      <div className="bg-gray-50 p-6 rounded-lg text-center">
        <p className="text-gray-500">No spending data available for this period</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-4 rounded-lg border border-gray-200">
      <h3 className="text-lg font-semibold mb-4">Spending by Account</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="name"
            angle={-45}
            textAnchor="end"
            height={100}
            interval={0}
            tick={{ fontSize: 12 }}
          />
          <YAxis
            tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
            tick={{ fontSize: 12 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="amount" fill="#3B82F6" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-4 grid grid-cols-2 gap-4">
        {data.map((item, idx) => (
          <div key={idx} className="bg-gray-50 p-3 rounded">
            <p className="text-sm text-gray-600">{item.bankName || 'Account'}</p>
            <p className="text-lg font-semibold">{formatCurrency(item.amount)}</p>
            <p className="text-xs text-gray-500 mt-1">
              {item.name}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export const CategoryWiseSpendingChart: React.FC<
  ChartsProps & { selectedAccounts?: string[] }
> = ({ transactions, selectedMonth, selectedAccounts }) => {
  const data = selectedAccounts
    ? calculateCategorySpendingFiltered(transactions, selectedMonth, selectedAccounts)
    : calculateSpendingByCategory(transactions, selectedMonth);

  if (data.length === 0) {
    return (
      <div className="bg-gray-50 p-6 rounded-lg text-center">
        <p className="text-gray-500">No spending data available for this period</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-4 rounded-lg border border-gray-200">
      <h3 className="text-lg font-semibold mb-4">Spending by Category</h3>
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ category, percentage }: { category: string; percentage: number }) => `${category}: ${percentage}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="amount"
              >
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 space-y-2 max-h-80 overflow-y-auto">
          {data.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded">
              <div className="flex items-center gap-3 flex-1">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                />
                <div className="flex-1">
                  <p className="font-medium text-sm">{item.category}</p>
                  <div className="flex gap-2 text-xs text-gray-500">
                    <span>{item.percentage}%</span>
                  </div>
                </div>
              </div>
              <p className="font-semibold">{formatCurrency(item.amount)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const MonthlyTrendsChart: React.FC<ChartsProps> = ({ transactions }) => {
  const data = calculateMonthlyTrends(transactions);

  return (
    <div className="bg-white p-4 rounded-lg border border-gray-200">
      <h3 className="text-lg font-semibold mb-4">12-Month Spending Trends</h3>
      <ResponsiveContainer width="100%" height={350}>
        <ComposedChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="month"
            angle={-45}
            textAnchor="end"
            height={80}
            tick={{ fontSize: 12 }}
          />
          <YAxis tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`} />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Line
            type="monotone"
            dataKey="spend"
            stroke="#EF4444"
            name="Spending"
            strokeWidth={2}
            dot={{ fill: '#EF4444' }}
          />
          <Line
            type="monotone"
            dataKey="income"
            stroke="#10B981"
            name="Income"
            strokeWidth={2}
            dot={{ fill: '#10B981' }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export const MerchantAnalysisChart: React.FC<ChartsProps> = ({
  transactions,
  selectedMonth,
}) => {
  const data = calculateMerchantSpending(transactions, selectedMonth);

  if (data.length === 0) {
    return (
      <div className="bg-gray-50 p-6 rounded-lg text-center">
        <p className="text-gray-500">No merchant data available for this period</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-4 rounded-lg border border-gray-200">
      <h3 className="text-lg font-semibold mb-4">Top Merchants</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="merchant"
            angle={-45}
            textAnchor="end"
            height={100}
            interval={0}
            tick={{ fontSize: 12 }}
          />
          <YAxis tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`} />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="amount" fill="#8B5CF6" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-4 space-y-2">
        {data.map((item, idx) => (
          <div key={idx} className="flex justify-between items-center p-2 bg-gray-50 rounded">
            <div>
              <p className="font-medium text-sm">{item.merchant}</p>
              <p className="text-xs text-gray-500">{item.count} transactions</p>
            </div>
            <div className="text-right">
              <p className="font-semibold">{formatCurrency(item.amount)}</p>
              <p className="text-xs text-gray-500">{item.percentage}%</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const InsightsPanel: React.FC<ChartsProps> = ({
  transactions,
  selectedMonth,
}) => {
  const insights = generateInsights(transactions, selectedMonth);

  if (insights.transactionCount === 0) {
    return (
      <div className="bg-gray-50 p-6 rounded-lg text-center">
        <p className="text-gray-500">No transactions for this period</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <p className="text-sm text-gray-600 mb-1">Total Transactions</p>
        <p className="text-3xl font-bold">{insights.transactionCount}</p>
      </div>

      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <p className="text-sm text-gray-600 mb-1">Avg Transaction</p>
        <p className="text-3xl font-bold">{formatCurrency(insights.averageTransaction)}</p>
      </div>

      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <p className="text-sm text-gray-600 mb-1">Avg Daily Spend</p>
        <p className="text-3xl font-bold">{formatCurrency(insights.averageDailySpend)}</p>
      </div>

      {insights.topMerchant && (
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
          <p className="text-sm text-blue-700 font-semibold mb-2">Top Merchant</p>
          <p className="text-xl font-bold text-blue-900">{insights.topMerchant.name}</p>
          <p className="text-sm text-blue-700 mt-1">
            {insights.topMerchant.count} transactions
          </p>
          <p className="text-lg font-semibold text-blue-900">
            {formatCurrency(insights.topMerchant.amount)}
          </p>
        </div>
      )}

      {insights.largestTransaction && (
        <div className="bg-gradient-to-br from-red-50 to-red-100 p-4 rounded-lg border border-red-200">
          <p className="text-sm text-red-700 font-semibold mb-2">Largest Transaction</p>
          <p className="text-lg font-bold text-red-900">{insights.largestTransaction.merchant}</p>
          <p className="text-2xl font-bold text-red-900">
            {formatCurrency(insights.largestTransaction.amount)}
          </p>
        </div>
      )}

      {insights.smallestTransaction && (
        <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
          <p className="text-sm text-green-700 font-semibold mb-2">Smallest Transaction</p>
          <p className="text-lg font-bold text-green-900">{insights.smallestTransaction.merchant}</p>
          <p className="text-2xl font-bold text-green-900">
            {formatCurrency(insights.smallestTransaction.amount)}
          </p>
        </div>
      )}

      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <p className="text-sm text-gray-600 mb-1">Days With Spending</p>
        <p className="text-3xl font-bold">{insights.daysWithSpending}</p>
      </div>
    </div>
  );
};

export const ChartsPanel: React.FC<ChartsProps & { selectedAccounts?: string[] }> = ({
  transactions,
  accounts,
  selectedMonth,
  selectedAccounts,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'accounts' | 'category' | 'merchants' | 'trends'>('overview');

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex gap-2 overflow-x-auto border-b border-gray-200 pb-4">
        {[
          { id: 'overview', label: '📊 Overview' },
          { id: 'accounts', label: '🏦 By Account' },
          { id: 'category', label: '🏷️ Categories' },
          { id: 'merchants', label: '🛍️ Merchants' },
          { id: 'trends', label: '📈 Trends' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'overview' && <InsightsPanel transactions={transactions} accounts={accounts} selectedMonth={selectedMonth} />}
      {activeTab === 'accounts' && (
        <SpendingByAccountChart
          transactions={transactions}
          accounts={accounts}
          selectedMonth={selectedMonth}
          selectedAccounts={selectedAccounts}
        />
      )}
      {activeTab === 'category' && (
        <CategoryWiseSpendingChart
          transactions={transactions}
          accounts={accounts}
          selectedMonth={selectedMonth}
          selectedAccounts={selectedAccounts}
        />
      )}
      {activeTab === 'merchants' && (
        <MerchantAnalysisChart transactions={transactions} accounts={accounts} selectedMonth={selectedMonth} />
      )}
      {activeTab === 'trends' && (
        <MonthlyTrendsChart transactions={transactions} accounts={accounts} selectedMonth={selectedMonth} />
      )}
    </div>
  );
};
