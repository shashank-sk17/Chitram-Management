import {
  collection, getDocs,
  query, where, orderBy, Timestamp,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../config/firebase';
import type { LicenseKeyDoc, LanguageCode, LicenseKeyPlan } from '../../types/firestore';

const COL = 'licenseKeys';

export interface LicenseKeyCreateParams {
  grade: number;
  language: LanguageCode;
  count?: number;
  plan?: LicenseKeyPlan;
  validFrom?: Date;
  expiresAt?: Date;
  maxRedemptions?: number;
  projectId?: string;
  schoolId?: string;
  note?: string;
  maxLevel?: number;
}

export async function createLicenseKey(
  params: LicenseKeyCreateParams,
  _adminUid: string,
): Promise<string> {
  const fn = httpsCallable<unknown, { keys: string[] }>(functions, 'adminCreateLicenseKeys');
  const result = await fn(buildCFPayload({ ...params, count: 1 }));
  return result.data.keys[0];
}

export async function createLicenseKeysBulk(
  params: LicenseKeyCreateParams,
  _adminUid: string,
): Promise<string[]> {
  const fn = httpsCallable<unknown, { keys: string[] }>(functions, 'adminCreateLicenseKeys');
  const result = await fn(buildCFPayload(params));
  return result.data.keys;
}

function buildCFPayload(params: LicenseKeyCreateParams) {
  return {
    count: params.count ?? 1,
    grade: params.grade,
    language: params.language,
    ...(params.plan ? { plan: params.plan } : {}),
    ...(params.validFrom ? { validFrom: params.validFrom.toISOString() } : {}),
    ...(params.expiresAt ? { expiresAt: params.expiresAt.toISOString() } : {}),
    ...(params.maxRedemptions ? { maxRedemptions: params.maxRedemptions } : {}),
    ...(params.projectId ? { projectId: params.projectId } : {}),
    ...(params.schoolId ? { schoolId: params.schoolId } : {}),
    ...(params.note ? { note: params.note } : {}),
    ...(params.maxLevel ? { maxLevel: params.maxLevel } : {}),
  };
}

export interface LicenseKeyFilters {
  status?: 'unused' | 'active' | 'expired';
  grade?: number;
  language?: LanguageCode;
  plan?: LicenseKeyPlan;
  projectId?: string;
  schoolId?: string;
}

export async function getLicenseKeys(
  filters: LicenseKeyFilters = {},
): Promise<Array<{ id: string } & LicenseKeyDoc>> {
  let q = query(collection(db, COL), orderBy('createdAt', 'desc'));
  if (filters.status) q = query(q, where('status', '==', filters.status));
  if (filters.grade !== undefined) q = query(q, where('grade', '==', filters.grade));
  if (filters.language) q = query(q, where('language', '==', filters.language));
  if (filters.plan) q = query(q, where('plan', '==', filters.plan));
  if (filters.projectId) q = query(q, where('projectId', '==', filters.projectId));
  if (filters.schoolId) q = query(q, where('schoolId', '==', filters.schoolId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as LicenseKeyDoc) }));
}

export async function revokeLicenseKey(key: string): Promise<void> {
  const fn = httpsCallable(functions, 'adminRevokeLicenseKey');
  await fn({ key });
}

export function exportLicenseKeysCSV(keys: Array<{ id: string } & LicenseKeyDoc>, schools: Array<{ id: string; name: string }>): void {
  const schoolMap = new Map(schools.map(s => [s.id, s.name]));
  const header = 'Key,Grade,Language,Plan,Status,Valid From,Expires,Max Redemptions,School,Note\n';
  const rows = keys.map(k => {
    const expires = k.expiresAt instanceof Timestamp ? k.expiresAt.toDate().toLocaleDateString() : '';
    const validFrom = k.validFrom instanceof Timestamp ? k.validFrom.toDate().toLocaleDateString() : '';
    const school = k.schoolId ? (schoolMap.get(k.schoolId) ?? k.schoolId) : '';
    return [k.key, k.grade, k.language, k.plan ?? '', k.status, validFrom, expires, k.maxRedemptions ?? 1, school, k.note ?? ''].join(',');
  }).join('\n');

  const blob = new Blob([header + rows], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `chitram-license-keys-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
