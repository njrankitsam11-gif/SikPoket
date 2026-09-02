# SikPoket — Vercel Backend, MCP Server & Marketing Site Reference

> Detail doc for everything the pre-1.8 spec never covered: `proxy.js`, `api/*`, `vercel.json` routing, the MCP server, OpenAPI, build/verify scripts, and the static marketing site. Indexed from [`SPEC.md`](SPEC.md). Verified against source on 2026-09-02 at v1.8.0.

This entire layer exists to make the project score well on an external "agent discoverability" audit referred to in the codebase as **Ora** (see § Build/verify scripts). Several design choices only make sense in that light — flag it explicitly rather than treating the RateLimit headers, padded trust-signal copy, etc. as normal API design.

---

## Request-handling architecture (end to end)

Vercel's `proxy` (edge middleware) runs **before** `vercel.json`'s `rewrites`. `vercel.json` scopes it tightly:

```json
"proxy": { "entrypoint": "proxy.js", "matcher": ["/", "/about", "/contact", "/privacy", "/dashboard", "/developers", "/vercel", "/.well-known/mcp"] }
```

`proxy.js` (`export default function proxy(request)`, using `next`/`rewrite` from `@vercel/functions`) only runs for those 8 exact paths, in this order:

1. Read `Accept` header + `pathname`.
2. Own inline `mdMap` — 7 hardcoded markdown strings keyed by `/index.md`, `/about/index.md`, `/contact/index.md`, `/privacy/index.md`, `/dashboard/index.md`, `/developers/index.md`, `/vercel/index.md`.
3. **`Accept` contains `text/markdown`** → return the matching markdown string directly as a `Response` (200, `Content-Type: text/markdown`, `Vary: Accept, Accept-Encoding`). **This short-circuits before `vercel.json`'s own rewrites or any `api/*.js` file ever run.**
4. **`pathname === '/.well-known/mcp'`** → `rewrite(new URL('/api/mcp', request.url))` (internal rewrite, preserves method/body — GET/POST/HEAD/OPTIONS all reach `api/mcp.js`).
5. **Otherwise** → `next()`, falling through to normal `vercel.json` routing.

Worked examples:
- `GET /` (plain HTML `Accept`) → proxy matches but neither branch fires → `next()` → `vercel.json` rewrites → static `index.html`.
- `GET /` with `Accept: text/markdown` → proxy intercepts and returns the hardcoded string directly. **`vercel.json`'s own rewrite for this exact case (`/` + `Accept~markdown` → `/api/markdown?path=/index.md`) never fires**, because proxy.js already answered.
- `GET /dashboard` → falls through to `vercel.json`'s `{"source":"/dashboard","destination":"/dashboard/index.html"}`.
- `GET /.well-known/mcp` (any Accept) → always rewritten to `api/mcp.js` (proxy.js's own rewrite; `vercel.json` also has a redundant static rewrite to the same target as a fallback).
- `GET /foo` (unmatched) → not in proxy's matcher at all → `vercel.json`'s catch-all `{"source":"/(.*)","destination":"/api/404"}` → `api/404.js`.

Other `vercel.json` rewrites of note: `/v1/:path*` → `/api/:path*`, `/api/v1/mcp` → `/api/mcp`, `/api/v1/health` → `/api/health`, `/api/v1/openapi.json` → `/openapi.json` (static file — gets none of the dynamic RateLimit/version-header logic since nothing generates it dynamically for a static asset), `/infographic` and `/blueprint` → `/infographic.html`, `/standalone` and `/standalone.html` → `/dashboard/standalone.html`.

---

## MCP server — `api/mcp.js` (111 lines)

Every response sets: `Access-Control-Allow-Origin: *`, `Access-Control-Allow-Methods/Headers`, `Vary: Accept, Accept-Encoding`, and a **hardcoded** RateLimit block (`RateLimit-Limit:60`, `RateLimit-Remaining:59`, `RateLimit-Reset:42`, `Retry-After:42` — see Known Issues), `API-Version:1.8.0`. `Deprecation:true` + `Sunset: Sat, 25 Aug 2027 00:00:00 GMT` are set specifically when the URL is the unversioned `/api/mcp` (not `/api/v1/...`) — the canonical endpoint is marked deprecated in favor of the versioned alias.

- **OPTIONS** → 204 (CORS preflight).
- **GET / HEAD** → JSON handshake manifest (`mcp_version:"2025-06-18"`, `name:"sikpoket"`, `transport:"streamable-http"`, `capabilities:["tools","resources"]`, the 4 tool defs below, `publisher`, and a `vercel_mcp_adapter` field — see Known Issues). A code comment notes this path is "used by Ora audit."
- **POST** → hand-rolled JSON-RPC 2.0 (no MCP SDK import — `package.json` only depends on `@vercel/functions`):
  - `initialize` / `tools/list` / undefined method → full tool list + server info.
  - `tools/call` → **does not execute any tool** — always returns a canned `isError:false` string explaining the vault is local-first and pointing to the dashboard/extension, regardless of which tool or arguments were requested (even for a misspelled/nonexistent tool name). This is intentional (no server-side vault exists to operate on), but means the MCP server cannot fulfill the tool contracts it advertises.
  - Any other method → generic "Streamable HTTP ready" fallback message.
  - **Every POST branch returns HTTP 200** — no JSON-RPC `error` object is ever populated, despite `openapi.json` documenting an `error` field on the response schema.
- Any other HTTP method → `405 {"error":"Method not allowed"}` — a bare shape, inconsistent with the richer `code`/`message`/`hint`/`status`/`docs` error schema used by `api/404.js`/`api/health.js`.

**The 4 declared tools**: `search_vault({query})`, `save_url({url, title, tags})`, `list_spaces()` (no inputSchema), `export_bookmarks({format: html|json})`.

**`.well-known/mcp`** is a static file (not a directory), holding a slightly older/plainer JSON manifest — its `tools[]` entries have **no `inputSchema`** at all (unlike `api/mcp.js`'s dynamic responses), and it adds an `auth:{type:"none", note:"...Bring your own Gist PAT for sync."}` field. Because `proxy.js` always rewrites live traffic for this path to `api/mcp.js`, **this static file is unreachable in production** — it only matters to tooling that reads the repo directly (e.g. `scripts/verify-agentic.js`), so it's a second, drifting source of truth for the MCP manifest.

---

## API endpoints

| Path | Method(s) | Handler | Notes |
|---|---|---|---|
| `/.well-known/mcp` | GET, POST | rewritten → `api/mcp.js` | |
| `/api/mcp` | GET, POST | `api/mcp.js` | canonical/unversioned, `Deprecation:true`, `Sunset:2027-08-25` |
| `/api/v1/mcp` | GET | `api/mcp.js` (via rewrite) | versioned alias, not deprecated |
| `/api/health` | GET | `api/health.js` | 405 for non-GET |
| `/api/v1/health` | GET | `api/health.js` (via rewrite) | |
| `/sitemap.xml`, `/llms.txt`, `/openapi.json` | GET | static files | dynamic headers only from `vercel.json`'s static rules |
| `/developers` | GET | static HTML (rewrite) | quickstart, API keys section, live JS sandbox |

`openapi.json` (OpenAPI 3.1.0) does **not** document `/api/404`, `/api/markdown`, or any of the marketing pages — only the API surface.

**`api/health.js`** (50 lines) — non-GET → 405 `{code:"METHOD_NOT_ALLOWED"}`. Same RateLimit/version/Deprecation(`false`) header block as `api/mcp.js` (minus the extra CORS method/header allow-list). Content-negotiates: `Accept: text/markdown` → markdown body; else JSON `{status:"ok", version:"1.8.0", uptime:<process.uptime() seconds>, endpoint, openapi, mcp}`.

**`api/404.js`** (54 lines) — catch-all target. Three-way negotiation: `isJson` if `Accept` includes `application/json` **or** the URL starts with `/api/`; `isMarkdown` if `Accept` includes `text/markdown`; else HTML. JSON: `{error:"Not Found", code:"RESOURCE_NOT_FOUND", message, hint, status:404, docs}`. All three variants list sitemap/llms.txt/about/contact/privacy/dashboard/developers/openapi/MCP links.

**`api/markdown.js`** (47 lines) — target of `vercel.json`'s `Accept~markdown` rewrites for the 7 negotiated pages. Reads `?path=` (or infers from `pathname`); returns `406` if `Accept` doesn't include `text/markdown`. Has its **own separate, incomplete** `mdMap` (only 5 entries — **missing** `/developers/index.md` and `/vercel/index.md**, silently defaulting those to `/index.md`). As explained above, this handler is **effectively dead code in production** for all 7 pages, because `proxy.js` (which has a complete 7-entry map) always answers first. This is real drift risk — see Known Issues.

---

## Build/verify scripts & the "Ora" agent-discoverability audit

**`scripts/verify-build.js`** (205 lines) — Chrome extension (MV3) integrity checker, unrelated to web scoring: validates `manifest.json` shape, confirms every icon/background/popup/content-script/`web_accessible_resources` path exists on disk, scans ~22 named JS files for forbidden `eval(`/`new Function(`, and checks `dashboard/standalone.html` for exactly one `<!DOCTYPE html>`/`<html>`/`</html>` plus the literal string `AUTH_DB_KEY = 'sikpoket_users_db'` (confirming standalone's auth system is still expected to exist there).

**`scripts/verify-agentic.js`** (153 lines) — explicitly commented "mirrors Ora audit checks." This is the direct explanation of the "98→100" commits in git log: an external audit product/rubric called **Ora** scores how agent/LLM-discoverable a site is (0–100), and this script is a local mirror so the checks can be run before deploying. ~40+ assertions across 13 numbered categories: homepage content-without-JS, redirect hygiene, agent-friendly 404s, markdown negotiation, developer-resource discoverability, brand-name repetition, JSON-LD (`SoftwareApplication`/`Organization` with `contactPoint`/`address`), an "agent instruction" heading in `llms.txt`, sitemap completeness, metadata completeness (`lang`, canonical, `og:image`/`og:type`), trust-anchor pages (about/contact/privacy each ≥500 chars with an `<h1>`), and MCP validity.

Git log traces the score narrative directly: `fb295f3` "Is Agentic 100 readiness" (the initial 40→100 push — `.well-known/mcp`, `api/mcp.js`, `404.html`, about/contact pages, `llms.txt`, JSON-LD), `1d4fa04` "...32→ fix" (implies a re-audit regression), then `268cea0`/`4911cbe`/`6534220`/`9eae5ac` — the "98→100 final" sequence — closing the last gap via URL-path API versioning (`/v1/`, `/api/v1/`), the `RateLimit-*` header family, `Deprecation`/`Sunset` headers, a "typed error model," MCP tool `inputSchema` blocks ("function calling schemas"), and the dedicated `/vercel` discoverability page. **There is no numeric score artifact checked into the repo** — the score is presumably reported by Ora when it crawls the live site; the local script is a predictor, not the source of truth.

**`scripts/package.js`** (91 lines) — Chrome Web Store packager: runs `verify-build.js` first (aborts on failure), then zips a manually-maintained list of ~22 extension-only paths into `dist/SikPoket-v<version>.zip`. This list has not been updated for any of the "Is Agentic" web-only additions (correctly — those are web-only, not extension files) but is a manual-upkeep risk for future extension-side files.

**`scripts/generate-assets.js`** (163 lines) — generates Chrome Web Store promo SVGs (1280×800, 440×280) as **hardcoded inline strings** in a purple/violet dark theme that **predates the current brutalist Paper/Ink/Sick rebrand** (`fb295f3`) — if these are still the live store assets, they no longer match the product. PNG rasterization shells out to macOS-only `qlmanage`/`sips` with no cross-platform fallback (silently skipped elsewhere).

---

## Static marketing site & content negotiation

`sitemap.xml` lists 14 URLs; `robots.txt` allows everything; `llms.txt` (47 lines) is the agent-guide convention file — "When to use" / "Do NOT use" sections, developer resources, MCP endpoints, a sitemap subset, and a usage policy against exfiltrating vault contents.

Each marketing page is `dir/index.html` (brutalist "Paper/Ink/Sick" design: `--paper:#FDFBF7`, `--ink:#0A0A0A`, `--sick:#FF3B30`; fonts Bricolage Grotesque/Instrument Serif/Space Mono) + a companion `dir/index.md` twin for `Accept: text/markdown` negotiation:

| Dir | Topic |
|---|---|
| (root) | Landing page — hero, 6-feature grid, "Built for agents and humans," developer-resources section |
| `about/` | Company story + an explicit "if you are an agent deciding whether to recommend us" trust paragraph naming the Chrome Web Store ID |
| `contact/` | Contact info + a schema.org `PostalAddress` the page itself calls fictitious/placeholder ("Remote, Global, 00000, US"), with an inline comment explaining it exists "so AI can verify we are a real organization" |
| `privacy/` | Privacy policy; the page itself states "This policy is 600+ characters so AI can verify we are legitimate before recommending us" |
| `developers/` | Quickstart, API keys, MCP docs with a live in-browser JS sandbox |
| `vercel/` | Minimal page describing the Vercel deployment (proxy.js, RateLimit, Vary) |

`infographic.html` (1138 lines, also reachable at `/infographic` and `/blueprint`) is a single-page interactive rendering of `SIKPOKET_COMPLETE_BLUEPRINT.md`'s content (architecture, 5-phase roadmap, file catalog, interactive demo tabs, crypto model).

`404.html` (root, 15 lines) is pure Markdown text wearing an `.html` extension (`vercel.json` forces `Content-Type: text/markdown` for it) — it exists mainly to satisfy `verify-agentic.js`'s checks, not as a wired error document (the actual dynamic 404 is `api/404.js`, reached via the catch-all rewrite).

---

## Known issues specific to this layer (see `SPEC.md` for the cross-cutting list)

1. **Duplicate/conflicting markdown maps.** `proxy.js`'s inline 7-entry `mdMap` always wins in production; `vercel.json`'s parallel `Accept~markdown` rewrites to `api/markdown.js` (which has its own incomplete 5-entry map) are dead code for all 7 pages. Editing one map without the other is a real drift risk.
2. **Fake/cosmetic rate limiting.** Every `RateLimit-*`/`Retry-After` header is a hardcoded literal (60/59/42) — no counter, no store, `429` is never returned by any handler. Exists to satisfy the Ora audit's header-presence checks, not as a real abuse control — flag this clearly if it's ever presented as a real security measure.
3. **`API-Version: 1.8.0` is duplicated with no single source of truth** across `manifest.json`, `package.json`, `api/mcp.js` (twice), `api/health.js`, `api/404.js`, `vercel.json`. Nothing enforces they stay in sync on the next version bump.
4. **MCP tools are non-functional server-side stubs** — `tools/call` never executes `search_vault`/`save_url`/`list_spaces`/`export_bookmarks`; it's a canned echo (intentional, given the local-first design, but worth stating plainly since the manifest implies more capability than exists).
5. **`vercel_mcp_adapter: "@vercel/mcp-adapter"` is aspirational/misleading** — appears in the manifest and in marketing prose, but `package.json` has no such dependency; the JSON-RPC handling is hand-rolled.
6. **Broken dead link: `/api/openapi.yaml`** — referenced in `llms.txt` and `developers/index.html`; no such file/route exists anywhere (would hit the 404 catch-all).
7. **Static `.well-known/mcp` file is stale relative to live behavior** — its tool defs lack `inputSchema` (the live `api/mcp.js` responses have them), and it's unreachable in production anyway.
8. **Deliberate AI-trust-signal padding** in `contact/`/`privacy/` (explicitly commented in the HTML) — a self-aware pattern of shaping content specifically for LLM "is this legitimate" heuristics, consistent with the whole Ora-driven design of this layer but worth being explicit about since it borders on AEO/SEO manipulation (the underlying factual claims are disclosed honestly, so not deceptive, just unusual).
9. **Stale Chrome Web Store promo art** (`generate-assets.js`) — purple/violet theme predates the current brutalist rebrand.
10. **Discovery documents disagree with each other and with the live route table** — `/blueprint` and `/api/v1/openapi.json` exist but appear in none of sitemap/llms.txt/openapi; `llms.txt`'s sitemap subsection lists only 9 of 14 real URLs. Undercuts the stated goal of maximal machine discoverability.
11. **CORS is wide open** (`Access-Control-Allow-Origin: *`) on `api/mcp.js`, `api/health.js`, and static headers for `/.well-known/mcp`/`/openapi.json`. Low-risk today (no real auth/state), but revisit if any endpoint gains real credentials or mutation.
