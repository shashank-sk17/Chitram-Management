import {
  collection, doc, getDocs,
  query, where, orderBy, Timestamp,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../config/firebase';
import type { LicenseKeyDoc, LanguageCode } from '../../types/firestore';

const COL = 'licenseKeys';

export async function createLicenseKey(
  grade: number,
  language: LanguageCode,
  _adminUid: string,
  expiresAt?: Date,
): Promise<string> {
  const fn = httpsCallable<unknown, { keys: string[] }>(functions, 'adminCreateLicenseKeys');
  const result = await fn({
    count: 1,
    grade,
    language,
    ...(expiresAt ? { expiresAt: expiresAt.toISOString() } : {}),
  });
  return result.data.keys[0];
}

export async function createLicenseKeysBulk(
  count: number,
  grade: number,
  language: LanguageCode,
  _adminUid: string,
  expiresAt?: Date,
): Promise<string[]> {
  const fn = httpsCallable<unknown, { keys: string[] }>(functions, 'adminCreateLicenseKeys');
  const result = await fn({
    count,
    grade,
    language,
    ...(expiresAt ? { expiresAt: expiresAt.toISOString() } : {}),
  });
  return result.data.keys;
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
  const fn = httpsCallable(functions, 'adminRevokeLicenseKey');
  await fn({ key });
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
