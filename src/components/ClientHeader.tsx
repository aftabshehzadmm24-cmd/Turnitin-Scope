import React, { useState, useEffect, useRef } from 'react';
import { isAdminEmail, useApp } from '../context/AppContext';
import {
  Bell,
  Shield,
  X,
  ArrowRight,
  LogOut,
  UserCog,
  CheckCheck,
  Moon,
  Sun,
} from 'lucide-react';
import { InstallAppButton } from './InstallAppButton';

interface ClientHeaderProps {
  title: string;
  iconSuffix?: string;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
}

export const ClientHeader: React.FC<ClientHeaderProps> = ({
  title,
  iconSuffix,
  isDarkMode,
  onToggleDarkMode,
}) => {
  const {
    currentUser,
    setActivePanel,
    setActiveTab,
    setIsProfileModalOpen,
    transactions,
    signOutAuth,
    notification,
  } = useApp();

  const [showNotifications, setShowNotifications] = useState(false);
  const [hasActiveAlert, setHasActiveAlert] = useState(true);
  const [isDiminishing, setIsDiminishing] = useState(false);
  const [isDismissedManual, setIsDismissedManual] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const alertDismissTimerRef = useRef<NodeJS.Timeout | null>(null);
  const notificationPanelRef = useRef<HTMLDivElement>(null);
  const notificationButtonRef = useRef<HTMLButtonElement>(null);

  // Auto-diminish notification after 5 seconds without any progress counters
  useEffect(() => {
    // Trigger active alert state when notification or transactions change
    setHasActiveAlert(true);
    setIsDiminishing(false);
    setIsDismissedManual(false);

    if (timerRef.current) clearTimeout(timerRef.current);
    if (alertDismissTimerRef.current) clearTimeout(alertDismissTimerRef.current);

    // After 5 seconds, smoothly diminish the bell badge and ringing effect
    timerRef.current = setTimeout(() => {
      setIsDiminishing(true);
      alertDismissTimerRef.current = setTimeout(() => {
        setHasActiveAlert(false);
        setIsDiminishing(false);
      }, 500);
    }, 5000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (alertDismissTimerRef.current) clearTimeout(alertDismissTimerRef.current);
    };
  }, [notification, transactions.length]);

  useEffect(() => {
    if (!showNotifications) return;

    const handleOutsidePointer = (event: PointerEvent) => {
      if (!notificationPanelRef.current?.contains(event.target as Node)
        && !notificationButtonRef.current?.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowNotifications(false);
        notificationButtonRef.current?.focus();
      }
    };

    document.addEventListener('pointerdown', handleOutsidePointer);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handleOutsidePointer);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showNotifications]);

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
    <header className="relative z-20 flex min-h-14 items-center justify-between gap-2 border-b border-slate-200/80 bg-white/95 px-3 py-2 backdrop-blur-md sm:sticky sm:top-0 sm:min-h-16 sm:px-6 sm:py-0">
      <div className="flex min-w-0 items-center gap-3">
        <h1 className="truncate text-base font-bold tracking-tight text-slate-900 sm:text-xl" id="header-page-title">
          {title}{iconSuffix ? ` ${iconSuffix}` : ''}
        </h1>
      </div>

      {/* Right Controls: Notification Bell, Auth pill, Admin Panel Switcher */}
      <div className="flex w-auto shrink-0 items-center justify-end gap-1.5 sm:gap-3">
        <button
          type="button"
          onClick={onToggleDarkMode}
          className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
          aria-label={`Switch to ${isDarkMode ? 'light' : 'dark'} mode`}
          aria-pressed={isDarkMode}
          title={`Switch to ${isDarkMode ? 'light' : 'dark'} mode`}
        >
          {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        {/* Notification Bell with 5s Diminishing Badge */}
        <div className="relative">
          <button
            onClick={handleToggleNotifications}
            className="group relative flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 sm:h-11 sm:w-11"
            id="btn-header-bell"
            title={hasActiveAlert ? 'New Notifications' : 'Activity & Notifications'}
            aria-label="Notifications"
            aria-expanded={showNotifications}
            aria-controls="header-notifications-panel"
            ref={notificationButtonRef}
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
            <div
              ref={notificationPanelRef}
              id="header-notifications-panel"
              role="dialog"
              aria-labelledby="header-notifications-title"
              className="fixed inset-x-3 top-[calc(env(safe-area-inset-top)+7.5rem)] z-[60] max-h-[min(70vh,32rem)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-xl animate-in fade-in slide-in-from-top-2 duration-150 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[min(24rem,calc(100vw-2rem))]"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-indigo-600" />
                  <span id="header-notifications-title" className="text-xs font-bold text-slate-900">Activity & Credit Alerts</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleMarkAllAsRead}
                    className="flex min-h-11 items-center gap-1 rounded-lg px-2 text-[11px] font-medium text-indigo-600 transition hover:bg-indigo-50 hover:text-indigo-800"
                    title="Mark all as read"
                  >
                    <CheckCheck className="w-3 h-3" />
                    <span>Mark Read</span>
                  </button>
                  <button
                    onClick={() => setShowNotifications(false)}
                    className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
                    title="Close"
                    aria-label="Close notifications"
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
              <div className="mt-2 divide-y divide-slate-100">
                {recentAlerts.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400">
                    All caught up! No unread notifications
                  </div>
                ) : (
                  recentAlerts.map(tx => {
                    const isScanDeduction = tx.type === 'scan_deduction' || (Boolean(tx.note) && tx.note.toLowerCase().includes('scanned document'));
                    const displayAmount = isScanDeduction ? -1 : (tx.amount === -5 ? -1 : tx.amount);
                    return (
                    <div key={tx.id} className="py-2.5 flex items-start gap-2.5">
                      <div
                        className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                          displayAmount >= 0 ? 'bg-emerald-500' : 'bg-indigo-500'
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
                          displayAmount >= 0 ? 'text-emerald-600' : 'text-slate-600'
                        }`}
                      >
                        {displayAmount > 0 ? `+${displayAmount}` : displayAmount}
                      </span>
                    </div>
                  );})
                )}
              </div>

              <div className="mt-2 border-t border-slate-100 pt-3 text-center text-[11px] text-slate-500">
                Credit and scan activity for this account
              </div>
            </div>
          )}
        </div>

        <InstallAppButton compact />

        {/* User Auth Profile & Sign Out */}
        <div className="flex min-w-0 items-center gap-1 rounded-xl border border-slate-200/80 bg-slate-50 p-1 shadow-sm">
          <button
            onClick={() => setIsProfileModalOpen(true)}
            className="group flex min-h-9 min-w-0 items-center gap-2 rounded-lg px-1.5 py-1 text-xs font-semibold text-slate-800 transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 sm:px-2"
            id="header-user-badge"
            title="Click to view & edit your profile"
            aria-label={`Open profile settings for ${currentUser.name || 'your account'}`}
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
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
            title="Sign Out of TurnitScope"
            id="btn-header-signout"
            aria-label="Sign out"
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
