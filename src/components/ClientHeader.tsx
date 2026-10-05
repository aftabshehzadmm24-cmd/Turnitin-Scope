import React, { useState, useEffect, useRef } from 'react';
import { isAdminEmail, useApp } from '../context/AppContext';
import {
  Bell,
  Shield,
  Sparkles,
  X,
  CheckCircle,
  ArrowRight,
  LogOut,
  UserCog,
  CheckCheck,
} from 'lucide-react';

interface ClientHeaderProps {
  title: string;
  iconSuffix?: string;
}

export const ClientHeader: React.FC<ClientHeaderProps> = ({ title, iconSuffix }) => {
  const {
    currentUser,
    setActivePanel,
    setActiveTab,
    setIsProfileModalOpen,
    transactions,
    signOutAuth,
    notification,
    setNotification,
  } = useApp();

  const [showNotifications, setShowNotifications] = useState(false);
  const [hasActiveAlert, setHasActiveAlert] = useState(true);
  const [isDiminishing, setIsDiminishing] = useState(false);
  const [isDismissedManual, setIsDismissedManual] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-diminish notification after 5 seconds without any progress counters
  useEffect(() => {
    // Trigger active alert state when notification or transactions change
    setHasActiveAlert(true);
    setIsDiminishing(false);
    setIsDismissedManual(false);

    if (timerRef.current) clearTimeout(timerRef.current);

    // After 5 seconds, smoothly diminish the bell badge and ringing effect
    timerRef.current = setTimeout(() => {
      setIsDiminishing(true);
      setTimeout(() => {
        setHasActiveAlert(false);
        setIsDiminishing(false);
      }, 500);
    }, 5000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [notification, transactions.length]);

  const handleToggleNotifications = () => {
    const nextState = !showNotifications;
    setShowNotifications(nextState);
    if (nextState) {
      // User opened notification tray -> mark as read and diminish alert
      setHasActiveAlert(false);
      setIsDiminishing(false);
      if (timerRef.current) clearTimeout(timerRef.current);
    }
  };

  const handleMarkAllAsRead = () => {
    setIsDismissedManual(true);
    setHasActiveAlert(false);
    setIsDiminishing(false);
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  const recentAlerts = isDismissedManual
    ? []
    : transactions
        .filter(tx => tx.note !== 'Redeemed code: TC-WELCOME10')
        .filter(tx => tx.note !== 'Initial verified user balance')
        .slice(0, 4);

  return (
    <header className="border-b border-slate-200/80 bg-white/95 backdrop-blur-md px-3 sm:px-6 py-3 sm:py-0 h-auto sm:h-16 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sticky top-0 z-20">
      {/* Page Title with Emoji */}
      <div className="flex items-center gap-3 min-w-0 px-1 sm:px-0">
        <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight truncate" id="header-page-title">
          {title}{iconSuffix ? ` ${iconSuffix}` : ''}
        </h1>
      </div>

      {/* Right Controls: Notification Bell, Auth pill, Admin Panel Switcher */}
      <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-4 flex-wrap w-full sm:w-auto">
        {/* Notification Bell with 5s Diminishing Badge */}
        <div className="relative">
          <button
            onClick={handleToggleNotifications}
            className="relative p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition group focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            id="btn-header-bell"
            title={hasActiveAlert ? 'New Notifications' : 'Activity & Notifications'}
            aria-label="Notifications"
          >
            <Bell
              className={`w-5 h-5 transition-all duration-500 ${
                hasActiveAlert
                  ? 'text-amber-500 animate-bell-ring filter drop-shadow-[0_2px_8px_rgba(245,158,11,0.4)]'
                  : 'text-slate-500 group-hover:text-slate-800'
              }`}
            />
            <span
              className={`absolute top-1.5 right-1.5 pointer-events-none transition-all duration-700 ${
                hasActiveAlert
                  ? isDiminishing
                    ? 'opacity-0 scale-50 -translate-y-0.5'
                    : 'opacity-100 scale-100'
                  : 'opacity-0 scale-0'
              }`}
            >
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500 ring-2 ring-white shadow-sm"></span>
              </span>
            </span>
          </button>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-84 bg-white rounded-2xl shadow-xl border border-slate-200 p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-indigo-600" />
                  <span className="text-xs font-bold text-slate-900">Activity & Credit Alerts</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleMarkAllAsRead}
                    className="text-[11px] text-indigo-600 hover:text-indigo-800 font-medium px-2 py-0.5 rounded hover:bg-indigo-50 transition flex items-center gap-1"
                    title="Mark all as read"
                  >
                    <CheckCheck className="w-3 h-3" />
                    <span>Mark Read</span>
                  </button>
                  <button
                    onClick={() => setShowNotifications(false)}
                    className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
                    title="Close"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Active Alert Notice if alert is active */}
              {hasActiveAlert && (
                <div className="mt-2.5 px-3 py-1.5 rounded-lg bg-amber-50/80 border border-amber-200/80 text-[11px] text-amber-800 flex items-center gap-1.5 font-medium">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                  <span>New activity alert active</span>
                </div>
              )}

              {/* Recent Alerts List */}
              <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto mt-2">
                {recentAlerts.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400">
                    All caught up! No unread notifications
                  </div>
                ) : (
                  recentAlerts.map(tx => (
                    <div key={tx.id} className="py-2.5 flex items-start gap-2.5">
                      <div
                        className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                          tx.amount >= 0 ? 'bg-emerald-500' : 'bg-indigo-500'
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-800 truncate">
                          {tx.note}
                        </p>
                        <p className="text-[10px] text-slate-400">{tx.date}</p>
                      </div>
                      <span
                        className={`text-xs font-bold ${
                          tx.amount >= 0 ? 'text-emerald-600' : 'text-slate-600'
                        }`}
                      >
                        {tx.amount > 0 ? `+${tx.amount}` : tx.amount}
                      </span>
                    </div>
                  ))
                )}
              </div>

              <div className="pt-2.5 border-t border-slate-100 mt-2 flex items-center justify-between text-xs font-semibold">
                <button
                  onClick={() => {
                    setNotification({ message: 'Sample test notification alert triggered', type: 'info' });
                  }}
                  className="text-slate-500 hover:text-slate-800 text-[11px] py-1 font-medium transition"
                  title="Test notification"
                >
                  Test alert
                </button>
                <button
                  onClick={() => {
                    setShowNotifications(false);
                  }}
                  className="text-indigo-600 hover:text-indigo-800 py-1"
                >
                  Recent activity →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User Auth Profile & Sign Out */}
        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 rounded-xl p-1 shadow-sm min-w-0">
          <button
            onClick={() => setIsProfileModalOpen(true)}
            className="flex items-center gap-2 px-2 py-1 text-xs font-semibold text-slate-800 hover:bg-white rounded-lg transition cursor-pointer group min-w-0"
            id="header-user-badge"
            title="Click to view & edit your profile"
          >
            {currentUser.photoURL ? (
              <img
                src={currentUser.photoURL}
                alt={currentUser.name}
                className="w-6 h-6 rounded-full object-cover ring-1 ring-indigo-200 group-hover:ring-2 ring-indigo-500 transition"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-[10px] shadow-sm">
                {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
              </div>
            )}
            <span className="hidden sm:inline max-w-[70px] md:max-w-[120px] truncate font-bold text-slate-900 group-hover:text-indigo-600 transition">
              {currentUser.name}
            </span>
            <UserCog className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 transition ml-0.5 hidden sm:inline" />
          </button>

          <button
            onClick={() => signOutAuth()}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
            title="Sign Out of TurnitScope"
            id="btn-header-signout"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Switch to Admin Mode Button */}
        {currentUser.role === 'admin' && isAdminEmail(currentUser.email) && (
          <button
            onClick={() => setActivePanel('admin')}
            className="flex items-center gap-2 bg-gradient-to-r from-slate-900 to-indigo-950 hover:from-slate-800 hover:to-indigo-900 text-white text-[10px] sm:text-xs font-bold px-2.5 sm:px-3 py-2 rounded-xl shadow-sm transition group shrink-0"
            id="header-admin-pill"
            title="Open Admin Control Panel"
          >
            <Shield className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden lg:inline">Admin Panel</span>
            <span className="text-[10px] bg-amber-400/20 text-amber-300 font-semibold px-1.5 py-0.5 rounded hidden sm:inline">
              Credits
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition" />
          </button>
        )}
      </div>
    </header>
  );
};
