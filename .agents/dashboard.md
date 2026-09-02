# SikPoket — Dashboard SPA Reference

> Detail doc for `dashboard/`. Indexed from [`SPEC.md`](SPEC.md). Verified against source on 2026-09-02 at v1.8.0. Supersedes the pre-1.8 spec's description of a multi-user `auth.html`/`auth.js` system — **that system was removed from the primary dashboard** (see § Auth below).

---

## Files

- `dashboard/index.html` (579 lines) + `dashboard/app.js` (1999 lines) + `dashboard/app.css` — the primary dashboard, used by the extension and by the hosted `https://sikpoket.vercel.app/dashboard/`.
- `dashboard/standalone.html` (1490 lines) — a **frozen fork**, not a live mirror (see § Standalone below).
- `dashboard/sw.js` (64 lines) — PWA service worker. **Effectively disabled** (see § PWA below).
- `dashboard/theme-init.js` (9 lines) — pre-paint theme application; also actively unregisters any service worker and clears all caches on every load.
- `dashboard/manifest.webmanifest` — PWA manifest.
- `dashboard/index.md` — markdown twin for content negotiation (see `backend.md`).

`manifest.json`'s `web_accessible_resources` lists `index.html`, `app.js`, `app.css`, `manifest.webmanifest` — **not** `standalone.html`, `sw.js`, or `theme-init.js`, confirming standalone is static-hosting-only, never served from inside the extension.

---

## Auth — removed from the primary dashboard

`find`/`grep` across the whole repo confirm **no `dashboard/auth.html` or `dashboard/auth.js` exist anywhere**. `dashboard/index.html` has no login screen, no session guard — it renders immediately on load. Access control for secrets now lives entirely upstream in the extension popup (master password + `CryptoHelper`); the dashboard itself has no crypto layer and no gate.

One vestige remained until 2026-09-02: `app.js` wired a `#logout-btn` click to `sessionStorage.removeItem('sikpoket_user'); location.href = 'auth.html'`, and `index.html` rendered a red "Logout" button in the sidebar footer that 404'd on click (no `auth.html` exists, in the extension or on the web). **Fixed**: the button, its click handler, and the now-dead `html[data-theme="obsidian"] #logout-btn` CSS rule in `app.css` have all been removed, since the primary dashboard has no session to log out of. The stray top-of-file comment in `app.js` referencing this ("Use user-scoped storage key + add logout") was also removed as misleading dead commentary.

The old multi-user login concept wasn't deleted so much as **forked into `dashboard/standalone.html`**, which keeps a full inline reimplementation (see below).

---

## `state` object (app.js)

```js
let state = {
  spaces: [],        // [{id, name, wallpaper, wallpaperOpacity, wallpaperBlur, items:[...]}]
  activeSpace: null,
  collection: 'all',
  tag: null,
  search: '',
  sort: 'newest',     // 'newest' | 'oldest' | 'name'
  viewMode: 'grid',   // 'grid' | 'list' | 'masonry'
  editId: null
};
```

Fields added dynamically elsewhere (not in the initial literal — grep for `state.X =` to re-verify if this drifts):
- `state.brokenIds` — `Set` of broken-link item IDs, from `scanBrokenLinks()` (always empty — see Known Issues).
- `state.brokenScanDone` — gates the one-time-per-session broken-link scan.
- `state.feeds` — `[{url, title}]` RSS subscriptions, lazily initialized with 2 defaults (Hacker News, GitHub Blog).
- `state.theme` — mirrors the current theme id, set by `applyTheme()`.

**Item shape** (type-dependent superset): `{id, type:'url'|'note'|'key'|'password', createdAt, favorite, archived, tags[], url?, title?, content?, name?, username?, value?, _removed?}`. `_removed` is a soft-delete tombstone filtered out on every load.

---

## Sidebar collections

- **Spaces** — space switcher (not a collection).
- **Library**: `all`, `favorites`, `archived`.
- **Categories**: `urls`, `notes`, `keys`, `passwords`.
- **Smart Spaces** (rule-based, via `TaggerHelper.SmartSpaces`): `smart-quick` (<3min reads), `smart-research`, `smart-dev`, `smart-inbox` (untagged triage).
- **Tools**: `highlights` (tag=`highlight`), `broken` (link scanner — see Known Issues), `graph` (Knowledge Graph), `rss` (feed watcher), dedup/shortcuts/guide modals.
- **Tags** — dynamic per-tag filters.

All resolved centrally in `getFiltered()`; `render()` special-cases `graph`/`rss`/`guide`/`broken` to render entirely different UI than the card grid.

---

## Function catalog (app.js), grouped

**State / persistence / extension bridge**: `getActiveSpace()`, `syncFromExtensionStorage()` (merges raw `sikpoketData` into dashboard spaces, dedupes by id/url), `load()`, `save()`, `genId()`, `seedDemo()` (3 default spaces: Startups/Research/Personal).

**Rendering / grid**: `getFiltered()`, `updateBadges()`/`setBdg()`, `updateSpaceList()`, `renderSidebarTags()`, `updateTagStrip()`, `getFaviconUrl()`/`faviconEl()`, `cardHtml(item, lm)`, `attachCardEventDelegation()`, `render()`, `toggleFav`/`toggleArchive`/`confirmDelete`/`copySecret`/`filterTag`.

**CRUD modal**: `openAdd()`, `openEdit(id)`, `closeModal()`, `showTypeFields(type)`, `handleFormSubmit(e)`.

**Spaces / Wallpaper Studio**: `WALLPAPER_PRESETS` (38 curated presets, 6 mood bundles), `setWallpaper()`, `renderWallpaperPresets()`, `updateWallpaperLivePreview()`, `setupWallpaperStudioControls()` (file upload via FileReader base64, custom URL, opacity/blur sliders, ambient sound buttons → `AudioHelper`), `openSpaceSettings/openAddSpace/closeSpaceModal/handleSpaceSubmit`, `deleteActiveSpace()`/`deleteSpace(id)` (blocks deleting the last space), `initCollapsibleSections()` (persisted to `localStorage['sik_collapsed_sections']`).

**Import/export**: `exportItems()` (JSON v2, spaces envelope), `exportNetscapeHtml()` (via `QRCodeGenerator.exportNetscapeBookmarks`), `exportObsidianVault()` / `exportNotionCsv()` (via `ExportHelper`), `importFile(e)`, `openDashboardQrModal()`/`closeDashboardQrModal()` (via `QRCodeGenerator`).

**Broken link scanner**: `scanBrokenLinks()` — calls `window.HealthHelper.scanAll()`; fixed 2026-09-02 (see Known Issues — `health-helper.js` was missing from `index.html`'s script list, so this always no-op'd).

**In-app docs**: `renderDashboardGuide(container)` — static "How to Use" guide.

**Knowledge Graph** (new since v1.1): `initOrUpdateKnowledgeGraph()` — instantiates `window.KnowledgeGraph`, wires node clicks and the "⟲ Recenter" button.

**Reader Mode / TTS / WikiLinks** (new): `openReaderMode(item)` (runs `WikiLinkHelper.renderWikiLinks()`, `ReaderHelper.cleanContent()`, backlinks panel via `WikiLinkHelper.buildLinkIndex().getItemBacklinks()`), `initReaderControls()` (font/theme toggle, TTS via `ReaderHelper.TTS`), `closeReaderMode()`.

**Command Palette** (Cmd/Ctrl+K, new): `toggleCommandPalette/openCommandPalette/closeCommandPalette/renderCommandPalette(query)/executeCommandItem(index)/initCommandPalette()` — substring search over a hardcoded action list (theme switches including `sunset`/`solar`, which the topbar UI itself doesn't expose — see theme note below) plus all vault items and spaces. `applyTheme(theme)` normalizes legacy `sunset`/`solar` → `forest`, persists to `localStorage['sik_theme']`.

**Vim-style navigation** (Phase 9, new): `moveFocus(delta)`, `getFocusedItem()`, `openFocusedItem()`, `toggleFavoriteFocused()`, `copyFocused()`, `editFocused()`, `deleteFocused()` — J/K/O/F/C/E/D over the rendered grid. `deleteFocused()` (key `D`) calls `confirmDelete(item.id)`, which handles its own confirm dialog + delete/save/render/toast — fixed 2026-09-02 (previously called an undefined `deleteItem()`, throwing `ReferenceError` on every use).

**Keyboard shortcuts modal**: `openShortcutsModal/closeShortcutsModal/toggleShortcutsModal`.

**Duplicate Cleaner** (Phase 9): `openDedupModal()/closeDedupModal()/window.mergeCluster(index)/mergeAllDuplicates()` — via `DedupHelper.findDuplicates()`/`.mergeGroup()`.

**RSS/Atom Feed Watcher** (Phase 9): `renderRssSection(container)/loadRssStream()/window.openRssReader(art)/openRssModal/closeRssModal/handleAddRssFeed/window.removeRssFeed(index)` — via `FeedHelper.fetchFeed()`. **Falls back to 3 hardcoded demo articles whenever real feed fetches fail** (expected, since cross-origin XML fetches routinely hit CORS) — a first-time visitor may see placeholder articles that look real.

**Utility**: `toast(msg, type)`, `esc(str)`.

**Init**: the `DOMContentLoaded` handler (~lines 948–1090) wires essentially every listener described above, then `initCommandPalette()`, seeds demo data if empty, and does the first `render()`.

---

## Extension bridge — exact mechanism

**No `postMessage`, no `chrome.runtime.sendMessage`/`onMessage` listener exists anywhere in `dashboard/`.** The bridge is purely `chrome.storage.local`:

1. `load()` reads `chrome.storage.local.sikpoketDashboardData`.
2. `save()` writes `chrome.storage.local.set({sikpoketDashboardData: {spaces, activeSpace}})`.
3. `chrome.storage.onChanged` listener re-runs `syncFromExtensionStorage()` + full re-render whenever `sikpoketData` **or** `sikpoketDashboardData` changes in another context (popup, another dashboard tab).

`syncFromExtensionStorage()` reads the raw popup shape (`sikpoketData: {urls, notes, apiKeys, passwords}`) and converts `urls`/`notes` into the dashboard's unified item schema, deduping by id/url before unshifting into the active space. `apiKeys`/`passwords` are deliberately **not** included — see the Security-relevant note below.

Separately, `popup.js`'s `dashboardExport()` opens the dashboard tab, tries `chrome.tabs.sendMessage` (always silently ignored — no listener), then falls back to `chrome.storage.local.set({sikpoketDashboardData: items})` with a **flat array**, not the `{spaces, activeSpace}` shape — `load()`'s `Array.isArray(data)` branch handles this by wrapping it into a synthetic "Default" space.

Outside the extension (`chrome.storage` undefined, e.g. the hosted `/dashboard/`), every path above falls back to `localStorage` transparently.

---

## Data persistence — exact keys

| Key | Set by | Storage | Purpose |
|---|---|---|---|
| `sikpoketDashboardData` | `app.js` `save()`/`load()` | `chrome.storage.local` (extension) or `localStorage` (standalone browser) | `{spaces[], activeSpace}` |
| `sikpoketData` | `popup.js`/`content.js` | `chrome.storage.local` only | Raw extension vault; `apiKeys`/`passwords` values are AES-GCM ciphertext |
| `sik_theme` | `applyTheme()`, read by `theme-init.js` | `localStorage` (always, even inside the extension) | `'forest'` / `'obsidian'` |
| `sik_collapsed_sections` | `initCollapsibleSections()` | `localStorage` | JSON array of collapsed sidebar section ids |
| `sikpoket_user` | logout handler only (removeItem) | `sessionStorage` | Dead/vestigial |

**Security-relevant note**: `apiKeys`/`passwords` are excluded from the automatic live sync (`syncFromExtensionStorage()`) — **fixed 2026-09-02**; previously it copied `apiKeys[].key`/`passwords[].password` straight into the dashboard item's `.value` field without decryption (no `CryptoHelper` in the dashboard at all), so a key/password added via the popup while a dashboard tab was already open showed up as an unusable encrypted blob, and editing/saving that item would silently persist the literal string `"[object Object]"` over the real value. `urls`/`notes` still sync live (no encryption concern there). The two remaining, now-consistent postures: items exported via the popup's explicit `dashboardExport()` button arrive **decrypted** (readable plaintext in the dashboard), and items created *directly* in the dashboard's own modal are **plain unencrypted strings** from the start. Both postures are plaintext-at-rest in `sikpoketDashboardData` — that's an unchanged, still-true architectural fact (the dashboard has no crypto layer or master password of its own), not something this fix addresses. Use the popup for anything that needs the AES-GCM/PBKDF2 protection.

---

## `standalone.html` — frozen fork, NOT kept in sync

Evidence this is a legacy snapshot, not a mirror:

- Loads only 3 helpers (`qr`, `ai`, `audio`) vs. `index.html`'s 13; of those, only `QRCodeGenerator` is actually called — `ai-helper.js`/`audio-helper.js` are loaded but unused there too (ambient-sound buttons exist in markup with no click handlers).
- **Missing entirely**: Knowledge Graph, Reader Mode/TTS, WikiLinks, Command Palette, Vim navigation, Shortcuts modal, Duplicate Cleaner, RSS watcher, Smart Spaces, broken-link scanner, "✨ Find Similar" (VectorHelper), Obsidian/Notion export, light/dark theme switcher (one fixed dark theme baked into its own CSS), and `deleteSpace` (no way to delete a space at all).
- **Has, that `index.html`/`app.js` do NOT**: a complete inline multi-user auth system — `sha256()`, `genSalt()`, `hashPw()`, `getDb()`, `showAuthScreen()`, `doRegister()`, `doLogin()`, `seedUserData(user)`, plus a guest quick-login. Storage model: per-user keys `sikpoket_<username>` + `sikpoket_users_db` (this is what `scripts/verify-build.js` checks for via its `AUTH_DB_KEY = 'sikpoket_users_db'` string assertion). **Zero `chrome.*` API calls anywhere** — pure static-hosting demo, no extension bridge at all.
- Shared/copied-then-diverged code: `cardHtml`, filtering logic, `render`, `renderWallpaperPresets`, `renderDashboardGuide` (verbatim guide text), export functions, `updateSpaceList`, `toast`, `esc`.

**Treat `standalone.html` as a separate, older build** — a feature added to `app.js` does not automatically exist there.

---

## PWA setup — effectively disabled

- `manifest.webmanifest`: `start_url: /dashboard/index.html`, `display: standalone`, `background_color:#FDFBF7`, `theme_color:#0A0A0A`, icons 16/48/128 (128px `purpose: any maskable`).
- `sw.js`: cache `sikpoket-pwa-v1.6.2` (stale version string — see below), network-first-with-cache-fallback strategy, pre-caches core files on install, prunes stale cache names on activate.
- `theme-init.js` applies the persisted theme pre-paint (avoiding flash-of-wrong-theme), **and also unregisters every service worker + deletes all Cache Storage entries on every single page load**. Nothing in `index.html` ever calls `navigator.serviceWorker.register('sw.js')` in the first place. Net effect: `sw.js` and `manifest.webmanifest` are leftover infrastructure from an earlier phase — **do not assume offline PWA caching is active.**
- Three different, un-synced version strings currently coexist: `package.json` → `1.8.0`; `index.html`'s CSS cache-bust → `app.css?v=2.0.4`; `sw.js`'s `CACHE_NAME` → `sikpoket-pwa-v1.6.2`.

---

## Theme system mismatch

`app.css` defines 4 themes (`forest`, `sunset`, `obsidian`, `solar`) and the Command Palette can switch to all 4, but the topbar `#theme-switcher` `<select>` only offers 2 (Light/forest, Dark/obsidian), and every persistence path (`applyTheme`, `theme-init.js`, the init handler) coerces `sunset`/`solar` back to `forest`. `sunset`/`solar` are reachable only transiently via the command palette and don't stick.

---

## Known issues specific to this module (see `SPEC.md` for the cross-cutting list)

1. ~~Broken "Logout" button → nonexistent `auth.html` (404).~~ **Fixed 2026-09-02** — button, handler, and dead CSS rule removed (no session to log out of in the primary dashboard).
2. ~~`deleteFocused()` (vim key `D`) calls undefined `deleteItem()` → `ReferenceError`.~~ **Fixed 2026-09-02** — now calls `confirmDelete(item.id)`.
3. ~~`health-helper.js` never `<script>`-loaded here despite `scanBrokenLinks()` calling `window.HealthHelper.scanAll()`.~~ **Fixed 2026-09-02** — added `<script src="../health-helper.js">` to `dashboard/index.html`. "Broken Links" now performs a real scan (still only detects timeouts/offline, not real 404/500s — see `extension.md`'s `health-helper.js` entry, that limitation is in the helper itself, not the wiring).
4. ~~`archive-helper.js` loaded but zero callers — dead include.~~ **Removed 2026-09-02** — file deleted, `<script>` tag removed from `dashboard/index.html`. See `SPEC.md` § Known Issues #6.
5. `ai-helper.js` loaded but zero callers here (it's a popup-only feature).
6. ~~Secret-encryption inconsistency between live sync and explicit export.~~ **Fixed 2026-09-02** — `syncFromExtensionStorage()` no longer live-syncs `apiKeys`/`passwords` at all (see § Data persistence above); the dashboard's key/password items are still plaintext-at-rest by design (no crypto layer there), which is unchanged.
7. Inline `onclick="..."` handlers for `openRssReader`/`removeRssFeed`/`mergeCluster` (with awkward `JSON.stringify(...).replace(/"/g,'&quot;')` escaping) — inconsistent with the addEventListener-delegation pattern used elsewhere.
