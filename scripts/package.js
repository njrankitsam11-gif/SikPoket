#!/usr/bin/env node

/**
 * SikPoket Chrome Extension Packager
 * Creates a clean release ZIP for Chrome Web Store upload inside the dist/ directory.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

const manifest = JSON.parse(fs.readFileSync(path.join(rootDir, 'manifest.json'), 'utf8'));
const version = manifest.version || '1.0.0';
const zipName = `SikPoket-v${version}.zip`;
const zipPath = path.join(distDir, zipName);

console.log(`\n📦 Packaging SikPoket v${version} for Chrome Web Store...\n`);

// First run verify-build
try {
  execSync('node scripts/verify-build.js', { cwd: rootDir, stdio: 'inherit' });
} catch (e) {
  console.error('\x1b[31m✖ Verification failed. Aborting package.\x1b[0m');
  process.exit(1);
}

// Remove old zip with same name if exists
if (fs.existsSync(zipPath)) {
  fs.unlinkSync(zipPath);
}

// Files and directories to include in Chrome Extension bundle:
const includes = [
  'manifest.json',
  'background.js',
  'content.js',
  'crypto-helper.js',
  'qr-helper.js',
  'ai-helper.js',
  'audio-helper.js',
  'sync-helper.js',
  'search-helper.js',
  'health-helper.js',
  'chat-helper.js',
  'graph-helper.js',
  'reader-helper.js',
  'wikilink-helper.js',
  'tagger-helper.js',
  'archive-helper.js',
  'dedup-helper.js',
  'feed-helper.js',
  'export-helper.js',
  'vector-helper.js',
  'sidepanel.html',
  'popup.html',
  'popup.js',
  'popup.css',
  'unlock.html',
  'unlock.js',
  'icons',
  'dashboard',
  'index.html',
  'vercel.json'
];

try {
  const excludeArgs = [
    '-x', '"*.DS_Store*"',
    '-x', '"*/.git/*"',
    '-x', '"*/.vercel/*"',
    '-x', '"*/.agents/*"',
    '-x', '"*.zip"'
  ].join(' ');

  const command = `zip -r "dist/${zipName}" ${includes.join(' ')} ${excludeArgs}`;
  console.log(`Executing: ${command}`);
  execSync(command, { cwd: rootDir, stdio: 'inherit' });

  const stats = fs.statSync(zipPath);
  console.log(`\n\x1b[32m✔ Successfully built release package: dist/${zipName} (${(stats.size / 1024).toFixed(1)} KB)\x1b[0m`);
  console.log(`Ready for upload to Chrome Developer Dashboard!\n`);
} catch (err) {
  console.error(`\x1b[31m✖ Failed to create zip package: ${err.message}\x1b[0m`);
  process.exit(1);
}
