#!/usr/bin/env node
/**
 * Prints Android signing fingerprints for Firebase Google Sign-In setup.
 */
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const androidDir = path.join(root, 'android');
const googleServicesPath = path.join(androidDir, 'app', 'google-services.json');
const isWin = process.platform === 'win32';
const gradle = isWin ? 'gradlew.bat' : './gradlew';

console.log('\nPlanflow Android Google Sign-In setup\n');
console.log('1) Open https://console.firebase.google.com/project/gen-lang-client-0638229101/settings/general');
console.log('2) Under "Your apps", select Android app: com.planflow.dailytracker');
console.log('3) Click "Add fingerprint" and paste SHA-1 + SHA-256 below');
console.log('4) Download google-services.json and replace:');
console.log('   android/app/google-services.json');
console.log('5) Rebuild APK: npm run build:android\n');

try {
  const googleServices = JSON.parse(readFileSync(googleServicesPath, 'utf8'));
  const oauthClients = googleServices?.client?.[0]?.oauth_client ?? [];
  const hasAndroidClient = oauthClients.some((client) => client.client_type === 1);
  if (hasAndroidClient) {
    console.log('✓ google-services.json includes an Android OAuth client (SHA-1 is configured).\n');
  } else {
    console.log('✗ google-services.json is missing Android OAuth client (client_type: 1).');
    console.log('  This means SHA-1 is NOT registered yet in Firebase.\n');
  }
} catch {
  console.log('! Could not read android/app/google-services.json\n');
}

const result = spawnSync(gradle, ['signingReport'], {
  cwd: androidDir,
  shell: isWin,
  encoding: 'utf8',
});

if (result.stdout) {
  const lines = result.stdout.split('\n');
  const sha1 = lines.find((line) => line.includes('SHA1:') && !line.includes('SHA-256'));
  const sha256 = lines.find((line) => line.includes('SHA-256:'));
  if (sha1) console.log(`SHA-1:   ${sha1.split('SHA1:')[1]?.trim()}`);
  if (sha256) console.log(`SHA-256: ${sha256.split('SHA-256:')[1]?.trim()}`);
}

if (result.status !== 0) {
  console.error(result.stderr || 'Failed to run signingReport.');
  process.exit(result.status ?? 1);
}

console.log('\nAlso verify Authentication -> Sign-in method -> Google is enabled.\n');
