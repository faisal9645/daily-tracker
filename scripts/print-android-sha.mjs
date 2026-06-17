#!/usr/bin/env node
/**
 * Prints Android signing fingerprints for Firebase Google Sign-In setup.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const androidDir = path.join(root, 'android');
const isWin = process.platform === 'win32';
const gradle = isWin ? 'gradlew.bat' : './gradlew';

console.log('\nPlanflow Android Google Sign-In setup\n');
console.log('1) Firebase Console -> Project Settings -> Your apps -> Android app');
console.log('   Package name: com.planflow.dailytracker');
console.log('2) Add SHA-1 and SHA-256 fingerprints shown below');
console.log('3) Download google-services.json and replace:');
console.log('   android/app/google-services.json');
console.log('4) Rebuild APK: npm run build:android\n');

const result = spawnSync(gradle, ['signingReport'], {
  cwd: androidDir,
  shell: isWin,
  encoding: 'utf8',
});

if (result.stdout) {
  const lines = result.stdout.split('\n');
  let printing = false;
  for (const line of lines) {
    if (line.includes('Variant: debug') && line.includes('app:')) {
      printing = true;
    }
    if (printing && (line.includes('SHA1:') || line.includes('SHA-256:'))) {
      console.log(line.trim());
    }
    if (printing && line.trim() === '' && line.includes('SHA')) {
      printing = false;
    }
  }

  const sha1 = lines.find((line) => line.includes('SHA1:') && !line.includes('SHA-256'));
  const sha256 = lines.find((line) => line.includes('SHA-256:'));
  if (sha1) console.log(`\nCopy SHA-1:   ${sha1.split('SHA1:')[1]?.trim()}`);
  if (sha256) console.log(`Copy SHA-256: ${sha256.split('SHA-256:')[1]?.trim()}`);
}

if (result.status !== 0) {
  console.error(result.stderr || 'Failed to run signingReport.');
  process.exit(result.status ?? 1);
}

console.log('\nAlso verify Firebase Authentication -> Sign-in method -> Google is enabled.\n');
