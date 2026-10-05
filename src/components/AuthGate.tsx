import React, { useState } from 'react';
import { TurnitScopeLogo } from './TurnitScopeLogo';
import {
  ShieldCheck,
  AlertCircle,
  Sparkles,
  Loader2,
  ShieldAlert,
  FileSearch,
  Cpu,
  Lock,
  KeyRound,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

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
      const msg = err instanceof Error ? err.message : 'Google authentication failed';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 bg-[#0a0f1d] text-slate-100 font-['Plus_Jakarta_Sans',sans-serif] relative overflow-hidden"
      id="auth-gate-container"
    >
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f293710_1px,transparent_1px),linear-gradient(to_bottom,#1f293710_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-5">
        {/* Brand & Security Notice */}
        <div className="text-center space-y-2.5">
          <div className="flex justify-center pb-1">
            <TurnitScopeLogo size="lg" variant="dark" showSubtitle={true} />
          </div>

          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-950/90 border border-indigo-500/30 text-indigo-300 text-xs font-semibold shadow-inner">
            <ShieldAlert className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span>Turnitin Similarity Engine • Institutional Gateway</span>
          </div>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Access institutional originality reports, AI similarity scoring, and academic citation analysis.
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-[#141c2e]/95 border border-slate-700/70 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl space-y-5">
          {/* Navigation Pill Switcher */}
          <div className="grid grid-cols-2 p-1 bg-slate-900/90 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => {
                setActiveTab('google');
                setErrorMessage(null);
              }}
              className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'google'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0">
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
              className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'admin'
                  ? 'bg-amber-500 text-slate-950 shadow font-extrabold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5 shrink-0" />
              <span>Admin Portal</span>
            </button>
          </div>

          {/* TAB 1: Google User Sign-In */}
          {activeTab === 'google' && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="text-center space-y-1">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  Academic Client Sign-In
                </h2>
                <p className="text-xs text-slate-400">
                  Instant access using your Google or institutional account.
                </p>
              </div>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleGoogleAuth}
                  disabled={isLoading}
                  id="btn-gate-google-auth"
                  className="w-full py-3.5 px-5 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-sm transition duration-150 flex items-center justify-center gap-3 shadow-xl active:scale-98 disabled:opacity-70 group cursor-pointer border border-slate-200"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin text-slate-700" />
                      <span>Signing in with Google...</span>
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0">
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
                      <span className="ml-auto text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                        Instant
                      </span>
                    </>
                  )}
                </button>
                <p className="text-[11px] text-slate-400 text-center leading-relaxed">
                  Compatible with institutional Google Workspace and personal Google accounts.
                </p>
              </div>

              {/* Quick switch to Admin */}
              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('admin');
                    setErrorMessage(null);
                  }}
                  className="text-xs text-amber-400/90 hover:text-amber-300 font-medium inline-flex items-center gap-1.5 cursor-pointer underline underline-offset-2 transition"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Master Administrator Login (Google) →</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: Administrator Portal */}
          {activeTab === 'admin' && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="text-center space-y-1">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  Admin Sign-In
                </h2>
              </div>

              {/* Submit Admin Button */}
              <button
                type="button"
                onClick={handleGoogleAuth}
                disabled={isLoading}
                id="btn-gate-admin-submit"
                className="w-full py-3 px-5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm transition duration-150 flex items-center justify-center gap-2 shadow-xl active:scale-98 disabled:opacity-70 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
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
                  className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer underline"
                >
                  ← Return to User Sign-In
                </button>
              </div>
            </div>
          )}

          {/* Feedback messages */}
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-950/60 border border-rose-500/50 text-rose-200 text-xs flex items-start gap-2.5 text-left animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1.5 flex-1">
                <p className="font-semibold text-rose-100">Authentication Notice</p>
                <p className="text-[11px] text-rose-200/90 leading-relaxed">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Features highlight */}
          {activeTab === 'google' && <div className="grid grid-cols-2 gap-2.5 pt-1">
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start gap-2.5">
              <FileSearch className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-white">Originality Check</p>
                <p className="text-[10px] text-slate-400 leading-tight mt-0.5">Cross-journal & repository matching</p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start gap-2.5">
              <Cpu className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-white">AI Content Score</p>
                <p className="text-[10px] text-slate-400 leading-tight mt-0.5">Linguistic entropy metrics</p>
              </div>
            </div>
          </div>}

          {/* Footer Security Badge */}
          {activeTab === 'google' && <div className="pt-2 border-t border-slate-700/50 flex items-center justify-center gap-2 text-[11px] text-slate-400">
            <Lock className="w-3.5 h-3.5 text-slate-500" />
            <span>Encrypted end-to-end via Firebase Cloud Identity</span>
          </div>}
        </div>
      </div>
    </div>
  );
};
