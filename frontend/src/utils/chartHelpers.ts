import { Transaction, Account } from '../types';
import { filterTransactionsByMonth } from './formatters';

export interface SpendingByAccount {
  name: string;
  amount: number;
  accountId: string;
  bankName?: string;
}

export interface SpendingByCategory {
  category: string;
  amount: number;
  percentage: number;
}

export interface MonthlyTrend {
  month: string;
  spend: number;
  income: number;
  net: number;
}

export interface MerchantSpending {
  merchant: string;
  amount: number;
  count: number;
  percentage: number;
}

export interface InsightData {
  topMerchant: {
    name: string;
    amount: number;
    count: number;
  } | null;
  averageTransaction: number;
  largestTransaction: {
    merchant: string;
    amount: number;
  } | null;
  smallestTransaction: {
    merchant: string;
    amount: number;
  } | null;
  transactionCount: number;
  averageDailySpend: number;
  daysWithSpending: number;
}

/**
 * Helper: Get display name for account (nickname > bankName > accountNumber)
 */
const getAccountDisplayName = (account: Account | undefined): string => {
  if (!account) return 'Unknown Account';
  if (account.accountNickname) return account.accountNickname;
  if (account.bankName) return account.bankName;
  return `Account ${account.accountNumber?.slice(-4) || '****'}`;
};

/**
 * Calculate spending by account for selected month
 */
export const calculateSpendingByAccount = (
  transactions: Transaction[],
  accounts: Account[],
  month: Date
): SpendingByAccount[] => {
  const monthTransactions = filterTransactionsByMonth(transactions, month);
  
  const accountMap = new Map<string, number>();
  
  monthTransactions.forEach((tx) => {
    if (tx.type === 'debit' && tx.accountId) {
      const current = accountMap.get(tx.accountId) || 0;
      accountMap.set(tx.accountId, current + tx.amount);
    }
  });

  return Array.from(accountMap.entries())
    .map(([accountId, amount]) => {
      const account = accounts.find((a) => a.id === accountId);
      return {
        name: getAccountDisplayName(account),
        amount: Math.round(amount * 100) / 100,
        accountId,
        bankName: account?.bankName,
      };
    })
    .sort((a, b) => b.amount - a.amount);
};

/**
 * Calculate spending by category for selected month
 */
export const calculateSpendingByCategory = (
  transactions: Transaction[],
  month: Date
): SpendingByCategory[] => {
  const monthTransactions = filterTransactionsByMonth(transactions, month);
  
  const categoryMap = new Map<string, number>();
  let totalSpend = 0;

  monthTransactions.forEach((tx) => {
    if (tx.type === 'debit') {
      const category = tx.category || 'Uncategorized';
      const current = categoryMap.get(category) || 0;
      categoryMap.set(category, current + tx.amount);
      totalSpend += tx.amount;
    }
  });

  return Array.from(categoryMap.entries())
    .map(([category, amount]) => ({
      category,
      amount: Math.round(amount * 100) / 100,
      percentage: totalSpend > 0 ? Math.round((amount / totalSpend) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
};

/**
 * Calculate monthly spending trends for last 12 months
 */
export const calculateMonthlyTrends = (
  transactions: Transaction[]
): MonthlyTrend[] => {
  const today = new Date();
  const trends: MonthlyTrend[] = [];

  // Get last 12 months
  for (let i = 11; i >= 0; i--) {
    const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const monthTransactions = filterTransactionsByMonth(transactions, date);

    const spend = monthTransactions
      .filter((t) => t.type === 'debit')
      .reduce((sum, t) => sum + t.amount, 0);

    const income = monthTransactions
      .filter((t) => t.type === 'credit')
      .reduce((sum, t) => sum + t.amount, 0);

    trends.push({
      month: date.toLocaleString('default', { month: 'short', year: '2-digit' }),
      spend: Math.round(spend * 100) / 100,
      income: Math.round(income * 100) / 100,
      net: Math.round((income - spend) * 100) / 100,
    });
  }

  return trends;
};

/**
 * Calculate merchant spending for selected month
 */
export const calculateMerchantSpending = (
  transactions: Transaction[],
  month: Date
): MerchantSpending[] => {
  const monthTransactions = filterTransactionsByMonth(transactions, month);

  const merchantMap = new Map<string, { amount: number; count: number }>();
  let totalSpend = 0;

  monthTransactions.forEach((tx) => {
    if (tx.type === 'debit') {
      const merchant = tx.merchantName || 'Unknown';
      const current = merchantMap.get(merchant) || { amount: 0, count: 0 };
      merchantMap.set(merchant, {
        amount: current.amount + tx.amount,
        count: current.count + 1,
      });
      totalSpend += tx.amount;
    }
  });

  return Array.from(merchantMap.entries())
    .map(([merchant, { amount, count }]) => ({
      merchant,
      amount: Math.round(amount * 100) / 100,
      count,
      percentage: totalSpend > 0 ? Math.round((amount / totalSpend) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10); // Top 10 merchants
};

/**
 * Generate insights from transactions
 */
export const generateInsights = (
  transactions: Transaction[],
  month: Date
): InsightData => {
  const monthTransactions = filterTransactionsByMonth(transactions, month);
  const debits = monthTransactions.filter((t) => t.type === 'debit');

  if (debits.length === 0) {
    return {
      topMerchant: null,
      averageTransaction: 0,
      largestTransaction: null,
      smallestTransaction: null,
      transactionCount: 0,
      averageDailySpend: 0,
      daysWithSpending: 0,
    };
  }

  // Calculate merchant spending for top merchant
  const merchantMap = new Map<string, number>();
  debits.forEach((tx) => {
    const merchant = tx.merchantName || 'Unknown';
    const current = merchantMap.get(merchant) || 0;
    merchantMap.set(merchant, current + tx.amount);
  });

  const topMerchantEntry = Array.from(merchantMap.entries()).reduce((prev, curr) =>
    curr[1] > prev[1] ? curr : prev
  );

  const topMerchantCount = debits.filter(
    (t) => t.merchantName === topMerchantEntry[0]
  ).length;

  // Calculate daily spending
  const dayMap = new Map<string, number>();
  debits.forEach((tx) => {
    const dateKey = tx.transactionDate.toDateString();
    const current = dayMap.get(dateKey) || 0;
    dayMap.set(dateKey, current + tx.amount);
  });

  const totalSpend = debits.reduce((sum, t) => sum + t.amount, 0);
  const daysInMonth = new Date(
    monthTransactions[0]?.transactionDate?.getFullYear() || new Date().getFullYear(),
    (monthTransactions[0]?.transactionDate?.getMonth() || new Date().getMonth()) + 1,
    0
  ).getDate();

  // Find largest and smallest transactions
  const sorted = [...debits].sort((a, b) => b.amount - a.amount);
  const largest = sorted[0];
  const smallest = sorted[sorted.length - 1];

  return {
    topMerchant: topMerchantEntry[0]
      ? {
          name: topMerchantEntry[0],
          amount: Math.round(topMerchantEntry[1] * 100) / 100,
          count: topMerchantCount,
        }
      : null,
    averageTransaction: Math.round((totalSpend / debits.length) * 100) / 100,
    largestTransaction: largest
      ? {
          merchant: largest.merchantName || 'Unknown',
          amount: largest.amount,
        }
      : null,
    smallestTransaction: smallest
      ? {
          merchant: smallest.merchantName || 'Unknown',
          amount: smallest.amount,
        }
      : null,
    transactionCount: debits.length,
    averageDailySpend: Math.round((totalSpend / daysInMonth) * 100) / 100,
    daysWithSpending: dayMap.size,
  };
};

/**
 * Get spending insights for selected accounts only
 */
export const calculateSpendingByAccountFiltered = (
  transactions: Transaction[],
  accounts: Account[],
  month: Date,
  selectedAccountIds: string[]
): SpendingByAccount[] => {
  const monthTransactions = filterTransactionsByMonth(transactions, month);
  const filtered = monthTransactions.filter(
    (tx) => selectedAccountIds.includes(tx.accountId) && tx.type === 'debit'
  );

  const accountMap = new Map<string, number>();

  filtered.forEach((tx) => {
    const current = accountMap.get(tx.accountId) || 0;
    accountMap.set(tx.accountId, current + tx.amount);
  });

  return Array.from(accountMap.entries())
    .map(([accountId, amount]) => {
      const account = accounts.find((a) => a.id === accountId);
      return {
        name: getAccountDisplayName(account),
        amount: Math.round(amount * 100) / 100,
        accountId,
        bankName: account?.bankName,
      };
    })
    .sort((a, b) => b.amount - a.amount);
};

/**
 * Get category spending for selected accounts
 */
export const calculateCategorySpendingFiltered = (
  transactions: Transaction[],
  month: Date,
  selectedAccountIds: string[]
): SpendingByCategory[] => {
  const monthTransactions = filterTransactionsByMonth(transactions, month);
  const filtered = monthTransactions.filter(
    (tx) =>
      selectedAccountIds.includes(tx.accountId) &&
      tx.type === 'debit'
  );

  const categoryMap = new Map<string, number>();
  let totalSpend = 0;

  filtered.forEach((tx) => {
    const category = tx.category || 'Uncategorized';
    const current = categoryMap.get(category) || 0;
    categoryMap.set(category, current + tx.amount);
    totalSpend += tx.amount;
  });

  return Array.from(categoryMap.entries())
    .map(([category, amount]) => ({
      category,
      amount: Math.round(amount * 100) / 100,
      percentage: totalSpend > 0 ? Math.round((amount / totalSpend) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
};
