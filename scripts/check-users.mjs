#!/usr/bin/env node

import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const serviceAccountPath = join(__dirname, 'serviceAccountKey.json');
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

async function checkUsers() {
  console.log('Checking users in Firestore...\n');
  
  const usersSnapshot = await db.collection('users').get();
  console.log(`Found ${usersSnapshot.size} users:\n`);
  
  usersSnapshot.forEach(doc => {
    const data = doc.data();
    console.log(`- ${data.email} (${data.role})`);
  });
}

checkUsers().then(() => process.exit(0)).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
