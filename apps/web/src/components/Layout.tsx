import { useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Bot, MessageSquare, BarChart2,
  ArrowUpDown, Shield, ClipboardList, Settings,
  LogOut, ChevronRight, ChevronDown, Key, Users, Webhook, GitBranch, Globe,
} from 'lucide-react';
import { clearAuth, getUser } from '../lib/auth';
import clsx from 'clsx';

const mainNav = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Overview' },
  { to: '/conversations', icon: MessageSquare, label: 'Conversations' },
  { to: '/agents', icon: Bot, label: 'Agents' },
  { to: '/reports', icon: BarChart2, label: 'Reports' },
  { to: '/promotions', icon: ArrowUpDown, label: 'Deployments' },
  { to: '/policies', icon: Shield, label: 'Policies' },
  { to: '/audit', icon: ClipboardList, label: 'Audit Log' },
];

const settingsNav = [
  { to: '/api-keys', icon: Key, label: 'API Keys' },
  { to: '/team', icon: Users, label: 'Team' },
  { to: '/webhooks', icon: Webhook, label: 'Webhooks' },
  { to: '/integrations', icon: GitBranch, label: 'Integrations' },
  { to: '/environments', icon: Globe, label: 'Environments' },
  { to: '/configs', icon: Settings, label: 'Configs' },
];

export function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getUser();
  const [settingsOpen, setSettingsOpen] = useState(
    settingsNav.some((item) => location.pathname.startsWith(item.to)),
  );

  function handleLogout() {
    clearAuth();
    navigate('/login');
  }

  const isSettingsActive = settingsNav.some((item) => location.pathname.startsWith(item.to));

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="p-5 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center">
              <ChevronRight className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-white text-sm">Provenant</span>
          </div>
        </div>

        <nav className="flex-1 p-3 overflow-y-auto space-y-0.5">
          {mainNav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                  isActive
                    ? 'bg-brand-600/20 text-brand-400 font-medium'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800',
                )
              }
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </NavLink>
          ))}

          {/* Settings collapsible group */}
          <div className="pt-1">
            <button
              onClick={() => setSettingsOpen(!settingsOpen)}
              className={clsx(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors w-full',
                isSettingsActive
                  ? 'bg-brand-600/20 text-brand-400 font-medium'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800',
              )}
            >
              <Settings className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1 text-left">Settings</span>
              <ChevronDown
                className={clsx('w-3 h-3 transition-transform', settingsOpen && 'rotate-180')}
              />
            </button>
            {settingsOpen && (
              <div className="ml-3 mt-0.5 space-y-0.5 border-l border-gray-800 pl-3">
                {settingsNav.map(({ to, icon: Icon, label }) => (
                  <NavLink
                    key={to}
                    to={to}
                    className={({ isActive }) =>
                      clsx(
                        'flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-xs transition-colors',
                        isActive
                          ? 'bg-brand-600/20 text-brand-400 font-medium'
                          : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800',
                      )
                    }
                  >
                    <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                    {label}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        </nav>

        <div className="p-3 border-t border-gray-800">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-7 h-7 rounded-full bg-brand-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-gray-200 truncate">{user?.name}</p>
              <p className="text-xs text-gray-500 truncate">{user?.role}</p>
            </div>
            <button onClick={handleLogout} className="text-gray-500 hover:text-red-400 transition-colors">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-gray-950">
        <div className="max-w-7xl mx-auto p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
