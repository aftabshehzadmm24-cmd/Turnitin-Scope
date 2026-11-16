import React from 'react';
import { useApp } from '../context/AppContext';
import { OriginalityCheckLogo } from './OriginalityCheckLogo';
import {
  LayoutDashboard,
  FileText,
  Ticket,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';

export const ClientSidebar: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    isSidebarOpen,
    toggleSidebar,
  } = useApp();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'reports',   label: 'Reports',   icon: FileText },
    { id: 'redeem',    label: 'Redeem Code', icon: Ticket },
  ] as const;

  return (
    <aside
      className={`sticky top-0 z-40 flex w-full shrink-0 select-none flex-col justify-start border-b border-white/[0.06] bg-[#0d1526] pt-[env(safe-area-inset-top)] transition-all duration-200 md:static md:z-20 md:min-h-screen md:border-b-0 md:border-r ${
        isSidebarOpen ? 'md:w-64' : 'md:w-[72px]'
      }`}
      id="client-sidebar"
    >
      {/* Logo & Toggle */}
      <div
        className={`flex items-center border-b border-white/[0.06] transition-all duration-200 ${
          isSidebarOpen ? 'justify-between gap-2 px-4 py-2.5 md:py-4' : 'flex-col justify-center gap-3 px-3 py-4'
        }`}
      >
        {isSidebarOpen ? (
          <>
            <OriginalityCheckLogo size="sm" showSubtitle={false} variant="dark" />
            <button
              onClick={toggleSidebar}
              className="hidden shrink-0 rounded-lg p-2 text-slate-500 transition hover:bg-white/[0.07] hover:text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 md:block"
              title="Collapse sidebar"
              id="btn-sidebar-toggle-close"
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </>
        ) : (
          <>
            <OriginalityCheckLogo size="sm" iconOnly={true} variant="dark" />
            <button
              onClick={toggleSidebar}
              className="rounded-lg p-2 text-slate-500 transition hover:bg-indigo-500/10 hover:text-indigo-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
              title="Expand sidebar"
              id="btn-sidebar-toggle-open"
              aria-label="Expand sidebar"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          </>
        )}
      </div>

      {/* Navigation */}
      <nav
        aria-label="Main navigation"
        className={`grid grid-cols-3 gap-1 transition-all duration-200 md:flex md:flex-col md:overflow-visible ${
          isSidebarOpen ? 'px-2 py-2 md:p-3' : 'p-2'
        }`}
        id="sidebar-nav"
      >
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              id={`nav-${item.id}`}
              onClick={() => setActiveTab(item.id)}
              title={!isSidebarOpen ? item.label : undefined}
              aria-current={isActive ? 'page' : undefined}
              aria-label={item.label}
              className={`flex min-h-12 min-w-0 items-center justify-center rounded-xl text-[10px] font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 md:min-h-11 md:justify-start md:text-sm ${
                isSidebarOpen ? 'flex-col gap-1 px-1.5 py-1.5 md:flex-row md:gap-3 md:px-3.5 md:py-2.5' : 'md:justify-center md:p-2.5'
              } ${
                isActive
                  ? 'bg-blue-600/20 text-blue-200 ring-1 ring-blue-400/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.05]'
              }`}
            >
              <Icon
                aria-hidden="true"
                className={`h-[18px] w-[18px] shrink-0 ${
                  isActive ? 'text-blue-300' : 'text-slate-500'
                }`}
              />
              {isSidebarOpen && (
                <span className="max-w-full truncate text-center md:text-left">
                  <span className="md:hidden">{item.id === 'redeem' ? 'Redeem' : item.label}</span>
                  <span className="hidden md:inline">{item.label}</span>
                </span>
              )}
              {isSidebarOpen && isActive && (
                <span className="hidden h-1.5 w-1.5 rounded-full bg-blue-400 md:ml-auto md:block" />
              )}
            </button>
          );
        })}
      </nav>
    </aside>
  );
};
