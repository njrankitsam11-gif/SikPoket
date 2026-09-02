# SikPoket

Local-first, encrypted personal bookmark/vault manager shipped as **three surfaces from one repo**: a Chrome extension (MV3), a dashboard SPA, and a Vercel backend/marketing site. No build step, no framework — vanilla JS throughout. Current version: **1.8.0**.

**Full architecture reference lives in [`.agents/SPEC.md`](.agents/SPEC.md)** (index) with deep detail in [`.agents/extension.md`](.agents/extension.md), [`.agents/dashboard.md`](.agents/dashboard.md), and [`.agents/backend.md`](.agents/backend.md). Read the relevant detail doc before making non-trivial changes to that surface — these were compiled from a full read of every file and are kept current; the previous spec (last touched at v1.1) went stale for ~5 phases of work and cost real time to reconstruct. Don't repeat that.

## Update the spec after every feature/module

When you finish a feature, fix, or module: update the relevant `.agents/*.md` doc (which surface changed?), add a row to `SPEC.md`'s Feature Completion Log, and if you fixed something listed in `SPEC.md`'s Known Issues section, remove or mark it fixed there. Full instructions: [`.agents/SPEC.md` § How to Update](.agents/SPEC.md#9-how-to-update-this-spec). Do this before ending the session — it's the only thing preventing the next session from re-deriving context from scratch.

## The three surfaces, at a glance

- **Extension** (`manifest.json`, `background.js`, `content.js`, `popup.html`/`.js`, `sidepanel.html`, `unlock.html`, 15 root `*-helper.js` files) — the vault lives in `chrome.storage.local.sikpoketData`, encrypted with AES-GCM/PBKDF2, unlocked by a master password held in `sessionStorage` (scoped per top-level context — popup/side panel/`unlock.html` each unlock independently).
- **Dashboard** (`dashboard/index.html` + `app.js`) — reads/writes `chrome.storage.local.sikpoketDashboardData` (or `localStorage` when run outside the extension), has **no auth and no crypto layer**. `dashboard/standalone.html` is a separately-frozen fork with its own multi-user auth — don't assume features added to `app.js` exist there too.
- **Backend** (`vercel.json` + `proxy.js` + `api/*.js`) — serves the marketing site, a content-negotiated (.html/.md) page pattern, and an MCP server (`api/mcp.js`) whose `tools/call` is a non-functional stub by design (no server-side vault exists; everything is local-first).

## Known traps worth knowing before you touch code

- `sync-helper.js` and `archive-helper.js` were removed 2026-09-02 — both were fully built but had zero callers anywhere, and their marketing copy (GitHub Gist sync claims) was corrected across `index.html`, `about/`, `privacy/`, `developers/`, `llms.txt`, and the blueprint docs. See `SPEC.md § Known Issues` for what else is documented-but-not-wired before reporting something as broken — it may already be a known gap.
- The dashboard has no crypto layer at all — key/password items created there, or exported via the popup's "Export to Dashboard" button, are always plaintext-at-rest in `sikpoketDashboardData`. `apiKeys`/`passwords` no longer live-sync from the encrypted `sikpoketData` (fixed 2026-09-02 — the dashboard had no way to decrypt them anyway); only `urls`/`notes` sync live.
- Every `RateLimit-*` header in the Vercel layer is a hardcoded literal — there is no real rate limiting.

## Commands

```bash
node scripts/verify-build.js      # MV3 integrity check — run before packaging
node scripts/package.js           # Build the Chrome Web Store zip (runs verify-build.js first)
node scripts/generate-assets.js   # Regenerate store promo art (macOS only for PNG rasterization)
node scripts/verify-agentic.js    # Local mirror of the external "Ora" agent-discoverability audit
```

There is no test suite, no linter config, and no dev server — load the extension unpacked via `chrome://extensions` → Developer mode → Load unpacked, and preview the dashboard/marketing site by opening the static HTML files directly or via `vercel dev`.
