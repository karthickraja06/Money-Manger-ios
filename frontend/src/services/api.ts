import { Account, Transaction, Budget, Category, RefundPair, BudgetAlert, NetSpend } from '../types';

const mockAccounts: Account[] = [
  {
    id: 'acc-1',
    bankName: 'Chase Bank',
    accountNumber: '****1234',
    balance: 4285.50,
    balanceSource: 'sms',
  },
  {
    id: 'acc-2',
    bankName: 'Bank of America',
    accountNumber: '****5678',
    balance: 8920.75,
    balanceSource: 'sms',
  },
  {
    id: 'acc-3',
    bankName: 'Wells Fargo',
    accountNumber: '****9012',
    balance: 2145.30,
    balanceSource: 'calculated',
  },
];

const mockTransactions: Transaction[] = [
  {
    id: 'txn-1',
    merchantName: 'Starbucks',
    amount: 5.80,
    accountId: 'acc-1',
    transactionDate: new Date(2026, 0, 14),
    type: 'debit',
  },
  {
    id: 'txn-2',
    merchantName: 'Amazon',
    amount: 45.99,
    accountId: 'acc-2',
    transactionDate: new Date(2026, 0, 14),
    type: 'debit',
  },
  {
    id: 'txn-3',
    merchantName: 'Salary Deposit',
    amount: 3500.00,
    accountId: 'acc-1',
    transactionDate: new Date(2026, 0, 13),
    type: 'credit',
  },
  {
    id: 'txn-4',
    merchantName: 'Whole Foods',
    amount: 87.42,
    accountId: 'acc-2',
    transactionDate: new Date(2026, 0, 12),
    type: 'debit',
  },
  {
    id: 'txn-5',
    merchantName: 'Netflix',
    amount: 15.99,
    accountId: 'acc-1',
    transactionDate: new Date(2026, 0, 10),
    type: 'debit',
  },
  {
    id: 'txn-6',
    merchantName: 'Gas Station',
    amount: 52.30,
    accountId: 'acc-3',
    transactionDate: new Date(2026, 0, 9),
    type: 'debit',
  },
  {
    id: 'txn-7',
    merchantName: 'Target',
    amount: 125.43,
    accountId: 'acc-2',
    transactionDate: new Date(2026, 0, 8),
    type: 'debit',
  },
  {
    id: 'txn-8',
    merchantName: 'Uber',
    amount: 28.50,
    accountId: 'acc-1',
    transactionDate: new Date(2026, 0, 7),
    type: 'debit',
  },
  {
    id: 'txn-9',
    merchantName: 'Restaurant XYZ',
    amount: 68.25,
    accountId: 'acc-3',
    transactionDate: new Date(2026, 0, 6),
    type: 'debit',
  },
  {
    id: 'txn-10',
    merchantName: 'Apple iTunes',
    amount: 9.99,
    accountId: 'acc-1',
    transactionDate: new Date(2026, 0, 5),
    type: 'debit',
  },
  {
    id: 'txn-11',
    merchantName: 'Gym Membership',
    amount: 49.99,
    accountId: 'acc-2',
    transactionDate: new Date(2026, 0, 4),
    type: 'debit',
  },
  {
    id: 'txn-12',
    merchantName: 'Refund',
    amount: 25.00,
    accountId: 'acc-1',
    transactionDate: new Date(2026, 0, 3),
    type: 'credit',
  },
  {
    id: 'txn-13',
    merchantName: 'Pharmacy',
    amount: 32.15,
    accountId: 'acc-2',
    transactionDate: new Date(2026, 0, 2),
    type: 'debit',
  },
  {
    id: 'txn-14',
    merchantName: 'Hotel Booking',
    amount: 250.00,
    accountId: 'acc-3',
    transactionDate: new Date(2025, 11, 31),
    type: 'debit',
  },
  {
    id: 'txn-15',
    merchantName: 'Online Store',
    amount: 89.50,
    accountId: 'acc-1',
    transactionDate: new Date(2025, 11, 30),
    type: 'debit',
  },
];

export const getAccounts = async (): Promise<Account[]> => {
  return new Promise(resolve => {
    setTimeout(() => resolve(mockAccounts), 300);
  });
};

export const getTransactions = async (): Promise<Transaction[]> => {
  return new Promise(resolve => {
    setTimeout(() => resolve(mockTransactions), 300);
  });
};

const mockBudgets: Budget[] = [
  {
    id: 'budget-1',
    category: 'Dining',
    monthlyLimit: 5000,
    spent: 3200,
    remaining: 1800,
    percentage: 64,
    transactionCount: 12,
    alertThreshold: 80,
    isExceeding: false,
    isNearLimit: false,
  },
  {
    id: 'budget-2',
    category: 'Entertainment',
    monthlyLimit: 2000,
    spent: 1800,
    remaining: 200,
    percentage: 90,
    transactionCount: 5,
    alertThreshold: 80,
    isExceeding: false,
    isNearLimit: true,
  },
  {
    id: 'budget-3',
    category: 'Transport',
    monthlyLimit: 1500,
    spent: 1650,
    remaining: -150,
    percentage: 110,
    transactionCount: 8,
    alertThreshold: 80,
    isExceeding: true,
    isNearLimit: false,
  },
  {
    id: 'budget-4',
    category: 'Shopping',
    monthlyLimit: 3000,
    spent: 1200,
    remaining: 1800,
    percentage: 40,
    transactionCount: 6,
    alertThreshold: 80,
    isExceeding: false,
    isNearLimit: false,
  },
  {
    id: 'budget-5',
    category: 'Groceries',
    monthlyLimit: 4000,
    spent: 2400,
    remaining: 1600,
    percentage: 60,
    transactionCount: 15,
    alertThreshold: 80,
    isExceeding: false,
    isNearLimit: false,
  },
];

const mockCategories: Category[] = [
  {
    id: 'cat-1',
    name: 'Restaurant',
    parentCategory: 'Dining',
    keywords: ['zomato', 'swiggy', 'restaurant'],
    merchantPatterns: [],
    color: '#FF6B6B',
    isActive: true,
    transactionCount: 8,
  },
  {
    id: 'cat-2',
    name: 'Coffee Shop',
    parentCategory: 'Dining',
    keywords: ['starbucks', 'coffee', 'cafe'],
    merchantPatterns: [],
    color: '#8B5A3C',
    isActive: true,
    transactionCount: 12,
  },
  {
    id: 'cat-3',
    name: 'Movies',
    parentCategory: 'Entertainment',
    keywords: ['netflix', 'prime', 'movie'],
    merchantPatterns: [],
    color: '#FF1493',
    isActive: true,
    transactionCount: 3,
  },
  {
    id: 'cat-4',
    name: 'Fuel',
    parentCategory: 'Transport',
    keywords: ['petrol', 'gas', 'fuel'],
    merchantPatterns: [],
    color: '#FFD700',
    isActive: true,
    transactionCount: 6,
  },
];

const mockRefundPairs: RefundPair[] = [
  {
    original: {
      id: 'txn-2',
      amount: 45.99,
      merchant: 'Amazon',
      type: 'debit',
    },
    refund: {
      id: 'txn-12',
      amount: 45.99,
      merchant: 'Amazon Refund',
      type: 'credit',
      transactionTime: new Date(2026, 0, 5),
    },
    linkedDate: new Date(2026, 0, 5),
  },
];

export const getBudgets = async (): Promise<Budget[]> => {
  return new Promise(resolve => {
    setTimeout(() => resolve(mockBudgets), 300);
  });
};

export const getBudgetAlerts = async (): Promise<BudgetAlert> => {
  return new Promise(resolve => {
    setTimeout(() => {
      const exceeding = mockBudgets.filter(b => b.isExceeding);
      const nearLimit = mockBudgets.filter(b => b.isNearLimit);
      resolve({
        exceeding,
        nearLimit,
        allCategories: mockBudgets,
      });
    }, 300);
  });
};

export const createBudget = async (budget: Partial<Budget>): Promise<Budget> => {
  return new Promise(resolve => {
    setTimeout(() => {
      const newBudget: Budget = {
        id: `budget-${Date.now()}`,
        category: budget.category || 'Other',
        monthlyLimit: budget.monthlyLimit || 0,
        spent: 0,
        remaining: budget.monthlyLimit || 0,
        percentage: 0,
        transactionCount: 0,
        alertThreshold: 80,
        isExceeding: false,
        isNearLimit: false,
      };
      resolve(newBudget);
    }, 300);
  });
};

export const updateBudget = async (id: string, updates: Partial<Budget>): Promise<Budget> => {
  return new Promise(resolve => {
    setTimeout(() => {
      const budget = mockBudgets.find(b => b.id === id);
      if (budget) {
        Object.assign(budget, updates);
        resolve(budget);
      }
    }, 300);
  });
};

export const deleteBudget = async (id: string): Promise<void> => {
  return new Promise(resolve => {
    setTimeout(() => {
      const index = mockBudgets.findIndex(b => b.id === id);
      if (index > -1) mockBudgets.splice(index, 1);
      resolve();
    }, 300);
  });
};

export const getCategories = async (): Promise<Category[]> => {
  return new Promise(resolve => {
    setTimeout(() => resolve(mockCategories), 300);
  });
};

export const createCategory = async (category: Partial<Category>): Promise<Category> => {
  return new Promise(resolve => {
    setTimeout(() => {
      const newCategory: Category = {
        id: `cat-${Date.now()}`,
        name: category.name || 'New Category',
        parentCategory: category.parentCategory || 'Other',
        keywords: category.keywords || [],
        merchantPatterns: category.merchantPatterns || [],
        color: category.color || '#808080',
        isActive: true,
        transactionCount: 0,
      };
      resolve(newCategory);
    }, 300);
  });
};

export const getRefundPairs = async (): Promise<RefundPair[]> => {
  return new Promise(resolve => {
    setTimeout(() => resolve(mockRefundPairs), 300);
  });
};

export const linkRefund = async (originalTxId: string, refundTxId: string): Promise<RefundPair> => {
  return new Promise(resolve => {
    setTimeout(() => {
      const original = mockTransactions.find(t => t.id === originalTxId);
      const refund = mockTransactions.find(t => t.id === refundTxId);
      if (original && refund) {
        const pair: RefundPair = {
          original: {
            id: original.id,
            amount: original.amount,
            merchant: original.merchantName,
            type: original.type,
          },
          refund: {
            id: refund.id,
            amount: refund.amount,
            merchant: refund.merchantName,
            type: refund.type,
            transactionTime: refund.transactionDate,
          },
          linkedDate: new Date(),
        };
        mockRefundPairs.push(pair);
        resolve(pair);
      }
    }, 300);
  });
};

export const unlinkRefund = async (originalTxId: string): Promise<void> => {
  return new Promise(resolve => {
    setTimeout(() => {
      const index = mockRefundPairs.findIndex(p => p.original.id === originalTxId);
      if (index > -1) mockRefundPairs.splice(index, 1);
      resolve();
    }, 300);
  });
};

export const getNetSpend = async (startDate: Date, endDate: Date): Promise<NetSpend> => {
  return new Promise(resolve => {
    setTimeout(() => {
      const debits = mockTransactions
        .filter(t => t.type === 'debit' && !t.isRefund && t.transactionDate >= startDate && t.transactionDate <= endDate)
        .reduce((sum, t) => sum + t.amount, 0);

      const refunded = mockRefundPairs.reduce((sum, p) => sum + p.refund.amount, 0);

      resolve({
        totalDebits: debits,
        totalRefunded: refunded,
        netSpend: debits - refunded,
        refundCount: mockRefundPairs.length,
      });
    }, 300);
  });
};

export const autoCategorizeTransactions = async (): Promise<{ updated: number; total: number }> => {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve({ updated: mockTransactions.length, total: mockTransactions.length });
    }, 300);
  });
}
