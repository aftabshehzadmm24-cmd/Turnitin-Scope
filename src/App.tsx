import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { ClientSidebar } from './components/ClientSidebar';
import { ClientHeader } from './components/ClientHeader';
import { DashboardView } from './components/DashboardView';
import { ReportsView } from './components/ReportsView';
import { RedeemCodeView } from './components/RedeemCodeView';
import { AdminPanel } from './components/AdminPanel';
import { ReportModal } from './components/ReportModal';
import { ScanProgressModal } from './components/ScanProgressModal';
import { ProfileEditModal } from './components/ProfileEditModal';
import { AuthGate } from './components/AuthGate';
import { TurnitScopeLogo } from './components/TurnitScopeLogo';
import { ToastNotificationBanner } from './components/ToastNotificationBanner';
import { ScanReport } from './types';
import { AlertCircle, Loader2 } from 'lucide-react';

const AppContent: React.FC = () => {
  const {
    currentUser,
    activePanel,
    activeTab,
    selectedReport,
    setSelectedReport,
    notification,
    setNotification,
    firebaseUser,
    isAuthLoading,
    isIdleWarning,
  } = useApp();

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
  const isAdmin = currentUser?.role === 'admin' && currentUser?.email?.toLowerCase() === 'admin@turnitscope.com';

  return (
    <>
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

      {isIdleWarning && (
        <div
          className="fixed top-4 right-4 z-50 flex max-w-md items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950 shadow-xl"
          role="alert"
          aria-live="assertive"
        >
          <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" />
          <p className="text-sm font-medium">
            You will be signed out in 30 seconds due to inactivity. Move, tap, or press a key to stay signed in.
          </p>
        </div>
      )}

      {/* Academic Profile & Account Settings Modal */}
      <ProfileEditModal />

      {/* Interactive Turnitin Report Inspection Modal */}
      {selectedReport && (
        <ReportModal
          report={selectedReport}
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
