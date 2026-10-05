"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteExpiredReports = exports.auditCreditBalanceChanges = void 0;
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const firestore_2 = require("firebase-functions/v2/firestore");
const scheduler_1 = require("firebase-functions/v2/scheduler");
(0, app_1.initializeApp)();
const db = (0, firestore_1.getFirestore)();
exports.auditCreditBalanceChanges = (0, firestore_2.onDocumentWrittenWithAuthContext)({
    document: 'users/{userId}',
    region: 'us-central1',
}, async (event) => {
    const beforeSnapshot = event.data?.before;
    const afterSnapshot = event.data?.after;
    if (!beforeSnapshot || !afterSnapshot)
        return;
    const beforeData = beforeSnapshot.exists ? beforeSnapshot.data() : undefined;
    const afterData = afterSnapshot.exists ? afterSnapshot.data() : undefined;
    const previousCredits = typeof beforeData?.credits === 'number' ? beforeData.credits : 0;
    const newCredits = typeof afterData?.credits === 'number' ? afterData.credits : 0;
    if (previousCredits === newCredits)
        return;
    await db.collection('credit_audit_logs').doc(event.id).set({
        eventId: event.id,
        userId: event.params.userId,
        userEmail: afterData?.email || beforeData?.email || null,
        previousCredits,
        newCredits,
        delta: newCredits - previousCredits,
        changeType: !beforeSnapshot.exists ? 'created' : !afterSnapshot.exists ? 'deleted' : 'updated',
        actorUid: event.authId || null,
        actorAuthType: event.authType,
        occurredAt: event.time,
        recordedAt: firestore_1.FieldValue.serverTimestamp(),
    });
});
const REPORT_RETENTION_MS = 24 * 60 * 60 * 1000;
const REPORT_DELETE_BATCH_SIZE = 250;
exports.deleteExpiredReports = (0, scheduler_1.onSchedule)({
    schedule: 'every 15 minutes',
    region: 'us-central1',
    timeZone: 'Etc/UTC',
}, async () => {
    const now = Date.now();
    const legacyCutoff = now - REPORT_RETENTION_MS;
    const [expirySnapshot, legacySnapshot] = await Promise.all([
        db.collection('reports').where('expiresAt', '<=', now).get(),
        db.collection('reports').where('timestamp', '<=', legacyCutoff).get(),
    ]);
    const expiredReports = new Map();
    for (const report of [...expirySnapshot.docs, ...legacySnapshot.docs]) {
        const data = report.data();
        const storedExpiry = typeof data.expiresAt === 'number'
            ? data.expiresAt
            : typeof data.expiresAt?.toMillis === 'function'
                ? data.expiresAt.toMillis()
                : typeof data.timestamp === 'number'
                    ? data.timestamp + REPORT_RETENTION_MS
                    : undefined;
        if (storedExpiry !== undefined && storedExpiry <= now) {
            expiredReports.set(report.id, report);
        }
    }
    const reports = [...expiredReports.values()];
    for (let index = 0; index < reports.length; index += REPORT_DELETE_BATCH_SIZE) {
        const batch = db.batch();
        reports.slice(index, index + REPORT_DELETE_BATCH_SIZE).forEach(report => {
            batch.delete(report.ref);
            const fileMetadataId = report.get('fileMetadataId');
            if (typeof fileMetadataId === 'string' && fileMetadataId) {
                batch.delete(db.collection('files').doc(fileMetadataId));
            }
        });
        await batch.commit();
    }
});
