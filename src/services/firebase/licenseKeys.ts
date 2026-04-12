import {
  collection, doc, getDocs, writeBatch, updateDoc,
  query, where, orderBy, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import type { LicenseKeyDoc, LanguageCode } from '../../types/firestore';

const COL = 'licenseKeys';

// Generate a random uppercase alphanumeric key (excludes I, O, 0, 1 for readability)
function generateKey(length = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export async function createLicenseKey(
  grade: number,
  language: LanguageCode,
  adminUid: string,
  expiresAt?: Date,
): Promise<string> {
  const key = generateKey();
  const batch = writeBatch(db);
  const docRef = doc(db, COL, key);
  batch.set(docRef, {
    key,
    grade,
    language,
    status: 'unused',
    createdBy: adminUid,
    createdAt: serverTimestamp(),
    ...(expiresAt ? { expiresAt: Timestamp.fromDate(expiresAt) } : {}),
  });
  await batch.commit();
  return key;
}

export async function createLicenseKeysBulk(
  count: number,
  grade: number,
  language: LanguageCode,
  adminUid: string,
  expiresAt?: Date,
): Promise<string[]> {
  const keys: string[] = [];
  const BATCH_SIZE = 500;

  for (let i = 0; i < count; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    const chunkSize = Math.min(BATCH_SIZE, count - i);
    for (let j = 0; j < chunkSize; j++) {
      const key = generateKey();
      keys.push(key);
      batch.set(doc(db, COL, key), {
        key,
        grade,
        language,
        status: 'unused',
        createdBy: adminUid,
        createdAt: serverTimestamp(),
        ...(expiresAt ? { expiresAt: Timestamp.fromDate(expiresAt) } : {}),
      });
    }
    await batch.commit();
  }
  return keys;
}

export interface LicenseKeyFilters {
  status?: 'unused' | 'active' | 'expired';
  grade?: number;
  language?: LanguageCode;
}

export async function getLicenseKeys(
  filters: LicenseKeyFilters = {},
): Promise<Array<{ id: string } & LicenseKeyDoc>> {
  let q = query(collection(db, COL), orderBy('createdAt', 'desc'));
  if (filters.status) q = query(q, where('status', '==', filters.status));
  if (filters.grade !== undefined) q = query(q, where('grade', '==', filters.grade));
  if (filters.language) q = query(q, where('language', '==', filters.language));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as LicenseKeyDoc) }));
}

export async function revokeLicenseKey(key: string): Promise<void> {
  await updateDoc(doc(db, COL, key), { status: 'expired' });
}

export function exportLicenseKeysCSV(keys: Array<{ id: string } & LicenseKeyDoc>): void {
  const header = 'Key,Grade,Language,Status,Created,Expires,Used By\n';
  const rows = keys.map(k => {
    const created = k.createdAt instanceof Timestamp
      ? k.createdAt.toDate().toLocaleDateString()
      : '';
    const expires = k.expiresAt instanceof Timestamp
      ? k.expiresAt.toDate().toLocaleDateString()
      : '';
    return `${k.key},${k.grade},${k.language},${k.status},${created},${expires},${k.usedBy ?? ''}`;
  }).join('\n');

  const blob = new Blob([header + rows], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `chitram-license-keys-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
