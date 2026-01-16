import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Wallet, CreditCard, Target, RotateCcw, Tag } from 'lucide-react';

export const BottomNav = () => {
  const navItems = [
    { label: 'Dashboard', href: '/', icon: LayoutDashboard },
    { label: 'Accounts', href: '/accounts', icon: CreditCard },
    { label: 'Transactions', href: '/transactions', icon: Wallet },
    { label: 'Budgets', href: '/budgets', icon: Target },
    { label: 'Refunds', href: '/refunds', icon: RotateCcw },
    { label: 'Categories', href: '/categories', icon: Tag },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 md:hidden bg-white border-t border-gray-200 flex">
      {navItems.map(({ label, href, icon: Icon }) => (
        <NavLink
          key={href}
          to={href}
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center justify-center gap-1 py-3 transition-colors ${
              isActive
                ? 'text-blue-600 font-medium'
                : 'text-gray-600 hover:text-gray-900'
            }`
          }
        >
          <Icon size={24} />
          <span className="text-xs">{label}</span>
        </NavLink>
      ))}
    </div>
  );
};
