const DATABASE_NAME = 'turnitscope_report_files_v1';
const STORE_NAME = 'reportFiles';
const DATABASE_VERSION = 1;

interface StoredReportFile {
  reportId: string;
  fileData: string;
  expiresAt: number;
}

let databasePromise: Promise<IDBDatabase> | undefined;

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB is not available in this browser.'));
  }

  if (!databasePromise) {
    databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          database.createObjectStore(STORE_NAME, { keyPath: 'reportId' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Could not open local report file storage.'));
      request.onblocked = () => reject(new Error('Local report file storage is blocked by another tab.'));
    }).catch(error => {
      databasePromise = undefined;
      throw error;
    });
  }

  return databasePromise;
}

export async function saveReportFile(reportId: string, fileData: string, expiresAt: number): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put({ reportId, fileData, expiresAt } satisfies StoredReportFile);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('Could not save the report file locally.'));
    transaction.onabort = () => reject(transaction.error || new Error('Saving the report file locally was cancelled.'));
  });
}

export async function getReportFile(reportId: string): Promise<string | undefined> {
  const database = await openDatabase();
  const storedFile = await new Promise<StoredReportFile | undefined>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).get(reportId);
    request.onsuccess = () => resolve(request.result as StoredReportFile | undefined);
    request.onerror = () => reject(request.error || new Error('Could not read the local report file.'));
  });

  if (!storedFile) return undefined;
  if (storedFile.expiresAt <= Date.now()) {
    await deleteReportFile(reportId);
    return undefined;
  }
  return storedFile.fileData;
}

export async function deleteReportFile(reportId: string): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).delete(reportId);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('Could not remove the local report file.'));
    transaction.onabort = () => reject(transaction.error || new Error('Removing the local report file was cancelled.'));
  });
}

export async function pruneExpiredReportFiles(): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const request = transaction.objectStore(STORE_NAME).openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      const storedFile = cursor.value as StoredReportFile;
      if (storedFile.expiresAt <= Date.now()) cursor.delete();
      cursor.continue();
    };
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('Could not clean up expired local report files.'));
    transaction.onabort = () => reject(transaction.error || new Error('Cleaning up expired local report files was cancelled.'));
  });
}
