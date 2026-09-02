# SikPoket — Codebase Specification (Index)

> **Purpose**: authoritative architecture reference for the SikPoket project, read at the start of every Claude Code session (via the root [`CLAUDE.md`](../CLAUDE.md)) so context survives across sessions. This file is the index; deep detail lives in the linked docs below. **Update the relevant doc after finishing any feature or module** — see § How to Update at the bottom.
>
> Last full rewrite: 2026-09-02, verified against source at v1.8.0. The previous version of this file (last touched at v1.1) was stale on nearly every count — file map, auth model, feature list — because ~5 phases of work landed without spec updates. Don't let that happen again.

---

## 1. Project Overview

**SikPoket** is a local-first, encrypted personal bookmark/vault manager shipped as **three surfaces from one repo**:

| Surface | Entry points | Detail doc |
|---|---|---|
| Chrome Extension (MV3) | `manifest.json`, `background.js`, `content.js`, `popup.html`/`.js`, `sidepanel.html`, `unlock.html`, 15 root helper `.js` files | [`extension.md`](extension.md) |
| Dashboard SPA | `dashboard/index.html` + `app.js` (primary), `dashboard/standalone.html` (frozen fork) | [`dashboard.md`](dashboard.md) |
| Vercel backend + marketing site | `vercel.json`, `proxy.js`, `api/*.js`, MCP server, static pages, build/verify scripts | [`backend.md`](backend.md) |

| Property | Value |
|---|---|
| Version | **1.8.0** (`manifest.json` / `package.json`) |
| Manifest version | 3 |
| Primary language | Vanilla JS, no build step, no framework (`package.json` has exactly one dependency: `@vercel/functions`) |
| Encryption | AES-256-GCM via Web Crypto, PBKDF2 key derivation (100,000 iterations) — **extension popup only**, not the dashboard |
| Biometrics | WebAuthn platform authenticator (Touch ID / Windows Hello), via a standalone `unlock.html` tab |
| Deployment | Vercel (`sikpoket.vercel.app`), also distributed as a Chrome extension zip |
| Chrome Web Store ID | `blmcoemlhjbiffhinamoocngmoojgdp` |

---

## 2. Repository Map

```
SikPoket/
├── manifest.json                # MV3 manifest, v1.8.0
├── background.js                # Service worker: context menus, badge, omnibox, alarms, sessions
├── content.js                   # Injected everywhere: Shadow-DOM toast, bookmarklet listener
├── popup.html / popup.css / popup.js   # Main browser-action popup (~1707 lines of logic)
├── sidepanel.html                # Docked side panel (partial feature parity — see extension.md)
├── unlock.html / unlock.js       # Standalone tab for WebAuthn/Touch ID unlock
├── crypto-helper.js              # CryptoHelper (AES-GCM/PBKDF2) + BiometricHelper (WebAuthn)
├── ai-helper.js                  # On-device Prompt-API summarization + local TextRank fallback
├── audio-helper.js               # Procedural ambient soundscapes (dashboard only)
├── chat-helper.js                # "Ask your vault" Prompt-API chat (side panel only)
├── search-helper.js              # TF-ranked full-text search (dashboard only)
├── health-helper.js              # Broken-link scanner (background.js + dashboard, both wired)
├── graph-helper.js               # Canvas force-directed Knowledge Graph (dashboard only)
├── reader-helper.js              # Reading time, content cleanup, SpeechSynthesis TTS (dashboard only)
├── wikilink-helper.js            # [[WikiLink]] parsing + backlink index (dashboard only)
├── tagger-helper.js              # Domain/keyword auto-tagging + Smart Spaces predicates
├── dedup-helper.js               # URL-normalizing duplicate detector/merger (dashboard only)
├── feed-helper.js                # RSS/Atom parsing (dashboard only)
├── export-helper.js              # Obsidian vault + Notion CSV export, hand-rolled ZIP writer
├── vector-helper.js              # TF + char-3gram "semantic" search/clustering
├── qr-helper.js                  # Dependency-free QR encoder + Netscape bookmark export
├── icons/                        # 16/48/128px extension icons
├── dashboard/
│   ├── index.html / app.js / app.css   # Primary dashboard SPA (no auth, single vault)
│   ├── standalone.html                 # Frozen fork with its OWN multi-user auth — see dashboard.md
│   ├── sw.js / theme-init.js / manifest.webmanifest   # PWA infra — effectively disabled, see dashboard.md
│   └── index.md                        # Markdown twin for content negotiation
├── api/
│   ├── mcp.js                    # MCP server (JSON-RPC, hand-rolled, no SDK)
│   ├── health.js                 # /api/health
│   ├── markdown.js               # Markdown content-negotiation handler (mostly dead — see backend.md)
│   └── 404.js                    # Catch-all 404, 3-way content negotiation
├── .well-known/mcp               # Static MCP manifest — unreachable in prod (proxy.js always wins)
├── proxy.js                      # Vercel proxy/middleware: markdown negotiation + MCP rewrite
├── vercel.json                   # Routing, headers, rewrites, proxy config
├── openapi.json                  # OpenAPI 3.1 spec for the API surface
├── llms.txt / robots.txt / sitemap.xml   # Agent/crawler discoverability files
├── about/ contact/ privacy/ developers/ vercel/   # Marketing pages, each dir/index.html + dir/index.md
├── infographic.html              # Long-form interactive architecture/roadmap one-pager
├── 404.html                      # Static markdown-as-.html file (see backend.md)
├── scripts/
│   ├── verify-build.js           # MV3 integrity checker (used by package.js)
│   ├── verify-agentic.js         # Mirrors the external "Ora" agent-discoverability audit
│   ├── package.js                # Builds the Chrome Web Store zip
│   └── generate-assets.js        # Generates (stale-branded) store promo art
└── .agents/                      # This spec — SPEC.md (index) + extension.md/dashboard.md/backend.md
```

---

## 3. Architecture — how the three surfaces relate

```
┌─────────────────────────────┐        chrome.storage.local        ┌──────────────────────────┐
│   Chrome Extension (MV3)    │ ◄─────────  sikpoketData  ────────► │      Dashboard SPA        │
│  popup / sidepanel / unlock │             (no postMessage,        │  dashboard/index.html +   │
│  background.js (SW)         │              only storage +         │  app.js                   │
│  content.js (all pages)     │              onChanged listener)    │  (no auth, no crypto)     │
└──────────────┬───────────────┘                                    └───────────┬──────────────┘
               │ web_accessible_resources                                        │ same origin,
               │ (15 root helpers loaded into extension pages)                   │ chrome-extension://<id>
               ▼                                                                 ▼
     unlock.html (separate tab, WebAuthn needs a real hostname)         dashboard/standalone.html
                                                                          (frozen fork, own
                                                                           multi-user auth,
                                                                           localStorage only)

┌───────────────────────────────────────────────────────────────────────────────────────────┐
│                              Vercel (sikpoket.vercel.app) — independent                     │
│  proxy.js → vercel.json rewrites → api/mcp.js | api/health.js | api/markdown.js | api/404.js│
│  Static marketing pages (about/contact/privacy/developers/vercel) + dashboard/ hosted copy   │
│  MCP server: manifest + JSON-RPC handshake, tools/call is a non-functional stub (no server-  │
│  side vault — the real vault only ever lives in chrome.storage.local on-device)             │
└───────────────────────────────────────────────────────────────────────────────────────────┘
```

The Vercel layer and the extension are **not integrated** beyond serving the extension's own dashboard as a static page and hosting marketing/API surface — there is no server-side account system, no server-side vault, and the MCP tools cannot actually read or write a user's data (by design: local-first).

---

## 4. Storage & Data Model — master inventory

Full per-key detail lives in [`extension.md`](extension.md#storage-key-inventory-extension-side) and [`dashboard.md`](dashboard.md#data-persistence--exact-keys). Summary:

| Key | Storage | Written by | Shape |
|---|---|---|---|
| `sikpoketData` | `chrome.storage.local` | popup, content.js | `{urls[], apiKeys[], passwords[], notes[]}` — secrets AES-GCM encrypted |
| `sikpoketDashboardData` | `chrome.storage.local` / `localStorage` | dashboard `save()`, popup `dashboardExport()` | `{spaces:[{id,items[]}], activeSpace}` — secrets always **plaintext** here (no crypto layer in the dashboard, by design); `apiKeys`/`passwords` no longer live-sync from the encrypted `sikpoketData` (see dashboard.md) |
| `sikpoketSessions` | `chrome.storage.local` | background.js | `[{id,name,tabs[],createdAt}]` — write-only, never rendered/restored by any UI |
| `sikpoketBrokenLinks` | `chrome.storage.local` | `HealthHelper.scanAll()` via background.js only | `string[]` of item IDs |
| `sikpoket_users_db`, `sikpoket_<username>` | `localStorage` | `dashboard/standalone.html` only | Separate, parallel auth/data scheme — not used by the primary dashboard |
| `sik_theme`, `sikpoketReaderFontSize/FontFamily/Theme`, `sik_collapsed_sections` | `localStorage` | popup/dashboard UI prefs | Device-local, not vault data |
| `sikpoketBiometricEnabled/CredId/BioKey/WrappedPassword` | `localStorage` | `unlock.js` + `popup.js` | Biometric unlock chain |
| `sikpoketFirebaseConfig` | `localStorage` | popup Settings modal | Dead-end stub, no Firebase SDK loaded anywhere |
| `sikpoketMasterPassword` | `sessionStorage` | popup/unlock.js | Plaintext, **scoped per top-level browsing context** — popup, side panel, and `unlock.html` each need an independent unlock |

**Two independent encryption postures coexist**: the extension popup encrypts `apiKeys`/`passwords` with AES-GCM derived from the master password; the dashboard has **no crypto layer at all** and stores its own key/password items as plain strings. Be careful when describing "the vault" as a single security boundary — it isn't one.

---

## 5. Module Status

| Area | Status | Detail |
|---|---|---|
| Extension core (manifest, background, content, popup, unlock) | ✅ Stable | [`extension.md`](extension.md) |
| Side panel | ⚠️ Partial — Sessions tab can save but never list/restore; no add-item forms; drag-drop zone unwired; stale version string | [`extension.md`](extension.md#sidepanelhtml-241-lines--confirmed-new-since-the-pre-18-spec) |
| Helper modules (15 files) | ✅ Clean — `sync-helper.js`/`archive-helper.js` removed (were fully orphaned); dead `<script>` loads of `export-helper.js`/`vector-helper.js`/`ai-helper.js` in the wrong context removed 2026-09-02. Every remaining helper is loaded only where it's actually called | [`extension.md`](extension.md#helper-wiring-matrix) |
| Dashboard SPA (`app.js`) | ✅ Feature-rich; the vim-crash, broken-links, logout, and secret-sync bugs are fixed — other known gaps (orphaned helpers, no crypto layer by design) remain, see § 6 | [`dashboard.md`](dashboard.md) |
| Dashboard standalone build | ⚠️ Frozen fork, several phases behind, own auth system | [`dashboard.md`](dashboard.md#standalonehtml--frozen-fork-not-kept-in-sync) |
| Vercel routing / MCP / API | ✅ Live and scoring well on the Ora audit, ⚠️ MCP tools are non-functional stubs, some drift between discovery docs | [`backend.md`](backend.md) |
| Marketing site | ✅ Complete, content-negotiated (.html/.md pairs) | [`backend.md`](backend.md#static-marketing-site--content-negotiation) |
| Build/verify scripts | ✅ Working | [`backend.md`](backend.md#buildverify-scripts--the-ora-agent-discoverability-audit) |

---

## 6. Cross-Cutting Known Issues

Consolidated from all three detail docs — check here first before assuming a feature works as advertised.

**Real bugs (will misbehave or crash):**
1. ~~Dashboard vim shortcut `D` (`deleteFocused()`) calls an undefined `deleteItem()` → `ReferenceError`.~~ **Fixed 2026-09-02** — now calls `confirmDelete(item.id)`. ([dashboard.md](dashboard.md))
2. ~~Dashboard's "Broken Links" scanner always reports clean — `health-helper.js` was never `<script>`-loaded into `dashboard/index.html` despite `app.js` calling `window.HealthHelper.scanAll()`.~~ **Fixed 2026-09-02** — script tag added; the scan now runs for real (it can still only detect timeouts/offline, not actual 404/500s — that's an inherent limitation of the `no-cors` HEAD-fetch approach, not a wiring bug). ([dashboard.md](dashboard.md), [extension.md](extension.md))
3. ~~Dashboard's "Logout" button links to a nonexistent `dashboard/auth.html` (404) — leftover from the removed multi-user auth system.~~ **Fixed 2026-09-02** — button, its click handler, and a now-dead CSS rule removed; the primary dashboard has no session to log out of. ([dashboard.md](dashboard.md))
4. ~~`graph-helper.js` physics: `edge.target.target?.mass` typo causes every edge's target node to get an unscaled force nudge instead of a mass-scaled one.~~ **Fixed 2026-09-02** — now divides by `edge.target.mass`, matching the source-side pattern. Closes [issue #4](https://github.com/njrankitsam11-gif/SikPoket/issues/4). ([extension.md](extension.md))
5. ~~Secret-encryption inconsistency: the dashboard's live extension-sync path copied encrypted blobs into a `.value` field without decrypting them (unusable).~~ **Fixed 2026-09-02** — `apiKeys`/`passwords` are no longer included in the automatic live sync at all (the dashboard has no way to decrypt them); only `urls`/`notes` sync live now. Secrets reach the dashboard only via the popup's explicit "Export to Dashboard" button (decrypted) or direct dashboard creation (plaintext from the start) — both are plaintext-at-rest in the dashboard, which remains an unchanged architectural fact, not a bug. ([dashboard.md](dashboard.md))

**Orphaned / dead code:**
6. ~~`sync-helper.js` (GitHub Gist E2E backup) and `archive-helper.js` (offline snapshots) were fully implemented with zero callers anywhere.~~ **Removed 2026-09-02** — both files deleted, along with their `manifest.json`/`scripts/verify-build.js`/`scripts/package.js` references and the `<script>` tag for `archive-helper.js` in `dashboard/index.html`. GitHub Gist sync claims corrected in `index.html`, `about/`, `privacy/`, `developers/`, `llms.txt`, `infographic.html`, and `SIKPOKET_COMPLETE_BLUEPRINT.md`.
7. ~~`export-helper.js` and `vector-helper.js` were loaded in popup/sidepanel but never called there; `ai-helper.js` was loaded in the dashboard but never called there.~~ **Fixed 2026-09-02** — removed the dead `<script>` tags from `popup.html`/`sidepanel.html` (export-helper.js, vector-helper.js) and `dashboard/index.html` (ai-helper.js). Each file remains loaded (and works) only where it's actually used: export/vector in the dashboard, AI summarization in the popup and side panel.
8. The popup's "Cloud Sync ☁ / Firebase" Settings block stores a config blob to `localStorage` that nothing else in the repo reads — a second, independent dead-end sync stub.
9. `api/markdown.js`'s markdown-serving logic is dead code in production for all 7 negotiated pages — `proxy.js`'s own inline (and more complete) markdown map always answers first. Its own map is also missing 2 of the 7 pages, so if `proxy.js` were ever bypassed, `/developers` and `/vercel` markdown would silently wrong-serve `/index.md`.
10. `.well-known/mcp` as a static file is unreachable in production (proxy always rewrites to `api/mcp.js`) and its tool defs have already drifted from the live handler (missing `inputSchema`).

**By-design but worth flagging explicitly:**
11. All `RateLimit-*`/`Retry-After` headers across the Vercel layer are hardcoded literals — no real rate limiting exists anywhere; `429` is never returned.
12. MCP `tools/call` never executes real logic — always a canned echo, regardless of tool name or arguments. Intentional (no server-side vault), but the manifest/OpenAPI imply more capability than exists.
13. `contact/`/`privacy/` marketing pages contain content explicitly (and honestly, in code comments) padded/shaped to satisfy LLM "is this a real, trustworthy org" heuristics — a deliberate AEO-style practice tied to the Ora audit, not a bug, but unusual enough to call out.
14. Two independent duplicate-detectors and two independent search implementations exist (popup's are simpler/weaker versions of the dashboard's `DedupHelper`/`SearchHelper`) — not bugs, but don't assume fixing one fixes the other.
15. `sessionStorage`-scoped master password means popup, side panel, and `unlock.html` each require independent unlocking, even though they share an origin and vault — surprising but working as designed.

---

## 7. Conventions / Patterns

- IDs: `Date.now().toString()` (popup) or `Date.now().toString(36) + random` (dashboard `genId()`).
- Tags: always lowercase, comma-separated input, parsed via `.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)`.
- HTML escaping: `esc()` helper (temp DOM node in popup, regex replace in dashboard).
- Mutations persisted immediately, never batched: popup's `saveAndRefresh()` (storage set + badge/tab-count + re-render + tag-filter rebuild); dashboard's `save(); render();`.
- Helper modules use an IIFE `(function(global){...})(window)` pattern and attach to `window.<Name>` — **except** `crypto-helper.js`, which is a bare top-level `const` (works because it's always loaded as a classic, non-module script), and `health-helper.js`, which binds to `self`/`this` because it also runs inside the service worker via `importScripts()` where `window` doesn't exist.
- Settings/prefs/biometrics → `localStorage`; actual vault data → `chrome.storage.local` (extension) or `localStorage` (dashboard, when running outside the extension).
- No build step anywhere — every file is served/loaded as-is. Verify with `node scripts/verify-build.js` before packaging.

---

## 8. Feature Completion Log

| Date / Phase | Feature | Status |
|---|---|---|
| Initial | Core popup: URLs, API Keys, Passwords, Notes + AES-GCM encryption | ✅ |
| Initial | Context menu save, content-script toast, badge count | ✅ |
| Initial | Reader mode, dashboard SPA with Spaces + Wallpapers | ✅ |
| Initial | Dashboard multi-user auth (SHA-256 + salt) | ⚠️ Later removed from primary dashboard, survives only in `standalone.html` |
| Initial | Biometric/Touch ID unlock via `unlock.html` | ✅ |
| Module 1–6 (pre-1.6) | Duplicate detector, batch processing, text highlights, layout modes, reminders/notifications, broken-link scanner | ✅ (broken-link scanner later regressed in the dashboard — see § 6) |
| Phase 8 (v1.6.0) | Bi-directional WikiLinks, Semantic Smart Spaces, Offline Page Archiver | ⚠️ Archiver shipped as dead code (`archive-helper.js`, zero callers) — module removed 2026-09-02, see below |
| Phase 9 (v1.7.0) | Vim navigation, 1-click duplicate cleaner, RSS watcher | ✅ (Vim `D` key crash fixed 2026-09-02, see § 6) |
| Phase 10 (v1.8.0) | Obsidian Vault Exporter, Notion CSV Export, Semantic Vector Search, auto-rendered store PNGs | ✅ (store PNGs are brand-stale, see backend.md) |
| — | Side Panel (Sessions + Assistant tabs) | ⚠️ Partial — see § 5 |
| "Is Agentic" push | `.well-known/mcp`, `api/mcp.js`, OpenAPI 3.1, `/developers` portal, `llms.txt`, JSON-LD, trust-anchor pages, RateLimit/Deprecation headers, `/v1` versioning | ✅ Live, mirrors the external Ora audit rubric — see `backend.md` |
| 2026-09-02 | **Full spec rewrite** — `.agents/SPEC.md` + `extension.md`/`dashboard.md`/`backend.md` created from a full-codebase read, replacing the stale v1.1-era spec | ✅ |
| 2026-09-02 | Fix: `dashboard/app.js` `deleteFocused()` (vim key `D`) called an undefined `deleteItem()`, crashing with `ReferenceError`; now calls `confirmDelete(item.id)` | ✅ |
| 2026-09-02 | Fix: `health-helper.js` was missing from `dashboard/index.html`'s script list, so the dashboard's "Broken Links" scan always no-op'd; script tag added, scan now runs for real | ✅ |
| 2026-09-02 | Fix: removed the dashboard's broken "Logout" button (linked to a nonexistent `auth.html`), its click handler, a dead CSS rule, and a stray misleading comment — leftovers from the removed multi-user auth system | ✅ |
| 2026-09-02 | Fix: `graph-helper.js` spring physics divided by `edge.target.target?.mass` (always `NaN`→`1`) instead of `edge.target.mass`; now matches the source-side pattern. Closes [issue #4](https://github.com/njrankitsam11-gif/SikPoket/issues/4) | ✅ |
| 2026-09-02 | Fix: `syncFromExtensionStorage()` no longer live-syncs `apiKeys`/`passwords` into the dashboard (it had no way to decrypt them — was writing an unusable encrypted-blob object as `.value`, which editing/saving would silently corrupt into the literal string `"[object Object]"`); `urls`/`notes` still sync live | ✅ |
| 2026-09-02 | Removed `sync-helper.js` and `archive-helper.js` (fully built, zero callers, per user decision) — deleted the files, their `manifest.json`/build-script/`<script>` references, and corrected GitHub Gist sync claims across the marketing site and blueprint docs | ✅ |
| 2026-09-02 | Fix: removed dead `<script>` loads — `export-helper.js`/`vector-helper.js` from `popup.html`/`sidepanel.html`, `ai-helper.js` from `dashboard/index.html` — none were ever called in those contexts; each helper still loads where it's actually used | ✅ |

---

## 9. How to Update This Spec

After completing any feature or module:

1. **Identify which surface changed** — extension, dashboard, or backend/marketing — and update the corresponding detail doc (`extension.md`, `dashboard.md`, or `backend.md`) directly: update the relevant function/module description, storage keys, and wiring notes.
2. **If a bug you fixed is listed in § 6 (Cross-Cutting Known Issues)**, remove that entry (or mark it fixed) here in `SPEC.md`.
3. **If new dead code, orphaned modules, or cross-file inconsistencies are introduced**, add them to § 6 rather than letting a future session rediscover them the hard way.
4. **Add a row to § 8 (Feature Completion Log)** with the date and a one-line status.
5. **If a new top-level file/directory is added**, update § 2 (Repository Map) and, if it's substantial, consider whether it needs its own entry in one of the detail docs.
6. **If the version number bumps**, update it in § 1 here — note that `manifest.json`, `package.json`, and several hardcoded strings in `api/mcp.js`/`api/health.js`/`vercel.json` all currently need to be bumped independently (see `backend.md` § Known Issues #3); this is itself worth fixing someday.

Keep entries terse and factual — this file is optimized for a future Claude session to regain full context quickly, not for human narrative prose.
