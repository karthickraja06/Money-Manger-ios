import { format } from 'date-fns';

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount);
};

export const maskAccountNumber = (accountNumber: string): string => {
  return accountNumber;
};

export const formatDate = (date: Date): string => {
  return format(date, 'MMM d, yyyy');
};

export const formatDateShort = (date: Date): string => {
  return format(date, 'MMM d');
};

export const calculateTotalBalance = (accounts: { balance: number }[]): number => {
  return accounts.reduce((sum, account) => sum + account.balance, 0);
};

export const filterTransactionsByMonth = <T extends { transactionDate: Date }>(
  transactions: T[],
  month: Date
): T[] => {
  return transactions.filter(
    (t) =>
      t.transactionDate.getMonth() === month.getMonth() &&
      t.transactionDate.getFullYear() === month.getFullYear()
  );
};

export const calculateMonthlyExpense = (
  transactions: { transactionDate: Date; type: string; amount: number }[],
  month: Date
): number => {
  const monthTransactions = filterTransactionsByMonth(transactions, month);
  return monthTransactions
    .filter((t) => t.type === 'debit')
    .reduce((sum, t) => sum + t.amount, 0);
};
