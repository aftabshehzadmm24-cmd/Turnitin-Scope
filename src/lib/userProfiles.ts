import type { User } from '../types';

export const isAdminEmail = (email?: string | null): boolean => {
  if (!email) return false;
  const em = email.trim().toLowerCase();
  return em === 'admin@turnitscope.com';
};

export type AuthProfileLike = {
  uid?: string;
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  emailVerified?: boolean | null;
  providerData?: Array<{ providerId?: string | null; email?: string | null }>;
};

const isGenericProfileName = (name: string): boolean =>
  /^(?:academic(?:\s+google)?(?:\s+user)?|google\s+user|user)$/i.test(name.trim());

const formatEmailName = (email?: string | null): string => {
  const localPart = email?.trim().split('@')[0] || '';
  return localPart
    .split(/[._+-]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

export function resolveProfileName(
  displayName?: string | null,
  savedName?: string | null,
  email?: string | null,
  fallbackName = 'Academic User'
): string {
  const googleName = displayName?.trim();
  if (googleName && !isGenericProfileName(googleName)) return googleName;

  const savedFullName = savedName?.trim();
  if (savedFullName && !isGenericProfileName(savedFullName)) return savedFullName;

  const emailName = formatEmailName(email);
  if (emailName && isGenericProfileName(fallbackName)) return emailName;

  return googleName || savedFullName || fallbackName || emailName || 'Academic User';
}

export function buildUserFromAuthProfile(
  authProfile: AuthProfileLike,
  fallbackRole: 'client' | 'admin' = 'client'
): User {
  const email = (authProfile.email || '').trim().toLowerCase();
  const isAdmin = isAdminEmail(email) || fallbackRole === 'admin';

  return {
    id: authProfile.uid || `usr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    name: resolveProfileName(
      authProfile.displayName,
      undefined,
      email,
      isAdmin ? 'TurnitScope Administrator' : 'Academic User'
    ),
    email,
    role: isAdmin ? 'admin' : 'client',
    credits: isAdmin ? 5000 : 25,
    planName: isAdmin ? 'Master Administrator' : 'Standard Verified Plan',
    planExpiry: isAdmin ? '2030-12-31' : '2027-12-31',
    totalScans: isAdmin ? 142 : 0,
    createdAt: new Date().toISOString().split('T')[0],
    emailVerified: !!authProfile.emailVerified,
    photoURL: authProfile.photoURL || null,
    authProvider: authProfile.providerData?.[0]?.providerId === 'google.com' ? 'google' : 'password',
  };
}
