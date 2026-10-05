import React, { useEffect, useRef, useState } from 'react';
import { AppProvider, isAdminEmail, useApp } from './context/AppContext';
import { ClientSidebar } from './components/ClientSidebar';
import { ClientHeader } from './components/ClientHeader';
import { DashboardView, RedeemCodeView } from './components/DashboardView';
import { ReportsView } from './components/ReportsView';
import { AdminPanel } from './components/AdminPanel';
import { ReportModal } from './components/ReportModal';
import { ScanProgressModal } from './components/ScanProgressModal';
import { ProfileEditModal } from './components/ProfileEditModal';
import { AuthGate } from './components/AuthGate';
import { TurnitScopeLogo } from './components/TurnitScopeLogo';
import { ToastNotificationBanner } from './components/ToastNotificationBanner';
import { ScanReport } from './types';
import { CheckCircle2, AlertCircle, Info, Loader2 } from 'lucide-react';

const IDLE_TIMEOUT_MS = 2 * 60 * 1000;
const IDLE_WARNING_MS = 30 * 1000;
const ACTIVITY_STORAGE_PREFIX = 'turnitscope:last-activity:';

const AppContent: React.FC = () => {
  const {
    currentUser,
    reports,
    activePanel,
    activeTab,
    selectedReport,
    setSelectedReport,
    notification,
    setNotification,
    firebaseUser,
    isAuthLoading,
    isScanning,
    signOutAuth,
  } = useApp();
  const [showIdleWarning, setShowIdleWarning] = useState(false);
  const signOutAuthRef = useRef(signOutAuth);
  signOutAuthRef.current = signOutAuth;

  useEffect(() => {
    if (!firebaseUser?.uid) {
      setShowIdleWarning(false);
      return;
    }

    const activityStorageKey = `${ACTIVITY_STORAGE_PREFIX}${firebaseUser.uid}`;
    let lastActivityWrite = Date.now();
    let isSigningOut = false;
    localStorage.setItem(activityStorageKey, String(lastActivityWrite));

    const recordActivity = () => {
      const now = Date.now();
      if (now - lastActivityWrite >= 10_000) {
        lastActivityWrite = now;
        localStorage.setItem(activityStorageKey, String(now));
      }
      setShowIdleWarning(false);
    };

    const checkIdleTime = () => {
      if (isScanning) {
        recordActivity();
        return;
      }

      const lastActivity = Number(localStorage.getItem(activityStorageKey)) || lastActivityWrite;
      const idleDuration = Date.now() - lastActivity;
      if (idleDuration >= IDLE_TIMEOUT_MS) {
        if (!isSigningOut) {
          isSigningOut = true;
          void signOutAuthRef.current();
        }
        return;
      }

      const shouldWarn = idleDuration >= IDLE_TIMEOUT_MS - IDLE_WARNING_MS;
      setShowIdleWarning(previous => previous === shouldWarn ? previous : shouldWarn);
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === activityStorageKey && event.newValue) {
        setShowIdleWarning(false);
      }
    };

    const activityEvents: Array<keyof WindowEventMap> = [
      'pointerdown',
      'keydown',
      'touchstart',
      'scroll',
      'mousemove',
    ];
    activityEvents.forEach(eventName => window.addEventListener(eventName, recordActivity, { passive: true }));
    window.addEventListener('storage', handleStorage);
    document.addEventListener('visibilitychange', recordActivity);
    const timer = window.setInterval(checkIdleTime, 5_000);

    return () => {
      window.clearInterval(timer);
      activityEvents.forEach(eventName => window.removeEventListener(eventName, recordActivity));
      window.removeEventListener('storage', handleStorage);
      document.removeEventListener('visibilitychange', recordActivity);
    };
  }, [firebaseUser?.uid, isScanning]);

  const getPageInfo = () => {
    switch (activeTab) {
      case 'dashboard':
        return { title: 'Dashboard', iconSuffix: '' };
      case 'reports':
        return { title: 'Reports', iconSuffix: '' };
      case 'redeem':
        return { title: 'Redeem Code', iconSuffix: '' };
      default:
        return { title: 'Dashboard', iconSuffix: '' };
    }
  };

  // While checking Firebase Auth status, show clean loading state
  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-[#0a0f1d] flex flex-col items-center justify-center gap-4 text-slate-100 font-['Plus_Jakarta_Sans',sans-serif]">
        <TurnitScopeLogo size="lg" showSubtitle={true} />
        <div className="flex items-center gap-2 text-indigo-400 text-sm mt-4">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Verifying authentication...</span>
        </div>
      </div>
    );
  }

  // Access is strictly restricted: Only registered and authenticated users can access the app
  if (!firebaseUser) {
    return <AuthGate />;
  }

  const pageInfo = getPageInfo() || { title: 'Dashboard', iconSuffix: '' };
  const isAdmin = currentUser?.role === 'admin' && isAdminEmail(currentUser.email);
  const reportForModal = selectedReport
    ? reports.find(report => report.id === selectedReport.id) || selectedReport
    : null;

  return (
    <>
      {showIdleWarning && (
        <div
          className="fixed left-1/2 top-3 z-[60] flex w-[calc(100%-1.5rem)] max-w-xl -translate-x-1/2 items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950 shadow-lg"
          role="alert"
          aria-live="assertive"
        >
          <span className="text-xs font-semibold">You’ll be signed out in about 30 seconds due to inactivity.</span>
          <button
            type="button"
            onClick={() => {
              localStorage.setItem(`${ACTIVITY_STORAGE_PREFIX}${firebaseUser.uid}`, String(Date.now()));
              setShowIdleWarning(false);
            }}
            className="shrink-0 rounded-lg bg-amber-200 px-3 py-1.5 text-xs font-bold hover:bg-amber-300"
          >
            Stay signed in
          </button>
        </div>
      )}
      {isAdmin ? (
        <AdminPanel />
      ) : (
        <div className="min-h-screen bg-[#f8fafc] flex flex-col md:flex-row relative font-['Plus_Jakarta_Sans',sans-serif] overflow-x-hidden" id="app-client-root">
          {/* Client Left Sidebar */}
          <ClientSidebar />

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Header */}
            <ClientHeader title={pageInfo.title} iconSuffix={pageInfo.iconSuffix} />

            {/* View Content */}
            <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl w-full mx-auto">
              {activeTab === 'dashboard' && (
                <DashboardView onOpenReport={(rep: ScanReport) => setSelectedReport(rep)} />
              )}
              {activeTab === 'reports' && (
                <ReportsView onOpenReport={(rep: ScanReport) => setSelectedReport(rep)} />
              )}
              {activeTab === 'redeem' && <RedeemCodeView />}
            </main>
          </div>
        </div>
      )}

      {/* Profile Settings Modal */}
      <ProfileEditModal />

      {/* Interactive Turnitin Report Inspection Modal */}
      {reportForModal && (
        <ReportModal
          report={reportForModal}
          onClose={() => setSelectedReport(null)}
        />
      )}

      {/* Scan Processing Modal Animation */}
      <ScanProgressModal />

      {/* Toast Notification Banner with Auto-Diminish after 5s */}
      {notification && (
        <ToastNotificationBanner
          notification={notification}
          onDismiss={() => setNotification(null)}
          durationSeconds={5}
        />
      )}
    </>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
