import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Wallet, Target, Tag, BarChart3 } from 'lucide-react';

export const BottomNav = () => {
  const navItems = [
    { label: 'Dashboard', href: '/', icon: LayoutDashboard },
    { label: 'Transactions', href: '/transactions', icon: Wallet },
    { label: 'Analytics', href: '/analytics', icon: BarChart3 },
    { label: 'Budgets', href: '/budgets', icon: Target },
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
                ? 'text-blue-600 font-medium border-t-2 border-blue-600'
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
