import React from 'react';
import { useApp } from '../context/AppContext';
import { TurnitScopeLogo } from './TurnitScopeLogo';
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
    { id: 'reports', label: 'Reports', icon: FileText },
    { id: 'redeem', label: 'Redeem Code', icon: Ticket },
  ] as const;

  return (
    <aside
      className={`bg-white/95 border-b md:border-b-0 md:border-r border-slate-200/80 flex flex-col justify-start shrink-0 select-none md:sticky md:top-0 transition-all duration-200 z-20 w-full md:min-h-screen shadow-sm md:shadow-none ${
        isSidebarOpen ? 'md:w-64' : 'md:w-20'
      }`}
      id="client-sidebar"
    >
      {/* Top Section: Logo & Nav */}
      <div>
        {/* Logo & Toggle Header */}
        <div
          className={`border-b border-slate-100 flex items-center transition-all duration-200 ${
            isSidebarOpen ? 'p-4 justify-between gap-2' : 'p-3 flex-col gap-3 justify-center'
          }`}
        >
          {isSidebarOpen ? (
            <>
              <TurnitScopeLogo size="md" showSubtitle={true} subtitle="Academic Integrity" />
              <button
                onClick={toggleSidebar}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition shrink-0"
                title="Close sidebar"
                id="btn-sidebar-toggle-close"
                aria-label="Close sidebar"
              >
                <PanelLeftClose className="w-5 h-5" />
              </button>
            </>
          ) : (
            <>
              <TurnitScopeLogo size="sm" iconOnly={true} />
              <button
                onClick={toggleSidebar}
                className="p-1.5 rounded-xl text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition"
                title="Open sidebar"
                id="btn-sidebar-toggle-open"
                aria-label="Open sidebar"
              >
                <PanelLeftOpen className="w-5 h-5 text-indigo-600" />
              </button>
            </>
          )}
        </div>

        {/* Navigation items */}
        <nav className={`flex flex-row md:flex-col gap-1.5 overflow-x-auto md:overflow-visible transition-all duration-200 scrollbar-hide ${isSidebarOpen ? 'p-3 md:p-4' : 'p-2'}`} id="sidebar-nav">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`nav-${item.id}`}
                onClick={() => setActiveTab(item.id)}
                title={!isSidebarOpen ? item.label : undefined}
                className={`w-full min-w-[110px] flex items-center rounded-xl text-sm font-semibold transition-all duration-150 ${
                  isSidebarOpen ? 'gap-3.5 px-4 py-3' : 'justify-center p-3'
                } ${
                  isActive
                    ? 'bg-gradient-to-r from-[#4f46e5] to-[#6366f1] text-white shadow-md shadow-indigo-500/20'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                }`}
              >
                <Icon
                  className={`w-5 h-5 shrink-0 ${
                    isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'
                  }`}
                />
                {isSidebarOpen && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>
      </div>

    </aside>
  );
};
