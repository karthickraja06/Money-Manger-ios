import { create } from 'zustand';
import { Account, Transaction } from '../types';
import { getAccounts, getTransactions } from '../services/api';

interface Store {
  accounts: Account[];
  transactions: Transaction[];
  selectedMonth: Date;
  viewMode: 'personal' | 'business';
  theme: 'light' | 'dark';
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
  loadAccounts: async () => {
    try {
      const accounts = await getAccounts();
      set({ accounts });
    } catch (err) {
      console.error('[Store] loadAccounts failed', err);
      set({ accounts: [] });
    }
  },
  loadTransactions: async () => {
    try {
      const transactions = await getTransactions();
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
