import test from 'node:test';
import assert from 'node:assert/strict';

import { isUnauthorizedDomainError, isLegacyGoogleAuthFallbackSession } from './firebase.ts';
import { buildUserFromAuthProfile, resolveProfileName } from './userProfiles';

test('detects unauthorized-domain Firebase errors', () => {
  assert.equal(isUnauthorizedDomainError({ code: 'auth/unauthorized-domain' }), true);
  assert.equal(isUnauthorizedDomainError({ message: 'Firebase: Error (auth/unauthorized-domain).' }), true);
  assert.equal(isUnauthorizedDomainError({ code: 'auth/popup-blocked' }), false);
});

test('recognizes and removes the legacy synthetic Google account', () => {
  assert.equal(isLegacyGoogleAuthFallbackSession({ uid: 'usr_google_local_turnitscope', email: 'academic.user@local.turnitscope' } as any), true);
  assert.equal(isLegacyGoogleAuthFallbackSession({ uid: 'kunal-123', email: 'kunal@example.com' } as any), false);
});

test('builds a client profile for new Google users and keeps admin access for admin email', () => {
  const googleUser = buildUserFromAuthProfile({
    uid: 'google-123',
    email: 'newstudent@gmail.com',
    displayName: 'New Student',
    photoURL: null,
    emailVerified: true,
    providerData: [{ providerId: 'google.com', email: 'newstudent@gmail.com' }],
  } as any);

  assert.equal(googleUser.role, 'client');
  assert.equal(googleUser.credits, 25);
  assert.equal(googleUser.name, 'New Student');

  const adminUser = buildUserFromAuthProfile({
    uid: 'google-admin',
    email: 'admin@turnitscope.com',
    displayName: 'TurnitScope Admin',
    photoURL: null,
    emailVerified: true,
    providerData: [{ providerId: 'google.com', email: 'admin@turnitscope.com' }],
  } as any);

  assert.equal(adminUser.role, 'admin');
  assert.equal(adminUser.credits, 5000);
});

test('uses a real Google name or account name instead of the generic Academic placeholder', () => {
  assert.equal(resolveProfileName('Kunal', 'Academic Google User', 'kunal@example.com'), 'Kunal');
  assert.equal(resolveProfileName(null, 'Academic Google User', 'kunal@example.com'), 'Kunal');
  assert.equal(resolveProfileName(null, 'Kunal Ahmed', 'kunal@example.com'), 'Kunal Ahmed');
  assert.equal(resolveProfileName(null, null, 'admin@example.com', 'TurnitScope Administrator'), 'TurnitScope Administrator');
});
