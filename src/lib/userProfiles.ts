import type { User } from '../types';
import { ADMIN_EMAIL } from './firebase';

export const isAdminEmail = (email?: string | null): boolean => {
  if (!email) return false;
  const em = email.trim().toLowerCase();
  return em === ADMIN_EMAIL;
};

export type AuthProfileLike = {
  uid?: string;
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  emailVerified?: boolean | null;
  providerData?: Array<{ providerId?: string | null; email?: string | null }>;
};

export function buildUserFromAuthProfile(
  authProfile: AuthProfileLike,
  fallbackRole: 'client' | 'admin' = 'client'
): User {
  const email = (authProfile.email || '').trim().toLowerCase();
  const isAdmin = isAdminEmail(email) || fallbackRole === 'admin';

  return {
    id: authProfile.uid || `usr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    name:
      authProfile.displayName ||
      (isAdmin ? 'TurnitScope Administrator' : email ? email.split('@')[0] : 'Academic User') ||
      'Academic User',
    email,
    role: isAdmin ? 'admin' : 'client',
    credits: 0,
    usedCredits: 0,
    planName: isAdmin ? 'Master Administrator' : 'Standard Verified Plan',
    planExpiry: isAdmin ? '2030-12-31' : '2027-12-31',
    totalScans: 0,
    createdAt: new Date().toISOString().split('T')[0],
    emailVerified: !!authProfile.emailVerified,
    photoURL: authProfile.photoURL || null,
    authProvider: authProfile.providerData?.[0]?.providerId === 'google.com' ? 'google' : 'password',
  };
}
