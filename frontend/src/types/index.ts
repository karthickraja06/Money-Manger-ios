export interface Account {
  id: string;
  bankName: string;
  accountNumber: string;
  balance: number;
  balanceSource: 'sms' | 'calculated';
  accountType?: 'bank' | 'cash' | 'wallet' | 'credit_card';
  accountHolder?: string | null;
}

export interface Transaction {
  id: string;
  merchantName: string;
  amount: number;
  accountId: string;
  transactionDate: Date;
  type: 'debit' | 'credit';
  category?: string;
  tags?: string[];
  notes?: string;
  receiverName?: string;
  senderName?: string;
  refundLinkedId?: string;
  isRefund?: boolean;
}

export interface Budget {
  id: string;
  category: string;
  monthlyLimit: number;
  spent: number;
  remaining: number;
  percentage: number;
  transactionCount: number;
  alertThreshold: number;
  isExceeding: boolean;
  isNearLimit: boolean;
}

export interface Category {
  id: string;
  name: string;
  parentCategory: string;
  keywords: string[];
  merchantPatterns: string[];
  color: string;
  icon?: string;
  isActive: boolean;
  transactionCount: number;
}

export interface RefundPair {
  original: {
    id: string;
    amount: number;
    merchant: string;
    type: 'debit' | 'credit';
  };
  refund: {
    id: string;
    amount: number;
    merchant: string;
    type: 'debit' | 'credit';
    transactionTime: Date;
  };
  linkedDate: Date;
}

export interface BudgetAlert {
  exceeding: Budget[];
  nearLimit: Budget[];
  allCategories: Budget[];
}

export interface NetSpend {
  totalDebits: number;
  totalRefunded: number;
  netSpend: number;
  refundCount: number;
}

export interface AppState {
  accounts: Account[];
  transactions: Transaction[];
  budgets: Budget[];
  categories: Category[];
  selectedMonth: Date;
}
