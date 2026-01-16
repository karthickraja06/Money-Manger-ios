import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Wallet, CreditCard, Target, RotateCcw, Tag } from 'lucide-react';

export const Sidebar = () => {
  const navItems = [
    { label: 'Dashboard', href: '/', icon: LayoutDashboard },
    { label: 'Accounts', href: '/accounts', icon: CreditCard },
    { label: 'Transactions', href: '/transactions', icon: Wallet },
    { label: 'Budgets', href: '/budgets', icon: Target },
    { label: 'Refunds', href: '/refunds', icon: RotateCcw },
    { label: 'Categories', href: '/categories', icon: Tag },
  ];

  return (
    <div className="hidden md:flex flex-col w-64 bg-white border-r border-gray-200 h-[calc(100vh-64px)]">
      <nav className="flex-1 px-4 py-8 space-y-2">
        {navItems.map(({ label, href, icon: Icon }) => (
          <NavLink
            key={href}
            to={href}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? 'bg-blue-50 text-blue-600 font-medium'
                  : 'text-gray-700 hover:bg-gray-50'
              }`
            }
          >
            <Icon size={20} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
};
