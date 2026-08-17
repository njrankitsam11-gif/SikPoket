# Chrome Web Store Listing & Submission Guide: SikPoket

**Last Updated:** August 17, 2026  
**Extension Name:** SikPoket - Secure Bookmark Manager  
**Version:** 1.2.0  
**Primary Category:** Productivity  
**Secondary Category:** Workflow & Planning  

---

## 1. Store Listing Details

### Extension Name
`SikPoket - Secure Bookmark Manager`

### Summary (Short Description — Max 132 chars)
`Save URLs, notes, passwords, and articles securely with client-side encryption, custom spaces, reader mode, and quick search.`

### Detailed Description
```markdown
SikPoket is an ultra-fast, privacy-first bookmark and digital pocket manager designed to help you organize your web life without compromising your data.

✨ KEY FEATURES:

🔒 Client-Side Encryption
• Secure sensitive bookmarks, API tokens, notes, and credentials with AES-GCM / SHA-256 client-side encryption.
• Your master password encrypts your data locally — zero plaintext is transmitted to any cloud servers.

🚀 Lightning-Fast Omnibox & Search
• Type "sik <keyword>" in your browser address bar to instantly search and launch saved bookmarks.
• Full-text search across titles, URLs, tags, and saved notes.

🎨 Dynamic Wallpaper Studio & Spaces
• Organize bookmarks into customizable Spaces (Work, Research, Personal, Projects).
• Customize your dashboard with 38+ curated aesthetic wallpapers, custom image uploads, opacity and blur controls.

📱 Instant Mobile QR Codes
• Generate instant QR codes for any saved bookmark to open links on your mobile device instantly.

📖 Distraction-Free Reader Mode & Reading Time
• Read saved articles without ads, popups, or cluttered layouts.
• Automatic reading time and word count estimation for articles and research notes.

💾 Seamless Import & Export
• Export and import standard Netscape HTML bookmarks (fully compatible with Chrome, Safari, Firefox, Edge, and Brave).
• Encrypted JSON backups for total data portability.

⚡ Offline-Ready & Lightweight
• Works offline directly via local browser storage.
• Available as an extension popup, dedicated full-tab dashboard, or standalone web app.

---
PRIVACY & PERMISSIONS:
SikPoket is committed to user privacy. All bookmark data, tags, and encryption keys remain on your device. We do not track, collect, or sell your personal browsing history.
```

---

## 2. Permissions Justification

Every permission requested in `manifest.json` is strictly required for core user functionality:

| Permission | Purpose & Plain-English Justification |
| :--- | :--- |
| `storage` | Required to store and retrieve user bookmarks, custom spaces, tags, reader mode cache, and user theme preferences locally on the user's device. |
| `tabs` | Required to read the active tab's URL and title when the user clicks to save the current page, and to open dashboard/reader tabs. |
| `activeTab` | Required to extract page metadata and content when the user invokes Reader Mode on the active tab. |
| `scripting` | Required to inject the lightweight bookmark-save confirmation toast directly into the saved webpage. |
| `contextMenus` | Required to allow users to right-click any link, image, or selected text to quickly save it directly into SikPoket. |
| `downloads` | Required to allow users to export and download their Netscape HTML bookmark files and encrypted JSON backups locally. |
| `alarms` | Required to schedule user-configured bookmark reminders and broken link health checks without keeping background scripts permanently awake. |
| `notifications` | Required to display system notifications when scheduled bookmark reminders or background exports complete. |
| `<all_urls>` (Host) | Required to allow the content script toast notification and reader mode extractor to operate across any webpage the user chooses to save. |

---

## 3. Privacy & Data Disclosures

- **Single Purpose Description:**  
  SikPoket serves the single purpose of providing a secure, encrypted personal bookmark and note manager with distraction-free reading and custom workspace organization.

- **Data Collection Declaration:**
  - **Personally Identifiable Information (PII):** NOT collected.
  - **Financial & Payment Information:** NOT collected.
  - **Health Information:** NOT collected.
  - **Web History / Browsing Activity:** NOT collected or transmitted to external servers. URLs are only saved when explicitly requested by user action and stored locally.
  - **User Data Storage:** Stored exclusively in local browser storage (`chrome.storage.local` / `localStorage`).

- **Privacy Policy URL:**  
  `https://sikpoket.vercel.app/privacy` (or hosted at `PRIVACY_POLICY.md`)

---

## 4. Visual Assets Checklist

- [x] **Store Icon:** 128×128 PNG (`icons/icon128.png`)
- [ ] **Small Promo Tile:** 440×280 PNG (Recommended)
- [ ] **Marquee Promo Tile:** 1400×560 PNG (Optional)
- [ ] **Screenshots:** Minimum 1 screenshot at 1280×800 or 640×400 showing:
  1. Main Dashboard with Spaces & Wallpaper Studio
  2. Popup Interface with Quick Save & QR Code
  3. Encrypted Vault / Secure Notes View
  4. Distraction-Free Reader Mode

---

## 5. Submission & Build Checklist

- [x] `manifest_version: 3`
- [x] No `eval()` or prohibited code generation
- [x] All icon files exist at exact dimensions (`16px`, `48px`, `128px`)
- [x] Background service worker uses event-driven listeners
- [x] Clean ZIP build without `.git`, `.vercel`, node_modules, or markdown documentation
