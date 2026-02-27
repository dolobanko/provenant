import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Bot, Globe, Settings, FlaskConical, Activity,
  MessageSquare, GitBranch, Shield, ClipboardList, LogOut, ArrowUpDown, ChevronRight, Key, Users, Webhook,
} from 'lucide-react';
import { clearAuth, getUser } from '../lib/auth';
import clsx from 'clsx';

const nav = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/agents', icon: Bot, label: 'Agents' },
  { to: '/environments', icon: Globe, label: 'Environments' },
  { to: '/promotions', icon: ArrowUpDown, label: 'Promotions' },
  { to: '/configs', icon: Settings, label: 'Configs' },
  { to: '/evals', icon: FlaskConical, label: 'Evaluations' },
  { to: '/drift', icon: Activity, label: 'Drift Detection' },
  { to: '/sessions', icon: MessageSquare, label: 'Sessions' },
  { to: '/integrations', icon: GitBranch, label: 'Integrations' },
  { to: '/policies', icon: Shield, label: 'Policies' },
  { to: '/audit', icon: ClipboardList, label: 'Audit Log' },
  { to: '/api-keys', icon: Key, label: 'API Keys' },
  { to: '/team', icon: Users, label: 'Team' },
  { to: '/webhooks', icon: Webhook, label: 'Webhooks' },
];

export function Layout() {
  const navigate = useNavigate();
  const user = getUser();

  function handleLogout() {
    clearAuth();
    navigate('/login');
  }

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
          {nav.map(({ to, icon: Icon, label }) => (
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

      {/* Main */}
      <main className="flex-1 overflow-y-auto bg-gray-950">
        <div className="max-w-7xl mx-auto p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
