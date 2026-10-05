import test from 'node:test';
import assert from 'node:assert/strict';

import { isUnauthorizedDomainError } from './firebase.ts';
import { buildUserFromAuthProfile } from './userProfiles';

test('detects unauthorized-domain Firebase errors', () => {
  assert.equal(isUnauthorizedDomainError({ code: 'auth/unauthorized-domain' }), true);
  assert.equal(isUnauthorizedDomainError({ message: 'Firebase: Error (auth/unauthorized-domain).' }), true);
  assert.equal(isUnauthorizedDomainError({ code: 'auth/popup-blocked' }), false);
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
  assert.equal(googleUser.credits, 0);
  assert.equal(googleUser.usedCredits, 0);
  assert.equal(googleUser.name, 'New Student');

  const adminUser = buildUserFromAuthProfile({
    uid: 'google-admin',
    email: 'aftabshehzadmm24@gmail.com',
    displayName: 'TurnitScope Admin',
    photoURL: null,
    emailVerified: true,
    providerData: [{ providerId: 'google.com', email: 'aftabshehzadmm24@gmail.com' }],
  } as any);

  assert.equal(adminUser.role, 'admin');
  assert.equal(adminUser.credits, 0);
  assert.equal(adminUser.usedCredits, 0);
  assert.equal(adminUser.totalScans, 0);
});
