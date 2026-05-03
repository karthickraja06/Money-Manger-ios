export interface Account {
  id: string;
  bankName: string;
  accountNumber: string;
  balance: number;
  balanceSource: 'sms' | 'calculated';
  accountType?: 'bank' | 'cash' | 'wallet' | 'credit_card';
  accountHolder?: string | null;
  accountNickname?: string | null;
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
  linked_refunds?: string[];
  is_refund_of?: string;
  refund_calculation_notes?: string;
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
  _id?: string;
  id?: string;
  name: string;
  type?: 'debit' | 'credit';
  parentCategory?: string;
  keywords?: string[];
  merchantPatterns?: string[];
  color?: string;
  icon?: string;
  isActive?: boolean;
  transactionCount?: number;
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

export interface Notification {
  id: string;
  type: 'budget_exceeded' | 'budget_warning' | 'sync_complete' | 'info';
  category?: string;
  spent?: number;
  limit?: number;
  percentage?: number;
  message: string;
  timestamp: Date;
  read: boolean;
  actionUrl?: string;
}

export interface SyncChange {
  id: string;
  entityType: 'transaction' | 'account' | 'budget' | 'category';
  entityId: string;
  changeType: 'created' | 'updated' | 'deleted';
  data: any;
  timestamp: number;
}

export interface SyncStats {
  total_changes: number;
  last_sync: number | null;
  current_timestamp: number;
  changes_by_type: Record<string, number>;
  changes_by_operation: Record<string, number>;
}
