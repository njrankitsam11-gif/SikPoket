# SikPoket — Codebase Specification

> **Purpose**: This file is the authoritative reference for the SikPoket project. Update the relevant section after every module or feature completion. The AI agent reads this at the start of every session to restore full context.

---

## 1. Project Overview

**SikPoket** is a Chrome Extension (Manifest V3) that acts as a secure personal vault and bookmark manager.

| Property | Value |
|---|---|
| Extension name | SikPoket — Secure Bookmark Manager |
| Version | 1.1 |
| Manifest version | 3 |
| Primary language | Vanilla JS (no build step, no framework) |
| Storage | `chrome.storage.local` (extension data), `localStorage` (settings, auth, biometrics), `sessionStorage` (session unlock) |
| Encryption | AES-GCM 256 via Web Crypto API (PBKDF2 key derivation) |
| Biometrics | WebAuthn (platform authenticator — Touch ID / Windows Hello) |

---

## 2. File Map

```
SikPoket/
├── manifest.json           # MV3 manifest
├── background.js           # Service worker: context menus, badge count, message relay
├── content.js              # Injected into all pages: toast notifications, bookmarklet listener
├── crypto-helper.js        # CryptoHelper (AES-GCM encrypt/decrypt) + BiometricHelper (WebAuthn)
├── popup.html              # Main extension popup UI
├── popup.css               # Full styling for popup UI (23KB, dark theme)
├── popup.js                # Popup logic (~1087 lines)
├── unlock.html             # Standalone tab for biometric unlock (fallback when popup WebAuthn fails)
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── dashboard/
    ├── index.html          # Dashboard SPA (requires auth)
    ├── app.js              # Dashboard logic: Spaces, items, CRUD, import/export
    ├── app.css             # Dashboard styling (19KB, dark glassmorphism theme)
    ├── auth.html           # Login/register page for dashboard
    ├── auth.js             # Multi-user auth with SHA-256 password hashing
    └── standalone.html     # Standalone version of dashboard (61KB self-contained)
```

---

## 3. Architecture

### 3.1 Data Model

**Extension storage** (`chrome.storage.local`) key: `sikpoketData`
```js
{
  urls: [
    { id: string, url: string, title: string, tags: string[], createdAt: number, archived: bool, favorite: bool }
  ],
  apiKeys: [
    { id: string, name: string, key: EncryptedObject, tags: string[], createdAt: number, archived: bool, favorite: bool }
  ],
  passwords: [
    { id: string, name: string, username: string, password: EncryptedObject, tags: string[], createdAt: number, archived: bool, favorite: bool }
  ],
  notes: [
    { id: string, title: string, content: string, tags: string[], createdAt: number, archived: bool, favorite: bool, url?: string }
  ]
}
```

**EncryptedObject** (from `CryptoHelper.encrypt`):
```js
{ salt: number[], iv: number[], data: number[] }
```

**Dashboard storage** (`localStorage`) key: `sikpoket_<username>`
```js
{
  spaces: [{ id: string, name: string, wallpaper: string, wallpaperOpacity?: number, wallpaperBlur?: number, items: DashboardItem[] }],
  activeSpace: string  // space id
}
```

**DashboardItem** (unified, unencrypted in dashboard):
```js
{ id: string, type: 'url'|'note'|'key'|'password', createdAt: number, favorite: bool, archived: bool, tags: string[],
  url?: string, title?: string,       // url
  content?: string,                   // note
  name?: string, value?: string,      // key / password
  username?: string                   // password
}
```

### 3.2 Security Model

- **Master password** (extension): Any string entered on first use. Stored only in `sessionStorage.sikpoketMasterPassword` for the session. Clears on lock/reload. Used as AES-GCM encryption key for `apiKeys` and `passwords`.
- **Biometrics**: Optional. Registers a WebAuthn platform credential. A random `bioKey` (128-bit) is stored in `localStorage.sikpoketBioKey`. The master password is wrapped (`CryptoHelper.encrypt`) with `bioKey` and stored in `localStorage.sikpoketWrappedPassword`. On biometric unlock, the `bioKey` is used to decrypt the wrapped password.
- **Dashboard auth**: SHA-256 hashing with a per-user random salt. User DB stored in `localStorage.sikpoket_users_db`. Sessions in `sessionStorage.sikpoket_user`. Dashboard passwords are plain text after being decrypted from the extension.

### 3.3 Communication Flow

```
Extension popup → background.js → chrome.storage.local
                                 ↓
                       Badge count (active item total)

Context menu (right-click) → background.js.saveItem()
                           → content.js: showToast(type, item)

popup.js (dashboardExport) → chrome.tabs.create(dashboard/index.html)
                           → chrome.tabs.sendMessage / chrome.storage bridge → app.js
```

---

## 4. Modules

### 4.1 `background.js` — Service Worker
**Status**: ✅ Complete

- Registers 4 context menus: `save-link`, `save-selection`, `save-highlight`, `save-page`
- `saveItem(type, item)` — appends to `chrome.storage.local.sikpoketData[type]`
- `updateBadgeCount()` — counts non-archived items across all 4 types, sets badge text (purple `#7c6af7`)
- Relays `item-saved` message back to the originating tab (for toast)
- Listens for `save-item-external` message from `content.js` (bookmarklet flow)
- **NEW**: `save-highlight` context menu: saves selected text as a note with `tags:['highlight']`, `color:'purple'`, and `url: tab.url`
- **NEW**: `chrome.alarms.onAlarm` handler: fires `chrome.notifications.create` when a reminder alarm triggers

### 4.2 `content.js` — Content Script
**Status**: ✅ Complete

- Injected on all URLs
- Listens for `item-saved` message → renders a Shadow DOM toast card (310px, dark glass)
- Toast features: tag input (comma-separated), auto-dismiss (7s), fade-out animation
- `saveTags()` reads chrome.storage, finds item by id+type, appends new tags
- Listens for `window.CustomEvent('sikpoket-save-request')` → bookmarklet URL save

### 4.3 `crypto-helper.js` — Crypto & Biometrics
**Status**: ✅ Complete

**CryptoHelper**:
- `generateSalt()` → `Uint8Array(16)`
- `deriveKey(password, salt)` → `PBKDF2, 100k iterations, SHA-256 → AES-GCM-256`
- `encrypt(data, password)` → returns `{salt, iv, data}` all as `number[]`
- `decrypt(encryptedObj, password)` → returns original JS object

**BiometricHelper**:
- `isAvailable()` → checks `PublicKeyCredential` and platform authenticator
- `register()` → `navigator.credentials.create` with `rpId: 'localhost'`
- `authenticate(credentialIdB64)` → `navigator.credentials.get`
- `_translateError(e)` → friendly error messages for WebAuthn error names
- ⚠️ WebAuthn rpId is `localhost` — only works in a full browser tab (not the extension popup)

### 4.4 `popup.html` / `popup.js` — Main Popup
**Status**: ✅ Complete

**UI Sections**:
- Unlock screen (overlaid, class `show` toggled): password input → `sessionStorage`
- Tabs: URLs | Keys | Passwords | Notes (data-tab attribute drives sections)
- Header: search input, filter pills (All/Favorites/Archived), sort cycle button
- Per-tab: `.sp-list` container, "Add" toggle button, inline `.sp-form`
- Footer: Export JSON, Open Dashboard
- Settings modal: Biometrics, Cloud Sync (Firebase config textarea), Tag Manager, Shortcuts, Bookmarklet

**Key Functions** (`popup.js`):

| Function | Description |
|---|---|
| `loadAllData()` | Loads from chrome.storage, normalizes fields, renders |
| `getFilteredItems()` | Applies status/tag/search/sort filters across all 4 types |
| `renderUrls/ApiKeys/Passwords/Notes()` | Renders item cards with favicons/icons and action buttons |
| `saveUrl/ApiKey/Password/Note()` | Saves new items; encrypts sensitive fields via CryptoHelper |
| `saveArticle()` | Extracts current tab content via `chrome.scripting`, saves as note with `article` tag |
| `dashboardExport()` | Opens dashboard tab, decrypts all secrets, passes data via storage bridge |
| `editItemTags()` | Prompt-based tag editing |
| `toggleFavorite/Archive()` | Toggle item flags, save, re-render |
| `deleteItem()` | Confirm → filter out → save |
| `openReaderMode(note)` | Fullscreen reader overlay for notes/articles |
| `setupReaderControls()` | Font size/family, theme tabs, scroll progress bar |
| `renderTagManager()` | Settings modal: tag list with item counts, rename, delete |
| `handleKeyboardShortcuts()` | Ctrl+1–4 tabs, Ctrl+F search, Ctrl+L lock, Ctrl+B batch, Ctrl+H / ? guide, Esc |
| `checkBiometricAvailability()` | Always shows biometric section, button redirects to unlock.html |
| `buildTagFilter/buildTagSuggestions()` | Populates hidden `<select>` and inline suggestions dropdowns |
| `toggleSelectMode()/applyBulkAction()` | Batch selection toggle, bulk favorite, archive, delete |
| `findDuplicates()/renderDuplicates()` | Groups duplicate URLs and supports one-click Keep Newest |
| `openReminderPopover()/handleAlarm()` | Reminders with datetime popover, chrome.alarms, and desktop notifications |

**User Guide Options (`#guide-modal` & Dashboard)**:
- Header 📖 icon button (`#help-btn`) and footer `"📖 How to Use"` link open an interactive guide modal
- 6 Interactive Guide Sections: Quick Start, 5 Ways to Save, Vault & Encryption, Pro Tools, Dashboard & Spaces, Shortcuts Cheat Sheet
- Dashboard sidebar includes a dedicated `"How to Use"` navigation tool rendering rich step cards and live shortcut references
- Accessible via shortcut <kbd>Ctrl+H</kbd> or <kbd>?</kbd> anytime
- Themes: dark (default in state, `sepia` is default prefs), light
- Font sizes: 11–28px, persisted to `localStorage.sikpoketReaderFontSize`
- Font families: sans-serif / serif, persisted to `localStorage.sikpoketReaderFontFamily`
- Scroll progress bar at top

### 4.5 `unlock.html` — Standalone Unlock Page
**Status**: ✅ Complete

- Opened in a new tab when biometric fails in popup context
- Register: creates WebAuthn credential, generates `bioKey`, encrypts master password, stores in `localStorage`
- Unlock: authenticates with Touch ID, decrypts wrapped password, writes `sessionStorage.sikpoketMasterPassword`
- Auto-triggers unlock after 200ms if credential already registered

### 4.6 `dashboard/auth.html` + `auth.js` — Dashboard Auth
**Status**: ✅ Complete

- Login/register mode toggle with SHA-256 + per-user salt
- User DB: `localStorage.sikpoket_users_db = { [username]: { hash, salt, createdAt } }`
- On first register: `seedUserData(username)` creates 3 demo spaces
- Session: `sessionStorage.sikpoket_user = username`
- Auth guard in `dashboard/index.html` (inline script) redirects to auth.html if no session

### 4.7 `dashboard/index.html` + `app.js` — Dashboard SPA
**Status**: ✅ Complete

**State Object**:
```js
state = {
  spaces: [],       // [{id, name, wallpaper, items}]
  activeSpace: null, // space id
  collection: 'all',
  tag: null,
  search: '',
  sort: 'newest',
  viewMode: 'grid',
  editId: null
}
```

**Collections** (sidebar nav): `all`, `favorites`, `archived`, `urls`, `notes`, `keys`, `passwords`

**Key Functions**:

| Function | Description |
|---|---|
| `load()` | Loads from localStorage; merges chrome.storage bridge data if available |
| `save()` | Persists state to localStorage |
| `getFiltered()` | Filters items by collection, tag, search, sort |
| `render()` | Renders `content-area` as grid or list |
| `cardHtml(item, listMode)` | Generates full item card HTML |
| `updateBadges()` | Updates sidebar badge counts |
| `updateSpaceList()` | Renders space switcher in sidebar |
| `renderSidebarTags()` | Tag list with counts in sidebar |
| `openAdd/openEdit/closeModal()` | CRUD modal for items |
| `handleFormSubmit()` | Creates/updates items, calls `save(); render()` |
| `openAddSpace/handleSpaceSubmit()` | Space CRUD with name, curated mood presets, local image file upload, and atmosphere sliders |
| `renderWallpaperPresets()` | Generates curated mood presets gallery (Cyberpunk, Lo-Fi, Cosmos, Forest, Sunset, Ocean, etc.) |
| `setupWallpaperStudioControls()` | Local file FileReader base64 loader, custom link input, live preview, opacity & blur sliders |
| `deleteActiveSpace()` | Removes active space (min 1 required) |
| `exportItems/importFile()` | JSON export v2 (with spaces structure) / import with merge |
| `seedDemo()` | Seeds 3 demo spaces if no items exist |
| `toast(msg, type)` | Bottom toast notification (2.5s auto-dismiss) |

**Spaces & Wallpaper Studio**:
- Each space: `{ id, name, wallpaper (URL / base64), wallpaperOpacity: number, wallpaperBlur: number, items[] }`
- Wallpaper Studio modal with 38+ curated mood presets (Anime & Pixel Art, Nature & Landscapes, Cosmos & Space, Urban & Cyberpunk, Cozy & Lo-Fi, Minimal & Studio), local computer file uploader (`FileReader` Base64), custom image URL input
- Real-time atmosphere controls: **Opacity (5%–65%)** and **Depth Blur (0px–16px)** with live preview
- Topbar **"🖼️ Wallpaper"** quick switcher button
- Space switcher in sidebar; active space highlighted with `active` class
- Keyboard shortcuts: `N` = new item, `Esc` = close modal, `Ctrl+Delete` = delete active space

---

## 5. Styling / Design System

### Popup (`popup.css`)
- **Theme**: Deep dark (`#0a0a0f` bg, `#141418` surface)
- **Brand color**: `#7c6af7` (purple-violet)
- **Font**: System UI / Inter fallback
- **Width**: 380px fixed
- **CSS prefix**: `sp-` (sp-card, sp-tab, sp-btn-primary, sp-modal, etc.)
- Animations: `.shake` for wrong password, `slideIn/fadeOut` for toasts

### Dashboard (`app.css`)
- **Theme**: Dark glassmorphism (`--bg: #0c0e12`, `--surface: #1b1d23`)
- **Brand**: `--primary: #6b7cf0` (indigo)
- **Font**: Plus Jakarta Sans (Google Fonts) with Inter fallback
- **Layout**: 240px fixed sidebar + flex main content
- **Grid**: responsive 3-col card grid with `card-favicon`, `card-title-row`, `card-footer`
- **Glassmorphism**: `backdrop-filter: blur(12px)` on cards/modals

---

## 6. Permissions

| Permission | Usage |
|---|---|
| `storage` | All data persistence via `chrome.storage.local` |
| `tabs` | Tab creation (dashboard, unlock page), active tab metadata |
| `activeTab` | Current page URL/title for article save |
| `scripting` | `chrome.scripting.executeScript` for article content extraction |
| `contextMenus` | Right-click save menus |
| `downloads` | Listed in manifest (not actively used in v1.1) |
| `<all_urls>` (host) | Content script injection on all pages |

---

### 3.1 Instant Vault Lock
- Triggered by clicking `#lock-btn` in header or pressing Ctrl+L / Cmd+L.
- `lock()` clears `masterPassword = null`, removes `sessionStorage.sikpoketMasterPassword`, resets `unlockInput`, immediately adds `.show` to `#unlock-overlay`, and auto-focuses `#unlock-input`.
- Encrypted secrets are masked immediately.

### 3.2 Non-Blocking Unlock Screen
- On initial load or when locked, `#unlock-overlay` is displayed with high `z-index: 9999`.
- All tab listeners, form toggles, search bars, and shortcuts remain active and attached without hanging promises.
- Typing the master password and clicking "Unlock" (or pressing Enter) executes `doUnlock(pw)`, which removes `#unlock-overlay` and decrypts active vault items.
- Fallback button "Open Full Unlock Page" opens `unlock.html` for platform Touch ID / biometric verification.

---

## 4. Feature Completion Log

| Date | Feature / Module | Status |
|---|---|---|
| Initial | Core popup: URLs, API Keys, Passwords, Notes | ✅ Done |
| Initial | AES-GCM encryption for sensitive fields | ✅ Done |
| Initial | Context menu save (link, selection, highlight, page) | ✅ Done |
| Initial | Content script toast with inline tag input | ✅ Done |
| Initial | Badge count on extension icon | ✅ Done |
| Initial | Reader mode for notes (themes, font, scroll progress) | ✅ Done |
| Initial | Dashboard SPA with Spaces + Wallpapers | ✅ Done |
| Initial | Dashboard multi-user auth (SHA-256 + salt + guest demo) | ✅ Done |
| Initial | Biometric/Touch ID unlock via unlock.html tab | ✅ Done |
| Initial | Tag manager, tag suggestions, bookmarklet | ✅ Done |
| Initial | Export (JSON) / Import (JSON merge) | ✅ Done |
| Module 1 | Duplicate URL Detector ("Scan for Duplicates", "Keep Newest", "Delete All") | ✅ Done |
| Module 2 | Batch Processing & Multi-Select Bar (Bulk favorite, archive, delete) | ✅ Done |
| Module 3 | Text Highlights (Context menu quote cards with color swatches) | ✅ Done |
| Module 4 | Layout Modes (Grid, List, and dynamic Masonry column view) | ✅ Done |
| Module 5 | Reminders & Native Notifications (chrome.alarms + chrome.notifications) | ✅ Done |
| Module 6 | Broken Link Diagnostic Scanner | ✅ Done |
| Pro | Space & Wallpaper Studio (38+ Curated Mood Presets & Local File Upload) | ✅ Done |
| Guide | Interactive User Manual with Shortcuts & Diagnostic Tools | ✅ Done |
| Fix | Instant Lock / Unlock Architecture Refactor (Ctrl+L / Cmd+L + overlay z-index) | ✅ Done |

---

## 9. Conventions / Patterns

- IDs: `Date.now().toString()` (popup) or `Date.now().toString(36) + random` (dashboard)
- Tags: always lowercase, comma-separated input, parsed by `.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)`
- HTML escaping: `esc()` helper via tmp DOM node (popup) or regex replace (dashboard)
- Mutations always immediately persisted:
  - Popup: `saveAndRefresh()` (calls `chrome.storage.local.set + updateTabCounts + renderCurrentTab + buildTagFilter + renderTagManager`)
  - Dashboard: `save(); render();` (localStorage + re-render)
- Settings, prefs, and biometrics stored in `localStorage`; actual vault data in `chrome.storage.local`
- The popup `allData` object is the single source of truth in memory; never stale between operations

---

## 10. How to Update This Spec

After completing any feature or module:
1. Update the relevant **Section 4.x** for the module
2. Add a row to the **Feature Completion Log** (Section 8)
3. Note any new bugs or known issues in **Section 7**
4. If a new file is added, update the **File Map** (Section 2)

**Spec location**: `/Users/sam/.gemini/antigravity-ide/brain/812d8857-c792-4350-8075-c321a2bb2bf5/SPEC.md`  
**Project root**: `/Users/sam/Desktop/SikPoket/`
