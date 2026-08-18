#!/usr/bin/env node

/**
 * SikPoket Extension Build & Manifest Verifier
 * Validates Manifest V3 compliance, icons, file integrity, and CSP restrictions.
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
let errors = 0;
let warnings = 0;

function logPass(msg) {
  console.log(`\x1b[32m✔ PASS:\x1b[0m ${msg}`);
}
function logFail(msg) {
  console.error(`\x1b[31m✖ FAIL:\x1b[0m ${msg}`);
  errors++;
}
function logWarn(msg) {
  console.warn(`\x1b[33m⚠ WARN:\x1b[0m ${msg}`);
  warnings++;
}

console.log('\n🔍 Running SikPoket Extension Health & Store Verification...\n');

// 1. Validate manifest.json
const manifestPath = path.join(rootDir, 'manifest.json');
if (!fs.existsSync(manifestPath)) {
  logFail('manifest.json does not exist!');
  process.exit(1);
}

let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  logPass('manifest.json is valid JSON');
} catch (e) {
  logFail(`manifest.json JSON parse error: ${e.message}`);
  process.exit(1);
}

if (manifest.manifest_version !== 3) {
  logFail(`manifest_version must be 3, found: ${manifest.manifest_version}`);
} else {
  logPass('manifest_version is 3 (MV3 compliant)');
}

// 2. Check Icons
if (manifest.icons) {
  for (const [size, iconPath] of Object.entries(manifest.icons)) {
    const fullPath = path.join(rootDir, iconPath);
    if (!fs.existsSync(fullPath)) {
      logFail(`Manifest icon ${size}px file missing at: ${iconPath}`);
    } else {
      const stats = fs.statSync(fullPath);
      if (stats.size === 0) {
        logFail(`Icon ${iconPath} is empty (0 bytes)`);
      } else {
        logPass(`Icon ${size}px found: ${iconPath} (${stats.size} bytes)`);
      }
    }
  }
} else {
  logWarn('No icons field defined in manifest.json');
}

// 3. Check service worker
if (manifest.background && manifest.background.service_worker) {
  const swPath = path.join(rootDir, manifest.background.service_worker);
  if (fs.existsSync(swPath)) {
    logPass(`Background service worker found: ${manifest.background.service_worker}`);
  } else {
    logFail(`Background service worker missing: ${manifest.background.service_worker}`);
  }
}

// 4. Check Popup
if (manifest.action && manifest.action.default_popup) {
  const popupPath = path.join(rootDir, manifest.action.default_popup);
  if (fs.existsSync(popupPath)) {
    logPass(`Default popup found: ${manifest.action.default_popup}`);
  } else {
    logFail(`Default popup missing: ${manifest.action.default_popup}`);
  }
}

// 5. Check Side Panel
if (manifest.side_panel && manifest.side_panel.default_path) {
  const spPath = path.join(rootDir, manifest.side_panel.default_path);
  if (fs.existsSync(spPath)) {
    logPass(`Side panel default_path found: ${manifest.side_panel.default_path}`);
  } else {
    logFail(`Side panel default_path missing: ${manifest.side_panel.default_path}`);
  }
}

// 6. Check Content Scripts
if (Array.isArray(manifest.content_scripts)) {
  for (const cs of manifest.content_scripts) {
    if (Array.isArray(cs.js)) {
      for (const jsFile of cs.js) {
        const csPath = path.join(rootDir, jsFile);
        if (fs.existsSync(csPath)) {
          logPass(`Content script file found: ${jsFile}`);
        } else {
          logFail(`Content script file missing: ${jsFile}`);
        }
      }
    }
  }
}

// 7. Check Web Accessible Resources
if (Array.isArray(manifest.web_accessible_resources)) {
  for (const war of manifest.web_accessible_resources) {
    if (Array.isArray(war.resources)) {
      for (const res of war.resources) {
        const resPath = path.join(rootDir, res);
        if (fs.existsSync(resPath)) {
          logPass(`Web accessible resource exists: ${res}`);
        } else {
          logFail(`Web accessible resource missing on disk: ${res}`);
        }
      }
    }
  }
}

// 8. Security check: Scan for eval() or new Function() in extension JS files
const jsFilesToCheck = [
  'background.js',
  'content.js',
  'popup.js',
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
  'dashboard/app.js',
  'unlock.js'
];

for (const relPath of jsFilesToCheck) {
  const filePath = path.join(rootDir, relPath);
  if (fs.existsSync(filePath)) {
    const code = fs.readFileSync(filePath, 'utf8');
    // Test for direct eval(
    if (/\beval\s*\(/.test(code)) {
      logFail(`Security violation: eval() found in ${relPath}`);
    } else {
      logPass(`No forbidden eval() in ${relPath}`);
    }
    // Test for new Function(
    if (/new\s+Function\s*\(/.test(code)) {
      logFail(`Security violation: new Function() found in ${relPath}`);
    } else {
      logPass(`No new Function() constructor in ${relPath}`);
    }
  }
}

// 8. Verify standalone.html integrity
const standalonePath = path.join(rootDir, 'dashboard/standalone.html');
if (fs.existsSync(standalonePath)) {
  const content = fs.readFileSync(standalonePath, 'utf8');
  const doctypeCount = (content.match(/<!DOCTYPE\s+html>/gi) || []).length;
  const htmlOpenCount = (content.match(/<html[\s>]/gi) || []).length;
  const htmlCloseCount = (content.match(/<\/html>/gi) || []).length;

  if (doctypeCount === 1 && htmlOpenCount === 1 && htmlCloseCount === 1) {
    logPass('dashboard/standalone.html has clean single-document structure');
  } else {
    logFail(`standalone.html structure issue: ${doctypeCount} DOCTYPEs, ${htmlOpenCount} <html> opens, ${htmlCloseCount} </html> closes`);
  }

  if (content.includes('AUTH_DB_KEY = \'sikpoket_users_db\'')) {
    logPass('dashboard/standalone.html contains correct auth database key');
  } else {
    logFail('dashboard/standalone.html is missing correct AUTH_DB_KEY');
  }
} else {
  logFail('dashboard/standalone.html is missing!');
}

console.log('\n----------------------------------------');
console.log(`Results: ${errors === 0 ? '\x1b[32mALL CHECKS PASSED\x1b[0m' : `\x1b[31m${errors} ERROR(S) FOUND\x1b[0m`}`);
if (warnings > 0) console.log(`Warnings: ${warnings}`);
console.log('----------------------------------------\n');

process.exit(errors > 0 ? 1 : 0);
