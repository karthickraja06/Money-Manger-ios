import { ReactNode, useEffect } from 'react';
import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';
import { SplashScreen } from './SplashScreen';
import { useStore } from '../store';

interface AppLayoutProps {
  children: ReactNode;
}

export const AppLayout = ({ children }: AppLayoutProps) => {
  const { loadAccounts, loadTransactions, viewMode, theme, isLoading } = useStore();

  useEffect(() => {
    // reload when app mounts or view mode changes
    console.log('[AppLayout] Mounting, loading accounts and transactions...');
    loadAccounts();
    loadTransactions();
  }, [loadAccounts, loadTransactions, viewMode]);

  useEffect(() => {
    try {
      const root = document.documentElement;
      if (theme === 'dark') root.classList.add('dark');
      else root.classList.remove('dark');
    } catch (e) {}
  }, [theme]);

  const isDark = theme === 'dark';

  return (
    <>
      <SplashScreen isLoading={isLoading} isDark={isDark} />
      <div className={`flex flex-col h-screen ${
        isDark ? 'bg-dark-bg text-dark-text-primary' : 'bg-gray-50 text-gray-900'
      } overflow-hidden transition-colors`}>
        <TopBar />
        <div className="flex flex-1 overflow-hidden pb-20 md:pb-0">
          <Sidebar />
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
        <BottomNav />
      </div>
    </>
  );
};
