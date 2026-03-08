import { create } from 'zustand';
import { Account, Transaction } from '../types';
import { getAccounts, getTransactions } from '../services/api';

interface Store {
  accounts: Account[];
  transactions: Transaction[];
  selectedMonth: Date;
  viewMode: 'personal' | 'business';
  theme: 'light' | 'dark';
  isLoading: boolean;
  loadAccounts: () => Promise<void>;
  loadTransactions: () => Promise<void>;
  setSelectedMonth: (month: Date) => void;
  setViewMode: (mode: 'personal' | 'business') => void;
  setTheme: (t: 'light' | 'dark') => void;
}

export const useStore = create<Store>((set) => ({
  accounts: [],
  transactions: [],
  selectedMonth: new Date(),
  viewMode: 'personal',
  theme: (localStorage.getItem('app_theme') as 'light' | 'dark') || 'light',
  isLoading: true,
  loadAccounts: async () => {
    set({ isLoading: true });
    try {
      const accounts = await getAccounts();
      console.log('[Store] loadAccounts success:', accounts);
      set({ accounts, isLoading: false });
    } catch (err) {
      console.error('[Store] loadAccounts failed', err);
      set({ accounts: [], isLoading: false });
    }
  },
  loadTransactions: async () => {
    try {
      const transactions = await getTransactions();
      console.log('[Store] loadTransactions success:', transactions.length, 'transactions');
      set({ transactions });
    } catch (err) {
      console.error('[Store] loadTransactions failed', err);
      set({ transactions: [] });
    }
  },
  setSelectedMonth: (month: Date) => {
    set({ selectedMonth: month });
  },
  setViewMode: (mode: 'personal' | 'business') => {
    set({ viewMode: mode });
  }
  ,
  setTheme: (t: 'light' | 'dark') => {
    set({ theme: t });
    try { localStorage.setItem('app_theme', t); } catch (e) {}
  }
}));
