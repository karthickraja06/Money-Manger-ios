import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Wallet, Target, Tag } from 'lucide-react';

export const Sidebar = () => {
  const navItems = [
    { label: 'Dashboard', href: '/', icon: LayoutDashboard },
    { label: 'Transactions', href: '/transactions', icon: Wallet },
    { label: 'Budgets', href: '/budgets', icon: Target },
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
              `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                isActive
                  ? 'bg-blue-600 text-white font-semibold shadow-md border-l-4 border-blue-700'
                  : 'text-gray-700 hover:bg-gray-50 border-l-4 border-transparent'
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
