import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X, AlertTriangle } from 'lucide-react';

interface ToastNotificationBannerProps {
  notification: {
    message: string;
    type: 'success' | 'error' | 'info';
  };
  onDismiss: () => void;
  durationSeconds?: number;
}

export const ToastNotificationBanner: React.FC<ToastNotificationBannerProps> = ({
  notification,
  onDismiss,
  durationSeconds = 5,
}) => {
  const [isExiting, setIsExiting] = useState(false);
  const [progress, setProgress] = useState(100);
  const onDismissRef = useRef(onDismiss);
  const pauseTimerRef = useRef<() => void>(() => {});
  const resumeTimerRef = useRef<() => void>(() => {});
  const dismissToastRef = useRef<() => void>(() => {});
  const isHoveredRef = useRef(false);
  const isFocusedRef = useRef(false);

  onDismissRef.current = onDismiss;

  useEffect(() => {
    const totalMs = durationSeconds * 1000;
    let remainingMs = totalMs;
    let startedAt = 0;
    let dismissTimer: number | undefined;
    let exitTimer: number | undefined;
    let rafId: number | undefined;

    const dismiss = () => {
      if (exitTimer !== undefined) return;
      if (dismissTimer !== undefined) window.clearTimeout(dismissTimer);
      if (rafId !== undefined) window.cancelAnimationFrame(rafId);
      dismissTimer = undefined;
      remainingMs = 0;
      setProgress(0);
      setIsExiting(true);
      exitTimer = window.setTimeout(() => onDismissRef.current(), 250);
    };

    const updateProgress = () => {
      if (dismissTimer === undefined) return;
      const elapsed = Date.now() - startedAt;
      const newProgress = Math.max(0, 100 - (elapsed / totalMs) * 100);
      setProgress(newProgress);
      if (newProgress > 0) {
        rafId = window.requestAnimationFrame(updateProgress);
      }
    };

    const resumeTimer = () => {
      if (dismissTimer !== undefined || remainingMs <= 0) return;
      startedAt = Date.now();
      dismissTimer = window.setTimeout(dismiss, remainingMs);
      rafId = window.requestAnimationFrame(updateProgress);
    };

    const pauseTimer = () => {
      if (dismissTimer === undefined) return;
      window.clearTimeout(dismissTimer);
      if (rafId !== undefined) window.cancelAnimationFrame(rafId);
      dismissTimer = undefined;
      rafId = undefined;
      remainingMs = Math.max(0, remainingMs - (Date.now() - startedAt));
    };

    pauseTimerRef.current = pauseTimer;
    resumeTimerRef.current = resumeTimer;
    dismissToastRef.current = dismiss;
    setIsExiting(false);
    setProgress(100);
    resumeTimer();

    return () => {
      if (dismissTimer !== undefined) window.clearTimeout(dismissTimer);
      if (exitTimer !== undefined) window.clearTimeout(exitTimer);
      if (rafId !== undefined) window.cancelAnimationFrame(rafId);
      pauseTimerRef.current = () => {};
      resumeTimerRef.current = () => {};
      dismissToastRef.current = () => {};
      isHoveredRef.current = false;
      isFocusedRef.current = false;
    };
  }, [durationSeconds, notification.message, notification.type]);

  const theme = {
    success: {
      wrapper: 'bg-gradient-to-br from-emerald-950 to-emerald-900 border-emerald-600/60 shadow-emerald-950/50',
      icon: <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400 drop-shadow-sm" aria-hidden="true" />,
      title: 'Success',
      titleColor: 'text-emerald-300',
      bar: 'bg-emerald-500',
      role: 'status' as const,
    },
    error: {
      wrapper: 'bg-gradient-to-br from-rose-950 to-rose-900 border-rose-600/60 shadow-rose-950/50',
      icon: <AlertCircle className="h-5 w-5 shrink-0 text-rose-400 drop-shadow-sm" aria-hidden="true" />,
      title: 'Error',
      titleColor: 'text-rose-300',
      bar: 'bg-rose-500',
      role: 'alert' as const,
    },
    info: {
      wrapper: 'bg-gradient-to-br from-slate-900 to-indigo-950 border-indigo-600/50 shadow-slate-950/50',
      icon: <Info className="h-5 w-5 shrink-0 text-indigo-400 drop-shadow-sm" aria-hidden="true" />,
      title: 'Info',
      titleColor: 'text-indigo-300',
      bar: 'bg-indigo-500',
      role: 'status' as const,
    },
  }[notification.type];

  return (
    <div
      className={`
        fixed inset-x-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[100]
        overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-xl
        transition-all duration-250
        sm:left-auto sm:right-4 sm:max-w-sm
        ${theme.wrapper}
        ${isExiting
          ? 'translate-y-[-12px] scale-95 opacity-0'
          : 'animate-in fade-in slide-in-from-top-4 duration-300'}
        motion-reduce:animate-none motion-reduce:transition-none
      `}
      role={theme.role}
      aria-live={notification.type === 'error' ? 'assertive' : 'polite'}
      aria-atomic="true"
      id="toast-notification-banner"
      onMouseEnter={() => {
        isHoveredRef.current = true;
        pauseTimerRef.current();
      }}
      onMouseLeave={() => {
        isHoveredRef.current = false;
        if (!isFocusedRef.current) resumeTimerRef.current();
      }}
      onFocusCapture={() => {
        isFocusedRef.current = true;
        pauseTimerRef.current();
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          isFocusedRef.current = false;
          if (!isHoveredRef.current) resumeTimerRef.current();
        }
      }}
    >
      {/* Content */}
      <div className="flex items-start gap-3 px-4 py-3.5">
        <div className="mt-0.5 shrink-0">{theme.icon}</div>

        <div className="min-w-0 flex-1">
          <p className={`text-xs font-bold uppercase tracking-wide ${theme.titleColor}`}>
            {theme.title}
          </p>
          <p className="mt-0.5 break-words text-sm leading-snug text-white/90">
            {notification.message}
          </p>
        </div>

        <button
          onClick={() => dismissToastRef.current()}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/40 transition hover:bg-white/10 hover:text-white/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          title="Dismiss"
          aria-label="Dismiss notification"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-0.5 w-full bg-white/10">
        <div
          className={`h-full ${theme.bar} transition-none`}
          style={{ width: `${progress}%` }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
};
