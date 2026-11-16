import React, { useEffect, useRef, useState } from 'react';
import { isAdminEmail, useApp } from '../context/AppContext';
import { User } from '../types';
import { OriginalityCheckLogo } from './OriginalityCheckLogo';
import {
  Shield,
  Coins,
  UserPlus,
  Users,
  Clock,
  CheckCircle2,
  Copy,
  Plus,
  Trash2,
  Search,
  Sparkles,
  RefreshCw,
  Sliders,
  TrendingUp,
  FileCheck2,
  AlertTriangle,
  LogOut,
  X,
  Edit3,
  Database,
  KeyRound,
  ChevronDown,
  Check,
} from 'lucide-react';

const PURCHASE_KEY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const createPurchaseKeyCode = (): string => {
  const randomValues = crypto.getRandomValues(new Uint8Array(20));
  const keyCharacters = Array.from(randomValues, value => PURCHASE_KEY_ALPHABET[value % PURCHASE_KEY_ALPHABET.length]).join('');
  const groups = keyCharacters.match(/.{1,5}/g) || [];
  return `TZ-${groups.join('-')}`;
};

const formatActivityTimestamp = (timestamp: number, fallbackDate: string): string => {
  const date = new Date(timestamp);
  if (!Number.isFinite(timestamp) || Number.isNaN(date.getTime())) return fallbackDate;

  const formatted = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Karachi',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
  return `${formatted} PKT`;
};

const formatCompactActivityTimestamp = (timestamp: number, fallbackDate: string): string => {
  const date = new Date(timestamp);
  if (!Number.isFinite(timestamp) || Number.isNaN(date.getTime())) return fallbackDate;
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Karachi',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
};

export const AdminPanel: React.FC = () => {
  const {
    currentUser,
    users,
    purchaseKeys,
    transactions,
    giveCredits,
    addUserAsAdmin,
    updateUserAsAdmin,
    deleteUser,
    refreshFromFirestore,
    loadMoreAdminUsers,
    loadMoreTransactions,
    loadPurchaseKeys,
    loadMorePurchaseKeys,
    hasMoreAdminUsers,
    hasMoreTransactions,
    hasMorePurchaseKeys,
    isLoadingMoreAdminUsers,
    isLoadingMoreTransactions,
    isLoadingPurchaseKeys,
    isFirestoreSyncing,
    signOutAuth,
    resetAllData,
    createPurchaseKey,
    deletePurchaseKey,
    setNotification,
  } = useApp();

  // Give credits form state
  const [selectedUserId, setSelectedUserId] = useState<string>(currentUser.id);
  const [creditAmount, setCreditAmount] = useState<number>(25);
  const [creditReason, setCreditReason] = useState<string>('Administrative credit top-up');
  const [grantSuccess, setGrantSuccess] = useState<string | null>(null);
  const [isRecipientPickerOpen, setIsRecipientPickerOpen] = useState(false);
  const [recipientSearch, setRecipientSearch] = useState('');
  const recipientPickerRef = useRef<HTMLDivElement>(null);
  const [keyCredits, setKeyCredits] = useState<number>(20);
  const [keyQuantity, setKeyQuantity] = useState<number>(1);
  const [keyNote, setKeyNote] = useState<string>('');
  const [isGeneratingKeys, setIsGeneratingKeys] = useState(false);
  const [generatedKeysMessage, setGeneratedKeysMessage] = useState<string | null>(null);
  const [copiedPurchaseKeyId, setCopiedPurchaseKeyId] = useState<string | null>(null);

  // Edit user modal state
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [editCredits, setEditCredits] = useState<number>(0);
  const [editPlan, setEditPlan] = useState<string>('');
  const [editExpiry, setEditExpiry] = useState<string>('');
  const [isSavingUser, setIsSavingUser] = useState<boolean>(false);

  // Add user modal state
  const [isAddingUser, setIsAddingUser] = useState<boolean>(false);
  const [newUserName, setNewUserName] = useState<string>('');
  const [newUserEmail, setNewUserEmail] = useState<string>('');
  const [newUserCredits, setNewUserCredits] = useState<number>(0);
  const [newUserPlan, setNewUserPlan] = useState<string>('Standard Verified Plan');
  const [isCreatingUser, setIsCreatingUser] = useState<boolean>(false);

  // User search filter
  const [userSearch, setUserSearch] = useState('');
  const [activitySearch, setActivitySearch] = useState('');
  const [activityType, setActivityType] = useState<
    'all' | 'scan_deduction' | 'admin_grant' | 'redeem_code' | 'refund'
  >('all');

  // User deletion state
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  // Selected tab in admin
  const [adminTab, setAdminTab] = useState<'allocate' | 'users' | 'keys' | 'logs'>('allocate');

  const clientUsers = users.filter(user => user.role !== 'admin' && !isAdminEmail(user.email));
  const selectedUser = clientUsers.find(user => user.id === selectedUserId) || clientUsers[0];
  const filteredRecipientUsers = clientUsers.filter(user => {
    const query = recipientSearch.trim().toLowerCase();
    return !query || user.name.toLowerCase().includes(query) || user.email.toLowerCase().includes(query);
  });

  useEffect(() => {
    if (!isRecipientPickerOpen) return;

    const handleOutsidePointer = (event: PointerEvent) => {
      if (!recipientPickerRef.current?.contains(event.target as Node)) {
        setIsRecipientPickerOpen(false);
        setRecipientSearch('');
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsRecipientPickerOpen(false);
        setRecipientSearch('');
      }
    };

    document.addEventListener('pointerdown', handleOutsidePointer);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handleOutsidePointer);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isRecipientPickerOpen]);

  // Handle giving credits
  const handleGiveCredits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || creditAmount === 0) return;

    const success = await giveCredits(selectedUser.id, creditAmount, creditReason);
    if (success) {
      setGrantSuccess(`Allocated +${creditAmount} credits to ${selectedUser.name}!`);
      setTimeout(() => setGrantSuccess(null), 4000);
    }
  };

  const handleGeneratePurchaseKeys = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isGeneratingKeys || keyCredits < 1 || keyQuantity < 1) return;

    setIsGeneratingKeys(true);
    setGeneratedKeysMessage(null);
    const knownKeys = new Set(purchaseKeys.map(key => key.key));
    let createdCount = 0;

    try {
      for (let index = 0; index < keyQuantity; index += 1) {
        let key = createPurchaseKeyCode();
        while (knownKeys.has(key)) key = createPurchaseKeyCode();

        const created = await createPurchaseKey(key, keyCredits, keyNote);
        if (!created) break;
        knownKeys.add(created.key);
        createdCount += 1;
      }

      if (createdCount > 0) {
        setGeneratedKeysMessage(`Created ${createdCount} of ${keyQuantity} purchase keys.`);
        setTimeout(() => setGeneratedKeysMessage(null), 5000);
      }
    } finally {
      setIsGeneratingKeys(false);
    }
  };

  const handleCopyPurchaseKey = async (id: string, key: string) => {
    try {
      await navigator.clipboard.writeText(key);
      setCopiedPurchaseKeyId(id);
      setTimeout(() => setCopiedPurchaseKeyId(null), 1800);
    } catch {
      setNotification({ message: 'Could not copy the purchase key.', type: 'error' });
    }
  };

  const handleDeletePurchaseKey = async (id: string, key: string) => {
    if (window.confirm(`Delete purchase key ${key}? This cannot be undone.`)) {
      await deletePurchaseKey(id);
    }
  };

  // Aggregate stats
  const totalCreditsInCirculation = clientUsers.reduce((acc, user) => acc + user.credits, 0);
  const totalScansAllUsers = clientUsers.reduce((acc, user) => acc + user.totalScans, 0);

  const filteredUsers = clientUsers.filter(
    u =>
      u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase())
  );
  const filteredTransactions = transactions.filter(transaction => {
    const query = activitySearch.trim().toLowerCase();
    const matchesSearch = !query
      || transaction.userName.toLowerCase().includes(query)
      || transaction.note.toLowerCase().includes(query)
      || transaction.date.toLowerCase().includes(query);
    const matchesType = activityType === 'all' || transaction.type === activityType;
    return matchesSearch && matchesType;
  });

  return (
    <div className="flex min-h-screen flex-col bg-[radial-gradient(ellipse_at_top,#172554_0%,#0f172a_34%,#0b1120_100%)] text-slate-100" id="admin-panel-root">
      {/* Top Admin Navigation Header */}
      <header className="sticky top-0 z-30 flex flex-col gap-3 border-b border-slate-800/90 bg-slate-950/85 px-3 py-3 shadow-lg shadow-slate-950/10 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-3">
        <div aria-hidden="true" className="absolute inset-x-0 top-0 h-0.5 bg-[linear-gradient(90deg,#4285f4_0%,#ea4335_35%,#fbbc05_65%,#34a853_100%)]" />
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <OriginalityCheckLogo size="sm" variant="dark" showSubtitle={false} />
          <div className="h-5 w-px bg-slate-800 hidden sm:block" />
          <div className="min-w-0">
            <p className="truncate text-xs font-bold text-white">Admin console</p>
            <p className="hidden max-w-48 truncate text-[10px] text-slate-500 sm:block">{currentUser.email}</p>
          </div>
        </div>

        {/* Admin Actions */}
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={refreshFromFirestore}
            disabled={isFirestoreSyncing}
            className="flex min-h-10 items-center justify-center gap-2 rounded-xl border border-blue-400/25 bg-blue-400/10 px-3 py-2 text-xs font-semibold text-blue-200 transition hover:bg-blue-400/20 disabled:opacity-50"
            id="btn-admin-sync-firestore"
            title="Force Synchronize all documents with Cloud Firestore"
            aria-label={isFirestoreSyncing ? 'Syncing Firestore' : 'Sync Firestore'}
          >
            <RefreshCw className={`w-3.5 h-3.5 text-blue-300 ${isFirestoreSyncing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isFirestoreSyncing ? 'Syncing...' : 'Sync Firestore'}</span>
          </button>

          <button
            onClick={signOutAuth}
            className="flex min-h-10 items-center justify-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2 text-xs font-bold text-rose-300 transition hover:bg-rose-500/20 active:scale-98"
            id="btn-admin-signout"
            title="Sign Out from Administrator Portal"
            aria-label="Sign out from administrator portal"
          >
            <LogOut className="w-3.5 h-3.5 text-rose-400" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* Admin Content Area */}
      <main className="mx-auto w-full max-w-[1440px] flex-1 space-y-5 px-3 py-4 pb-[calc(2rem+env(safe-area-inset-bottom))] sm:space-y-6 sm:px-6 sm:py-6 xl:px-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-300/80">Control center</p>
            <h1 className="mt-1 text-xl font-extrabold tracking-tight text-white sm:text-2xl">Admin dashboard</h1>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-700/80 bg-slate-900/70 px-3 py-1.5 text-[10px] font-medium text-slate-300">
            <Shield className="h-3.5 w-3.5 text-emerald-300" />
            Administrator access
          </span>
        </div>

        {/* KPI Stats Banner */}
        <div className="grid grid-cols-2 gap-2.5 sm:gap-4 xl:grid-cols-3" id="admin-kpi-grid">
          <div className="group relative min-w-0 overflow-hidden rounded-2xl border border-blue-400/15 bg-gradient-to-br from-blue-500/[0.09] via-slate-800/90 to-slate-900/80 p-3 shadow-lg shadow-slate-950/10 transition duration-200 hover:-translate-y-0.5 hover:border-blue-400/30 sm:p-4">
            <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-full bg-blue-400/[0.06] blur-2xl transition group-hover:bg-blue-400/[0.12]" />
            <div className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-300/10 bg-blue-400/10 text-blue-300">
                <Coins className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-400 sm:text-xs">Active credits</p>
                <p className="mt-0.5 truncate font-mono text-lg font-extrabold tabular-nums text-blue-200 sm:text-2xl">{totalCreditsInCirculation.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="group relative min-w-0 overflow-hidden rounded-2xl border border-emerald-400/15 bg-gradient-to-br from-emerald-500/[0.08] via-slate-800/90 to-slate-900/80 p-3 shadow-lg shadow-slate-950/10 transition duration-200 hover:-translate-y-0.5 hover:border-emerald-400/30 sm:p-4">
            <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-full bg-emerald-400/[0.06] blur-2xl transition group-hover:bg-emerald-400/[0.12]" />
            <div className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-300/10 bg-emerald-400/10 text-emerald-300">
                <FileCheck2 className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-400 sm:text-xs">Documents scanned</p>
                <p className="mt-0.5 truncate font-mono text-lg font-extrabold tabular-nums text-emerald-300 sm:text-2xl">{totalScansAllUsers.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="group relative col-span-2 min-w-0 overflow-hidden rounded-2xl border border-amber-400/15 bg-gradient-to-br from-amber-500/[0.08] via-slate-800/90 to-slate-900/80 p-3 shadow-lg shadow-slate-950/10 transition duration-200 hover:-translate-y-0.5 hover:border-amber-400/30 sm:col-span-1 sm:p-4">
            <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-full bg-amber-400/[0.06] blur-2xl transition group-hover:bg-amber-400/[0.12]" />
            <div className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-300/10 bg-amber-400/10 text-amber-200">
                <Users className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-400 sm:text-xs">Client accounts</p>
                <p className="mt-0.5 truncate font-mono text-lg font-extrabold tabular-nums text-amber-200 sm:text-2xl">{clientUsers.length.toLocaleString()}</p>
              </div>
            </div>
          </div>

        </div>

        {/* Sub-Navigation Tabs */}
        <nav className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-800/90 bg-slate-950/65 p-1.5 shadow-inner shadow-slate-950/30 sm:flex sm:flex-wrap sm:gap-2 sm:p-2" aria-label="Admin sections">
          <button
            type="button"
            onClick={() => setAdminTab('allocate')}
            aria-pressed={adminTab === 'allocate'}
            className={`flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-bold transition sm:min-w-32 sm:px-4 ${
              adminTab === 'allocate'
                ? 'border-blue-300/40 bg-gradient-to-b from-blue-500 to-blue-700 text-white shadow-md shadow-blue-950/40'
                : 'border-transparent bg-slate-800/45 text-slate-300 hover:border-slate-700 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Coins className="w-3.5 h-3.5" />
            <span>Allocate</span>
          </button>

          <button
            type="button"
            onClick={() => setAdminTab('users')}
            aria-pressed={adminTab === 'users'}
            className={`flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-bold transition sm:min-w-32 sm:px-4 ${
              adminTab === 'users'
                ? 'border-blue-300/40 bg-gradient-to-b from-blue-500 to-blue-700 text-white shadow-md shadow-blue-950/40'
                : 'border-transparent bg-slate-800/45 text-slate-300 hover:border-slate-700 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Users ({clientUsers.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setAdminTab('keys');
              void loadPurchaseKeys();
            }}
            aria-pressed={adminTab === 'keys'}
            className={`flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-bold transition sm:min-w-32 sm:px-4 ${
              adminTab === 'keys'
                ? 'border-blue-300/40 bg-gradient-to-b from-blue-500 to-blue-700 text-white shadow-md shadow-blue-950/40'
                : 'border-transparent bg-slate-800/45 text-slate-300 hover:border-slate-700 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <KeyRound className={`w-3.5 h-3.5 ${adminTab === 'keys' ? '' : 'text-yellow-400'}`} />
            <span>Purchase Keys</span>
          </button>

          <button
            type="button"
            onClick={() => setAdminTab('logs')}
            aria-pressed={adminTab === 'logs'}
            className={`flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-bold transition sm:min-w-32 sm:px-4 ${
              adminTab === 'logs'
                ? 'border-blue-300/40 bg-gradient-to-b from-blue-500 to-blue-700 text-white shadow-md shadow-blue-950/40'
                : 'border-transparent bg-slate-800/45 text-slate-300 hover:border-slate-700 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Clock className={`w-3.5 h-3.5 ${adminTab === 'logs' ? '' : 'text-red-400'}`} />
            <span>Activity ({transactions.length})</span>
          </button>
        </nav>

        {/* Tab 1: GIVE CREDITS TO USER (Core Requirement) */}
        {adminTab === 'allocate' && (
          <div className="grid grid-cols-1 gap-3 sm:gap-5" id="give-credits-panel">
            <div className="rounded-2xl border border-slate-700/70 bg-gradient-to-br from-slate-800/90 to-slate-900/80 p-3.5 shadow-lg shadow-black/10 sm:rounded-3xl sm:p-6">
              <div className="mb-4 flex items-center gap-3 border-b border-slate-700/70 pb-3 sm:mb-5 sm:pb-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-400/10 text-blue-300">
                  <Coins className="h-5 w-5" />
                </span>
                <h3 className="text-sm font-bold text-white sm:text-base">Allocate credits</h3>
              </div>

              <form onSubmit={handleGiveCredits} className="space-y-4 sm:space-y-5">
                {/* Select User */}
                <div className="relative" ref={recipientPickerRef}>
                  <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Recipient
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsRecipientPickerOpen(value => !value);
                      setRecipientSearch('');
                    }}
                    className="flex min-h-[58px] w-full min-w-0 items-center justify-between gap-3 rounded-xl border border-slate-600/80 bg-slate-950/70 px-3.5 py-3 text-left transition hover:border-blue-400/60 focus:outline-none focus:ring-2 focus:ring-blue-500/40 sm:px-4"
                    id="select-credit-recipient"
                    aria-haspopup="listbox"
                    aria-expanded={isRecipientPickerOpen}
                    aria-label={selectedUser ? `Recipient: ${selectedUser.name}, ${selectedUser.email}` : 'Select recipient'}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-white">
                        {selectedUser?.name || 'No client accounts'}
                      </span>
                      <span className="mt-1 block truncate text-[10px] text-slate-400">
                        {selectedUser ? selectedUser.email : 'Add a client account first'}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-lg bg-blue-400/10 px-2.5 py-1.5 text-[10px] font-semibold text-blue-200">
                      {selectedUser ? `${selectedUser.credits} credits` : '—'}
                    </span>
                    <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition ${isRecipientPickerOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isRecipientPickerOpen && (
                    <div className="absolute inset-x-0 top-full z-40 mt-2 overflow-hidden rounded-2xl border border-slate-600 bg-slate-900 shadow-2xl shadow-black/40">
                      <div className="border-b border-slate-700 p-2.5">
                        <div className="relative">
                          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
                          <input
                            type="search"
                            value={recipientSearch}
                            onChange={event => setRecipientSearch(event.target.value)}
                            placeholder="Search name or email"
                            aria-label="Search recipients"
                            className="min-h-10 w-full rounded-xl border border-slate-700 bg-slate-950 py-2 pl-9 pr-3 text-xs text-white placeholder:text-slate-500 outline-none focus:border-blue-400/60 focus:ring-2 focus:ring-blue-500/20"
                          />
                        </div>
                      </div>
                      <div className="max-h-56 overflow-y-auto p-1.5" role="listbox" aria-label="Client accounts">
                        {filteredRecipientUsers.map(user => (
                          <button
                            type="button"
                            key={user.id}
                            role="option"
                            aria-selected={selectedUser?.id === user.id}
                            onClick={() => {
                              setSelectedUserId(user.id);
                              setIsRecipientPickerOpen(false);
                              setRecipientSearch('');
                            }}
                            className="flex min-h-12 w-full min-w-0 items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition hover:bg-slate-800 focus:bg-slate-800 focus:outline-none"
                          >
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-400/10 text-xs font-bold text-blue-200">
                              {user.name.charAt(0).toUpperCase()}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-xs font-semibold text-slate-100">{user.name}</span>
                              <span className="mt-0.5 block truncate text-[10px] text-slate-400">{user.email}</span>
                            </span>
                            <span className="shrink-0 text-[10px] font-medium text-slate-400">{user.credits}</span>
                            {selectedUser?.id === user.id && <Check className="h-4 w-4 shrink-0 text-emerald-400" />}
                          </button>
                        ))}
                        {filteredRecipientUsers.length === 0 && (
                          <p className="px-3 py-6 text-center text-xs text-slate-400">
                            {clientUsers.length === 0 ? 'No client accounts yet.' : 'No matching accounts.'}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Amount Selection & Presets */}
                <div className="rounded-xl border border-slate-700/70 bg-slate-900/45 p-3 sm:p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Amount
                    </label>
                    <span className="rounded-lg bg-blue-400/10 px-2.5 py-1 text-xs font-bold text-blue-200">
                      +{creditAmount}
                    </span>
                  </div>

                  {/* Preset Buttons */}
                  <div className="mb-3 grid grid-cols-5 gap-1.5 sm:gap-2">
                    {[5, 10, 25, 50, 100].map(amt => (
                      <button
                        type="button"
                        key={amt}
                        onClick={() => setCreditAmount(amt)}
                        className={`min-h-10 rounded-lg border px-1 text-[11px] font-bold transition sm:rounded-xl sm:text-xs ${
                          creditAmount === amt
                            ? 'border-blue-400/50 bg-blue-500/20 text-blue-100 shadow-sm shadow-blue-950/30'
                            : 'border-slate-700 bg-slate-950/70 text-slate-300 hover:border-blue-400/40'
                        }`}
                      >
                        +{amt}
                      </button>
                    ))}
                  </div>

                  {/* Custom Amount Input */}
                  <input
                    type="number"
                    min="1"
                    max="10000"
                    value={creditAmount}
                    onChange={e => setCreditAmount(Math.max(1, parseInt(e.target.value) || 1))}
                    className="min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3.5 py-2.5 text-xs text-white outline-none focus:border-blue-400/60 focus:ring-2 focus:ring-blue-500/30 sm:px-4"
                    placeholder="Enter custom credit amount..."
                    id="input-credit-amount"
                  />
                </div>

                {/* Reason / Note */}
                <div>
                  <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Note
                  </label>
                  <input
                    type="text"
                    value={creditReason}
                    onChange={e => setCreditReason(e.target.value)}
                    placeholder="Reason for this credit"
                    className="min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 outline-none focus:border-blue-400/60 focus:ring-2 focus:ring-blue-500/30 sm:px-4"
                    id="input-credit-reason"
                  />
                </div>

                {/* Submit Action */}
                <div className="flex flex-col gap-3 rounded-xl border border-slate-700/70 bg-slate-900/60 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
                  <div className="flex items-center justify-between gap-3 text-xs sm:block">
                    <span className="text-slate-400">New balance</span>{' '}
                    <span className="font-mono font-bold text-emerald-300">
                      {((selectedUser?.credits ?? 0) + creditAmount).toLocaleString()} credits
                    </span>
                  </div>

                  <button
                    type="submit"
                    disabled={!selectedUser || creditAmount < 1}
                    className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-950/30 transition hover:bg-blue-500 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                    id="btn-confirm-give-credits"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Give {creditAmount} credits</span>
                  </button>
                </div>

                {grantSuccess && (
                  <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-200">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{grantSuccess}</span>
                  </div>
                )}
              </form>
            </div>

          </div>
        )}

        {/* Tab 2: CLIENT USER LIST */}
        {adminTab === 'users' && (
          <div className="overflow-hidden rounded-2xl border border-slate-700/70 bg-gradient-to-b from-slate-800/75 to-slate-900/80 shadow-xl shadow-slate-950/20">
            <div className="space-y-3 border-b border-slate-700/80 bg-slate-900/35 p-3.5 sm:p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-400/15 bg-blue-400/10 text-blue-300">
                    <Users className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-sm font-bold text-white">Client accounts</h2>
                    <p className="mt-0.5 text-[10px] text-slate-400">{filteredUsers.length} shown · {clientUsers.length} loaded</p>
                  </div>
                </div>

                <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                  {hasMoreAdminUsers && (
                    <button
                      type="button"
                      onClick={() => void loadMoreAdminUsers()}
                      disabled={isLoadingMoreAdminUsers}
                      className="min-h-10 rounded-xl border border-slate-600/80 bg-slate-800/70 px-3 py-2 text-[11px] font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-700 disabled:cursor-wait disabled:opacity-50"
                    >
                      {isLoadingMoreAdminUsers ? 'Loading...' : 'Load more'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setNewUserName('');
                      setNewUserEmail('');
                      setNewUserCredits(0);
                      setNewUserPlan('Standard Verified Plan');
                      setIsAddingUser(true);
                    }}
                    className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-b from-blue-500 to-blue-700 px-3.5 py-2 text-[11px] font-bold text-white shadow-md shadow-blue-950/30 transition hover:from-blue-400 hover:to-blue-600 sm:flex-none"
                    id="btn-admin-add-user"
                    title="Add new user directly to Cloud Firestore"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    <span>Add user</span>
                  </button>
                </div>
              </div>

              <div className="relative w-full sm:max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  placeholder="Search users"
                  aria-label="Search users by name or email"
                  className="min-h-11 w-full rounded-xl border border-slate-700/80 bg-slate-950/70 py-2 pl-9 pr-3 text-xs text-white placeholder:text-slate-500 outline-none transition focus:border-blue-400/50 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            <div className="space-y-2.5 p-2.5 lg:hidden">
              {filteredUsers.map(user => (
                <article key={user.id} className="space-y-2.5 rounded-2xl border border-slate-700/70 bg-gradient-to-br from-slate-800/70 to-slate-900/80 p-3 shadow-sm transition hover:border-slate-600 sm:p-3.5">
                  <div className="flex min-w-0 items-center gap-2.5">
                    {user.photoURL ? (
                      <img src={user.photoURL} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-slate-700" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500/30 to-indigo-500/20 text-sm font-bold text-blue-100 ring-2 ring-blue-400/10">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h3 className="max-w-full truncate text-sm font-bold text-white">{user.name}</h3>
                        {user.role === 'admin' && <span className="rounded bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">Admin</span>}
                        {user.id === currentUser.id && <span className="rounded bg-indigo-500/15 px-1.5 py-0.5 text-[10px] font-bold text-indigo-300">You</span>}
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-slate-400" title={user.email}>{user.email}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-700/50 bg-slate-950/45 p-2.5 text-[11px]">
                    <div className="rounded-lg bg-slate-800/50 px-2.5 py-1.5">
                      <span className="block text-slate-500">Credits</span>
                      <span className="font-mono font-bold tabular-nums text-amber-300">{user.credits.toLocaleString()}</span>
                    </div>
                    <div className="rounded-lg bg-slate-800/50 px-2.5 py-1.5">
                      <span className="block text-slate-500">Scans</span>
                      <span className="font-mono tabular-nums text-slate-200">{user.totalScans.toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedUserId(user.id);
                        setAdminTab('allocate');
                      }}
                      className="min-h-10 rounded-xl border border-blue-400/15 bg-blue-400/10 px-2 text-[11px] font-semibold text-blue-200 transition hover:bg-blue-400/15"
                    >
                      <Plus className="mr-1 inline h-3.5 w-3.5" />Credit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingUser(user);
                        setEditName(user.name);
                        setEditCredits(user.credits);
                        setEditPlan(user.planName || 'Standard Verified Plan');
                        setEditExpiry(user.planExpiry || '2027-12-31');
                      }}
                      className="min-h-10 rounded-xl border border-yellow-400/15 bg-yellow-400/10 px-2 text-[11px] font-semibold text-yellow-100 transition hover:bg-yellow-400/15"
                    >
                      <Edit3 className="mr-1 inline h-3.5 w-3.5" />Edit
                    </button>
                    {user.id !== currentUser.id && user.role !== 'admin' && (
                      <button
                        type="button"
                        onClick={() => setUserToDelete(user)}
                        className="min-h-10 rounded-xl border border-rose-400/15 bg-rose-400/10 px-2 text-[11px] font-semibold text-rose-200 transition hover:bg-rose-400/15"
                      >
                        <Trash2 className="mr-1 inline h-3.5 w-3.5" />Delete
                      </button>
                    )}
                  </div>
                </article>
              ))}
              {filteredUsers.length === 0 && (
                <p className="p-6 text-center text-xs text-slate-400">No users match this search.</p>
              )}
            </div>

            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[980px] text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-700/80 bg-slate-900/80 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="px-5 py-3.5">User</th>
                    <th className="px-4 py-3.5">Email</th>
                    <th className="px-4 py-3.5 text-right">Credits</th>
                    <th className="px-4 py-3.5 text-right">Scans</th>
                    <th className="px-4 py-3.5">Plan</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50 text-slate-300">
                  {filteredUsers.map(u => (
                    <tr key={u.id} className="transition-colors hover:bg-blue-400/[0.05]">
                      <td className="px-5 py-3.5">
                        <div className="flex min-w-0 items-center gap-2.5">
                        {u.photoURL ? (
                          <img
                            src={u.photoURL}
                            alt={u.name}
                            className="h-9 w-9 rounded-full object-cover ring-2 ring-slate-700/80"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600/20 text-xs font-bold text-blue-200 ring-2 ring-blue-400/10">
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className="max-w-[180px] truncate font-semibold text-slate-100">{u.name}</span>
                        {u.role === 'admin' && (
                          <span className="rounded-md border border-yellow-400/20 bg-yellow-400/10 px-1.5 py-0.5 text-[9px] font-bold text-yellow-200">
                            Admin
                          </span>
                        )}
                        {u.id === currentUser.id && (
                          <span className="rounded-md bg-blue-400/10 px-1.5 py-0.5 text-[9px] font-semibold text-blue-200">
                            You
                          </span>
                        )}
                        </div>
                      </td>
                      <td className="max-w-[260px] truncate px-4 py-3.5 font-mono text-[11px] text-slate-400" title={u.email}>
                        {u.email}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className="inline-flex min-w-16 justify-center rounded-lg bg-yellow-400/10 px-2.5 py-1.5 font-mono text-xs font-bold text-yellow-200">
                          {u.credits.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono tabular-nums text-slate-300">{u.totalScans.toLocaleString()}</td>
                      <td className="max-w-[200px] truncate px-4 py-3.5 text-slate-400" title={u.planName}>{u.planName}</td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedUserId(u.id);
                              setAdminTab('allocate');
                            }}
                            className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-blue-400/15 bg-blue-400/10 px-2.5 py-1.5 text-xs font-semibold text-blue-200 transition hover:bg-blue-400/20"
                            title="Allocate credits"
                            aria-label={`Allocate credits to ${u.name}`}
                          >
                            <Plus className="w-3 h-3" />
                            <span>Credits</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingUser(u);
                              setEditName(u.name);
                              setEditCredits(u.credits);
                              setEditPlan(u.planName || 'Standard Verified Plan');
                              setEditExpiry(u.planExpiry || '2027-12-31');
                            }}
                            className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-yellow-400/15 bg-yellow-400/10 px-2.5 py-1.5 text-xs font-semibold text-yellow-100 transition hover:bg-yellow-400/20"
                            title={`Edit user profile & credits for ${u.name}`}
                            aria-label={`Edit ${u.name}`}
                          >
                            <Edit3 className="w-3.5 h-3.5 text-indigo-400" />
                            <span>Edit</span>
                          </button>
                          {u.id !== currentUser.id && u.role !== 'admin' && (
                            <button
                              type="button"
                              onClick={() => setUserToDelete(u)}
                              className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-rose-400/15 bg-rose-400/10 px-2.5 py-1.5 text-xs font-semibold text-rose-200 transition hover:bg-rose-400/20"
                              title={`Delete user account for ${u.name}`}
                              aria-label={`Delete ${u.name}`}
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                              <span>Delete</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-5 py-12 text-center text-xs text-slate-400">
                        No users match this search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {adminTab === 'keys' && (
          <section className="space-y-3 sm:space-y-5" id="purchase-keys-panel">
            <div className="rounded-2xl border border-slate-700/60 bg-slate-800/40 px-4 py-3 sm:hidden">
              <h2 className="text-sm font-bold text-white">Purchase keys</h2>
            </div>

            <div className="space-y-4 rounded-2xl border border-slate-700/70 bg-gradient-to-br from-slate-800/80 to-slate-900/80 p-3.5 shadow-sm sm:space-y-5 sm:rounded-3xl sm:p-6">
              <h3 className="flex items-center gap-2.5 text-sm font-bold text-white">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-yellow-400/10 text-yellow-200">
                  <KeyRound className="h-4 w-4" />
                </span>
                Generate keys
              </h3>
              <form onSubmit={handleGeneratePurchaseKeys} className="grid grid-cols-2 gap-2.5 sm:grid-cols-2 sm:gap-3 xl:grid-cols-4">
                <label className="col-span-1 block space-y-1.5 text-[11px] font-medium text-slate-300">
                  <span>Credits per key</span>
                  <input
                    type="number"
                    min="1"
                    max="100000"
                    step="1"
                    required
                    value={keyCredits}
                    onChange={event => setKeyCredits(Math.max(1, Number.parseInt(event.target.value, 10) || 1))}
                    className="hide-number-steppers min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2.5 text-sm text-white outline-none transition focus:border-blue-400/60 focus:ring-2 focus:ring-blue-500/20"
                  />
                </label>
                <label className="col-span-1 block space-y-1.5 text-[11px] font-medium text-slate-300">
                  <span>How many</span>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    step="1"
                    required
                    value={keyQuantity}
                    onChange={event => setKeyQuantity(Math.min(100, Math.max(1, Number.parseInt(event.target.value, 10) || 1)))}
                    className="hide-number-steppers min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2.5 text-sm text-white outline-none transition focus:border-blue-400/60 focus:ring-2 focus:ring-blue-500/20"
                  />
                </label>
                <label className="col-span-2 block space-y-1.5 text-[11px] font-medium text-slate-300 xl:col-span-1">
                  <span>Note (optional)</span>
                  <input
                    type="text"
                    maxLength={120}
                    value={keyNote}
                    onChange={event => setKeyNote(event.target.value)}
                    placeholder="e.g. Starter pack"
                    className="min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-blue-400/60 focus:ring-2 focus:ring-blue-500/20"
                  />
                </label>
                <button
                  type="submit"
                  disabled={isGeneratingKeys}
                  className="col-span-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-950/30 transition hover:bg-blue-500 disabled:cursor-wait disabled:opacity-50 xl:col-span-1"
                >
                  <Plus className="w-4 h-4" />
                  {isGeneratingKeys ? 'Generating…' : 'Generate keys'}
                </button>
              </form>
              {generatedKeysMessage && <p role="status" className="text-xs text-emerald-300">{generatedKeysMessage}</p>}
            </div>

            <div className="bg-slate-800/60 border border-slate-700/70 rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-700 px-3.5 py-3 sm:px-4">
                <h3 className="text-xs font-bold text-white sm:text-sm">Keys</h3>
                <span className="rounded-full bg-slate-700/70 px-2.5 py-1 text-[10px] font-semibold text-slate-300">{purchaseKeys.length}</span>
              </div>
              <div className="space-y-2 p-2 lg:hidden">
                {purchaseKeys.map(purchaseKey => {
                  const isRedeemed = purchaseKey.usedCount >= purchaseKey.maxUses || !!purchaseKey.redeemedByUserId;
                  return (
                    <article key={purchaseKey.id} className="space-y-3 rounded-2xl border border-slate-700/70 bg-slate-900/45 p-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="break-all font-mono text-xs font-semibold text-white">{purchaseKey.key}</p>
                          <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                            isRedeemed
                              ? 'bg-slate-700 text-slate-300'
                              : purchaseKey.isActive
                                ? 'bg-emerald-400/15 text-emerald-300'
                                : 'bg-rose-400/15 text-rose-300'
                          }`}>
                            {isRedeemed ? 'Already Redeemed' : purchaseKey.isActive ? 'Available' : 'Disabled'}
                          </span>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleCopyPurchaseKey(purchaseKey.id, purchaseKey.key)}
                            title="Copy purchase key"
                            aria-label={`Copy purchase key ${purchaseKey.key}`}
                            className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-700 hover:text-white"
                          >
                            {copiedPurchaseKeyId === purchaseKey.id
                              ? <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                              : <Copy className="h-4 w-4" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeletePurchaseKey(purchaseKey.id, purchaseKey.key)}
                            title="Delete purchase key"
                            aria-label={`Delete purchase key ${purchaseKey.key}`}
                            className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-500/10 hover:text-rose-300"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-900/70 p-3 text-xs">
                        <div>
                          <span className="block text-[10px] text-slate-500">Credits</span>
                          <span className="mt-1 block font-mono font-semibold text-amber-300">{purchaseKey.credits}</span>
                        </div>
                        <div className="min-w-0">
                          <span className="block text-[10px] text-slate-500">Redeemed by</span>
                          <span className="mt-1 block break-all text-slate-300">{purchaseKey.redeemedByEmail || '—'}</span>
                        </div>
                        {purchaseKey.note && (
                          <div className="col-span-2 min-w-0 border-t border-slate-700/60 pt-2">
                            <span className="block text-[10px] text-slate-500">Note</span>
                            <span className="mt-1 block break-words text-slate-300">{purchaseKey.note}</span>
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
                {purchaseKeys.length === 0 && (
                  <p className="px-4 py-8 text-center text-xs text-slate-400">
                    {isLoadingPurchaseKeys ? 'Loading purchase keys...' : 'No purchase keys yet.'}
                  </p>
                )}
              </div>
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full min-w-[760px] text-left text-xs">
                  <thead>
                    <tr className="bg-slate-900/60 border-b border-slate-700 text-slate-400 text-[11px] font-bold">
                      <th className="py-3 px-4">Key</th>
                      <th className="py-3 px-4">Credits</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Redeemed By</th>
                      <th className="py-3 px-4">Note</th>
                      <th className="py-3 px-4"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/60 text-slate-300">
                    {purchaseKeys.map(purchaseKey => {
                      const isRedeemed = purchaseKey.usedCount >= purchaseKey.maxUses || !!purchaseKey.redeemedByUserId;
                      return (
                        <tr key={purchaseKey.id} className="hover:bg-slate-750 transition">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2 font-mono text-[11px]">
                              <span className="whitespace-nowrap">{purchaseKey.key}</span>
                              <button
                                type="button"
                                onClick={() => handleCopyPurchaseKey(purchaseKey.id, purchaseKey.key)}
                                title="Copy purchase key"
                                aria-label={`Copy purchase key ${purchaseKey.key}`}
                                className="p-1 text-slate-500 hover:text-white transition"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              {copiedPurchaseKeyId === purchaseKey.id && <span className="text-[10px] text-emerald-300">Copied</span>}
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono">{purchaseKey.credits}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-1 rounded-full text-[10px] font-semibold ${isRedeemed ? 'bg-slate-700 text-slate-300' : purchaseKey.isActive ? 'bg-emerald-400/15 text-emerald-300' : 'bg-rose-400/15 text-rose-300'}`}>
                              {isRedeemed ? 'Already Redeemed' : purchaseKey.isActive ? 'Available' : 'Disabled'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-400">{purchaseKey.redeemedByEmail || '—'}</td>
                          <td className="py-3 px-4 text-slate-400 max-w-[180px] truncate">{purchaseKey.note || '—'}</td>
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => void handleDeletePurchaseKey(purchaseKey.id, purchaseKey.key)}
                              title="Delete purchase key"
                              aria-label={`Delete purchase key ${purchaseKey.key}`}
                              className="p-1.5 text-slate-500 hover:text-rose-300 transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {purchaseKeys.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-10 px-4 text-center text-slate-500">
                          {isLoadingPurchaseKeys ? 'Loading purchase keys...' : 'No purchase keys yet.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {hasMorePurchaseKeys && (
                <div className="flex justify-center border-t border-slate-700 p-4">
                  <button
                    type="button"
                    onClick={() => void loadMorePurchaseKeys()}
                    disabled={isLoadingPurchaseKeys}
                    className="min-h-11 rounded-xl border border-slate-600 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-700 disabled:opacity-50"
                  >
                    {isLoadingPurchaseKeys ? 'Loading…' : 'Load more'}
                  </button>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Tab 4: AUDIT & TRANSACTION LOGS */}
        {adminTab === 'logs' && (
          <div className="bg-slate-800/60 border border-slate-700/70 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-slate-700 p-3.5 sm:p-4">
              <h2 className="text-sm font-bold text-white">Credit activity</h2>
              <span className="shrink-0 rounded-full bg-slate-700/70 px-2.5 py-1 text-[10px] font-semibold text-slate-300">
                {filteredTransactions.length} / {transactions.length}
              </span>
            </div>

            <div className="grid gap-2.5 border-b border-slate-700/70 bg-slate-900/30 p-3 sm:grid-cols-[minmax(0,1fr)_190px] sm:p-4">
              <div className="relative min-w-0">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
                <input
                  type="search"
                  value={activitySearch}
                  onChange={event => setActivitySearch(event.target.value)}
                  placeholder="Search user or details"
                  aria-label="Search activity by user or details"
                  className="min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950/70 py-2 pl-9 pr-10 text-xs text-white placeholder:text-slate-500 outline-none transition focus:border-blue-400/50 focus:ring-2 focus:ring-blue-500/20"
                />
                {activitySearch && (
                  <button
                    type="button"
                    onClick={() => setActivitySearch('')}
                    aria-label="Clear activity search"
                    className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-800 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <label className="relative block min-w-0">
                <span className="sr-only">Filter activity type</span>
                <Sliders className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" aria-hidden="true" />
                <select
                  value={activityType}
                  onChange={event => setActivityType(event.target.value as typeof activityType)}
                  aria-label="Filter by transaction type"
                  className="min-h-11 w-full appearance-none rounded-xl border border-slate-700 bg-slate-950/70 py-2 pl-9 pr-3 text-xs font-medium text-slate-200 outline-none transition focus:border-blue-400/50 focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="all">All activity</option>
                  <option value="scan_deduction">Scans</option>
                  <option value="admin_grant">Credit grants</option>
                  <option value="redeem_code">Redemptions</option>
                  <option value="refund">Refunds</option>
                </select>
              </label>
            </div>

            <div className="space-y-2 p-2 lg:hidden">
              {filteredTransactions.map(tx => {
                const isScanDeduction = tx.type === 'scan_deduction' || (Boolean(tx.note) && tx.note.toLowerCase().includes('scanned document'));
                const displayAmount = isScanDeduction ? -1 : (tx.amount === -5 ? -1 : tx.amount);
                const activityLabel = tx.type === 'admin_grant'
                  ? 'Grant'
                  : tx.type === 'redeem_code'
                    ? 'Redeem'
                    : isScanDeduction
                      ? 'Scan'
                      : tx.type.replace('_', ' ');
                return (
                  <article key={tx.id} className="min-w-0 space-y-2 rounded-xl border border-slate-700/70 bg-gradient-to-br from-slate-800/60 to-slate-900/70 p-3 shadow-sm">
                    <div className="flex min-w-0 items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-white">{tx.userName}</p>
                        <p className="mt-0.5 font-mono text-[9px] text-slate-500">
                          {formatCompactActivityTimestamp(tx.timestamp, tx.date)}
                        </p>
                      </div>
                      <span className={`max-w-[42%] shrink-0 truncate rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide ${
                        tx.type === 'admin_grant'
                          ? 'border border-amber-400/20 bg-amber-400/10 text-amber-200'
                          : tx.type === 'redeem_code'
                            ? 'border border-emerald-400/20 bg-emerald-400/10 text-emerald-200'
                            : 'border border-rose-400/20 bg-rose-400/10 text-rose-200'
                      }`}>
                        {activityLabel}
                      </span>
                    </div>
                    <div className="flex min-w-0 items-center gap-2 border-t border-slate-700/50 pt-2 text-[10px]">
                      <span className={`shrink-0 rounded-md px-2 py-1 font-mono font-bold ${
                        displayAmount > 0
                          ? 'bg-emerald-400/10 text-emerald-300'
                          : 'bg-rose-400/10 text-rose-300'
                      }`}>
                        {displayAmount > 0 ? `+${displayAmount}` : displayAmount}
                      </span>
                      <span className="shrink-0 rounded-md bg-slate-950/60 px-2 py-1 font-mono text-slate-300">
                        Bal. {tx.balanceAfter}
                      </span>
                      {tx.note && (
                        <span className="min-w-0 flex-1 truncate text-right text-slate-400" title={tx.note}>
                          {tx.note}
                        </span>
                      )}
                    </div>
                  </article>
                );
              })}
              {filteredTransactions.length === 0 && (
                <p className="px-4 py-8 text-center text-xs text-slate-400">
                  {transactions.length === 0 ? 'No activity yet.' : 'No activity matches your search or filter.'}
                </p>
              )}
            </div>

            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-900/60 border-b border-slate-700 text-slate-400 text-[11px] font-bold">
                    <th className="py-3 px-5">Timestamp</th>
                    <th className="py-3 px-4">Client</th>
                    <th className="py-3 px-4">Transaction Type</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Balance After</th>
                    <th className="py-3 px-5">Details / Memo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/60 text-slate-300">
                  {filteredTransactions.map(tx => {
                    const isScanDeduction = tx.type === 'scan_deduction' || (Boolean(tx.note) && tx.note.toLowerCase().includes('scanned document'));
                    const displayAmount = isScanDeduction ? -1 : (tx.amount === -5 ? -1 : tx.amount);
                    return (
                    <tr key={tx.id} className="hover:bg-slate-750 transition">
                      <td className="py-3.5 px-5 text-slate-400 font-mono text-[11px]">
                        {formatActivityTimestamp(tx.timestamp, tx.date)}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-white">
                        {tx.userName}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                            tx.type === 'admin_grant'
                              ? 'bg-amber-400/15 text-amber-400 border border-amber-400/20'
                              : tx.type === 'redeem_code'
                              ? 'bg-emerald-400/15 text-emerald-400 border border-emerald-400/20'
                              : 'bg-rose-400/15 text-rose-400 border border-rose-400/20'
                          }`}
                        >
                          {tx.type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold">
                        <span
                          className={displayAmount > 0 ? 'text-emerald-400' : 'text-rose-400'}
                        >
                          {displayAmount > 0 ? `+${displayAmount}` : displayAmount}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-400">
                        {tx.balanceAfter} credits
                      </td>
                      <td className="py-3.5 px-5 text-slate-400 max-w-sm truncate">
                        {tx.note}
                      </td>
                    </tr>
                  );})}
                  {filteredTransactions.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-5 py-10 text-center text-xs text-slate-400">
                        {transactions.length === 0 ? 'No activity yet.' : 'No activity matches your search or filter.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {hasMoreTransactions && (
              <div className="flex justify-center border-t border-slate-700 p-4">
                <button
                  type="button"
                  onClick={() => void loadMoreTransactions()}
                  disabled={isLoadingMoreTransactions}
                  className="rounded-xl border border-slate-600 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-50"
                >
                  {isLoadingMoreTransactions ? 'Loading...' : 'Load 10 older transactions'}
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Delete User Confirmation Modal */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="max-h-[calc(100dvh-0.5rem)] w-full max-w-md space-y-5 overflow-y-auto rounded-t-2xl border border-slate-700/80 bg-slate-900 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl sm:p-6">
            <div className="flex items-start justify-between">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <h3 className="text-base font-bold text-white">
                Delete User Account?
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                You are about to delete this account from TurnitScope. This will immediately remove all credentials, credit balances, and data.
              </p>
            </div>

            {/* User Details Summary Card */}
            <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3.5 space-y-2 text-xs">
              <div className="flex items-center gap-2.5 pb-2 border-b border-slate-700/50">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 text-white font-bold flex items-center justify-center text-xs">
                  {userToDelete.name.charAt(0)}
                </div>
                <div>
                  <div className="font-bold text-white">{userToDelete.name}</div>
                  <div className="break-all font-mono text-[11px] text-slate-400">{userToDelete.email}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                <div className="text-slate-400">
                  Credit Balance:{' '}
                  <span className="font-mono font-bold text-amber-400">
                    {userToDelete.credits} Credits
                  </span>
                </div>
                <div className="text-slate-400">
                  Scans Run:{' '}
                  <span className="font-mono font-bold text-white">
                    {userToDelete.totalScans}
                  </span>
                </div>
                <div className="text-slate-400">
                  Plan:{' '}
                  <span className="font-medium text-slate-300">
                    {userToDelete.planName}
                  </span>
                </div>
                <div className="text-slate-400">
                  Status:{' '}
                  <span className="font-medium text-slate-300">
                    {userToDelete.emailVerified ? 'Verified' : 'Unverified'}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 text-[11px] text-rose-300 flex items-start gap-2">
              <Trash2 className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <span>
                This action is irreversible and permanently deletes the Firestore database record for this user.
              </span>
            </div>

            <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                disabled={isDeletingUser}
                className="min-h-11 rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-700 hover:text-white sm:min-h-0"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingUser}
                onClick={async () => {
                  setIsDeletingUser(true);
                  try {
                    await deleteUser(userToDelete.id);
                    if (selectedUserId === userToDelete.id) {
                      setSelectedUserId('');
                    }
                    setUserToDelete(null);
                  } finally {
                    setIsDeletingUser(false);
                  }
                }}
                className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-rose-600/20 transition hover:bg-rose-500 sm:min-h-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeletingUser ? 'Deleting from Firestore...' : 'Yes, Delete User'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add New User Modal (Direct Firestore Sync) */}
      {isAddingUser && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="max-h-[calc(100dvh-0.5rem)] w-full max-w-md space-y-5 overflow-y-auto rounded-t-2xl border border-slate-700/80 bg-slate-900 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl sm:p-6">
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
                <UserPlus className="w-5 h-5" />
              </div>
              <button
                type="button"
                onClick={() => setIsAddingUser(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <h3 className="text-base font-bold text-white">Add New Client Account</h3>
              <p className="text-xs text-slate-400 mt-1">
                Creates a new user record immediately persisted in Cloud Firestore.
              </p>
            </div>

            <form
              onSubmit={async e => {
                e.preventDefault();
                if (!newUserName.trim() || !newUserEmail.trim()) return;
                setIsCreatingUser(true);
                try {
                  const success = await addUserAsAdmin({
                    name: newUserName.trim(),
                    email: newUserEmail.trim(),
                    credits: Number(newUserCredits) || 0,
                    planName: newUserPlan,
                    planExpiry: '2027-12-31',
                  });
                  if (success) {
                    setIsAddingUser(false);
                    setNewUserName('');
                    setNewUserEmail('');
                    setNewUserCredits(0);
                  }
                } finally {
                  setIsCreatingUser(false);
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={newUserName}
                  onChange={e => setNewUserName(e.target.value)}
                  placeholder="e.g. Dr. Alex Morgan"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={newUserEmail}
                  onChange={e => setNewUserEmail(e.target.value)}
                  placeholder="e.g. alex.morgan@university.edu"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Initial Credits
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="10000"
                    value={newUserCredits}
                    onChange={e => setNewUserCredits(parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Assigned Plan
                  </label>
                  <select
                    value={newUserPlan}
                    onChange={e => setNewUserPlan(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Standard Verified Plan">Standard Verified</option>
                    <option value="Academic Pro Researcher">Academic Pro</option>
                    <option value="Enterprise Campus License">Enterprise Campus</option>
                    <option value="Faculty Unlimited">Faculty Unlimited</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-2 border-t border-slate-800 pt-3 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddingUser(false)}
                  disabled={isCreatingUser}
                  className="min-h-11 rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-700 hover:text-white sm:min-h-0"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingUser}
                  className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500 disabled:opacity-50 sm:min-h-0"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{isCreatingUser ? 'Saving to Firestore...' : 'Create in Firestore'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal (Direct Firestore Sync) */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="max-h-[calc(100dvh-0.5rem)] w-full max-w-md space-y-5 overflow-y-auto rounded-t-2xl border border-slate-700/80 bg-slate-900 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl sm:p-6">
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 rounded-xl bg-amber-400/15 border border-amber-400/30 flex items-center justify-center text-amber-400 shrink-0">
                <Edit3 className="w-5 h-5" />
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <h3 className="text-base font-bold text-white">Edit User Account</h3>
              <p className="text-xs text-slate-400 mt-1">
                Updating this user profile immediately syncs to Cloud Firestore collection <code className="text-amber-400 font-mono">users/{editingUser.id}</code>.
              </p>
            </div>

            <form
              onSubmit={async e => {
                e.preventDefault();
                setIsSavingUser(true);
                try {
                  const success = await updateUserAsAdmin(editingUser.id, {
                    name: editName.trim() || editingUser.name,
                    credits: Math.max(0, editCredits),
                    planName: editPlan,
                    planExpiry: editExpiry,
                  });
                  if (success) {
                    setEditingUser(null);
                  }
                } finally {
                  setIsSavingUser(false);
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Email (Account Reference)
                </label>
                <input
                  type="email"
                  disabled
                  value={editingUser.email}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-400 font-mono cursor-not-allowed"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Credit Balance
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="50000"
                    value={editCredits}
                    onChange={e => setEditCredits(parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Plan Expiration
                  </label>
                  <input
                    type="date"
                    value={editExpiry}
                    onChange={e => setEditExpiry(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Plan Tier
                </label>
                <select
                  value={editPlan}
                  onChange={e => setEditPlan(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="Standard Verified Plan">Standard Verified Plan</option>
                  <option value="Academic Pro Researcher">Academic Pro Researcher</option>
                  <option value="Enterprise Campus License">Enterprise Campus License</option>
                  <option value="Faculty Unlimited">Faculty Unlimited</option>
                  <option value="Pay-As-You-Go">Pay-As-You-Go</option>
                </select>
              </div>

              <div className="flex flex-col gap-2 border-t border-slate-800 pt-3 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  disabled={isSavingUser}
                  className="min-h-11 rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-700 hover:text-white sm:min-h-0"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingUser}
                  className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-amber-500/20 transition hover:bg-amber-400 disabled:opacity-50 sm:min-h-0"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{isSavingUser ? 'Updating in Firestore...' : 'Save to Firestore'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
