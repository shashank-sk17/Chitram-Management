#!/usr/bin/env node

/**
 * Seed script for Chitram Management
 * Creates test users with custom claims for development
 *
 * Usage: node scripts/seed-users.mjs
 * Prerequisites: firebase login
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase Admin with service account
// You'll need to download this from Firebase Console > Project Settings > Service Accounts
const serviceAccountPath = join(__dirname, 'serviceAccountKey.json');

let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
} catch (error) {
  console.error('❌ Error: serviceAccountKey.json not found!');
  console.log('\n📝 To get your service account key:');
  console.log('1. Go to Firebase Console > Project Settings > Service Accounts');
  console.log('2. Click "Generate New Private Key"');
  console.log('3. Save as scripts/serviceAccountKey.json');
  console.log('4. Run this script again\n');
  process.exit(1);
}

initializeApp({
  credential: cert(serviceAccount),
});

const auth = getAuth();
const db = getFirestore();

// Test users configuration
const USERS = [
  {
    email: 'admin@chitram.com',
    password: 'admin123',
    displayName: 'Admin User',
    role: 'admin',
    claims: { role: 'admin' },
  },
  {
    email: 'teacher@chitram.com',
    password: 'teacher123',
    displayName: 'Teacher User',
    role: 'teacher',
    claims: { role: 'teacher' },
  },
  {
    email: 'projectadmin@chitram.com',
    password: 'projectadmin123',
    displayName: 'Project Admin User',
    role: 'projectAdmin',
    claims: { role: 'projectAdmin', projectId: 'demo-project' },
  },
  {
    email: 'pm@chitram.com',
    password: 'pm123456',
    displayName: 'Project Manager User',
    role: 'pm',
    claims: { role: 'pm', projectId: 'demo-project' },
  },
  {
    email: 'principal@chitram.com',
    password: 'principal123',
    displayName: 'Principal User',
    role: 'principal',
    claims: { role: 'principal', schoolIds: ['demo-school'] },
  },
];

async function createOrUpdateUser(userConfig) {
  try {
    // Try to get existing user
    let user;
    try {
      user = await auth.getUserByEmail(userConfig.email);
      console.log(`   Found existing user: ${userConfig.email}`);

      // Update password
      await auth.updateUser(user.uid, {
        password: userConfig.password,
        displayName: userConfig.displayName,
      });
      console.log(`   ✓ Updated password`);
    } catch (error) {
      // User doesn't exist, create new
      user = await auth.createUser({
        email: userConfig.email,
        password: userConfig.password,
        displayName: userConfig.displayName,
        emailVerified: true,
      });
      console.log(`   ✓ Created user: ${userConfig.email}`);
    }

    // Set custom claims
    await auth.setCustomUserClaims(user.uid, userConfig.claims);
    console.log(`   ✓ Set custom claims:`, userConfig.claims);

    // Create/update Firestore user document
    await db.collection('users').doc(user.uid).set(
      {
        email: userConfig.email,
        name: userConfig.displayName,
        role: userConfig.role,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      { merge: true }
    );
    console.log(`   ✓ Created Firestore document`);

    return user;
  } catch (error) {
    console.error(`   ❌ Error creating ${userConfig.email}:`, error.message);
    throw error;
  }
}

async function createDemoProject() {
  try {
    const projectRef = db.collection('projects').doc('demo-project');
    await projectRef.set({
      name: 'Demo Project',
      description: 'Demo project for testing',
      schoolIds: ['demo-school'],
      createdAt: new Date(),
    });
    console.log('   ✓ Created demo project');
  } catch (error) {
    console.error('   ❌ Error creating demo project:', error.message);
  }
}

async function createDemoSchool() {
  try {
    const schoolRef = db.collection('schools').doc('demo-school');
    await schoolRef.set({
      name: 'Demo School',
      code: 'DEMO01',
      projectId: 'demo-project',
      teacherIds: [],
      createdAt: new Date(),
    });
    console.log('   ✓ Created demo school');
  } catch (error) {
    console.error('   ❌ Error creating demo school:', error.message);
  }
}

async function main() {
  console.log('\n🌱 Seeding Chitram Management Users...\n');

  try {
    // Create demo project and school first
    console.log('📦 Creating demo data...');
    await createDemoProject();
    await createDemoSchool();
    console.log('');

    // Create users
    console.log('👥 Creating users...');
    for (const userConfig of USERS) {
      console.log(`\n${userConfig.role.toUpperCase()}: ${userConfig.email}`);
      await createOrUpdateUser(userConfig);
    }

    console.log('\n\n✅ Seeding complete!\n');
    console.log('📋 Login Credentials:\n');
    USERS.forEach((user) => {
      console.log(`${user.role.toUpperCase().padEnd(15)} ${user.email.padEnd(30)} Password: ${user.password}`);
    });
    console.log('\n🚀 Start the dev server: npm run dev');
    console.log('🌐 Navigate to: http://localhost:5173/\n');

  } catch (error) {
    console.error('\n❌ Seeding failed:', error);
    process.exit(1);
  }

  process.exit(0);
}

main();
