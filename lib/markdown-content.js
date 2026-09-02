// Single source of truth for the markdown twin of each content-negotiated page.
// Consumed by proxy.js (which answers Accept: text/markdown requests directly,
// and always runs before vercel.json's rewrites) and by api/markdown.js (kept
// as a defensive fallback + directly-callable endpoint, and to keep the
// Accept-header rewrite rules in vercel.json meaningful).
export const mdMap = {
  '/index.md': `# SikPoket — Encrypted Bookmark Manager & Knowledge Vault\n\n> Zero-knowledge, local-first bookmark vault. Save URLs, notes, API keys and passwords with client-side AES-GCM.\n\n**URL:** https://sikpoket.vercel.app/\n**Dashboard:** https://sikpoket.vercel.app/dashboard/\n**Sitemap:** https://sikpoket.vercel.app/sitemap.xml\n**llms.txt:** https://sikpoket.vercel.app/llms.txt\n`,
  '/about/index.md': `# About Sik — Builders of SikPoket\n\nSik builds local-first tools: SikPoket and SikOgami. Same Paper/Ink/Sick design.\n\nContact: hello@sikpoket.app\nGitHub: https://github.com/njrankitsam11-gif/SikPoket\n`,
  '/contact/index.md': `# Contact Sik\n\n- Email: hello@sikpoket.app\n- GitHub: https://github.com/njrankitsam11-gif/SikPoket\n- Address: Remote, Global, 00000 US\n`,
  '/privacy/index.md': `# Privacy — SikPoket Zero-Data\n\nEffective: 2026-08-17. Zero collection. All data in chrome.storage.local, encrypted AES-GCM.\n\nFull: https://sikpoket.vercel.app/privacy\n`,
  '/dashboard/index.md': `# SikPoket Dashboard — Vault\n\nLocal-first vault: URLs, notes, API keys, passwords. Spaces with wallpapers, TF-IDF search.\n\nOpen: https://sikpoket.vercel.app/dashboard/\n`,
  '/developers/index.md': `# Developers — SikPoket API, MCP & Vercel\n\nQuickstart: https://sikpoket.vercel.app/developers\nOpenAPI: https://sikpoket.vercel.app/openapi.json\nMCP: https://sikpoket.vercel.app/.well-known/mcp\nHealth: https://sikpoket.vercel.app/api/health\n`,
  '/vercel/index.md': `# Vercel — SikPoket on Vercel\n\nSikPoket on Vercel at https://sikpoket.vercel.app — vercel.json, proxy.js, /api/mcp, /api/health, RateLimit, Vary: Accept.\n\nSee https://sikpoket.vercel.app/developers and https://sikpoket.vercel.app/openapi.json\n`,
};
