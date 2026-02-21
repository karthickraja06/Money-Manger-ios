import { ReactNode, useEffect } from 'react';
import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';
import { useStore } from '../store';

interface AppLayoutProps {
  children: ReactNode;
}

export const AppLayout = ({ children }: AppLayoutProps) => {
  const { loadAccounts, loadTransactions } = useStore();
  const { viewMode } = useStore();

  useEffect(() => {
    // reload when app mounts or view mode changes
    loadAccounts();
    loadTransactions();
  }, [loadAccounts, loadTransactions, viewMode]);

  const { theme } = useStore();

  useEffect(() => {
    try {
      const root = document.documentElement;
      if (theme === 'dark') root.classList.add('dark');
      else root.classList.remove('dark');
    } catch (e) {}
  }, [theme]);

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <TopBar />
      <div className="flex flex-1 overflow-hidden pb-20 md:pb-0">
        <Sidebar />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
      <BottomNav />
    </div>
  );
};
