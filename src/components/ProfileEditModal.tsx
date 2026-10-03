import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Check, Loader2, User as UserIcon, X } from 'lucide-react';

export const ProfileEditModal: React.FC = () => {
  const {
    currentUser,
    updateCurrentUser,
    isProfileModalOpen,
    setIsProfileModalOpen,
    setNotification,
  } = useApp();
  const [fullName, setFullName] = useState(currentUser.name || '');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isProfileModalOpen) return;
    setFullName(currentUser.name || '');
  }, [isProfileModalOpen, currentUser.name]);

  if (!isProfileModalOpen) return null;

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    const cleanName = fullName.trim();
    if (!cleanName) {
      setNotification({ message: 'Please enter your full name.', type: 'error' });
      return;
    }

    setIsSaving(true);
    try {
      await updateCurrentUser({ name: cleanName });
      setIsProfileModalOpen(false);
    } catch (error) {
      console.error('Failed to save profile name:', error);
      setNotification({
        message: error instanceof Error ? error.message : 'Could not save your name. Please try again.',
        type: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      id="profile-modal-overlay"
      onClick={event => {
        if (event.target === event.currentTarget) setIsProfileModalOpen(false);
      }}
    >
      <section
        className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        id="profile-edit-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-dialog-title"
      >
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white">
              <UserIcon className="h-4 w-4" />
            </div>
            <h2 id="profile-dialog-title" className="text-base font-bold text-slate-900">Profile</h2>
          </div>
          <button
            type="button"
            onClick={() => setIsProfileModalOpen(false)}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close profile"
            id="btn-close-profile-modal"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <form onSubmit={handleSave} className="space-y-4 p-5" id="profile-edit-form">
          <div className="space-y-1.5">
            <label htmlFor="input-profile-full-name" className="text-xs font-semibold text-slate-700">Full name</label>
            <input
              id="input-profile-full-name"
              type="text"
              autoComplete="name"
              required
              value={fullName}
              onChange={event => setFullName(event.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="input-profile-email" className="flex items-center justify-between text-xs font-semibold text-slate-700">
              <span>Email</span>
              {currentUser.emailVerified && <span className="text-[11px] font-medium text-emerald-700">Verified</span>}
            </label>
            <input
              id="input-profile-email"
              type="email"
              readOnly
              value={currentUser.email}
              className="w-full min-w-0 cursor-text rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none selection:bg-indigo-100"
            />
          </div>

          <footer className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => setIsProfileModalOpen(false)}
              className="min-h-10 rounded-lg px-4 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex min-h-10 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-xs font-bold text-white transition hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-60"
              id="btn-save-profile"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
};
