import React, { useState } from 'react';
import { OriginalityCheckLogo } from './OriginalityCheckLogo';
import { InstallAppButton } from './InstallAppButton';
import {
  AlertCircle,
  Loader2,
  KeyRound,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getGoogleAuthErrorMessage } from '../lib/firebase';

export const AuthGate: React.FC = () => {
  const { signInWithGoogleAuth } = useApp();

  const [activeTab, setActiveTab] = useState<'google' | 'admin'>('google');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleGoogleAuth = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      await signInWithGoogleAuth();
    } catch (err: unknown) {
      // Suppress user-initiated popup dismissals — not a real error
      const msg = err instanceof Error ? err.message : String(err);
      if (
        msg.toLowerCase().includes('closed before') ||
        msg.toLowerCase().includes('popup-closed') ||
        msg.toLowerCase().includes('cancelled-popup') ||
        msg.toLowerCase().includes('closed by user')
      ) {
        // User just closed the popup — silently ignore
        setIsLoading(false);
        return;
      }
      const errorMsg = getGoogleAuthErrorMessage(err)
        || (err instanceof Error ? err.message : 'Google authentication failed');
      setErrorMessage(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="relative flex min-h-[100svh] w-full items-center justify-center overflow-hidden bg-[linear-gradient(135deg,#0b1020_0%,#1e1b4b_52%,#0f3b4a_100%)] px-4 py-8 font-['Plus_Jakarta_Sans',sans-serif] text-slate-100 sm:px-6"
      id="auth-gate-container"
    >
      <div className="relative z-10 mx-auto w-full max-w-md space-y-6">
          <div className="space-y-3 text-center">
            <div className="flex justify-center">
              <OriginalityCheckLogo size="md" variant="dark" showSubtitle={false} />
            </div>
            <p className="text-xs font-medium tracking-wide text-slate-300">
              A clearer view of your documents
            </p>
          </div>

        <div className="glass-panel space-y-6 rounded-2xl border border-white/10 bg-[#111a2d]/95 p-5 shadow-2xl shadow-black/30 ring-1 ring-indigo-300/10 sm:p-8">
          {/* Navigation Pill Switcher */}
          <div className="grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-[#0b1220] p-1" role="group" aria-label="Choose sign-in type">
            <button
              type="button"
              onClick={() => {
                setActiveTab('google');
                setErrorMessage(null);
              }}
              aria-pressed={activeTab === 'google'}
              className={`flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50 ${
                activeTab === 'google'
                  ? 'bg-indigo-500 text-white shadow-sm shadow-indigo-950/40'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>User Sign-In</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('admin');
                setErrorMessage(null);
              }}
              aria-pressed={activeTab === 'admin'}
              className={`flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50 ${
                activeTab === 'admin'
                  ? 'bg-indigo-500 text-white shadow-sm shadow-indigo-950/40'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              <KeyRound className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>Admin Portal</span>
            </button>
          </div>

          {/* TAB 1: Google User Sign-In */}
          {activeTab === 'google' && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="space-y-1 text-center">
                <span className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-300/20 bg-gradient-to-br from-indigo-400/20 to-cyan-300/10 text-cyan-200">
                  <Sparkles className="h-5 w-5" aria-hidden="true" />
                </span>
                <h2 className="text-2xl font-bold tracking-tight text-white">
                  Welcome back
                </h2>
                <p className="text-sm text-slate-300">
                  Sign in to check documents and manage reports.
                </p>
              </div>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleGoogleAuth}
                  disabled={isLoading}
                  id="btn-gate-google-auth"
                  className="group flex min-h-14 w-full cursor-pointer items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-bold text-slate-800 shadow-sm transition hover:border-cyan-200 hover:bg-slate-50 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-300/30 disabled:cursor-wait disabled:opacity-70"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
                      <span>Signing in with Google...</span>
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" aria-hidden="true">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                        />
                      </svg>
                      <span>Continue with Google</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: Administrator Portal */}
          {activeTab === 'admin' && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="space-y-1 text-center">
                <span className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-300/20 bg-gradient-to-br from-indigo-400/20 to-cyan-300/10 text-cyan-200">
                  <KeyRound className="h-5 w-5" aria-hidden="true" />
                </span>
                <h2 className="text-2xl font-bold tracking-tight text-white">
                  Admin sign-in
                </h2>
                <p className="text-sm text-slate-300">Sign in to continue to your admin workspace.</p>
              </div>

              {/* Submit Admin Button */}
              <button
                type="button"
                onClick={handleGoogleAuth}
                disabled={isLoading}
                id="btn-gate-admin-submit"
                className="flex min-h-14 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-950/30 transition hover:from-indigo-400 hover:to-cyan-500 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-300/30 disabled:cursor-wait disabled:opacity-70"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-white" />
                    <span>Opening Google sign-in...</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" />
                    <span>Continue with Google</span>
                  </>
                )}
              </button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('google');
                    setErrorMessage(null);
                  }}
                  className="min-h-11 cursor-pointer px-3 text-xs font-medium text-slate-300 underline underline-offset-4 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
                >
                  ← Return to User Sign-In
                </button>
              </div>
            </div>
          )}

          {/* Feedback messages */}
          {errorMessage && (
            <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-left text-xs text-rose-800 animate-in fade-in duration-200" role="alert">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
              <div className="space-y-1.5 flex-1">
                <p className="font-semibold text-rose-900">Sign-in failed</p>
                <p className="text-[11px] leading-relaxed text-rose-700">{errorMessage}</p>
              </div>
            </div>
          )}
        </div>
        <InstallAppButton variant="dark" />
      </div>
    </div>
  );
};
