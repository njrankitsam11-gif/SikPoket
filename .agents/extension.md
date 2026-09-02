# SikPoket — Chrome Extension Core Reference

> Detail doc for the extension surface (manifest, service worker, content script, popup, side panel, unlock page, and all 17 root-level helper modules). Indexed from [`SPEC.md`](SPEC.md). Verified against source on 2026-09-02 at v1.8.0.

---

## manifest.json

- MV3, `version: "1.8.0"`, omnibox keyword `sik`.
- Permissions: `storage`, `tabs`, `activeTab`, `scripting`, `contextMenus`, `downloads`, `alarms`, `notifications`, `sidePanel`. Host permissions: `<all_urls>`.
- `background.service_worker = "background.js"` — classic script, not `type: module` (hence `importScripts()` inside it).
- `content_scripts`: `content.js` on `<all_urls>`, default run_at, no CSS.
- `side_panel.default_path = "sidepanel.html"`.
- `commands`: `_execute_action` (Ctrl+Shift+S, native popup open) and `toggle-side-panel` (Ctrl+Shift+E, handled in `background.js`).
- `web_accessible_resources`: one entry (`matches: <all_urls>`) listing the dashboard bundle (`dashboard/index.html`, `app.js`, `app.css`, `manifest.webmanifest`), `popup.css`, all 17 helper `.js` files, icons, `sidepanel.html`, `unlock.html`, `unlock.js`.
  - **Not listed** (so not servable from inside the extension, static-hosting only): `dashboard/standalone.html`, `dashboard/sw.js`, `dashboard/theme-init.js`.

---

## background.js (342 lines) — MV3 service worker

`importScripts('health-helper.js')` at the top, wrapped in try/catch that swallows failure — the only place `HealthHelper` loads successfully (see helper table below).

Key functions:
- `saveItem(type, item)` — unshifts into `chrome.storage.local.sikpoketData[type]`, auto-inits the 4 arrays.
- `updateBadgeCount()` — counts non-archived items across all 4 `sikpoketData` arrays, sets badge `#7c6af7`. Fires on install/startup and on `chrome.storage.onChanged` **only for `sikpoketData`** — it does **not** react to `sikpoketDashboardData` changes, so dashboard-only items never affect the badge.
- `chrome.contextMenus.onClicked` — 4 menus: `save-link`, `save-selection`, `save-highlight`, `save-page`. Note `save-selection` and `save-highlight` both register on `contexts: ['selection']`, so right-clicking selected text always shows both options (overlapping UX, not a bug but worth knowing).
- `chrome.runtime.onMessage` #1 — `action: 'save-item-external'`: the bookmarklet entry point (paired with `content.js`).
- `chrome.alarms.onAlarm` — `sikpoket_health_check` (weekly → `HealthHelper.scanAll()`) and `sikpoket_reminder_<type>_<id>` (fires `chrome.notifications.create`).
- Omnibox (`sik <query>`) — searches `sikpoketData.urls`/`.notes`, max 6 suggestions; Enter either navigates directly or opens `dashboard/index.html?search=<query>`.
- `chrome.commands.onCommand` — `toggle-side-panel` → `chrome.sidePanel.open({windowId})`.
- `chrome.runtime.onMessage` #2 (Tab Session Snapshot) — `save-window-session` (snapshots all non-`chrome://` tabs in the window into `chrome.storage.local.sikpoketSessions`) and `restore-session` (opens tabs from a saved session). **No code anywhere reads `sikpoketSessions` back to render a list, and `restore-session` is never actually invoked by any UI** — see sidepanel section below. You can create a session snapshot but never see or restore it.

---

## content.js (266 lines)

Injected on `<all_urls>`. Two jobs:
- `showToast(type, item)` — Shadow DOM toast (`#sikpoket-toast-host`, fully isolated CSS) confirming a save, with an inline tag-add mini-form (`saveTags()` re-reads/writes `chrome.storage.local.sikpoketData` directly). Auto-dismiss 7s.
- Listens for `window.CustomEvent('sikpoket-save-request')` (dispatched by the popup's bookmarklet `javascript:` link) → `chrome.runtime.sendMessage({action:'save-item-external', type:'urls', item})`.

---

## popup.html (551 lines) / popup.js (1707 lines) / popup.css

Fixed-size (400×560–640px) browser-action popup. Script includes, in order: `crypto-helper.js`, `qr-helper.js`, `ai-helper.js`, `export-helper.js`, `vector-helper.js`, `popup.js`.

Sections: unlock overlay, full-screen reader-mode overlay (font/theme controls, AI-summary box), header (brand, side-panel/wallpaper/help/select-mode/settings/lock buttons, search, filter pills), 4 tabs (URLs / Keys / Passwords / Notes, each with list + inline "+Add" form + tag autocomplete), bulk-action bar, footer (Guide / Export / Open Dashboard), and 4 modals: Wallpaper, Settings (Guide callout, duplicate scanner, biometric section, Cloud Sync/Firebase textarea, Tag Manager, shortcuts cheat-sheet, bookmarklet, HTML/JSON export), the 6-tab Guide/Manual modal, and a QR modal.

Key functions in `popup.js` (`allData` is the single in-memory source of truth, always kept fresh):

| Function | Description |
|---|---|
| `loadAllData()` | Loads from `chrome.storage.local`, normalizes fields, renders |
| `getFilteredItems()` | Substring-only search/filter/sort across all 4 types (simpler than the dashboard's `SearchHelper`) |
| `renderUrls/ApiKeys/Passwords/Notes()` | Card rendering with favicons/icons/action buttons |
| `saveUrl/ApiKey/Password/Note()` | Encrypts sensitive fields via `CryptoHelper` before saving |
| `saveArticle()` | Extracts current tab content via `chrome.scripting`, saves as a `note` tagged `article` |
| `saveAndRefresh()` | Central mutation path: `chrome.storage.local.set` + badge/tab-count update + re-render + tag-filter rebuild. **Also bridges decrypted plaintext secrets into `sikpoketDashboardData`** — see [SPEC.md § Known Issues](SPEC.md#known-issues) |
| `dashboardExport()` | Opens a dashboard tab, decrypts all secrets with the master password, hands them off via `chrome.storage.local` (attempts `chrome.tabs.sendMessage` first, which always fails silently since the dashboard has no message listener, then falls back to storage) |
| `editItemTags()` / `toggleFavorite/Archive()` / `deleteItem()` | Standard item mutators |
| `openReaderMode(note)` / `setupReaderControls()` | Fullscreen reader (own implementation — does **not** use `reader-helper.js` or TTS, unlike the dashboard's reader) |
| `renderTagManager()` | Settings-modal tag list: counts, rename, delete |
| `handleKeyboardShortcuts()` | Ctrl+1–4 tabs, Ctrl+F search, Ctrl+L lock, Ctrl+B batch select, Ctrl+H/`?` guide, Esc |
| `checkBiometricAvailability()` | Shows biometric section; button redirects to `unlock.html` (WebAuthn needs a real tab, see below) |
| `toggleSelectMode()` / `applyBulkAction()` | Batch selection + bulk favorite/archive/delete |
| `findDuplicates()` / `renderDuplicates()` | **Weaker, independent** duplicate detector — only compares `urls[]` by trailing-slash/lowercase, no tracking-param stripping, no note dedup (contrast `DedupHelper` below) |
| `openReminderPopover()` / `handleAlarm()` | Reminders via `chrome.alarms` + `chrome.notifications` |
| `handleChat` / `appendChatMessage` | Wraps `ChatHelper`; guarded by DOM element existence, so effectively **side-panel-only** despite living in the shared `popup.js` |
| `exportData()` / `exportHtmlBookmarks()` | Own JSON export (secrets replaced with literal `'ENCRYPTED'`) and Netscape HTML export via `QRCodeGenerator.exportNetscapeBookmarks` — **does not use `ExportHelper`** |

**`export-helper.js` and `vector-helper.js` are loaded here but never referenced by `popup.js`** — confirmed dead weight in this context (they're alive in the dashboard).

---

## sidepanel.html (241 lines) — confirmed new since the pre-1.8 spec

Docked variant, structurally different from the popup, sharing the same `popup.js`:

- Inline `<style>` block (not `popup.css`) for full-viewport layout + a `.sp-drop-zone` drag target.
- **6 tabs** (vs popup's 4): URLs, **Sessions** (new), Notes, Keys, Passwords, **Assistant** (new) — tab order also differs from the popup.
- Sessions tab: `#snapshot-window-btn` is wired (sends `save-window-session`); the list is otherwise non-functional (see background.js notes above).
- Assistant tab: chat UI backed by `chat-helper.js` / `ChatHelper`, context built from `[...urls, ...notes]` (API keys/passwords correctly excluded).
- Quick-add buttons per tab exist in markup (`#add-url-btn`, `#add-note-btn`, `#add-api-key-btn`, `#add-password-btn`, `#save-current-tab-btn`) but **have no click handlers and no `<form>` markup at all** — you cannot add a new item from the side panel today.
- `.sp-drop-zone` markup exists with **no JS wiring** (no `dragover`/`drop`/`dataTransfer` handlers anywhere in `popup.js`).
- `popup.css` has a literal comment: `/* ── SIDEPANEL COMPAT — missing in popup.css but used by sidepanel.html ── */` followed by patch classes — direct evidence the side panel was retrofitted after the fact.
- Footer hardcodes **`"SikPoket v1.3"`** — stale vs. the real manifest version 1.8.0.

Script includes: same as popup plus `chat-helper.js`.

---

## unlock.html (33 lines) / unlock.js (95 lines)

Standalone tab (`chrome.tabs.create`) — exists purely because WebAuthn platform-authenticator support inside a `chrome-extension://` popup surface is unreliable; `BiometricHelper.register()` sets `rp.id = window.location.hostname`, which only resolves sensibly in a real tab context.

- Already-unlocked check via `sessionStorage.sikpoketMasterPassword`.
- `unlock-btn` → `BiometricHelper.authenticate(credId)` → `CryptoHelper.decrypt(wrapped, bioKey)` → writes `sessionStorage.sikpoketMasterPassword`.
- `register-btn` — two-step: reveal password field, then `BiometricHelper.register()` + generate 16-byte `bioKey` + `CryptoHelper.encrypt({value: mp}, bioKey)`, persisted to `localStorage`.
- Auto-triggers unlock after 200ms if a credential already exists.
- **Important**: `sessionStorage` is scoped per top-level browsing context. Unlocking in `unlock.html`'s tab, the popup, and the side panel are three *independent* unlocks — none propagate to the others, despite sharing an origin and vault.

---

## Helper modules (root-level, all listed in `web_accessible_resources`)

### crypto-helper.js (180 lines) — `CryptoHelper` + `BiometricHelper`

The only helper written as a bare top-level `const` (every other helper uses an IIFE `(function(global){...})(window)` pattern).

- `CryptoHelper.generateSalt()` — random 16 bytes.
- `.deriveKey(password, salt)` — PBKDF2, **100,000 iterations**, SHA-256 → AES-GCM-256.
- `.encrypt(data, password)` → `{salt:number[], iv:number[], data:number[]}` (JSON-stringifies `data` first).
- `.decrypt(encryptedObj, password)` → parsed original object.
- `BiometricHelper.isAvailable()` / `.register()` / `.authenticate(credIdB64)` / `._translateError(e)` — WebAuthn platform authenticator wrapper.

Loaded in: `popup.html`, `sidepanel.html`, `unlock.html`. **Not loaded in `dashboard/index.html`** — the dashboard has no crypto layer at all (see `dashboard.md`).

### ai-helper.js (149 lines) — `AIHelper`

On-device summarization via Chrome's Prompt API (`window.ai.languageModel` / `window.LanguageModel`), falling back to a local extractive summarizer.

- `isPromptApiAvailable()` — checks for `available === 'readily' || 'after-download'`. **This may be checking a stale/early shape of Chrome's built-in AI API** — worth re-verifying against the current Chrome API surface if summarization silently always falls back.
- `summarizeArticle(title, content, maxBullets=3)` — Prompt API first, else `localTextRankSummary()` (stop-word-filtered frequency scoring + first-sentence position boost).
- `suggestTags(title, content, url, maxTags=5)` — frequency keywords + domain-derived tag.

Used by: popup's reader-mode "✨ AI Summary". Loaded but **unused** in the dashboard.

### audio-helper.js (161 lines) — `AudioHelper`

Procedural Web Audio ambient soundscapes, no audio files. Presets: `rain`, `lofi`, `binaural` (two oscillators forming an 8Hz beat — actually 216Hz/224Hz despite the "432Hz" label), `cafe` (all via brown-noise generation + filter graphs). `play(presetId, volume)` / `stop()` / `setVolume(val)`.

Dashboard-only feature — not loaded in popup/sidepanel.

### chat-helper.js (68 lines) — `ChatHelper`

Thin Prompt API wrapper for "ask your vault." `initSession(contextItems)` builds a system prompt capped at ~25,000 chars (character count, not real tokens); `prompt(message)`; `destroy()`. Side-panel-only in practice (see `sidepanel.html` above).

### sync-helper.js (111 lines) — `SyncHelper` — **fully orphaned**

Complete, working end-to-end-encrypted GitHub Gist backup/restore (`validateToken`, `pushToGist`, `pullFromGist`, using `CryptoHelper` + gist file `sikpoket-vault.enc.json`). **Not `<script>`-loaded anywhere in the actual app** (not popup, sidepanel, dashboard, or unlock) — referenced only in marketing prose (`index.html`, `about/`, `developers/`). A fully-built feature with zero UI wiring.

### search-helper.js (106 lines) — `SearchHelper`

TF-style ranked full-text search (`tokenize`, `_buildItemProfile`, `search(query, items)` — implicit AND across query tokens, exact/partial term weighting, title-match bonus). Dashboard-only; the popup has its own separate, simpler substring filter (`getFilteredItems`).

### health-helper.js (57 lines) — `HealthHelper`

`scanAll()` reads both `sikpoketData` and `sikpoketDashboardData`, HEAD-fetches each URL with `mode:'no-cors'` + 8s timeout. Because `no-cors` responses are always opaque, it can only detect **timeouts/offline**, never real 404/500s — this limitation is inherent to the approach, not a bug to fix. Writes results to `chrome.storage.local.sikpoketBrokenLinks`.

Bound via `self`/`this` (not `window`) because it's also loaded via `importScripts()` in `background.js` (works correctly there, weekly alarm). **Fixed 2026-09-02**: `health-helper.js` was never `<script>`-tagged into `dashboard/index.html`, so `dashboard/app.js`'s `scanBrokenLinks()` call to `window.HealthHelper.scanAll()` always hit `undefined` and the dashboard's "Broken Links" collection always reported clean regardless of actual link health. The script tag has been added; the dashboard scan now runs for real (with the timeout-only detection limitation noted above).

### graph-helper.js (444 lines) — `KnowledgeGraph` class

Dependency-free Canvas force-directed graph (nodes = items/tags/domains, edges = tag/domain/wikilink relations). Constructor takes `{nodeRadius, repulsion, springLength, springStrength, damping, centerGravity, onNodeClick, onNodeHover}`. `setData(items)` builds item nodes (colored/iconed by type), tag nodes, domain nodes (2+ shared items only), and — if `window.WikiLinkHelper` is present — direct wikilink edges.

**Fixed 2026-09-02** ([issue #4](https://github.com/njrankitsam11-gif/SikPoket/issues/4)): `_stepPhysics()`'s target-side velocity update previously divided by `edge.target.target?.mass` instead of `edge.target.mass`. Since edges only have `.source`/`.target` (no nested `.target.target`), that was always `undefined`, so `NaN || 1` silently fell back to `1` — every edge's target node got a flat force nudge instead of a mass-scaled one, while the source side was already correct. Now both sides divide by the node's actual `.mass` (1.5 for item nodes, 2.0 for tag nodes, 2.2 for domain nodes), matching the source-side pattern with no fallback needed.

Dashboard-only.

### reader-helper.js (129 lines) — `ReaderHelper`

`calculateReadingTime()`, `cleanContent()` (strips script/style/nav/footer, auto-paragraphs), and a `TTS` sub-object wrapping `SpeechSynthesis` (`init/speak/pause/resume/stop/setRate` — note `setRate` mid-utterance doesn't actually restart speech at the new rate, a known no-op per its own comment). Dashboard-only — the popup's reader mode is a separate, simpler implementation with no TTS.

### wikilink-helper.js (86 lines) — `WikiLinkHelper`

Obsidian-style `[[Target|Alias]]` parsing. `extractLinks(text)`, `buildLinkIndex(items)` (forward/back link maps, resolved by lowercase title match), `renderWikiLinks(text, callback)` (renders clickable pills — the `callback` param is accepted but unused). Consumed by `graph-helper.js` and the dashboard reader. **Not loaded in popup/sidepanel** — `[[wikilinks]]` typed in the popup are stored as literal text and never linked/graphed unless later viewed in the dashboard.

### tagger-helper.js (105 lines) — `TaggerHelper`

`DOMAIN_TAG_RULES` (19 hardcoded hostname→tags mappings) + `KEYWORD_RULES` (6 regex rules) power `suggestTags(item)`. `SmartSpaces` predicates — `isQuickRead`, `isResearch`, `isDev`, `isInbox` — back the dashboard's Smart Spaces sidebar collections. Dashboard-only; the popup's tag suggestions are just "previously used tags," no domain/keyword intelligence.

### archive-helper.js (63 lines) — `ArchiveHelper` — **fully orphaned**

`createSnapshot`/`saveSnapshot`/`getSnapshot`/`hasSnapshot`, keyed `archive_snap_<itemId>` in `chrome.storage.local`. Loaded in the dashboard but **zero callers anywhere in the repo**. The "Offline Page Archiver" feature this implies does not exist in any UI.

### dedup-helper.js (124 lines) — `DedupHelper`

`normalizeUrl()` strips 15 tracking params (`utm_*`, `fbclid`, `gclid`, etc.) + lowercases host/strips `www.`/trailing slash. `findDuplicates(items)` groups by normalized URL or (for note-like items) by normalized title. `mergeGroup(items)` unions tags, ORs favorites, concatenates non-redundant note content. Dashboard-only — stronger than the popup's inline dedup (see popup.js table above).

### feed-helper.js (97 lines) — `FeedHelper`

RSS 2.0 / Atom parsing via `DOMParser`. `parseFeedXml()`, `fetchFeed(url)`. A comment mentions a "proxy/cached fetch" fallback for CORS failures that **is not actually implemented** — CORS failures just throw. Dashboard-only (RSS Feed Watcher).

### export-helper.js (295 lines) — `ExportHelper`

Obsidian-vault Markdown export (YAML frontmatter + body), Notion CSV export, and a hand-rolled zero-dependency ZIP writer (full PKZIP local/central-directory headers, CRC32 table, store-only/no compression). `exportObsidianVaultZip()` handles filename collisions. Dashboard-only in practice — loaded but unreferenced in popup/sidepanel.

### vector-helper.js (303 lines) — `VectorHelper`

Sparse-vector "semantic" search: TF-weighted bag-of-words **plus character 3-grams** for fuzzy/typo tolerance (not real embeddings). Field weights: tags ×4.0, title ×3.5, space ×2.0, summary ×2.5, content ×1.5, url ×1.0. `cosineSimilarity`, `findSimilar(item, all, topK)`, `semanticSearch(query, items, topK)`, `clusterItems(items, numClusters)` (K-Means++ with auto-labeled cluster names). Dashboard-only in practice — loaded but unreferenced in popup/sidepanel.

### qr-helper.js (564 lines) — `QRCodeGenerator`

A complete dependency-free QR encoder (Reed-Solomon ECC, GF(256) math, all 8 mask patterns scored for minimal "lost points"), capped at QR type 1–10 (roughly 213 bytes at ECC level M — very long URLs would throw). Also bundles two unrelated utilities into the same global:
- `renderToCanvas(canvas, text, opts)` — powers the popup's and dashboard's QR modals.
- `exportNetscapeBookmarks(urlsList)` — Netscape Bookmark File Format HTML export, powers the popup's "🌐 Export HTML" button.
- `estimateReadingTime(text)` — powers the reading-time badge on note cards.

The only non-crypto helper genuinely wired into **both** popup/sidepanel and dashboard identically. Its own top-level `createQRCode()` function is defined but never called anywhere, even within the file.

---

## Helper wiring matrix

| Helper | Loaded popup/sidepanel | Used by popup.js | Loaded dashboard | Used by app.js | Status |
|---|:---:|:---:|:---:|:---:|---|
| crypto-helper.js | ✅ | ✅ | ❌ | — | Popup/side-panel only |
| qr-helper.js | ✅ | ✅ | ✅ | ✅ | Fully wired everywhere |
| ai-helper.js | ✅ | ✅ | ✅ | ❌ | Popup-only in practice |
| chat-helper.js | ✅ (sidepanel) | ✅ | ❌ | — | Side-panel-only |
| export-helper.js | ✅ | ❌ | ✅ | ✅ | Dashboard-only in practice |
| vector-helper.js | ✅ | ❌ | ✅ | ✅ | Dashboard-only in practice |
| audio-helper.js | ❌ | — | ✅ | ✅ | Dashboard-only |
| sync-helper.js | ❌ | — | ❌ | — | **Orphaned everywhere** |
| search-helper.js | ❌ | — | ✅ | ✅ | Dashboard-only |
| health-helper.js | ❌ | — | ✅ (fixed 2026-09-02) | ✅ | Works in background.js and dashboard |
| graph-helper.js | ❌ | — | ✅ | ✅ | Dashboard-only |
| reader-helper.js | ❌ | — | ✅ | ✅ | Dashboard-only |
| wikilink-helper.js | ❌ | — | ✅ | ✅ | Dashboard-only |
| tagger-helper.js | ❌ | — | ✅ | ✅ | Dashboard-only |
| archive-helper.js | ❌ | — | ✅ | ❌ | **Orphaned everywhere** |
| dedup-helper.js | ❌ | — | ✅ | ✅ | Dashboard-only |
| feed-helper.js | ❌ | — | ✅ | ✅ | Dashboard-only |

---

## Storage key inventory (extension side)

**`chrome.storage.local`**
- `sikpoketData` — `{urls[], apiKeys[], passwords[], notes[]}`. Common fields: `{id, title/name, tags[], createdAt, archived, favorite}`. `apiKeys[].key` / `passwords[].password` are `CryptoHelper`-encrypted `{salt,iv,data}` blobs; `passwords[].username` is plaintext.
- `sikpoketDashboardData` — `{spaces:[{id, items[]}], activeSpace}`. Item shape uses `type:'url'|'note'|'key'|'password'` (different convention than `sikpoketData`'s array-key convention) with **plaintext** `name/value/username` — see Known Issues.
- `sikpoketSessions` — `[{id, name, tabs:[{url,title,favIconUrl}], createdAt}]` — write-only from the UI's current perspective (see background.js notes).
- `sikpoketBrokenLinks` — `string[]` of item IDs (written by `HealthHelper.scanAll`, only ever populated from `background.js`'s weekly alarm, not from the dashboard).
- `sikpoketWallpaperUrl`, `sikpoketWallpaperOpacity` — popup/sidepanel wallpaper prefs.
- `archive_snap_<itemId>` — dead, never written (`ArchiveHelper` orphaned).

**`localStorage`** (shared across all `chrome-extension://<id>` pages)
- `sik_theme` (default `'forest'`; also `'obsidian'`, legacy `'sunset'`/`'solar'`).
- `sikpoketReaderFontSize` (default 15), `sikpoketReaderFontFamily` (default `sans-serif`), `sikpoketReaderTheme` (default `sepia`).
- `sikpoketBiometricEnabled`, `sikpoketBiometricCredId`, `sikpoketBioKey`, `sikpoketWrappedPassword` — biometric chain, identical across `unlock.js` and `popup.js`.
- `sikpoketFirebaseConfig` — written/read by the Settings-modal "Cloud Sync" block; **nothing else in the repo consumes it and no Firebase SDK is loaded anywhere** — a second, independent dead-end sync stub alongside `sync-helper.js`.
- `sikpoketReminder_<type>_<id>` — per-item reminder due-timestamp cache (mirrors a `chrome.alarms` entry of the same name).

**`sessionStorage`**
- `sikpoketMasterPassword` — plaintext, scoped per top-level browsing context (see unlock.html notes — popup/sidepanel/unlock.html each need independent unlocking).
