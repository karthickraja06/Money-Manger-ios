import { create } from 'zustand';
import { Account, Transaction } from '../types';
import { getAccounts, getTransactions } from '../services/api';

interface Store {
  accounts: Account[];
  transactions: Transaction[];
  selectedMonth: Date;
  loadAccounts: () => Promise<void>;
  loadTransactions: () => Promise<void>;
  setSelectedMonth: (month: Date) => void;
}

export const useStore = create<Store>((set) => ({
  accounts: [],
  transactions: [],
  selectedMonth: new Date(),
  loadAccounts: async () => {
    const accounts = await getAccounts();
    set({ accounts });
  },
  loadTransactions: async () => {
    const transactions = await getTransactions();
    set({ transactions });
  },
  setSelectedMonth: (month: Date) => {
    set({ selectedMonth: month });
  },
}));
