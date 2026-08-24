# SikPoket — Encrypted Bookmark Manager & Knowledge Vault

> Zero-knowledge, local-first bookmark vault. Save URLs, notes, API keys and passwords with client-side AES-GCM. No servers, no trackers.

**URL:** https://sikpoket.vercel.app/
**Dashboard:** https://sikpoket.vercel.app/dashboard/
**Sitemap:** https://sikpoket.vercel.app/sitemap.xml
**llms.txt:** https://sikpoket.vercel.app/llms.txt
**MCP:** https://sikpoket.vercel.app/.well-known/mcp

## What it is

SikPoket is a fast, distraction-free vault for researchers and creators. Chrome side panel (Ctrl+Shift+E), offline TF-IDF search, wallpaper Spaces, procedural Web Audio, offline QR, and Netscape export. All data lives in `chrome.storage.local` — encrypted with AES-GCM 256 + PBKDF2 100k.

## When to use

- Save a page/link/highlight/tab session → `save-item` via context menu or side panel
- Vault secrets → `crypto-helper.js` (never send plaintext)
- Find "my bookmark about X" → `search-helper.js` TF-IDF offline
- Share → `qr-helper.js` offline canvas QR

## Developer resources

- Helpers: `crypto-helper.js`, `search-helper.js`, `ai-helper.js`, `qr-helper.js`, `export-helper.js`
- Auth: master password + WebAuthn — https://sikpoket.vercel.app/about#auth
- MCP: POST https://sikpoket.vercel.app/api/mcp — tools: search_vault, save_url, list_spaces, export_bookmarks
- Source: https://github.com/njrankitsam11-gif/SikPoket
