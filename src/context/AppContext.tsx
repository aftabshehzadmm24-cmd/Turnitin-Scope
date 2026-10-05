import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, ScanReport, ActivationCode, PurchaseKey, CreditTransaction, ScanMode, HighlightedSnippet, MatchedSource } from '../types';
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
  safeSetDoc,
  safeGetDoc,
  safeGetDocs,
  cleanFirestoreData,
  updateFirebaseUserProfile,
  FirebaseUser,
  ADMIN_EMAIL,
} from '../lib/firebase';
import { doc, collection, deleteDoc, onSnapshot, query, runTransaction, setDoc, where } from 'firebase/firestore';
import { buildUserFromAuthProfile } from '../lib/userProfiles';
import { deleteReportFile, getReportFile, pruneExpiredReportFiles, saveReportFile } from '../utils/reportFileStore';

export { buildUserFromAuthProfile };

export const isAdminEmail = (email?: string | null): boolean => {
  if (!email) return false;
  const em = email.trim().toLowerCase();
  return em === ADMIN_EMAIL;
};

const addOneCalendarMonth = (date: Date): Date => {
  const result = new Date(date);
  const dayOfMonth = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + 1);
  const lastDayOfMonth = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(dayOfMonth, lastDayOfMonth));
  return result;
};

const formatPakistanDateTime = (value: Date | number = Date.now()): string => {
  const date = value instanceof Date ? value : new Date(value);
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

interface AppContextType {
  currentUser: User;
  users: User[];
  reports: ScanReport[];
  activationCodes: ActivationCode[];
  purchaseKeys: PurchaseKey[];
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
  giveCredits: (userId: string, amount: number, note?: string) => Promise<boolean>;
  deleteUser: (userId: string) => Promise<void>;
  generateCode: (codeStr: string, credits: number, maxUses?: number, note?: string) => ActivationCode;
  deleteCode: (codeId: string) => void;
  toggleCodeActivation: (codeId: string) => void;
  createPurchaseKey: (key: string, credits: number, note?: string) => Promise<PurchaseKey | null>;
  deletePurchaseKey: (keyId: string) => Promise<boolean>;
  redeemPurchaseKey: (key: string) => Promise<boolean>;
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
    sourceFileData?: string;
    sourceFileMimeType?: string;
    sourceFileSize?: number;
    htmlContent?: string;
    htmlPages?: string[];
    pageCount?: number;
  }) => Promise<{ success: boolean; error?: string; report?: ScanReport }>;
  deleteReport: (reportId: string) => Promise<void>;
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

const hydrateReportFiles = async (items: ScanReport[]): Promise<ScanReport[]> => Promise.all(
  items.map(async report => {
    if (report.fileData) return report;
    try {
      const fileData = await getReportFile(report.id);
      return fileData ? { ...report, fileData } : report;
    } catch (error) {
      console.warn('Could not restore the local original document for report:', error);
      return report;
    }
  })
);

const preserveReportFiles = (incomingReports: ScanReport[], existingReports: ScanReport[]): ScanReport[] => {
  const existingFiles = new Map(existingReports.map(report => [report.id, report.fileData]));
  return incomingReports.map(report => ({
    ...report,
    fileData: report.fileData || existingFiles.get(report.id),
  }));
};

const INITIAL_CURRENT_USER: User = {
  id: '',
  name: 'Academic User',
  email: '',
  role: 'client',
  credits: 0,
  usedCredits: 0,
  planName: 'Standard Tier',
  planExpiry: '2027-12-31',
  totalScans: 0,
  createdAt: '2026-01-01',
  emailVerified: false,
};

export const ADMIN_USER_INITIAL: User = {
  id: 'usr-admin-turnitscope',
  name: 'TurnitScope Admin',
  email: ADMIN_EMAIL,
  role: 'admin',
  credits: 0,
  usedCredits: 0,
  planName: 'Master Administrator',
  planExpiry: '2030-12-31',
  totalScans: 0,
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
        credits: isAdminEmail(parsed.email) ? 0 : parsed.credits,
        usedCredits: isAdminEmail(parsed.email) ? 0 : (parsed.usedCredits ?? 0),
        totalScans: isAdminEmail(parsed.email) ? 0 : parsed.totalScans,
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
    const sanitized: User[] = list
      .filter(u => !isRemovedUser(u))
      .map(u => ({
        ...u,
        role: (isAdminEmail(u.email) ? 'admin' : 'client') as 'admin' | 'client',
        credits: isAdminEmail(u.email) ? 0 : u.credits,
        usedCredits: isAdminEmail(u.email) ? 0 : (u.usedCredits ?? 0),
      }));
    if (!sanitized.some(u => u.email.toLowerCase() === ADMIN_EMAIL)) {
      sanitized.unshift(ADMIN_USER_INITIAL);
    }
    try {
      localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(sanitized));
    } catch {}
    return sanitized;
  });

  const [reports, setReports] = useState<ScanReport[]>([]);

  useEffect(() => {
    void pruneExpiredReportFiles().catch(error => {
      console.warn('Could not prune expired original documents from IndexedDB:', error);
    });
  }, []);

  useEffect(() => {
    let isCancelled = false;
    const userId = currentUser?.id;
    if (!userId) {
      setReports([]);
      return () => {
        isCancelled = true;
      };
    }

    const saved = localStorage.getItem(getReportsStorageKey(userId));
    if (!saved) {
      setReports([]);
      return () => {
        isCancelled = true;
      };
    }

    try {
      const parsed: ScanReport[] = JSON.parse(saved);
      const cleaned = sanitizePersistedReports(parsed, userId);
      setReports(cleaned);
      localStorage.setItem(getReportsStorageKey(userId), JSON.stringify(cleaned));
      void hydrateReportFiles(cleaned).then(hydratedReports => {
        if (isCancelled || currentUser?.id !== userId) return;
        setReports(previousReports => preserveReportFiles(hydratedReports, previousReports));
      });
    } catch {
      setReports([]);
    }

    return () => {
      isCancelled = true;
    };
  }, [currentUser?.id]);

  const [activationCodes, setActivationCodes] = useState<ActivationCode[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CODES);
      return saved ? JSON.parse(saved) : INITIAL_CODES;
    } catch {
      return INITIAL_CODES;
    }
  });
  const [purchaseKeys, setPurchaseKeys] = useState<PurchaseKey[]>([]);

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
        message: `Access Denied: Only ${ADMIN_EMAIL} has administrative access.`,
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

      if (!fsUsers.some(u => u.email.toLowerCase() === ADMIN_EMAIL)) {
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
          fileData: undefined,
        }));
        localStorage.setItem(getReportsStorageKey(currentUser.id), JSON.stringify(safeReports));
      } catch (e) {
        console.warn('Could not persist reports to localStorage:', e);
      }

      const nextExpiry = reports.reduce<number | undefined>((earliest, report) => {
        const expiresAt = report.expiresAt ?? (report.timestamp ? report.timestamp + ONE_DAY_MS : undefined);
        return expiresAt === undefined ? earliest : earliest === undefined ? expiresAt : Math.min(earliest, expiresAt);
      }, undefined);

      if (nextExpiry === undefined) return;

      const expiryTimer = setTimeout(() => {
        const now = Date.now();
        const newlyExpired = reports.filter(report => {
          const expiresAt = report.expiresAt ?? (report.timestamp ? report.timestamp + ONE_DAY_MS : undefined);
          return expiresAt !== undefined && expiresAt <= now;
        });
        const cleanup: Promise<unknown>[] = [];
        newlyExpired.forEach(report => {
          cleanup.push(deleteDoc(doc(db, 'reports', report.id)));
          cleanup.push(deleteReportFile(report.id));
          if (report.fileMetadataId) {
            cleanup.push(deleteDoc(doc(db, 'files', report.fileMetadataId)));
          }
        });
        void Promise.allSettled(cleanup);
        setReports(previous => previous.filter(report => {
          const expiresAt = report.expiresAt ?? (report.timestamp ? report.timestamp + ONE_DAY_MS : undefined);
          return expiresAt === undefined || expiresAt > now;
        }));
      }, Math.max(0, nextExpiry - Date.now()));

      return () => clearTimeout(expiryTimer);
    }

    let isCancelled = false;

    const purgeExpiredReportFiles = async () => {
      for (const report of expired) {
        await deleteReportFile(report.id).catch(error => {
          console.warn('Could not remove expired original document from IndexedDB:', error);
        });
        if (report.fileMetadataId) {
          await deleteDoc(doc(db, 'files', report.fileMetadataId)).catch(error => {
            console.warn('Could not delete expired file metadata from Firestore:', error);
          });
        }
        await deleteDoc(doc(db, 'reports', report.id)).catch(error => {
          console.warn('Could not delete expired report metadata from Firestore:', error);
        });
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

  useEffect(() => {
    if (!firebaseUser || !isAdminEmail(firebaseUser.email || currentUser.email)) {
      setPurchaseKeys([]);
      return;
    }

    return onSnapshot(
      collection(db, 'purchase_keys'),
      snapshot => {
        snapshot.docs.forEach(docSnap => {
          const data = docSnap.data();
          const normalizedKey = typeof data.key === 'string' ? data.key.trim().toUpperCase() : '';
          if (!normalizedKey || docSnap.id === normalizedKey) return;

          const canonicalRef = doc(db, 'purchase_keys', normalizedKey);
          void runTransaction(db, async transaction => {
            const [legacySnapshot, canonicalSnapshot] = await Promise.all([
              transaction.get(docSnap.ref),
              transaction.get(canonicalRef),
            ]);
            if (!legacySnapshot.exists()) return;

            if (!canonicalSnapshot.exists()) {
              transaction.set(canonicalRef, { ...legacySnapshot.data(), key: normalizedKey });
              transaction.delete(docSnap.ref);
              return;
            }

            if (canonicalSnapshot.data().key === normalizedKey) {
              transaction.delete(docSnap.ref);
            }
          }).catch(error => console.warn('Could not migrate legacy purchase key:', error));
        });

        const keys = snapshot.docs.map(docSnap => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            key: typeof data.key === 'string' ? data.key : '',
            credits: typeof data.credits === 'number' ? data.credits : 0,
            maxUses: typeof data.maxUses === 'number' ? data.maxUses : 1,
            usedCount: typeof data.usedCount === 'number' ? data.usedCount : 0,
            isActive: data.isActive !== false,
            note: typeof data.note === 'string' ? data.note : '',
            createdAt: typeof data.createdAt === 'string' ? data.createdAt : '',
            createdBy: typeof data.createdBy === 'string' ? data.createdBy : '',
            redeemedByEmail: typeof data.redeemedByEmail === 'string' ? data.redeemedByEmail : undefined,
            redeemedByUserId: typeof data.redeemedByUserId === 'string' ? data.redeemedByUserId : undefined,
            redeemedAt: typeof data.redeemedAt === 'string' ? data.redeemedAt : undefined,
          } satisfies PurchaseKey;
        });
        keys.sort((first, second) => second.createdAt.localeCompare(first.createdAt));
        setPurchaseKeys(keys);
      },
      error => console.warn('Purchase key listener notice:', error.message)
    );
  }, [firebaseUser, currentUser.email]);

  // Listen to Firebase Auth state & active institutional session
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setIsAuthLoading(true);
      if (fbUser) {
        setFirebaseUser(fbUser);
        const userDocRef = doc(db, 'users', fbUser.uid);
        try {
          const userDocSnap = await safeGetDoc(userDocRef, 3500);
          if (!userDocSnap) {
            throw new Error('Could not load your profile from Firestore. Skipping profile creation.');
          }
          if (userDocSnap.exists && userDocSnap.exists()) {
            const data = userDocSnap.data() as User;
            const isUserAdmin = isAdminEmail(fbUser.email);
            const mergedUser: User = {
              ...data,
              id: fbUser.uid,
              name: fbUser.displayName || data.name || fbUser.email?.split('@')[0] || 'User',
              email: fbUser.email || data.email,
              role: (isUserAdmin ? 'admin' : 'client') as 'admin' | 'client',
              credits: isUserAdmin ? 0 : (typeof data.credits === 'number' ? data.credits : 0),
              usedCredits: isUserAdmin ? 0 : (typeof data.usedCredits === 'number' ? data.usedCredits : 0),
              totalScans: isUserAdmin ? 0 : (typeof data.totalScans === 'number' ? data.totalScans : 0),
              emailVerified: fbUser.emailVerified,
              photoURL: fbUser.photoURL || data.photoURL,
              authProvider: fbUser.providerData?.[0]?.providerId === 'google.com' ? 'google' : 'password',
            };
            if (!isUserAdmin && data.role === 'admin') {
              safeSetDoc(userDocRef, { role: 'client' }, { merge: true });
            }
            if (isUserAdmin && (data.credits !== 0 || data.usedCredits !== 0 || data.totalScans !== 0)) {
              safeSetDoc(userDocRef, { credits: 0, usedCredits: 0, totalScans: 0 }, { merge: true });
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
                      credits: isAdminEmail(uData.email) ? 0 : (uData.credits ?? 0),
                      usedCredits: isAdminEmail(uData.email) ? 0 : (uData.usedCredits ?? 0),
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
            credits: 0,
            planName: isAdm ? 'Master Administrator' : 'Verified Account',
            planExpiry: '2030-12-31',
              totalScans: 0,
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
        setFirebaseUser(null);
        setCurrentUser(INITIAL_CURRENT_USER);
        setActivePanel('client');
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
    let unsubReports: (() => void) | undefined;

    // Only attach live listeners when auth is ready and user is authenticated per Firebase Skill
    if (!firebaseUser) {
      return;
    }

    const isCurrentAdmin = isAdminEmail(firebaseUser.email || currentUser.email) || currentUser.role === 'admin';

    try {
      const userReportsQuery = query(
        collection(db, 'reports'),
        where('userId', '==', firebaseUser.uid)
      );
      unsubReports = onSnapshot(
        userReportsQuery,
        snapshot => {
          const firestoreReports: ScanReport[] = [];
          snapshot.docs.forEach(reportDoc => {
            const data = reportDoc.data();
            const storedExpiry = typeof data.expiresAt === 'number'
              ? data.expiresAt
              : typeof data.expiresAt?.toMillis === 'function'
              ? data.expiresAt.toMillis()
              : undefined;
            const expiresAt = storedExpiry ?? (typeof data.timestamp === 'number'
              ? data.timestamp + ONE_DAY_MS
              : undefined);

            if (expiresAt !== undefined && expiresAt <= Date.now()) {
              deleteReportFile(reportDoc.id).catch(error => {
                console.warn('Could not remove expired original document from IndexedDB:', error);
              });
              deleteDoc(reportDoc.ref).catch(error => {
                console.warn('Could not delete expired report metadata from Firestore:', error);
              });
              if (data.fileMetadataId) {
                deleteDoc(doc(db, 'files', data.fileMetadataId)).catch(error => {
                  console.warn('Could not delete expired file metadata from Firestore:', error);
                });
              }
              return;
            }

            firestoreReports.push({
              ...data,
              id: reportDoc.id,
              fileData: undefined,
            } as ScanReport);
          });
          const cleanedReports = sanitizePersistedReports(firestoreReports, firebaseUser.uid)
            .sort((first, second) => (second.timestamp || 0) - (first.timestamp || 0));
          setReports(previousReports => preserveReportFiles(cleanedReports, previousReports));
          void hydrateReportFiles(cleanedReports).then(hydratedReports => {
            setReports(previousReports => preserveReportFiles(hydratedReports, previousReports));
          });
          try {
            localStorage.setItem(getReportsStorageKey(firebaseUser.uid), JSON.stringify(cleanedReports));
          } catch (error) {
            console.warn('Could not persist Firestore reports to localStorage:', error);
          }
        },
        error => console.warn('Live reports subscription notice:', error.message)
      );

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
                    credits: isAdminEmail(d.email) ? 0 : (typeof d.credits === 'number' ? d.credits : 0),
                    usedCredits: isAdminEmail(d.email) ? 0 : (typeof d.usedCredits === 'number' ? d.usedCredits : 0),
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

              if (!fsUsers.some(u => u.email.toLowerCase() === ADMIN_EMAIL)) {
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
                  date: d.date || formatPakistanDateTime(Date.now()),
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
      if (unsubReports) unsubReports();
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
                credits: isAdminEmail(d.email) ? 0 : (typeof d.credits === 'number' ? d.credits : 0),
                usedCredits: isAdminEmail(d.email) ? 0 : (typeof d.usedCredits === 'number' ? d.usedCredits : 0),
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
          if (!fsUsers.some(u => u.email.toLowerCase() === ADMIN_EMAIL)) {
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
                date: d.date || formatPakistanDateTime(Date.now()),
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
      const authProfile = {
        uid: result.user.uid,
        email: result.user.email,
        displayName: result.user.displayName,
        photoURL: result.user.photoURL,
        emailVerified: result.user.emailVerified,
        providerData: result.user.providerData?.map(provider => ({
          providerId: provider.providerId,
          email: provider.email,
        })),
      };
      const profileRef = doc(db, 'users', result.user.uid);
      const profileSnapshot = await safeGetDoc(profileRef);
      if (!profileSnapshot) {
        throw new Error('Could not load your profile from Firestore. Please retry signing in.');
      }
      const existingProfile = profileSnapshot.exists() ? profileSnapshot.data() as User : null;
      const generatedProfile = buildUserFromAuthProfile(authProfile);
      const newUser: User = existingProfile
        ? {
            ...generatedProfile,
            ...existingProfile,
            id: result.user.uid,
            name: result.user.displayName || existingProfile.name || generatedProfile.name,
            email: result.user.email || existingProfile.email,
            role: generatedProfile.role,
            credits: isAdminEmail(result.user.email) ? 0 : (typeof existingProfile.credits === 'number' ? existingProfile.credits : 0),
            usedCredits: isAdminEmail(result.user.email) ? 0 : (typeof existingProfile.usedCredits === 'number' ? existingProfile.usedCredits : 0),
            totalScans: isAdminEmail(result.user.email) ? 0 : (existingProfile.totalScans ?? 0),
            emailVerified: result.user.emailVerified,
            photoURL: result.user.photoURL || existingProfile.photoURL || null,
          }
        : generatedProfile;

      setCurrentUser(newUser);
      setFirebaseUser(result.user);
      setUsers(prev => {
        const without = prev.filter(u => u.id !== newUser.id && u.email.toLowerCase() !== newUser.email.toLowerCase());
        return [newUser, ...without];
      });
      if (newUser.email) {
        await setDoc(profileRef, newUser, { merge: true });
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
        credits: 0,
        usedCredits: 0,
        planName: isDefaultAdmin ? 'Master Administrator' : 'Standard Verified Plan',
        planExpiry: isDefaultAdmin ? '2030-12-31' : '2027-12-31',
        totalScans: 0,
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

      // Attempt Firestore sync safely in background if online
      await setDoc(doc(db, 'users', newUser.id), newUser);

      setNotification({
        message: isDefaultAdmin
          ? `Welcome Master Administrator (${newUser.email})!`
          : `Account created for ${newUser.email}.`,
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
      const profileSnapshot = await safeGetDoc(doc(db, 'users', result.user.uid));
      const firestoreUser = profileSnapshot?.exists?.() ? profileSnapshot.data() as User : undefined;
      const existingUser = firestoreUser || users.find(u => u.email.toLowerCase() === cleanEmail);
      if (existingUser) {
        const updated = {
          ...existingUser,
          id: result.user.uid,
          email: cleanEmail,
          role: (isDefaultAdmin ? 'admin' : 'client') as 'admin' | 'client',
          credits: isDefaultAdmin ? 0 : (typeof existingUser.credits === 'number' ? existingUser.credits : 0),
          usedCredits: isDefaultAdmin ? 0 : (typeof existingUser.usedCredits === 'number' ? existingUser.usedCredits : 0),
          totalScans: isDefaultAdmin ? 0 : (existingUser.totalScans ?? 0),
        };
        setCurrentUser(updated);
        setUsers(prev => [updated, ...prev.filter(user => user.id !== updated.id && user.email.toLowerCase() !== cleanEmail)]);
        if (isDefaultAdmin) {
          safeSetDoc(doc(db, 'users', result.user.uid), { role: 'admin', credits: 0, usedCredits: 0, totalScans: 0 }, { merge: true });
          setActivePanel('admin');
        }
      } else {
        const newUser: User = {
          id: result.user.uid,
          name: result.user.displayName || (isDefaultAdmin ? 'TurnitScope Administrator' : cleanEmail.split('@')[0]),
          email: cleanEmail,
          role: isDefaultAdmin ? 'admin' : 'client',
          credits: 0,
          usedCredits: 0,
          planName: isDefaultAdmin ? 'Master Administrator' : 'Standard Verified Plan',
          planExpiry: isDefaultAdmin ? '2030-12-31' : '2027-12-31',
          totalScans: 0,
          createdAt: new Date().toISOString().split('T')[0],
          emailVerified: true,
          photoURL: result.user.photoURL || null,
          authProvider: 'password',
        };
        setCurrentUser(newUser);
        setUsers(prev => [newUser, ...prev]);
        await setDoc(doc(db, 'users', newUser.id), newUser);
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
  const giveCredits = async (userId: string, amount: number, note: string = 'Admin Credit Grant'): Promise<boolean> => {
    if (!isAdminEmail(currentUser.email)) {
      setNotification({ message: 'Unauthorized: Only administrators can allocate credits.', type: 'error' });
      return false;
    }
    const targetUser = users.find(u => u.id === userId);
    if (!targetUser) {
      setNotification({ message: 'The selected client could not be found. Refresh the user list and try again.', type: 'error' });
      return false;
    }
    if (isAdminEmail(targetUser.email) || targetUser.role === 'admin') {
      setNotification({ message: 'Credits can only be allocated to client accounts.', type: 'error' });
      return false;
    }
    if (amount <= 0 && !confirm('Are you sure you want to deduct credits?')) return false;

    const userRef = doc(db, 'users', userId);
    const transactionRef = doc(collection(db, 'transactions'));
    const timestamp = Date.now();
    const transactionDate = formatPakistanDateTime(timestamp);

    try {
      const result = await runTransaction(db, async transaction => {
        const userSnapshot = await transaction.get(userRef);
        if (!userSnapshot.exists()) {
          throw new Error('The selected client no longer exists in Firestore. Refresh the user list and try again.');
        }

        const userData = userSnapshot.data();
        if (isAdminEmail(userData.email) || userData.role === 'admin') {
          throw new Error('Credits can only be allocated to client accounts.');
        }

        const currentBalance = typeof userData.credits === 'number' ? userData.credits : 0;
        const balanceAfter = Math.max(0, currentBalance + amount);
        const appliedAmount = balanceAfter - currentBalance;
        const userName = userData.name || targetUser.name;
        const creditTransaction: CreditTransaction = {
          id: transactionRef.id,
          userId,
          userName,
          amount: appliedAmount,
          balanceAfter,
          type: 'admin_grant',
          note,
          date: transactionDate,
          timestamp,
        };

        transaction.set(userRef, { credits: balanceAfter }, { merge: true });
        transaction.set(transactionRef, creditTransaction);
        return { balanceAfter, appliedAmount, userName, creditTransaction };
      });

      setUsers(prevUsers => prevUsers.map(user =>
        user.id === userId ? { ...user, credits: result.balanceAfter } : user
      ));
      if (currentUser.id === userId) {
        setCurrentUser(prev => ({ ...prev, credits: result.balanceAfter }));
      }
      setTransactions(prev => [result.creditTransaction, ...prev.filter(item => item.id !== transactionRef.id)]);

      setNotification({
        message: `Successfully allocated ${result.appliedAmount > 0 ? '+' : ''}${result.appliedAmount} credits to ${result.userName}.`,
        type: 'success',
      });
      return true;
    } catch (error) {
      console.error('Credit allocation failed:', error);
      setNotification({
        message: error instanceof Error ? error.message : 'Could not save the credit allocation. No balance change was made.',
        type: 'error',
      });
      return false;
    }
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
    if (isAdminEmail(cleanEmail)) {
      setNotification({ message: 'The administrator account cannot be created as a client account.', type: 'error' });
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
      usedCredits: 0,
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
          date: formatPakistanDateTime(),
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
    const isTargetAdmin = isAdminEmail(targetUser?.email) || (userId === currentUser.id && isAdminEmail(currentUser.email));
    const safeUpdates = isTargetAdmin ? { ...updates, credits: 0, usedCredits: 0, totalScans: 0 } : updates;
    const prevCredits = targetUser ? targetUser.credits : 0;

    setUsers(prev =>
      prev.map(u => (u.id === userId ? { ...u, ...safeUpdates } : u))
    );

    if (currentUser.id === userId) {
      setCurrentUser(prev => ({ ...prev, ...safeUpdates }));
    }

    // MAP TO FIRESTORE: Update document in Firestore
    try {
      await safeSetDoc(doc(db, 'users', userId), safeUpdates, { merge: true });

      if (!isTargetAdmin && safeUpdates.credits !== undefined && safeUpdates.credits !== prevCredits) {
        const diff = safeUpdates.credits - prevCredits;
        const auditTxn: CreditTransaction = {
          id: `tx-${Date.now()}`,
          userId,
          userName: safeUpdates.name || targetUser?.name || 'User',
          amount: diff,
          balanceAfter: safeUpdates.credits,
          type: 'admin_grant',
          note: `Admin modified credit balance: ${prevCredits} -> ${safeUpdates.credits}`,
          date: formatPakistanDateTime(),
          timestamp: Date.now(),
        };
        setTransactions(prev => [auditTxn, ...prev]);
        safeSetDoc(doc(db, 'transactions', auditTxn.id), auditTxn).catch(() => {});
      }

      setNotification({
        message: `User record for ${safeUpdates.name || targetUser?.name || 'user'} updated in Cloud Firestore!`,
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

  const createPurchaseKey = async (key: string, credits: number, note?: string): Promise<PurchaseKey | null> => {
    if (!isAdminEmail(currentUser.email)) {
      setNotification({ message: 'Unauthorized: Only administrators can create purchase keys.', type: 'error' });
      return null;
    }

    const normalizedKey = key.trim().toUpperCase();
    if (!normalizedKey || !Number.isSafeInteger(credits) || credits < 1) {
      setNotification({ message: 'Enter a valid key and a positive whole-number credit amount.', type: 'error' });
      return null;
    }

    const purchaseKey: PurchaseKey = {
      id: normalizedKey,
      key: normalizedKey,
      credits,
      maxUses: 1,
      usedCount: 0,
      isActive: true,
      note: note?.trim() || '',
      createdAt: new Date().toISOString(),
      createdBy: currentUser.email,
    };

    try {
      const keyRef = doc(db, 'purchase_keys', purchaseKey.id);
      await runTransaction(db, async transaction => {
        const existingKey = await transaction.get(keyRef);
        if (existingKey.exists()) throw new Error('That key already exists. Generate it again.');
        transaction.set(keyRef, purchaseKey);
      });
      setPurchaseKeys(previous => [purchaseKey, ...previous.filter(existing => existing.id !== purchaseKey.id)]);
      setNotification({ message: `Purchase key created for ${credits} credits.`, type: 'success' });
      return purchaseKey;
    } catch (error) {
      console.error('Purchase key creation failed:', error);
      setNotification({ message: 'Could not save the purchase key to Firestore.', type: 'error' });
      return null;
    }
  };

  const deletePurchaseKey = async (keyId: string): Promise<boolean> => {
    if (!isAdminEmail(currentUser.email)) {
      setNotification({ message: 'Unauthorized: Only administrators can delete purchase keys.', type: 'error' });
      return false;
    }

    try {
      await deleteDoc(doc(db, 'purchase_keys', keyId));
      setPurchaseKeys(previous => previous.filter(key => key.id !== keyId));
      setNotification({ message: 'Purchase key deleted.', type: 'success' });
      return true;
    } catch (error) {
      console.error('Purchase key deletion failed:', error);
      setNotification({ message: 'Could not delete the purchase key from Firestore.', type: 'error' });
      return false;
    }
  };

  const redeemPurchaseKey = async (key: string): Promise<boolean> => {
    if (!firebaseUser) {
      setNotification({ message: 'Sign in before redeeming a purchase key.', type: 'error' });
      return false;
    }

    const normalizedKey = key.trim().toUpperCase();
    if (!normalizedKey) {
      setNotification({ message: 'Enter a purchase key.', type: 'error' });
      return false;
    }

    const keyRef = doc(db, 'purchase_keys', normalizedKey);
    const userRef = doc(db, 'users', firebaseUser.uid);
    const transactionRef = doc(collection(db, 'transactions'));
    const now = Date.now();

    try {
      const result = await runTransaction(db, async transaction => {
        const keySnapshot = await transaction.get(keyRef);
        const userSnapshot = await transaction.get(userRef);
        if (!keySnapshot.exists()) throw new Error('Purchase key not found. Check the key and try again.');
        if (!userSnapshot.exists()) throw new Error('Your account profile could not be found. Please sign in again.');

        const keyData = keySnapshot.data();
        if (keyData.key !== normalizedKey || keyData.isActive !== true || keyData.usedCount >= keyData.maxUses) {
          throw new Error('This purchase key is invalid, inactive, or has already been redeemed.');
        }
        if (!Number.isSafeInteger(keyData.credits) || keyData.credits < 1) {
          throw new Error('This purchase key has an invalid credit value. Contact support.');
        }

        const userData = userSnapshot.data();
        const currentCredits = typeof userData.credits === 'number' ? userData.credits : 0;
        const balanceAfter = currentCredits + keyData.credits;
        const baseExpiry = Math.max(now, typeof userData.planExpiresAt === 'number' ? userData.planExpiresAt : 0);
        const expiresAt = addOneCalendarMonth(new Date(baseExpiry));
        const expiresAtTimestamp = expiresAt.getTime();
        const date = formatPakistanDateTime(now);

        transaction.update(keyRef, {
          usedCount: keyData.usedCount + 1,
          isActive: false,
          redeemedByUserId: firebaseUser.uid,
          redeemedByEmail: firebaseUser.email || currentUser.email,
          redeemedAt: new Date(now).toISOString(),
        });
        transaction.set(userRef, {
          credits: balanceAfter,
          planExpiresAt: expiresAtTimestamp,
          planExpiry: expiresAt.toISOString().slice(0, 10),
          lastRedeemedPurchaseKeyId: normalizedKey,
        }, { merge: true });
        transaction.set(transactionRef, {
          id: transactionRef.id,
          userId: firebaseUser.uid,
          userName: currentUser.name,
          amount: keyData.credits,
          balanceAfter,
          type: 'redeem_code',
          note: `Redeemed purchase key: ${normalizedKey}`,
          date,
          timestamp: now,
        });

        return { balanceAfter, expiresAtTimestamp, expiresOn: expiresAt.toISOString().slice(0, 10), amount: keyData.credits };
      });

      setCurrentUser(previous => ({
        ...previous,
        credits: result.balanceAfter,
        planExpiresAt: result.expiresAtTimestamp,
        planExpiry: result.expiresOn,
      }));
      setUsers(previous => previous.map(user => user.id === firebaseUser.uid ? {
        ...user,
        credits: result.balanceAfter,
        planExpiresAt: result.expiresAtTimestamp,
        planExpiry: result.expiresOn,
      } : user));
      setTransactions(previous => [{
        id: transactionRef.id,
        userId: firebaseUser.uid,
        userName: currentUser.name,
        amount: result.amount,
        balanceAfter: result.balanceAfter,
        type: 'redeem_code',
        note: `Redeemed purchase key: ${normalizedKey}`,
        date: formatPakistanDateTime(now),
        timestamp: now,
      }, ...previous.filter(item => item.id !== transactionRef.id)]);
      setNotification({ message: `${result.amount} credits added. Your plan expires on ${result.expiresOn}.`, type: 'success' });
      return true;
    } catch (error) {
      const firebaseError = error as { code?: string; message?: string };
      const errorCode = firebaseError.code || 'unknown';
      const errorMessage = firebaseError.message || 'Could not redeem this purchase key.';
      console.error('Purchase key redemption failed:', { code: errorCode, message: errorMessage, error });
      setNotification({
        message: /quota exceeded/i.test(errorMessage) || errorCode === 'resource-exhausted'
          ? `Firestore quota exceeded (${errorCode}). Check Firebase Usage and billing, then retry when quota is available.`
          : `${errorMessage} (${errorCode})`,
        type: 'error',
      });
      return false;
    }
  };

  const deleteUser = async (userId: string) => {
    if (!isAdminEmail(currentUser.email)) {
      setNotification({ message: 'Unauthorized: Only administrators can manage user accounts.', type: 'error' });
      return;
    }
    const target = users.find(u => u.id === userId);
    if (!target) return;
    if (target.email.toLowerCase() === ADMIN_EMAIL || target.id === currentUser.id) {
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
    sourceFileData?: string;
    sourceFileMimeType?: string;
    sourceFileSize?: number;
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

    if (typeof currentUser.planExpiresAt === 'number' && Date.now() >= currentUser.planExpiresAt) {
      return {
        success: false,
        error: 'Your plan has expired. Redeem a new purchase key to continue scanning.',
      };
    }

    if (currentUser.credits < cost) {
      return {
        success: false,
        error: `Insufficient credits. This check requires ${cost} credits, but you have ${currentUser.credits}. Please contact your admin for more credits.`,
      };
    }

    setIsScanning(true);
    setScanProgress({ step: 'Preparing document analysis...', percent: 15 });
    let uploadedReportId: string | undefined;

    try {
      if (!auth.currentUser || auth.currentUser.uid !== firebaseUser?.uid) {
        return {
          success: false,
          error: 'Sign in with Firebase to save scans and report metadata to your account.',
        };
      }

      setScanProgress({ step: 'Extracting text and preparing the document layout...', percent: 45 });
      setScanProgress({ step: 'Rendering the final report from the uploaded document...', percent: 75 });

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
          ? Math.floor(Math.random() * 17) + 1
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

      const reportId = `rep-${Date.now()}`;
      uploadedReportId = reportId;
      const expiresAt = Date.now() + ONE_DAY_MS;
      const storedFileSize = options.sourceFileSize ?? 0;

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
        id: reportId,
        userId: currentUser.id,
        expiresAt,
        title: options.fileName,
        fileName: options.fileName,
        fileSize: storedFileSize ? `${Math.max(0.01, storedFileSize / (1024 * 1024)).toFixed(2)} MB` : '1.8 MB',
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
        institution: options.institution || 'Allama Iqbal Open University',
        submissionDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ', ' + new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }),
        downloadDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ', ' + new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }),
        pageCount: calculatedPageCount,
        fileData: options.fileMimeType === 'application/pdf' ? options.fileData : undefined,
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

      if (newReport.fileData && newReport.expiresAt) {
        await saveReportFile(newReport.id, newReport.fileData, newReport.expiresAt).catch(error => {
          console.warn('Could not cache the original document in IndexedDB:', error);
        });
      }

      const {
        fileData: _fileData,
        text: _text,
        htmlContent: _htmlContent,
        htmlPages: _htmlPages,
        storagePath: _storagePath,
        sourceStoragePath: _sourceStoragePath,
        fileMimeType: _fileMimeType,
        fileMetadataId: _fileMetadataId,
        ...persistedReport
      } = newReport;
      await setDoc(doc(db, 'reports', newReport.id), {
        ...persistedReport,
        userId: firebaseUser.uid,
        expiresAt: newReport.expiresAt,
      });

      const transactionId = `tx-${Date.now()}`;
      const transactionDate = formatPakistanDateTime();
      const balanceResult = await runTransaction(db, async transaction => {
        const userRef = doc(db, 'users', firebaseUser.uid);
        const userSnapshot = await transaction.get(userRef);
        if (!userSnapshot.exists()) {
          throw new Error('Your Firebase profile is missing. Please sign out and sign in again.');
        }
        const userData = userSnapshot.data();
        if (typeof userData.planExpiresAt === 'number' && Date.now() >= userData.planExpiresAt) {
          throw new Error('Your plan has expired. Redeem a new purchase key to continue scanning.');
        }
        const availableCredits = typeof userData.credits === 'number' ? userData.credits : 0;
        if (availableCredits < cost) {
          throw new Error(`Insufficient credits. This check requires ${cost} credits, but you have ${availableCredits}.`);
        }
        const balanceAfter = availableCredits - cost;
        const usedCredits = (typeof userData.usedCredits === 'number' ? userData.usedCredits : 0) + cost;
        const totalScans = (typeof userData.totalScans === 'number' ? userData.totalScans : 0) + 1;
        transaction.set(userRef, { credits: balanceAfter, usedCredits, totalScans }, { merge: true });
        transaction.set(doc(db, 'transactions', transactionId), {
          id: transactionId,
          userId: firebaseUser.uid,
          userName: currentUser.name,
          amount: -cost,
          balanceAfter,
          type: 'scan_deduction',
          note: `Scanned document: ${options.fileName} (${modeNameMap[options.mode]})`,
          date: transactionDate,
          timestamp: Date.now(),
        });
        return { balanceAfter, usedCredits, totalScans };
      });

      const newBal = balanceResult.balanceAfter;
      setCurrentUser(prev => ({
        ...prev,
        credits: balanceResult.balanceAfter,
        usedCredits: balanceResult.usedCredits,
        totalScans: balanceResult.totalScans,
      }));
      setUsers(prev => prev.map(user => user.id === firebaseUser.uid ? {
        ...user,
        credits: balanceResult.balanceAfter,
        usedCredits: balanceResult.usedCredits,
        totalScans: balanceResult.totalScans,
      } : user));
      setReports(prev => pruneExpiredReports([newReport, ...prev.filter(report => report.id !== newReport.id)], currentUser.id));

      const scanTxn: CreditTransaction = {
        id: transactionId,
        userId: firebaseUser.uid,
        userName: currentUser.name,
        amount: -cost,
        balanceAfter: newBal,
        type: 'scan_deduction',
        note: `Scanned document: ${options.fileName} (${modeNameMap[options.mode]})`,
        date: transactionDate,
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
      const cleanup: Promise<unknown>[] = [];
      if (uploadedReportId) cleanup.push(deleteDoc(doc(db, 'reports', uploadedReportId)));
      await Promise.allSettled(cleanup);
      setIsScanning(false);
      setScanProgress(null);
      setNotification({
        message: error instanceof Error ? error.message : 'Scan failed while processing the document. Please try again.',
        type: 'error',
      });
      return { success: false, error: error instanceof Error ? error.message : 'Scan failed while processing the document.' };
    }
  };

  const deleteReport = async (reportId: string) => {
    const reportToDelete = reports.find(report => report.id === reportId);
    setReports(prev => prev.filter(r => r.id !== reportId));
    await deleteReportFile(reportId).catch(error => {
      console.warn('Could not remove the original document from IndexedDB:', error);
    });
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

    if (firebaseUser) {
      await Promise.allSettled([
        deleteDoc(doc(db, 'reports', reportId)),
        deleteDoc(doc(db, 'files', reportToDelete?.fileMetadataId || reportId)),
      ]);
    }
    setNotification({ message: 'Report removed', type: 'info' });
  };

  const updateCurrentUser = async (updates: Partial<User>) => {
    const targetUserId = firebaseUser?.uid || currentUser.id;
    const authenticatedUser = auth.currentUser;
    if (!authenticatedUser || authenticatedUser.uid !== targetUserId) {
      throw new Error(
        'A valid Firebase Auth session is required to save profile changes. Sign out and sign in again with Firebase.'
      );
    }

    const profileUpdates = {
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        setDoc(doc(db, 'users', authenticatedUser.uid), profileUpdates, { merge: true }),
        new Promise<never>((_, reject) => {
          timeoutId = setTimeout(
            () => reject(new Error('The server did not confirm the profile update. Check your connection and try again.')),
            10_000
          );
        }),
      ]);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }

    if (updates.name) {
      void updateFirebaseUserProfile(updates.name);
    }

    setCurrentUser(prev => ({ ...prev, ...profileUpdates }));
    setUsers(prev =>
      prev.map(u => (u.id === currentUser.id ? { ...u, ...profileUpdates } : u))
    );
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
        purchaseKeys,
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
        generateCode,
        deleteCode,
        toggleCodeActivation,
        createPurchaseKey,
        deletePurchaseKey,
        redeemPurchaseKey,
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
