#!/usr/bin/env node
/**
 * Full Chitram seed script — creates ALL users, schools, classes, and students.
 *
 * Hierarchy:
 *   1 Super Admin
 *   1 Project Admin, 1 Project Manager  (1 project)
 *   3 Schools, each with 1 Principal + 1 Teacher + 3 Classes + 5 Students/class
 *
 * Management portal password : Chitram@2025
 * Student PIN                : 1234  (Firebase password = chitram1234xx)
 *
 * Run:
 *   cd /Users/shashankkrishna/DevProjects/Chitram_Management
 *   node scripts/seed-full.mjs
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const serviceAccount = JSON.parse(
  readFileSync(join(__dirname, 'serviceAccountKey.json'), 'utf8'),
);

initializeApp({ credential: cert(serviceAccount) });

const auth  = getAuth();
const db    = getFirestore();
const NOW   = FieldValue.serverTimestamp();

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const MGMT_PASSWORD = 'Chitram@2025';

function kidPassword(pin) { return `chitram${pin}xx`; }
const KID_PIN = '1234';

const AVATAR_COLORS = [
  '#FF9B24', '#FF577B', '#00BBAE', '#7C81FF',
  '#00B9F1', '#FFA455', '#4CAF82', '#CE93D8',
];
let colorIdx = 0;
function nextColor() { return AVATAR_COLORS[colorIdx++ % AVATAR_COLORS.length]; }

function emptyAnalytics() {
  return {
    learnedWords: 0,
    averageAccuracy: 0,
    totalAttempts: 0,
    streakDays: 0,
    todayMinutes: 0,
    weeklyMinutes: [0, 0, 0, 0, 0, 0, 0],
    weeklyWords: [0, 0, 0, 0, 0, 0, 0],
    recentWords: [],
    learnedWordIds: [],
    levelBestScores: {},
  };
}

// ─────────────────────────────────────────────
// Fixture data (exact names / codes from spec)
// ─────────────────────────────────────────────

const PROJECT_ID = 'project-chitram-main';

const SCHOOLS = [
  { id: 'school-dps', name: 'Delhi Public School',     code: 'DPS001' },
  { id: 'school-blr', name: 'Bangalore Global Academy', code: 'BLR001' },
  { id: 'school-hyd', name: 'Hyderabad Kids School',   code: 'HYD001' },
];

const CLASSES = [
  { id: 'class-dps-1a', name: 'Grade 1A', grade: '1st Grade', code: 'DPS1A', schoolId: 'school-dps' },
  { id: 'class-dps-2a', name: 'Grade 2A', grade: '2nd Grade', code: 'DPS2A', schoolId: 'school-dps' },
  { id: 'class-dps-3a', name: 'Grade 3A', grade: '3rd Grade', code: 'DPS3A', schoolId: 'school-dps' },
  { id: 'class-blr-1b', name: 'Grade 1B', grade: '1st Grade', code: 'BLR1B', schoolId: 'school-blr' },
  { id: 'class-blr-2b', name: 'Grade 2B', grade: '2nd Grade', code: 'BLR2B', schoolId: 'school-blr' },
  { id: 'class-blr-3b', name: 'Grade 3B', grade: '3rd Grade', code: 'BLR3B', schoolId: 'school-blr' },
  { id: 'class-hyd-1c', name: 'Grade 1C', grade: '1st Grade', code: 'HYD1C', schoolId: 'school-hyd' },
  { id: 'class-hyd-2c', name: 'Grade 2C', grade: '2nd Grade', code: 'HYD2C', schoolId: 'school-hyd' },
  { id: 'class-hyd-3c', name: 'Grade 3C', grade: '3rd Grade', code: 'HYD3C', schoolId: 'school-hyd' },
];

const STUDENTS_DATA = [
  { classId: 'class-dps-1a', grade: '1st Grade', age: 6, names: ['Aarav',  'Priya',   'Rohan',  'Shreya',  'Siddharth'] },
  { classId: 'class-dps-2a', grade: '2nd Grade', age: 7, names: ['Vivaan', 'Ananya',  'Karthik','Tanya',   'Varun'] },
  { classId: 'class-dps-3a', grade: '3rd Grade', age: 8, names: ['Aditya', 'Divya',   'Rahul',  'Simran',  'Dhruv'] },
  { classId: 'class-blr-1b', grade: '1st Grade', age: 6, names: ['Vihaan', 'Riya',    'Dev',    'Anjali',  'Parth'] },
  { classId: 'class-blr-2b', grade: '2nd Grade', age: 7, names: ['Arjun',  'Sneha',   'Akash',  'Kritika', 'Rohit'] },
  { classId: 'class-blr-3b', grade: '3rd Grade', age: 8, names: ['Sai',    'Aisha',   'Vikram', 'Neha',    'Kabir'] },
  { classId: 'class-hyd-1c', grade: '1st Grade', age: 6, names: ['Ishaan', 'Pooja',   'Surya',  'Preeti',  'Arnav'] },
  { classId: 'class-hyd-2c', grade: '2nd Grade', age: 7, names: ['Kavya',  'Meera',   'Nikhil', 'Sonia',   'Rayan'] },
  { classId: 'class-hyd-3c', grade: '3rd Grade', age: 8, names: ['Diya',   'Nisha',   'Raj',    'Isha',    'Amit'] },
];

// Management users — email, display name, role, optional projectId / schoolIds / schoolId
const MANAGEMENT_USERS = [
  {
    email: 'superadmin@chitram.app',
    displayName: 'Super Admin',
    role: 'admin',
    claims: { role: 'admin' },
  },
  {
    email: 'projectadmin@chitram.app',
    displayName: 'Project Admin',
    role: 'projectAdmin',
    claims: { role: 'projectAdmin', projectId: PROJECT_ID },
  },
  {
    email: 'pm@chitram.app',
    displayName: 'Project Manager',
    role: 'pm',
    claims: { role: 'pm', projectId: PROJECT_ID },
  },
  {
    email: 'principal.delhi@chitram.app',
    displayName: 'Principal (Delhi)',
    role: 'principal',
    schoolId: 'school-dps',
    claims: { role: 'principal', schoolIds: ['school-dps'] },
  },
  {
    email: 'principal.blr@chitram.app',
    displayName: 'Principal (Bangalore)',
    role: 'principal',
    schoolId: 'school-blr',
    claims: { role: 'principal', schoolIds: ['school-blr'] },
  },
  {
    email: 'principal.hyd@chitram.app',
    displayName: 'Principal (Hyderabad)',
    role: 'principal',
    schoolId: 'school-hyd',
    claims: { role: 'principal', schoolIds: ['school-hyd'] },
  },
  {
    email: 'teacher.delhi@chitram.app',
    displayName: 'Teacher (Delhi)',
    role: 'teacher',
    schoolId: 'school-dps',
    classIds: ['class-dps-1a', 'class-dps-2a', 'class-dps-3a'],
    claims: { role: 'teacher', schoolId: 'school-dps' },
  },
  {
    email: 'teacher.blr@chitram.app',
    displayName: 'Teacher (Bangalore)',
    role: 'teacher',
    schoolId: 'school-blr',
    classIds: ['class-blr-1b', 'class-blr-2b', 'class-blr-3b'],
    claims: { role: 'teacher', schoolId: 'school-blr' },
  },
  {
    email: 'teacher.hyd@chitram.app',
    displayName: 'Teacher (Hyderabad)',
    role: 'teacher',
    schoolId: 'school-hyd',
    classIds: ['class-hyd-1c', 'class-hyd-2c', 'class-hyd-3c'],
    claims: { role: 'teacher', schoolId: 'school-hyd' },
  },
];

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

async function upsertAuthUser(email, password, displayName) {
  let userRecord;
  try {
    userRecord = await auth.getUserByEmail(email);
    await auth.updateUser(userRecord.uid, { password, displayName, emailVerified: true });
    return { uid: userRecord.uid, isNew: false };
  } catch (e) {
    if (e.code !== 'auth/user-not-found') throw e;
    userRecord = await auth.createUser({ email, password, displayName, emailVerified: true });
    return { uid: userRecord.uid, isNew: true };
  }
}

// ─────────────────────────────────────────────
// Phase 1 — Project & Schools
// ─────────────────────────────────────────────

async function seedProjectAndSchools() {
  console.log('\n📦  Project & Schools');

  await db.collection('projects').doc(PROJECT_ID).set({
    name: 'Chitram Education Project',
    description: 'Demo project — all three schools.',
    schoolIds: SCHOOLS.map(s => s.id),
    createdBy: 'seed-script',
    createdAt: NOW,
  }, { merge: true });
  console.log(`   ✓ Project: ${PROJECT_ID}`);

  for (const school of SCHOOLS) {
    await db.collection('schools').doc(school.id).set({
      name: school.name,
      code: school.code,
      projectId: PROJECT_ID,
      createdBy: 'seed-script',
      teacherIds: [],       // filled in phase 2
      createdAt: NOW,
    }, { merge: true });
    console.log(`   ✓ School: ${school.name} (${school.code})`);
  }
}

// ─────────────────────────────────────────────
// Phase 2 — Management Users
// ─────────────────────────────────────────────

async function seedManagementUsers() {
  console.log('\n👔  Management Users');
  const teacherUids = {};   // email → uid (needed when seeding classes)

  for (const u of MANAGEMENT_USERS) {
    const { uid, isNew } = await upsertAuthUser(u.email, MGMT_PASSWORD, u.displayName);
    await auth.setCustomUserClaims(uid, u.claims);

    // Firestore profile in /users (readable by mobile app if ever needed)
    await db.collection('users').doc(uid).set({
      role: u.role,
      name: u.displayName,
      email: u.email,
      avatarColor: nextColor(),
      createdAt: NOW,
      analytics: emptyAnalytics(),
      ...(u.schoolId ? { schoolId: u.schoolId } : {}),
    }, { merge: true });

    // Teachers also get a /teachers doc (management app reads this collection)
    if (u.role === 'teacher') {
      await db.collection('teachers').doc(uid).set({
        name: u.displayName,
        email: u.email,
        schoolId: u.schoolId,
        avatarColor: nextColor(),
        createdAt: NOW,
      }, { merge: true });

      // Add teacher to school's teacherIds
      await db.collection('schools').doc(u.schoolId).update({
        teacherIds: FieldValue.arrayUnion(uid),
      });

      teacherUids[u.email] = uid;
    }

    console.log(`   ${isNew ? '✓ Created' : '↺ Updated'} ${u.role.padEnd(13)} ${u.email}  uid=${uid}`);
  }

  return teacherUids;
}

// ─────────────────────────────────────────────
// Phase 3 — Classes
// ─────────────────────────────────────────────

async function seedClasses(teacherUids) {
  console.log('\n🏫  Classes');

  // Map school → teacher uid
  const schoolTeacher = {
    'school-dps': teacherUids['teacher.delhi@chitram.app'],
    'school-blr': teacherUids['teacher.blr@chitram.app'],
    'school-hyd': teacherUids['teacher.hyd@chitram.app'],
  };

  for (const cls of CLASSES) {
    const teacherUid = schoolTeacher[cls.schoolId];
    await db.collection('classes').doc(cls.id).set({
      name: cls.name,
      grade: cls.grade,
      teacherId: teacherUid,
      schoolId: cls.schoolId,
      code: cls.code,
      studentIds: [],       // filled in phase 4
      pendingStudentIds: [],
      createdAt: NOW,
    }, { merge: true });
    console.log(`   ✓ ${cls.code}  ${cls.name}  (teacher=${teacherUid?.slice(0,8)}...)`);
  }
}

// ─────────────────────────────────────────────
// Phase 4 — Students
// ─────────────────────────────────────────────

async function seedStudents() {
  console.log('\n🧒  Students');
  const studentPassword = kidPassword(KID_PIN);

  for (const group of STUDENTS_DATA) {
    const classInfo = CLASSES.find(c => c.id === group.classId);
    const schoolId = classInfo.schoolId;
    const schoolInfo = SCHOOLS.find(s => s.id === schoolId);
    const studentUids = [];

    for (const firstName of group.names) {
      const email = `${firstName.toLowerCase()}.kid@chitram.app`;
      const { uid, isNew } = await upsertAuthUser(email, studentPassword, firstName);

      const analytics = emptyAnalytics();
      const baseDoc = {
        name: firstName,
        email,
        parentEmail: email,
        avatarColor: nextColor(),
        age: group.age,
        grade: group.grade,
        homeLanguage: 'en',
        learningLanguages: ['te'],
        activeLearningLanguage: 'te',
        kidType: 'classroom',
        classId: group.classId,
        classIds: [group.classId],
        schoolId,
        createdAt: NOW,
        analytics,
      };

      // /users/{uid} — used by the mobile app for login + profile
      await db.collection('users').doc(uid).set(
        { role: 'kid', ...baseDoc },
        { merge: true },
      );

      // /students/{uid} — used by the management portal
      await db.collection('students').doc(uid).set(
        baseDoc,
        { merge: true },
      );

      studentUids.push(uid);
      console.log(`   ${isNew ? '✓' : '↺'} ${firstName.padEnd(12)} ${email}  uid=${uid.slice(0,8)}...`);
    }

    // Update class.studentIds
    await db.collection('classes').doc(group.classId).update({
      studentIds: studentUids,
    });
    console.log(`   → Linked ${studentUids.length} students to ${classInfo.code}`);
  }
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════');
  console.log('  Chitram Full Seed');
  console.log('═══════════════════════════════════════');

  await seedProjectAndSchools();
  const teacherUids = await seedManagementUsers();
  await seedClasses(teacherUids);
  await seedStudents();

  console.log('\n═══════════════════════════════════════');
  console.log('  ✅  Seed complete!');
  console.log('═══════════════════════════════════════');
  console.log('\nManagement Portal  →  password: Chitram@2025');
  console.log('  superadmin@chitram.app');
  console.log('  projectadmin@chitram.app');
  console.log('  pm@chitram.app');
  console.log('  principal.delhi@chitram.app');
  console.log('  principal.blr@chitram.app');
  console.log('  principal.hyd@chitram.app');
  console.log('  teacher.delhi@chitram.app');
  console.log('  teacher.blr@chitram.app');
  console.log('  teacher.hyd@chitram.app');
  console.log('\nStudent App  →  PIN: 1234');
  console.log('  aarav.kid@chitram.app  (and 44 others)');
  console.log('  Email format: {firstname}.kid@chitram.app');
  console.log('');
}

main().catch(err => {
  console.error('\n❌  Seed failed:', err?.message ?? err);
  process.exit(1);
}).then(() => process.exit(0));
