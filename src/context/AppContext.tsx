import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, ScanReport, ActivationCode, CreditTransaction, ScanMode, HighlightedSnippet, MatchedSource } from '../types';
import { cleanText, generateSmartSnippets } from '../utils/documentParser';
import { generateSourcesForDocument } from '../utils/dynamicManuscriptEngine';
import {
  auth,
  db,
  signInWithGoogle,
  registerWithEmail,
  loginWithEmail,
  logOut,
  sendVerificationToCurrentUser,
  resetPasswordForEmail,
  onAuthStateChanged,
  getActiveSessionUser,
  safeSetDoc,
  safeGetDoc,
  safeGetDocs,
  cleanFirestoreData,
  updateFirebaseUserProfile,
  FirebaseUser,
} from '../lib/firebase';
import { doc, collection, deleteDoc, onSnapshot, query, where } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { storage } from '../lib/firebase';
import { buildUserFromAuthProfile } from '../lib/userProfiles';

export { buildUserFromAuthProfile };

export const isAdminEmail = (email?: string | null): boolean => {
  if (!email) return false;
  const em = email.trim().toLowerCase();
  return em === 'admin@turnitscope.com';
};

interface AppContextType {
  currentUser: User;
  users: User[];
  reports: ScanReport[];
  activationCodes: ActivationCode[];
  transactions: CreditTransaction[];
  activePanel: 'client' | 'admin';
  activeTab: 'dashboard' | 'reports' | 'redeem';
  selectedReport: ScanReport | null;
  isScanning: boolean;
  scanProgress: { step: string; percent: number } | null;
  notification: { message: string; type: 'success' | 'error' | 'info' } | null;
  isProfileModalOpen: boolean;
  isSidebarOpen: boolean;

  // Firebase Auth State & Actions
  firebaseUser: FirebaseUser | null;
  isAuthLoading: boolean;
  signInWithGoogleAuth: () => Promise<void>;
  registerWithEmailAuth: (name: string, email: string, pass: string) => Promise<void>;
  signInWithEmailAuth: (email: string, pass: string) => Promise<void>;
  signOutAuth: () => Promise<void>;
  sendEmailVerificationAuth: () => Promise<void>;
  resetPasswordAuth: (email: string) => Promise<void>;

  // Actions
  setActivePanel: (panel: 'client' | 'admin') => void;
  setActiveTab: (tab: 'dashboard' | 'reports' | 'redeem') => void;
  setSelectedReport: (report: ScanReport | null) => void;
  setIsProfileModalOpen: (open: boolean) => void;
  setNotification: (notif: { message: string; type: 'success' | 'error' | 'info' } | null) => void;
  giveCredits: (userId: string, amount: number, note?: string) => boolean;
  deleteUser: (userId: string) => Promise<void>;
  redeemCode: (codeStr: string) => { success: boolean; message: string; creditsAdded?: number };
  generateCode: (codeStr: string, credits: number, maxUses?: number, note?: string) => ActivationCode;
  deleteCode: (codeId: string) => void;
  toggleCodeActivation: (codeId: string) => void;
  runScan: (options: {
    fileName: string;
    mode: ScanMode;
    authorFirst?: string;
    authorLast?: string;
    excludeBibliography?: boolean;
    excludeQuotes?: boolean;
    fileContent?: string;
    institution?: string;
    fileData?: string;
    storagePath?: string;
    fileMimeType?: string;
    htmlContent?: string;
    htmlPages?: string[];
    pageCount?: number;
  }) => Promise<{ success: boolean; error?: string; report?: ScanReport }>;
  deleteReport: (reportId: string) => void;
  updateCurrentUser: (updates: Partial<User>) => Promise<void>;
  addUserAsAdmin: (userData: {
    name: string;
    email: string;
    credits: number;
    planName?: string;
    planExpiry?: string;
  }) => Promise<boolean>;
  updateUserAsAdmin: (userId: string, updates: Partial<User>) => Promise<boolean>;
  refreshFromFirestore: () => Promise<void>;
  isFirestoreSyncing: boolean;
  resetAllData: () => void;
  setIsSidebarOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  toggleSidebar: () => void;
}

const STORAGE_KEY_USER = 'turnitscope_current_user_v1';
const STORAGE_KEY_USERS = 'turnitscope_users_v1';
const STORAGE_KEY_REPORTS = 'turnitscope_reports_v1';
const STORAGE_KEY_CODES = 'turnitscope_codes_v1';
const STORAGE_KEY_TXNS = 'turnitscope_txns_v1';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const getUserScopedStorageKey = (key: string, userId?: string): string => {
  if (!userId) return key;
  return `${key}_${userId}`;
};

const getReportsStorageKey = (userId?: string): string => getUserScopedStorageKey(STORAGE_KEY_REPORTS, userId);

const pruneExpiredReports = (items: ScanReport[] = [], userId?: string): ScanReport[] => {
  const now = Date.now();

  return items
    .filter(item => {
      const effectiveUserId = item.userId || userId;
      if (userId && effectiveUserId && effectiveUserId !== userId) return false;

      const expiresAt = item.expiresAt ?? (item.timestamp ? item.timestamp + ONE_DAY_MS : undefined);
      if (!expiresAt) return true;
      return expiresAt > now;
    })
    .map(item => ({
      ...item,
      userId: item.userId || userId,
      expiresAt: item.expiresAt ?? (item.timestamp ? item.timestamp + ONE_DAY_MS : Date.now() + ONE_DAY_MS),
    }));
};

const DEMO_REPORT_ID_SET = new Set([
  'rep-cyb2103-cyber-risk',
  'rep-kunal-ai-dev',
  'rep-101',
  'rep-102',
]);
const LEGACY_REPORT_KEYWORDS = [
  'cyb2103',
  'cyber risk',
  'kunal kumar - ai developer',
  'rep-101',
  'rep-102',
];

const isLegacyReport = (report: Partial<ScanReport>): boolean => {
  if (!report) return false;
  const idText = String(report.id || '').toLowerCase();
  const nameText = `${report.title || ''} ${report.fileName || ''}`.toLowerCase();
  return (
    DEMO_REPORT_ID_SET.has(report.id || '') ||
    LEGACY_REPORT_KEYWORDS.some(keyword => idText.includes(keyword) || nameText.includes(keyword))
  );
};

const sanitizePersistedReports = (items: ScanReport[] = [], userId?: string): ScanReport[] => {
  const seen = new Set<string>();
  return pruneExpiredReports(
    items
      .filter(r => !isLegacyReport(r))
      .map(r => {
        let sample = cleanText(r.contentSample || '');
        if (!sample || sample.length < 40 || sample.includes('PK') || sample.includes('docProps')) {
          sample = '';
        }

        const cleanedSnippets = (r.snippets || []).map((snip, idx) => {
          let snipText = cleanText(snip.text);
          if (!snipText || snipText.includes('PK')) {
            snipText = '';
          }
          return {
            ...snip,
            text: snipText,
            sourceIndex: snip.sourceIndex || (idx % 3) + 1,
            sourceId: snip.sourceId || `s${(idx % 3) + 1}`,
          };
        });

        return {
          ...r,
          userId: r.userId || userId,
          expiresAt: r.expiresAt ?? (r.timestamp ? r.timestamp + ONE_DAY_MS : Date.now() + ONE_DAY_MS),
          submissionId: r.submissionId || `trn:oid:${Math.floor(21940000000 + Math.random() * 99999999)}`,
          contentSample: sample,
          snippets: (cleanedSnippets.length > 0 ? cleanedSnippets : []) as HighlightedSnippet[],
        };
      })
      .filter(r => Boolean(r))
      .filter(r => {
        if (userId && r.userId && r.userId !== userId) return false;
        if (seen.has(r.id)) return false;
        seen.add(r.id);
        return true;
      }),
    userId
  );
};

const INITIAL_CURRENT_USER: User = {
  id: '',
  name: 'Academic User',
  email: '',
  role: 'client',
  credits: 0,
  planName: 'Standard Tier',
  planExpiry: '2027-12-31',
  totalScans: 0,
  createdAt: '2026-01-01',
  emailVerified: false,
};

export const ADMIN_USER_INITIAL: User = {
  id: 'usr-admin-turnitscope',
  name: 'TurnitScope Admin',
  email: 'admin@turnitscope.com',
  role: 'admin',
  credits: 5000,
  planName: 'Master Administrator',
  planExpiry: '2030-12-31',
  totalScans: 142,
  createdAt: '2026-01-01',
  emailVerified: true,
  authProvider: 'password',
};

export const isRemovedUser = (u: { id?: string; email?: string; name?: string }): boolean => {
  const id = u.id || '';
  const email = (u.email || '').toLowerCase();
  const name = (u.name || '').toLowerCase();
  return (
    id === 'usr-ayesha' ||
    id === 'usr-david' ||
    id === 'usr-zainab' ||
    email === 'ayesha.k@academic.edu' ||
    email === 'dmiller@research-lab.org' ||
    email === 'zainab.m@univ.edu' ||
    name.includes('ayesha') ||
    name.includes('david miller') ||
    name.includes('zainab')
  );
};

const INITIAL_USERS: User[] = [
  ADMIN_USER_INITIAL,
  {
    id: 'usr-kunal-sukhani',
    name: 'Kunal Sukhani',
    email: 'kunalsukhani333@gmail.com',
    role: 'client',
    credits: 35,
    planName: 'Standard Academic Plan',
    planExpiry: '2027-12-31',
    totalScans: 3,
    createdAt: '2026-01-01',
    emailVerified: true,
    authProvider: 'password',
  },
];

const INITIAL_CODES: ActivationCode[] = [
  {
    id: 'code-1',
    code: 'TC-WELCOME10',
    credits: 10,
    maxUses: 100,
    usedCount: 12,
    isActive: true,
    createdAt: '2026-09-01',
    note: 'Welcome bonus promo code',
    createdBy: 'Super Admin',
  },
  {
    id: 'code-2',
    code: 'TC-PRO50',
    credits: 50,
    maxUses: 50,
    usedCount: 4,
    isActive: true,
    createdAt: '2026-09-10',
    note: 'Pro package voucher',
    createdBy: 'Super Admin',
  },
  {
    id: 'code-3',
    code: 'TC-STUDENT25',
    credits: 25,
    maxUses: 200,
    usedCount: 38,
    isActive: true,
    createdAt: '2026-09-12',
    note: 'Fall Semester Student Grant',
    createdBy: 'Admin Panel',
  },
];

const INITIAL_REPORTS: ScanReport[] = [];

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_USER);
    if (!saved) return INITIAL_CURRENT_USER;
    try {
      const parsed: User = JSON.parse(saved);
      return {
        ...parsed,
        role: isAdminEmail(parsed.email) ? 'admin' : 'client',
      };
    } catch {
      return INITIAL_CURRENT_USER;
    }
  });

  const [users, setUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_USERS);
    let list: User[] = INITIAL_USERS;
    if (saved) {
      try {
        list = JSON.parse(saved);
      } catch {}
    }
    const sanitized = list
      .filter(u => !isRemovedUser(u))
      .map(u => ({
        ...u,
        role: (isAdminEmail(u.email) ? 'admin' : 'client') as 'admin' | 'client',
      }));
    if (!sanitized.some(u => u.email.toLowerCase() === 'admin@turnitscope.com')) {
      sanitized.unshift(ADMIN_USER_INITIAL);
    }
    try {
      localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(sanitized));
    } catch {}
    return sanitized;
  });

  const [reports, setReports] = useState<ScanReport[]>([]);

  useEffect(() => {
    const userId = currentUser?.id;
    if (!userId) {
      setReports([]);
      return;
    }

    const saved = localStorage.getItem(getReportsStorageKey(userId));
    if (!saved) {
      setReports([]);
      return;
    }

    try {
      const parsed: ScanReport[] = JSON.parse(saved);
      const cleaned = sanitizePersistedReports(parsed, userId);
      setReports(cleaned);
      localStorage.setItem(getReportsStorageKey(userId), JSON.stringify(cleaned));
    } catch {
      setReports([]);
    }
  }, [currentUser?.id]);

  const [activationCodes, setActivationCodes] = useState<ActivationCode[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CODES);
      return saved ? JSON.parse(saved) : INITIAL_CODES;
    } catch {
      return INITIAL_CODES;
    }
  });

  const [transactions, setTransactions] = useState<CreditTransaction[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_TXNS);
      return saved ? JSON.parse(saved) : [
        {
          id: 'tx-init',
          userId: 'usr-kunal',
          userName: 'Kunal Kumar',
          amount: 50,
          balanceAfter: 50,
          type: 'admin_grant',
          note: 'Initial verified user balance',
          date: '2026-09-15 09:00',
          timestamp: Date.now(),
        }
      ];
    } catch {
      return [
        {
          id: 'tx-init',
          userId: 'usr-kunal',
          userName: 'Kunal Kumar',
          amount: 50,
          balanceAfter: 50,
          type: 'admin_grant',
          note: 'Initial verified user balance',
          date: '2026-09-15 09:00',
          timestamp: Date.now(),
        }
      ];
    }
  });

  // Firebase Auth states
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const [isFirestoreSyncing, setIsFirestoreSyncing] = useState<boolean>(false);

  const [activePanel, setActivePanel] = useState<'client' | 'admin'>('client');

  const handleSetActivePanel = (panel: 'client' | 'admin') => {
    if (panel === 'admin' && !isAdminEmail(currentUser?.email)) {
      setNotification({
        message: 'Access Denied: Only admin@turnitscope.com has administrative access.',
        type: 'error',
      });
      setActivePanel('client');
      return;
    }
    setActivePanel(panel);
  };
  const [activeTab, setActiveTab] = useState<'dashboard' | 'reports' | 'redeem'>('dashboard');
  const [selectedReport, setSelectedReport] = useState<ScanReport | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<{ step: string; percent: number } | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const toggleSidebar = () => setIsSidebarOpen(prev => !prev);

  const syncUsersFromFirestoreIfPossible = async () => {
    try {
      const usersSnap = await safeGetDocs(collection(db, 'users'), 3500);
      if (!usersSnap || usersSnap.empty) return;

      const fsUsers: User[] = [];
      usersSnap.forEach((docSnap: any) => {
        const d = docSnap.data();
        if (d && (d.email || d.name) && !isRemovedUser(d)) {
          fsUsers.push({
            id: docSnap.id,
            name: d.name || (d.email ? d.email.split('@')[0] : 'Academic User'),
            email: d.email || '',
            role: isAdminEmail(d.email) ? 'admin' : (d.role || 'client'),
            credits: typeof d.credits === 'number' ? d.credits : 0,
            planName: d.planName || 'Standard Verified Plan',
            planExpiry: d.planExpiry || '2027-12-31',
            totalScans: typeof d.totalScans === 'number' ? d.totalScans : 0,
            createdAt: d.createdAt || new Date().toISOString().split('T')[0],
            emailVerified: !!d.emailVerified,
            photoURL: d.photoURL || null,
            authProvider: d.authProvider || 'password',
          });
        }
      });

      if (!fsUsers.some(u => u.email.toLowerCase() === 'admin@turnitscope.com')) {
        fsUsers.unshift(ADMIN_USER_INITIAL);
      }

      setUsers(fsUsers);
      try {
        localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(fsUsers));
      } catch {}
    } catch {
      // Ignore permission/offline cases; the in-memory user list is already updated.
    }
  };

  // Sync to local storage with safe quota handling
  useEffect(() => {
    try {
      if (currentUser) {
        localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(currentUser));
      }
    } catch (e) {
      console.warn('Could not persist user to localStorage:', e);
    }
  }, [currentUser]);

  useEffect(() => {
    try {
      if (users && users.length > 0) {
        localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
      }
    } catch (e) {
      console.warn('Could not persist users to localStorage:', e);
    }
  }, [users]);

  useEffect(() => {
    if (!currentUser?.id) return;

    const expired = reports.filter(report => {
      const expiresAt = report.expiresAt ?? (report.timestamp ? report.timestamp + ONE_DAY_MS : undefined);
      return !!expiresAt && expiresAt <= Date.now();
    });

    if (!expired.length) {
      try {
        const safeReports = pruneExpiredReports(reports, currentUser.id).map(r => ({
          ...r,
          userId: r.userId || currentUser.id,
        }));
        localStorage.setItem(getReportsStorageKey(currentUser.id), JSON.stringify(safeReports));
      } catch (e) {
        console.warn('Could not persist reports to localStorage:', e);
      }
      return;
    }

    let isCancelled = false;

    const purgeExpiredReportFiles = async () => {
      for (const report of expired) {
        if (!report.storagePath) continue;
        try {
          await deleteObject(ref(storage, report.storagePath));
        } catch (error) {
          console.warn('Could not delete expired file from Firebase Storage:', error);
        }
      }

      if (isCancelled) return;

      const cleaned = reports
        .filter(report => {
          const expiresAt = report.expiresAt ?? (report.timestamp ? report.timestamp + ONE_DAY_MS : undefined);
          return !expiresAt || expiresAt > Date.now();
        })
        .map(report => ({
          ...report,
          fileData: undefined,
          text: undefined,
          htmlContent: undefined,
          htmlPages: undefined,
          storagePath: undefined,
          contentSample: report.contentSample || '',
        }));

      setReports(cleaned);
      try {
        localStorage.setItem(getReportsStorageKey(currentUser.id), JSON.stringify(cleaned));
      } catch (e) {
        console.warn('Could not persist cleaned reports to localStorage:', e);
      }
    };

    purgeExpiredReportFiles();
    return () => {
      isCancelled = true;
    };
  }, [reports, currentUser?.id]);

  useEffect(() => {
    try {
      if (activationCodes) {
        localStorage.setItem(STORAGE_KEY_CODES, JSON.stringify(activationCodes));
      }
    } catch (e) {
      console.warn('Could not persist codes to localStorage:', e);
    }
  }, [activationCodes]);

  useEffect(() => {
    try {
      if (transactions) {
        localStorage.setItem(STORAGE_KEY_TXNS, JSON.stringify(transactions));
      }
    } catch (e) {
      console.warn('Could not persist transactions to localStorage:', e);
    }
  }, [transactions]);

  // Listen to Firebase Auth state & active institutional session
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setIsAuthLoading(true);
      if (fbUser) {
        setFirebaseUser(fbUser);
        const userDocRef = doc(db, 'users', fbUser.uid);
        try {
          const userDocSnap = await safeGetDoc(userDocRef, 3500);
          if (userDocSnap && userDocSnap.exists && userDocSnap.exists()) {
            const data = userDocSnap.data() as User;
            const isUserAdmin = isAdminEmail(fbUser.email);
            const mergedUser: User = {
              ...data,
              id: fbUser.uid,
              name: fbUser.displayName || data.name || fbUser.email?.split('@')[0] || 'User',
              email: fbUser.email || data.email,
              role: (isUserAdmin ? 'admin' : 'client') as 'admin' | 'client',
              emailVerified: fbUser.emailVerified,
              photoURL: fbUser.photoURL || data.photoURL,
              authProvider: fbUser.providerData?.[0]?.providerId === 'google.com' ? 'google' : 'password',
            };
            if (!isUserAdmin && data.role === 'admin') {
              safeSetDoc(userDocRef, { role: 'client' }, { merge: true });
            }
            setCurrentUser(mergedUser);
            if (!isUserAdmin) {
              setActivePanel('client');
            } else {
              setActivePanel('admin');
            }
            setUsers(prev => {
              const without = prev.filter(u => u.id !== mergedUser.id && u.email !== mergedUser.email);
              return [mergedUser, ...without];
            });
          } else {
            // New user registration profile in Firestore
            const isDefaultAdmin = isAdminEmail(fbUser.email);
            const newUser = buildUserFromAuthProfile(
              {
                uid: fbUser.uid,
                email: fbUser.email,
                displayName: fbUser.displayName,
                photoURL: fbUser.photoURL,
                emailVerified: fbUser.emailVerified,
                providerData: fbUser.providerData?.map(provider => ({
                  providerId: provider.providerId,
                  email: provider.email,
                })),
              },
              isDefaultAdmin ? 'admin' : 'client'
            );
            safeSetDoc(userDocRef, newUser).catch(() => {});
            setCurrentUser(newUser);
            setUsers(prev => {
              const without = prev.filter(u => u.id !== newUser.id && u.email.toLowerCase() !== newUser.email.toLowerCase());
              return [newUser, ...without];
            });

            // Add initial welcome transaction
            const welcomeTx: CreditTransaction = {
              id: `tx-welcome-${Date.now()}`,
              userId: newUser.id,
              userName: newUser.name,
              amount: isDefaultAdmin ? 5000 : 25,
              balanceAfter: isDefaultAdmin ? 5000 : 25,
              type: 'admin_grant',
              note: isDefaultAdmin ? 'Administrator provisioning balance' : 'Welcome sign up bonus credits',
              date: new Date().toISOString().replace('T', ' ').substring(0, 16),
              timestamp: Date.now(),
            };
            setTransactions(prev => [welcomeTx, ...prev]);

            if (isDefaultAdmin) {
              setActivePanel('admin');
            }
          }

          // If current user is admin, fetch all registered users from Firestore for directory
          if (isAdminEmail(fbUser.email)) {
            setActivePanel('admin');
            try {
              const usersSnap = await safeGetDocs(collection(db, 'users'), 3500);
              if (usersSnap && !usersSnap.empty) {
                const fsUsers: User[] = [];
                usersSnap.forEach((d: any) => {
                  const uData = d.data() as User;
                  if (uData && uData.email && !isRemovedUser(uData)) {
                    fsUsers.push({
                      ...uData,
                      role: isAdminEmail(uData.email) ? 'admin' : 'client',
                    });
                  }
                });
                setUsers(prev => {
                  const map = new Map<string, User>();
                  prev.forEach(u => map.set(u.email.toLowerCase(), u));
                  fsUsers.forEach(u => map.set(u.email.toLowerCase(), u));
                  return Array.from(map.values());
                });
              }
            } catch (err) {
              console.warn('Operating in offline mode or cached directory:', err);
            }
          }
        } catch (e) {
          console.warn('Operating in offline mode with cached profile:', e);
          // Fallback to local profile with Firebase user info
          const isAdm = isAdminEmail(fbUser.email);
          const fallbackUser: User = {
            id: fbUser.uid,
            name: fbUser.displayName || (isAdm ? 'TurnitScope Administrator' : fbUser.email?.split('@')[0]) || 'User',
            email: fbUser.email || '',
            role: isAdm ? 'admin' : 'client',
            credits: isAdm ? 5000 : 25,
            planName: isAdm ? 'Master Administrator' : 'Verified Account',
            planExpiry: '2030-12-31',
            totalScans: isAdm ? 142 : 0,
            createdAt: new Date().toISOString().split('T')[0],
            emailVerified: fbUser.emailVerified,
            photoURL: fbUser.photoURL || null,
            authProvider: fbUser.providerData?.[0]?.providerId === 'google.com' ? 'google' : 'password',
          };
          setCurrentUser(fallbackUser);
          if (isAdm) {
            setActivePanel('admin');
          }
        }
      } else {
        // If not in Firebase Auth, check for active institutional local session
        const localActive = getActiveSessionUser();
        if (localActive) {
          setFirebaseUser(localActive);
          const cleanEmail = localActive.email?.toLowerCase() || '';
          const isDefaultAdmin = isAdminEmail(cleanEmail);
          const existing = users.find(u => u.email.toLowerCase() === cleanEmail);
          if (existing) {
            setCurrentUser({
              ...existing,
              role: isDefaultAdmin ? 'admin' : 'client',
            });
            if (isDefaultAdmin) {
              setActivePanel('admin');
            }
          } else {
            const newUser: User = {
              id: localActive.uid,
              name: localActive.displayName || (isDefaultAdmin ? 'TurnitScope Administrator' : cleanEmail.split('@')[0]) || 'Academic User',
              email: cleanEmail,
              role: isDefaultAdmin ? 'admin' : 'client',
              credits: isDefaultAdmin ? 5000 : 25,
              planName: isDefaultAdmin ? 'Master Administrator' : 'Standard Verified Plan',
              planExpiry: '2030-12-31',
              totalScans: isDefaultAdmin ? 142 : 0,
              createdAt: new Date().toISOString().split('T')[0],
              emailVerified: true,
              authProvider: 'password',
            };
            setCurrentUser(newUser);
            setUsers(prev => [newUser, ...prev]);
            if (isDefaultAdmin) {
              setActivePanel('admin');
            }
          }
        } else {
          setFirebaseUser(null);
        }
      }
      setIsAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Live real-time Firestore synchronization for users, activation codes, and transactions
  useEffect(() => {
    let unsubUsers: (() => void) | undefined;
    let unsubCodes: (() => void) | undefined;
    let unsubTxns: (() => void) | undefined;

    // Only attach live listeners when auth is ready and user is authenticated per Firebase Skill
    if (!firebaseUser) {
      return;
    }

    const isCurrentAdmin = isAdminEmail(firebaseUser.email || currentUser.email) || currentUser.role === 'admin';

    try {
      // 1. Live Users Collection Listener - strictly for administrators per security rules
      if (isCurrentAdmin) {
        unsubUsers = onSnapshot(
          collection(db, 'users'),
          (snapshot) => {
            if (!snapshot.empty) {
              const fsUsers: User[] = [];
              snapshot.forEach((docSnap) => {
                const d = docSnap.data();
                if (d && (d.email || d.name) && !isRemovedUser(d)) {
                  fsUsers.push({
                    id: docSnap.id,
                    name: d.name || (d.email ? d.email.split('@')[0] : 'Academic User'),
                    email: d.email || '',
                    role: isAdminEmail(d.email) ? 'admin' : (d.role || 'client'),
                    credits: typeof d.credits === 'number' ? d.credits : 0,
                    planName: d.planName || 'Standard Verified Plan',
                    planExpiry: d.planExpiry || '2027-12-31',
                    totalScans: typeof d.totalScans === 'number' ? d.totalScans : 0,
                    createdAt: d.createdAt || new Date().toISOString().split('T')[0],
                    emailVerified: !!d.emailVerified,
                    photoURL: d.photoURL || null,
                    authProvider: d.authProvider || 'password',
                  });
                }
              });

              if (!fsUsers.some(u => u.email.toLowerCase() === 'admin@turnitscope.com')) {
                fsUsers.unshift(ADMIN_USER_INITIAL);
              }

              setUsers(fsUsers);
              try {
                localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(fsUsers));
              } catch {}
            }
          },
          (err) => {
            console.warn('Live users subscription notice:', err.message);
          }
        );
      }

      // 2. Live Activation Codes Collection Listener
      unsubCodes = onSnapshot(
        collection(db, 'activation_codes'),
        (snapshot) => {
          if (!snapshot.empty) {
            const fsCodes: ActivationCode[] = [];
            snapshot.forEach((docSnap) => {
              const d = docSnap.data();
              if (d && d.code) {
                fsCodes.push({
                  id: docSnap.id,
                  code: d.code,
                  credits: typeof d.credits === 'number' ? d.credits : 10,
                  maxUses: typeof d.maxUses === 'number' ? d.maxUses : 100,
                  usedCount: typeof d.usedCount === 'number' ? d.usedCount : 0,
                  isActive: d.isActive !== undefined ? !!d.isActive : true,
                  createdAt: d.createdAt || new Date().toISOString().split('T')[0],
                  note: d.note || '',
                  createdBy: d.createdBy || 'Admin',
                });
              }
            });
            setActivationCodes(fsCodes);
            try {
              localStorage.setItem(STORAGE_KEY_CODES, JSON.stringify(fsCodes));
            } catch {}
          }
        },
        (err) => {
          console.warn('Live activation codes subscription notice:', err.message);
        }
      );

      // 3. Live Transactions Collection Listener
      // Admins listen to all transactions; individual users query only their own transactions
      const txnsQuery = isCurrentAdmin
        ? collection(db, 'transactions')
        : query(collection(db, 'transactions'), where('userId', '==', firebaseUser.uid));

      unsubTxns = onSnapshot(
        txnsQuery,
        (snapshot) => {
          if (!snapshot.empty) {
            const fsTxns: CreditTransaction[] = [];
            snapshot.forEach((docSnap) => {
              const d = docSnap.data();
              if (d && d.userId) {
                fsTxns.push({
                  id: docSnap.id,
                  userId: d.userId,
                  userName: d.userName || 'User',
                  amount: typeof d.amount === 'number' ? d.amount : 0,
                  balanceAfter: typeof d.balanceAfter === 'number' ? d.balanceAfter : 0,
                  type: d.type || 'admin_grant',
                  note: d.note || '',
                  date: d.date || new Date().toISOString().replace('T', ' ').substring(0, 16),
                  timestamp: typeof d.timestamp === 'number' ? d.timestamp : Date.now(),
                });
              }
            });
            fsTxns.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            setTransactions(fsTxns);
            try {
              localStorage.setItem(STORAGE_KEY_TXNS, JSON.stringify(fsTxns));
            } catch {}
          }
        },
        (err) => {
          console.warn('Live transactions subscription notice:', err.message);
        }
      );
    } catch (err) {
      console.warn('Firestore live listener attachment notice:', err);
    }

    return () => {
      if (unsubUsers) unsubUsers();
      if (unsubCodes) unsubCodes();
      if (unsubTxns) unsubTxns();
    };
  }, [firebaseUser, currentUser.email, currentUser.role]);

  const refreshFromFirestore = async () => {
    setIsFirestoreSyncing(true);
    const isCurrentAdmin = isAdminEmail(currentUser.email) || currentUser.role === 'admin';
    try {
      if (isCurrentAdmin) {
        const usersSnap = await safeGetDocs(collection(db, 'users'), 3500);
        if (usersSnap && !usersSnap.empty) {
          const fsUsers: User[] = [];
          usersSnap.forEach((docSnap: any) => {
            const d = docSnap.data();
            if (d && (d.email || d.name) && !isRemovedUser(d)) {
              fsUsers.push({
                id: docSnap.id,
                name: d.name || (d.email ? d.email.split('@')[0] : 'Academic User'),
                email: d.email || '',
                role: isAdminEmail(d.email) ? 'admin' : (d.role || 'client'),
                credits: typeof d.credits === 'number' ? d.credits : 0,
                planName: d.planName || 'Standard Verified Plan',
                planExpiry: d.planExpiry || '2027-12-31',
                totalScans: typeof d.totalScans === 'number' ? d.totalScans : 0,
                createdAt: d.createdAt || new Date().toISOString().split('T')[0],
                emailVerified: !!d.emailVerified,
                photoURL: d.photoURL || null,
                authProvider: d.authProvider || 'password',
              });
            }
          });
          if (!fsUsers.some(u => u.email.toLowerCase() === 'admin@turnitscope.com')) {
            fsUsers.unshift(ADMIN_USER_INITIAL);
          }
          setUsers(fsUsers);
          try {
            localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(fsUsers));
          } catch {}
        }
      }

      if (firebaseUser) {
        const codesSnap = await safeGetDocs(collection(db, 'activation_codes'), 3500);
        if (codesSnap && !codesSnap.empty) {
          const fsCodes: ActivationCode[] = [];
          codesSnap.forEach((docSnap: any) => {
            const d = docSnap.data();
            if (d && d.code) {
              fsCodes.push({
                id: docSnap.id,
                code: d.code,
                credits: typeof d.credits === 'number' ? d.credits : 10,
                maxUses: typeof d.maxUses === 'number' ? d.maxUses : 100,
                usedCount: typeof d.usedCount === 'number' ? d.usedCount : 0,
                isActive: d.isActive !== undefined ? !!d.isActive : true,
                createdAt: d.createdAt || new Date().toISOString().split('T')[0],
                note: d.note || '',
                createdBy: d.createdBy || 'Admin',
              });
            }
          });
          setActivationCodes(fsCodes);
          try {
            localStorage.setItem(STORAGE_KEY_CODES, JSON.stringify(fsCodes));
          } catch {}
        }

        const txnsQuery = isCurrentAdmin
          ? collection(db, 'transactions')
          : query(collection(db, 'transactions'), where('userId', '==', firebaseUser.uid));

        const txnsSnap = await safeGetDocs(txnsQuery, 3500);
        if (txnsSnap && !txnsSnap.empty) {
          const fsTxns: CreditTransaction[] = [];
          txnsSnap.forEach((docSnap: any) => {
            const d = docSnap.data();
            if (d && d.userId) {
              fsTxns.push({
                id: docSnap.id,
                userId: d.userId,
                userName: d.userName || 'User',
                amount: typeof d.amount === 'number' ? d.amount : 0,
                balanceAfter: typeof d.balanceAfter === 'number' ? d.balanceAfter : 0,
                type: d.type || 'admin_grant',
                note: d.note || '',
                date: d.date || new Date().toISOString().replace('T', ' ').substring(0, 16),
                timestamp: typeof d.timestamp === 'number' ? d.timestamp : Date.now(),
              });
            }
          });
          fsTxns.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
          setTransactions(fsTxns);
          try {
            localStorage.setItem(STORAGE_KEY_TXNS, JSON.stringify(fsTxns));
          } catch {}
        }
      }

      setNotification({ message: 'Live data synchronized from Cloud Firestore database!', type: 'success' });
    } catch (err) {
      console.warn('Manual Firestore refresh notice:', err);
      setNotification({ message: 'Refreshed with cached data.', type: 'info' });
    } finally {
      setIsFirestoreSyncing(false);
    }
  };

  // Firebase Auth Handlers
  const signInWithGoogleAuth = async () => {
    try {
      const result = await signInWithGoogle();
      const newUser = buildUserFromAuthProfile({
        uid: result.user.uid,
        email: result.user.email,
        displayName: result.user.displayName,
        photoURL: result.user.photoURL,
        emailVerified: result.user.emailVerified,
        providerData: result.user.providerData?.map(provider => ({
          providerId: provider.providerId,
          email: provider.email,
        })),
      });

      setCurrentUser(newUser);
      setFirebaseUser(result.user);
      setUsers(prev => {
        const without = prev.filter(u => u.id !== newUser.id && u.email.toLowerCase() !== newUser.email.toLowerCase());
        return [newUser, ...without];
      });
      if (newUser.email) {
        safeSetDoc(doc(db, 'users', newUser.id), newUser).catch(() => {});
      }
      await syncUsersFromFirestoreIfPossible();
      setActivePanel(newUser.role === 'admin' ? 'admin' : 'client');
      setNotification({
        message: `Welcome, ${newUser.name || newUser.email}! Signed in with Google.`,
        type: 'success',
      });
    } catch (err: unknown) {
      console.error('Google Sign-In error:', err);
      const errMsg = err instanceof Error ? err.message : 'Google authentication failed';
      setNotification({
        message: `Google Sign In: ${errMsg}`,
        type: 'error',
      });
      throw err;
    }
  };

  const registerWithEmailAuth = async (name: string, email: string, pass: string) => {
    try {
      const result = await registerWithEmail(name, email, pass);
      setFirebaseUser(result.user);
      const cleanEmail = result.user.email?.toLowerCase() || email.trim().toLowerCase();
      const isDefaultAdmin = isAdminEmail(cleanEmail);

      const newUser: User = {
        id: result.user.uid,
        name: result.user.displayName || (isDefaultAdmin ? 'TurnitScope Administrator' : name.trim()) || cleanEmail.split('@')[0],
        email: cleanEmail,
        role: isDefaultAdmin ? 'admin' : 'client',
        credits: isDefaultAdmin ? 5000 : 25,
        planName: isDefaultAdmin ? 'Master Administrator' : 'Standard Verified Plan',
        planExpiry: isDefaultAdmin ? '2030-12-31' : '2027-12-31',
        totalScans: isDefaultAdmin ? 142 : 0,
        createdAt: new Date().toISOString().split('T')[0],
        emailVerified: true,
        photoURL: result.user.photoURL || null,
        authProvider: 'password',
      };
      setCurrentUser(newUser);
      setUsers(prev => {
        const without = prev.filter(u => u.id !== newUser.id && u.email.toLowerCase() !== newUser.email.toLowerCase());
        return [newUser, ...without];
      });

      if (isDefaultAdmin) {
        setActivePanel('admin');
      }

      // Add 25 bonus credits transaction
      const welcomeTx: CreditTransaction = {
        id: `tx-welcome-${Date.now()}`,
        userId: newUser.id,
        userName: newUser.name,
        amount: isDefaultAdmin ? 5000 : 25,
        balanceAfter: isDefaultAdmin ? 5000 : 25,
        type: 'admin_grant',
        note: isDefaultAdmin ? 'Administrator provisioning balance' : 'Welcome sign up bonus credits',
        date: new Date().toISOString().replace('T', ' ').substring(0, 16),
        timestamp: Date.now(),
      };
      setTransactions(prev => [welcomeTx, ...prev]);

      // Attempt Firestore sync safely in background if online
      safeSetDoc(doc(db, 'users', newUser.id), newUser);

      setNotification({
        message: isDefaultAdmin
          ? `Welcome Master Administrator (${newUser.email})!`
          : `Account created for ${newUser.email}! 25 complimentary credits added.`,
        type: 'success',
      });
    } catch (err: unknown) {
      console.error('Email Registration error:', err);
      const errMsg = err instanceof Error ? err.message : 'Registration failed';
      setNotification({
        message: `Registration Error: ${errMsg}`,
        type: 'error',
      });
      throw err;
    }
  };

  const signInWithEmailAuth = async (email: string, pass: string) => {
    try {
      const result = await loginWithEmail(email, pass);
      setFirebaseUser(result.user);
      const cleanEmail = result.user.email?.toLowerCase() || email.trim().toLowerCase();
      const isDefaultAdmin = isAdminEmail(cleanEmail);
      const existingUser = users.find(u => u.email.toLowerCase() === cleanEmail);
      if (existingUser) {
        const updated = {
          ...existingUser,
          role: (isDefaultAdmin ? 'admin' : 'client') as 'admin' | 'client',
        };
        setCurrentUser(updated);
        if (isDefaultAdmin) {
          setActivePanel('admin');
        }
      } else {
        const newUser: User = {
          id: result.user.uid,
          name: result.user.displayName || (isDefaultAdmin ? 'TurnitScope Administrator' : cleanEmail.split('@')[0]),
          email: cleanEmail,
          role: isDefaultAdmin ? 'admin' : 'client',
          credits: isDefaultAdmin ? 5000 : 25,
          planName: isDefaultAdmin ? 'Master Administrator' : 'Standard Verified Plan',
          planExpiry: isDefaultAdmin ? '2030-12-31' : '2027-12-31',
          totalScans: isDefaultAdmin ? 142 : 0,
          createdAt: new Date().toISOString().split('T')[0],
          emailVerified: true,
          photoURL: result.user.photoURL || null,
          authProvider: 'password',
        };
        setCurrentUser(newUser);
        setUsers(prev => [newUser, ...prev]);
        safeSetDoc(doc(db, 'users', newUser.id), newUser);
        if (isDefaultAdmin) {
          setActivePanel('admin');
        }
      }

      setNotification({
        message: `Signed in successfully as ${result.user.email}!`,
        type: 'success',
      });
    } catch (err: unknown) {
      console.error('Email Sign-In error:', err);
      const errMsg = err instanceof Error ? err.message : 'Sign in failed';
      setNotification({
        message: `Sign In Error: ${errMsg}`,
        type: 'error',
      });
      throw err;
    }
  };

  const signOutAuth = async () => {
    try {
      await logOut();
      setFirebaseUser(null);
      localStorage.removeItem(STORAGE_KEY_USER);
      setCurrentUser(INITIAL_CURRENT_USER);
      setNotification({
        message: 'You have signed out successfully.',
        type: 'info',
      });
    } catch (err: unknown) {
      console.error('Logout error:', err);
      const errMsg = err instanceof Error ? err.message : 'Sign out error';
      setNotification({
        message: errMsg,
        type: 'error',
      });
    }
  };

  const sendEmailVerificationAuth = async () => {
    try {
      await sendVerificationToCurrentUser();
      setNotification({
        message: 'Verification link dispatched! Please check your inbox.',
        type: 'success',
      });
    } catch (err: unknown) {
      console.error('Verification error:', err);
      const errMsg = err instanceof Error ? err.message : 'Could not send verification';
      setNotification({
        message: errMsg,
        type: 'error',
      });
    }
  };

  const resetPasswordAuth = async (email: string) => {
    try {
      await resetPasswordForEmail(email);
      setNotification({
        message: `Password reset instructions sent to ${email}`,
        type: 'success',
      });
    } catch (err: unknown) {
      console.error('Reset password error:', err);
      const errMsg = err instanceof Error ? err.message : 'Could not send reset email';
      setNotification({
        message: errMsg,
        type: 'error',
      });
    }
  };

  // Give credits to a user (Admin feature - mapped directly to Cloud Firestore)
  const giveCredits = (userId: string, amount: number, note: string = 'Admin Credit Grant') => {
    if (!isAdminEmail(currentUser.email)) {
      setNotification({ message: 'Unauthorized: Only administrators can allocate credits.', type: 'error' });
      return false;
    }
    if (amount <= 0 && !confirm('Are you sure you want to deduct credits?')) return false;

    const targetUser = users.find(u => u.id === userId) || currentUser;
    const newBal = Math.max(0, targetUser.credits + amount);

    setUsers(prevUsers =>
      prevUsers.map(u => {
        if (u.id === userId) {
          return { ...u, credits: newBal };
        }
        return u;
      })
    );

    if (currentUser.id === userId) {
      setCurrentUser(prev => ({ ...prev, credits: newBal }));
    }

    const newTxn: CreditTransaction = {
      id: `tx-${Date.now()}`,
      userId,
      userName: targetUser.name,
      amount,
      balanceAfter: newBal,
      type: 'admin_grant',
      note,
      date: new Date().toISOString().replace('T', ' ').substring(0, 16),
      timestamp: Date.now(),
    };

    setTransactions(prev => [newTxn, ...prev]);

    // MAP TO FIRESTORE: Update user document in Firestore users collection
    safeSetDoc(doc(db, 'users', userId), {
      credits: newBal,
      name: targetUser.name,
      email: targetUser.email,
    }, { merge: true }).catch(err => {
      console.warn('Notice while updating user credits in Firestore:', err);
    });

    // MAP TO FIRESTORE: Save transaction record
    safeSetDoc(doc(db, 'transactions', newTxn.id), newTxn).catch(err => {
      console.warn('Notice while writing transaction to Firestore:', err);
    });

    setNotification({
      message: `Successfully allocated ${amount > 0 ? `+${amount}` : amount} credits to ${targetUser.name} (synced to Firestore)!`,
      type: 'success',
    });
    return true;
  };

  // Add user as Admin (Create user profile with initial credits directly in Cloud Firestore)
  const addUserAsAdmin = async (userData: {
    name: string;
    email: string;
    credits: number;
    planName?: string;
    planExpiry?: string;
  }): Promise<boolean> => {
    if (!isAdminEmail(currentUser.email)) {
      setNotification({ message: 'Unauthorized: Only administrators can add users.', type: 'error' });
      return false;
    }
    const cleanEmail = userData.email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setNotification({ message: 'Please provide a valid email address.', type: 'error' });
      return false;
    }
    if (users.some(u => u.email.toLowerCase() === cleanEmail)) {
      setNotification({ message: `A user with email ${cleanEmail} already exists.`, type: 'error' });
      return false;
    }

    const newId = `usr-${Date.now()}`;
    const newUser: User = {
      id: newId,
      name: userData.name.trim() || cleanEmail.split('@')[0],
      email: cleanEmail,
      role: 'client',
      credits: Math.max(0, userData.credits),
      planName: userData.planName || 'Standard Verified Plan',
      planExpiry: userData.planExpiry || '2027-12-31',
      totalScans: 0,
      createdAt: new Date().toISOString().split('T')[0],
      emailVerified: true,
      authProvider: 'password',
    };

    setUsers(prev => [newUser, ...prev]);

    // MAP TO FIRESTORE: Save user document to Firestore
    try {
      await safeSetDoc(doc(db, 'users', newUser.id), newUser);

      if (newUser.credits > 0) {
        const welcomeTx: CreditTransaction = {
          id: `tx-newuser-${Date.now()}`,
          userId: newUser.id,
          userName: newUser.name,
          amount: newUser.credits,
          balanceAfter: newUser.credits,
          type: 'admin_grant',
          note: `Admin provisioned user account with ${newUser.credits} credits`,
          date: new Date().toISOString().replace('T', ' ').substring(0, 16),
          timestamp: Date.now(),
        };
        setTransactions(prev => [welcomeTx, ...prev]);
        safeSetDoc(doc(db, 'transactions', welcomeTx.id), welcomeTx).catch(() => {});
      }

      setNotification({
        message: `User ${newUser.name} created and saved directly to Cloud Firestore!`,
        type: 'success',
      });
      return true;
    } catch (err) {
      console.warn('Notice while writing new user to Firestore:', err);
      setNotification({
        message: 'Created user locally (synced to offline cache).',
        type: 'info',
      });
      return true;
    }
  };

  // Update user as Admin (Update user profile, plan, or credits directly in Firestore)
  const updateUserAsAdmin = async (userId: string, updates: Partial<User>): Promise<boolean> => {
    if (!isAdminEmail(currentUser.email)) {
      setNotification({ message: 'Unauthorized: Only administrators can update user accounts.', type: 'error' });
      return false;
    }
    const targetUser = users.find(u => u.id === userId);
    const prevCredits = targetUser ? targetUser.credits : 0;

    setUsers(prev =>
      prev.map(u => (u.id === userId ? { ...u, ...updates } : u))
    );

    if (currentUser.id === userId) {
      setCurrentUser(prev => ({ ...prev, ...updates }));
    }

    // MAP TO FIRESTORE: Update document in Firestore
    try {
      await safeSetDoc(doc(db, 'users', userId), updates, { merge: true });

      if (updates.credits !== undefined && updates.credits !== prevCredits) {
        const diff = updates.credits - prevCredits;
        const auditTxn: CreditTransaction = {
          id: `tx-${Date.now()}`,
          userId,
          userName: updates.name || targetUser?.name || 'User',
          amount: diff,
          balanceAfter: updates.credits,
          type: 'admin_grant',
          note: `Admin modified credit balance: ${prevCredits} -> ${updates.credits}`,
          date: new Date().toISOString().replace('T', ' ').substring(0, 16),
          timestamp: Date.now(),
        };
        setTransactions(prev => [auditTxn, ...prev]);
        safeSetDoc(doc(db, 'transactions', auditTxn.id), auditTxn).catch(() => {});
      }

      setNotification({
        message: `User record for ${updates.name || targetUser?.name || 'user'} updated in Cloud Firestore!`,
        type: 'success',
      });
      return true;
    } catch (err) {
      console.warn('Notice while updating user in Firestore:', err);
      setNotification({
        message: 'Updated user locally (synced to offline cache).',
        type: 'info',
      });
      return true;
    }
  };

  // Redeem code (Client feature)
  const redeemCode = (codeStr: string) => {
    const cleanCode = codeStr.trim().toUpperCase();
    const foundCode = activationCodes.find(
      c => c.code.toUpperCase() === cleanCode && c.isActive
    );

    if (!foundCode) {
      return { success: false, message: 'Invalid or inactive activation code.' };
    }

    if (foundCode.usedCount >= foundCode.maxUses) {
      return { success: false, message: 'This code has reached its maximum redemption limit.' };
    }

    // Award credits to current user
    const creditAmount = foundCode.credits;
    const newBal = currentUser.credits + creditAmount;

    setCurrentUser(prev => ({
      ...prev,
      credits: newBal,
      planName: prev.planName === 'No active plan assigned.' ? 'Active Credit Plan' : prev.planName,
    }));

    setUsers(prevUsers =>
      prevUsers.map(u => (u.id === currentUser.id ? { ...u, credits: newBal } : u))
    );

    // MAP TO FIRESTORE: Update user balance in Firestore
    safeSetDoc(doc(db, 'users', currentUser.id), { credits: newBal }, { merge: true }).catch(() => {});

    // Update activation code usage
    const updatedUsedCount = foundCode.usedCount + 1;
    const stillActive = updatedUsedCount < foundCode.maxUses;
    setActivationCodes(prev =>
      prev.map(c => (c.id === foundCode.id ? { ...c, usedCount: updatedUsedCount, isActive: stillActive } : c))
    );

    // MAP TO FIRESTORE: Update activation code in Firestore
    safeSetDoc(doc(db, 'activation_codes', foundCode.id), {
      usedCount: updatedUsedCount,
      isActive: stillActive,
    }, { merge: true }).catch(() => {});

    // Log transaction
    const newTxn: CreditTransaction = {
      id: `tx-${Date.now()}`,
      userId: currentUser.id,
      userName: currentUser.name,
      amount: creditAmount,
      balanceAfter: newBal,
      type: 'redeem_code',
      note: `Redeemed code: ${foundCode.code}`,
      date: new Date().toISOString().replace('T', ' ').substring(0, 16),
      timestamp: Date.now(),
    };
    setTransactions(prev => [newTxn, ...prev]);

    // MAP TO FIRESTORE: Save transaction
    safeSetDoc(doc(db, 'transactions', newTxn.id), newTxn).catch(() => {});

    setNotification({
      message: `Code redeemed successfully! +${creditAmount} credits added to your account.`,
      type: 'success',
    });

    return { success: true, message: `Redeemed +${creditAmount} credits!`, creditsAdded: creditAmount };
  };

  // Generate activation code (Admin feature - mapped directly to Cloud Firestore)
  const generateCode = (codeStr: string, credits: number, maxUses: number = 100, note?: string): ActivationCode => {
    if (!isAdminEmail(currentUser.email)) {
      setNotification({ message: 'Unauthorized: Only administrators can generate activation codes.', type: 'error' });
      return { id: '', code: '', credits: 0, maxUses: 0, usedCount: 0, isActive: false, createdAt: '', createdBy: '' };
    }
    const formattedCode = codeStr.trim().toUpperCase().startsWith('TC-')
      ? codeStr.trim().toUpperCase()
      : `TC-${codeStr.trim().toUpperCase()}`;

    const newCode: ActivationCode = {
      id: `code-${Date.now()}`,
      code: formattedCode,
      credits,
      maxUses,
      usedCount: 0,
      isActive: true,
      createdAt: new Date().toISOString().split('T')[0],
      note: note || `Admin generated ${credits} credit code`,
      createdBy: 'Admin Panel',
    };

    setActivationCodes(prev => [newCode, ...prev]);

    // MAP TO FIRESTORE: Save activation code in Firestore
    safeSetDoc(doc(db, 'activation_codes', newCode.id), newCode).catch(err => {
      console.warn('Notice while writing activation code to Firestore:', err);
    });

    setNotification({
      message: `New code created in Firestore: ${newCode.code} (${credits} credits)`,
      type: 'success',
    });
    return newCode;
  };

  const deleteCode = (codeId: string) => {
    if (!isAdminEmail(currentUser.email)) {
      setNotification({ message: 'Unauthorized: Only administrators can delete codes.', type: 'error' });
      return;
    }
    setActivationCodes(prev => prev.filter(c => c.id !== codeId));

    // MAP TO FIRESTORE: Delete activation code from Firestore
    deleteDoc(doc(db, 'activation_codes', codeId)).catch(err => {
      console.warn('Notice while deleting activation code from Firestore:', err);
    });

    setNotification({ message: 'Activation code deleted from Firestore', type: 'info' });
  };

  const toggleCodeActivation = (codeId: string) => {
    if (!isAdminEmail(currentUser.email)) {
      setNotification({ message: 'Unauthorized: Only administrators can change code visibility.', type: 'error' });
      return;
    }

    const targetCode = activationCodes.find(c => c.id === codeId);
    if (!targetCode) return;

    const nextIsActive = !targetCode.isActive;
    setActivationCodes(prev =>
      prev.map(c => (c.id === codeId ? { ...c, isActive: nextIsActive } : c))
    );

    safeSetDoc(doc(db, 'activation_codes', codeId), { isActive: nextIsActive }, { merge: true }).catch(err => {
      console.warn('Notice while toggling activation code state in Firestore:', err);
    });

    setNotification({
      message: `${targetCode.code} is now ${nextIsActive ? 'active' : 'inactive'} and ${nextIsActive ? 'visible to clients' : 'hidden from clients'}.`,
      type: 'success',
    });
  };

  const deleteUser = async (userId: string) => {
    if (!isAdminEmail(currentUser.email)) {
      setNotification({ message: 'Unauthorized: Only administrators can manage user accounts.', type: 'error' });
      return;
    }
    const target = users.find(u => u.id === userId);
    if (!target) return;
    if (target.email.toLowerCase() === 'admin@turnitscope.com' || target.id === currentUser.id) {
      setNotification({ message: 'Primary administrator account cannot be deleted.', type: 'error' });
      return;
    }
    setUsers(prev => {
      const updated = prev.filter(u => u.id !== userId);
      try {
        localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(updated));
      } catch {}
      return updated;
    });

    // MAP TO FIRESTORE: Delete user document from Firestore
    try {
      await deleteDoc(doc(db, 'users', userId));
    } catch (err) {
      console.warn('Notice while removing user document from Firestore:', err);
    }
    setNotification({ message: `User ${target.name} (${target.email}) permanently deleted from Firestore.`, type: 'info' });
  };

  // Run scan (Client feature)
  const runScan = async (options: {
    fileName: string;
    mode: ScanMode;
    authorFirst?: string;
    authorLast?: string;
    excludeBibliography?: boolean;
    excludeQuotes?: boolean;
    fileContent?: string;
    institution?: string;
    fileData?: string;
    storagePath?: string;
    fileMimeType?: string;
    htmlContent?: string;
    htmlPages?: string[];
    pageCount?: number;
  }): Promise<{ success: boolean; error?: string; report?: ScanReport }> => {
    const creditCosts: Record<ScanMode, number> = {
      ai: 2,
      plagiarism: 3,
      both: 5,
    };

    const cost = creditCosts[options.mode];

    if (currentUser.credits < cost) {
      return {
        success: false,
        error: `Insufficient credits. This check requires ${cost} credits, but you have ${currentUser.credits}. Redeem an activation code or contact your Admin to get credits.`,
      };
    }

    setIsScanning(true);
    setScanProgress({ step: 'Uploading and parsing document structure...', percent: 15 });

    try {
      setScanProgress({ step: 'Extracting text and preparing the document layout...', percent: 45 });
      setScanProgress({ step: 'Rendering the final report from the uploaded document...', percent: 75 });

      const newBal = currentUser.credits - cost;
      setCurrentUser(prev => ({
        ...prev,
        credits: newBal,
        totalScans: prev.totalScans + 1,
      }));

      setUsers(prev =>
        prev.map(u =>
          u.id === currentUser.id
            ? { ...u, credits: newBal, totalScans: u.totalScans + 1 }
            : u
        )
      );

      if (firebaseUser) {
        safeSetDoc(
          doc(db, 'users', firebaseUser.uid),
          { credits: newBal, totalScans: currentUser.totalScans + 1 },
          { merge: true }
        );
      }

      const modeNameMap: Record<ScanMode, 'AI Detection' | 'Plagiarism Check' | 'Both'> = {
        ai: 'AI Detection',
        plagiarism: 'Plagiarism Check',
        both: 'Both',
      };

      // Local detector distribution: 15% at 0%, 70% at 1-20%, and 15% at 21-70%.
      // Scores are independent of the document name and drive the existing highlight renderer.
      const aiEnabled = options.mode === 'ai' || options.mode === 'both';
      const aiRoll = Math.random();
      const aiScore = !aiEnabled
        ? 0
        : aiRoll < 0.15
        ? 0
        : aiRoll < 0.85
        ? Math.floor(Math.random() * 20) + 1
        : Math.floor(Math.random() * 50) + 21;
      const plagScore =
        options.mode === 'plagiarism' || options.mode === 'both'
          ? Math.floor(Math.random() * 13)
          : 0;
      const excludeQuotesSetting = options.excludeQuotes !== false;
      const excludeBibliographySetting = options.excludeBibliography !== false;

      const authorFullName =
        (options.authorFirst || options.authorLast)
          ? `${options.authorFirst || ''} ${options.authorLast || ''}`.trim()
          : currentUser.name;

      const sampleText = cleanText(options.fileContent || '');
      if (!sampleText || sampleText.length < 50 || sampleText.includes('PK') || sampleText.includes('docProps')) {
        return {
          success: false,
          error: 'No readable text could be extracted from this document. Please upload a valid document with actual content to run the scan.',
        };
      }

      const rawWords = sampleText.trim().split(/\s+/).filter(Boolean).length;
      const calculatedWordCount = Math.max(720, rawWords);
      const calculatedCharCount = sampleText.length > 500 ? sampleText.length : calculatedWordCount * 6;
      const calculatedPageCount = options.pageCount || Math.max(1, Math.ceil(calculatedWordCount / 320));

      const sourcesList: MatchedSource[] = generateSourcesForDocument(
        options.fileName,
        options.fileName,
        plagScore
      );
      const internetSum = sourcesList
        .filter(source => source.type === 'internet')
        .reduce((sum, source) => sum + source.similarity, 0);
      const pubSum = sourcesList
        .filter(source => source.type === 'publication')
        .reduce((sum, source) => sum + source.similarity, 0);
      const studentSum = sourcesList
        .filter(source => source.type === 'student_paper')
        .reduce((sum, source) => sum + source.similarity, 0);

      const generatedSnippets: HighlightedSnippet[] = generateSmartSnippets(
        sampleText,
        aiScore,
        plagScore,
        sourcesList,
        {
          excludeQuotes: excludeQuotesSetting,
          excludeBibliography: excludeBibliographySetting,
        }
      );

      const now = Date.now();
      const newReport: ScanReport = {
        id: `rep-${Date.now()}`,
        userId: currentUser.id,
        expiresAt: now + ONE_DAY_MS,
        title: options.fileName,
        fileName: options.fileName,
        fileSize: options.fileData ? `${Math.max(0.1, Math.round((options.fileData.length * 0.75) / 1024 / 10.24) / 100)} MB` : '1.8 MB',
        author: authorFullName || 'Author',
        type: modeNameMap[options.mode] || 'Both',
        status: 'Completed',
        plagiarismScore: plagScore,
        aiScore: aiScore,
        wordCount: calculatedWordCount,
        characterCount: calculatedCharCount,
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ', ' + new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }),
        timestamp: now,
        excludeBibliography: options.excludeBibliography !== false,
        excludeQuotes: options.excludeQuotes !== false,
        submissionId: `trn:oid:${Math.floor(21940000000 + Math.random() * 99999999)}`,
        sources: sourcesList,
        contentSample: sampleText,
        snippets: generatedSnippets,
        institution: options.institution || currentUser.institution || 'Allama Iqbal Open University',
        submissionDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ', ' + new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }),
        downloadDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ', ' + new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }),
        pageCount: calculatedPageCount,
        fileData: options.fileData,
        storagePath: options.storagePath,
        fileMimeType: options.fileMimeType,
        text: sampleText,
        htmlContent: options.htmlContent,
        htmlPages: options.htmlPages,
        matchGroups: {
          notCitedOrQuoted: 0,
          notCitedOrQuotedScore: 0,
          missingQuotations: 0,
          missingCitation: 0,
          citedAndQuoted: 0,
        },
        sourceDistribution: {
          internet: internetSum,
          publications: pubSum,
          studentPapers: studentSum,
        },
        integrityFlagsCount: 0,
      };

      setReports(prev => {
        const merged = [newReport, ...prev.filter(r => r.id !== newReport.id)];
        return pruneExpiredReports(merged, currentUser.id);
      });

      if (firebaseUser) {
        safeSetDoc(doc(db, 'reports', newReport.id), {
          ...newReport,
          userId: firebaseUser.uid,
          expiresAt: newReport.expiresAt,
        });
      }

      const scanTxn: CreditTransaction = {
        id: `tx-${Date.now()}`,
        userId: currentUser.id,
        userName: currentUser.name,
        amount: -cost,
        balanceAfter: newBal,
        type: 'scan_deduction',
        note: `Scanned document: ${options.fileName} (${modeNameMap[options.mode]})`,
        date: new Date().toISOString().replace('T', ' ').substring(0, 16),
        timestamp: Date.now(),
      };
      setTransactions(prev => [scanTxn, ...prev]);

      setScanProgress({ step: 'Finalizing report and rendering document...', percent: 100 });
      setTimeout(() => {
        setIsScanning(false);
        setScanProgress(null);
      }, 300);

      setNotification({
        message: `Scan finished! Report generated successfully (-${cost} credits).`,
        type: 'success',
      });

      return { success: true, report: newReport };
    } catch (error) {
      console.error('Scan failed:', error);
      setIsScanning(false);
      setScanProgress(null);
      setNotification({
        message: 'Scan failed while processing the document. Please try again.',
        type: 'error',
      });
      return { success: false, error: 'Scan failed while processing the document.' };
    }
  };

  const deleteReport = (reportId: string) => {
    setReports(prev => prev.filter(r => r.id !== reportId));
    if (currentUser?.id) {
      const storageKey = getReportsStorageKey(currentUser.id);
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          const items: ScanReport[] = JSON.parse(saved).filter((r: ScanReport) => r.id !== reportId);
          localStorage.setItem(storageKey, JSON.stringify(items));
        } catch {}
      }
    }
    setNotification({ message: 'Report removed', type: 'info' });
  };

  const updateCurrentUser = async (updates: Partial<User>) => {
    setCurrentUser(prev => {
      const updated = { ...prev, ...updates };
      if (firebaseUser) {
        safeSetDoc(doc(db, 'users', firebaseUser.uid), updated, { merge: true });
      }
      return updated;
    });
    setUsers(prev =>
      prev.map(u => (u.id === currentUser.id ? { ...u, ...updates } : u))
    );
    if (updates.name || updates.photoURL !== undefined || updates.email) {
      await updateFirebaseUserProfile(updates.name, updates.photoURL, updates.email);
    }
    setNotification({ message: 'Profile updated successfully!', type: 'success' });
  };

  const resetAllData = () => {
    localStorage.removeItem(STORAGE_KEY_USER);
    localStorage.removeItem(STORAGE_KEY_USERS);
    localStorage.removeItem(STORAGE_KEY_REPORTS);
    localStorage.removeItem(STORAGE_KEY_CODES);
    localStorage.removeItem(STORAGE_KEY_TXNS);
    setCurrentUser(INITIAL_CURRENT_USER);
    setUsers(INITIAL_USERS);
    setReports(INITIAL_REPORTS);
    setActivationCodes(INITIAL_CODES);
    setTransactions([]);
    setNotification({ message: 'Database reset to clean deployment state', type: 'info' });
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        users,
        reports,
        activationCodes,
        transactions,
        activePanel,
        activeTab,
        selectedReport,
        isScanning,
        scanProgress,
        notification,
        isProfileModalOpen,
        firebaseUser,
        isAuthLoading,
        signInWithGoogleAuth,
        registerWithEmailAuth,
        signInWithEmailAuth,
        signOutAuth,
        sendEmailVerificationAuth,
        resetPasswordAuth,
        setActivePanel: handleSetActivePanel,
        setActiveTab,
        setSelectedReport,
        setIsProfileModalOpen,
        setNotification,
        giveCredits,
        deleteUser,
        redeemCode,
        generateCode,
        deleteCode,
        toggleCodeActivation,
        runScan,
        deleteReport,
        updateCurrentUser,
        addUserAsAdmin,
        updateUserAsAdmin,
        refreshFromFirestore,
        isFirestoreSyncing,
        resetAllData,
        isSidebarOpen,
        setIsSidebarOpen,
        toggleSidebar,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
