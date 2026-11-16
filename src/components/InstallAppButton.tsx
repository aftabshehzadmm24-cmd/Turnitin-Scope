import React, { useEffect, useState } from 'react';
import { Download } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

let deferredInstallPrompt: BeforeInstallPromptEvent | null = null;
const installPromptSubscribers = new Set<(prompt: BeforeInstallPromptEvent | null) => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', event => {
    const installEvent = event as BeforeInstallPromptEvent;
    installEvent.preventDefault();
    deferredInstallPrompt = installEvent;
    installPromptSubscribers.forEach(subscriber => subscriber(installEvent));
  });
}

interface InstallAppButtonProps {
  variant?: 'dark' | 'light';
  compact?: boolean;
}

export const InstallAppButton: React.FC<InstallAppButtonProps> = ({
  variant = 'light',
  compact = false,
}) => {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(deferredInstallPrompt);
  const [isInstalled, setIsInstalled] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const handleInstallPromptChange = (prompt: BeforeInstallPromptEvent | null) => {
      setInstallPrompt(prompt);
    };
    const handleAppInstalled = () => {
      setIsInstalled(true);
      deferredInstallPrompt = null;
      installPromptSubscribers.forEach(subscriber => subscriber(null));
      setInstallPrompt(null);
      setMessage('TurnitScope has been installed.');
    };

    setIsInstalled(window.matchMedia('(display-mode: standalone)').matches);
    installPromptSubscribers.add(handleInstallPromptChange);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      installPromptSubscribers.delete(handleInstallPromptChange);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    setMessage('');
    if (!installPrompt) {
      const isAppleMobile = /iPhone|iPad|iPod/i.test(navigator.userAgent);
      setMessage(isAppleMobile
        ? 'To install, tap Share in Safari, then choose “Add to Home Screen”.'
        : 'Open your browser menu and choose “Install app” or “Add to Home Screen”.');
      return;
    }

    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setMessage('Installing TurnitScope...');
      }
      deferredInstallPrompt = null;
      installPromptSubscribers.forEach(subscriber => subscriber(null));
      setInstallPrompt(null);
    } catch (error) {
      console.error('Could not open the app install prompt:', error);
      setMessage('Could not open the install prompt. Try your browser menu instead.');
    }
  };

  if (isInstalled) return null;

  return (
    <div className={`relative ${compact ? '' : 'flex flex-col items-center gap-2'}`}>
      <button
        type="button"
        onClick={handleInstall}
        className={variant === 'dark'
          ? compact
            ? 'flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-slate-200 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50'
            : 'flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-cyan-200/40 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50'
          : compact
            ? 'flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-indigo-50 hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40'
            : 'flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40'
        }
        aria-label="Install TurnitScope app"
        title="Install app"
      >
        <Download className="h-4 w-4 shrink-0" aria-hidden="true" />
        {!compact && <span>Install app</span>}
      </button>
      {message && (
        <p
          className={`${
            compact
              ? 'absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-3 text-left text-xs leading-relaxed text-slate-600 shadow-xl'
              : 'max-w-xs text-center text-xs leading-relaxed'
          } ${variant === 'dark' && !compact ? 'text-slate-300' : ''}`}
          role="status"
          aria-live="polite"
        >
          {message}
        </p>
      )}
    </div>
  );
};
