import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
  res.setHeader('Vary', 'Accept, Accept-Encoding');
  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');

  const url = new URL(req.url, `https://${req.headers.host}`);
  const accept = req.headers.accept || '';
  // Only serve markdown if client asked for it; otherwise fallback to HTML (should not be called without has, but be safe)
  if (!accept.includes('text/markdown')) {
    res.status(406).send('Not Acceptable - send Accept: text/markdown');
    return;
  }

  // Map request path to markdown file
  // The rewrite destination is /api/markdown?path=/index.md etc via query, but we also support direct path mapping
  const qPath = url.searchParams.get('path');
  let mdPath = qPath;
  if (!mdPath) {
    // Infer from original URL (before rewrite) — Vercel passes x-rewrite or we can use pathname
    // For rewrites like "/" -> "/api/markdown?path=/index.md", qPath will be set
    // Fallback: map pathname
    const pathname = url.pathname;
    if (pathname === '/' || pathname === '/index.html') mdPath = '/index.md';
    else if (pathname.startsWith('/about')) mdPath = '/about/index.md';
    else if (pathname.startsWith('/contact')) mdPath = '/contact/index.md';
    else if (pathname.startsWith('/privacy')) mdPath = '/privacy/index.md';
    else if (pathname.startsWith('/dashboard')) mdPath = '/dashboard/index.md';
    else mdPath = '/index.md';
  }

  // Ensure leading slash and .md
  if (!mdPath.startsWith('/')) mdPath = '/' + mdPath;

  // Serve hardcoded markdown to avoid filesystem issues on Vercel
  const mdMap = {
    '/index.md': `# SikPoket — Encrypted Bookmark Manager & Knowledge Vault\n\n> Zero-knowledge, local-first bookmark vault. Save URLs, notes, API keys and passwords with client-side AES-GCM.\n\n**URL:** https://sikpoket.vercel.app/\n**Dashboard:** https://sikpoket.vercel.app/dashboard/\n**Sitemap:** https://sikpoket.vercel.app/sitemap.xml\n**llms.txt:** https://sikpoket.vercel.app/llms.txt\n`,
    '/about/index.md': `# About Sik — Builders of SikPoket\n\nSik builds local-first tools: SikPoket and SikOgami. Same Paper/Ink/Sick design.\n\nContact: hello@sikpoket.app\nGitHub: https://github.com/njrankitsam11-gif/SikPoket\n`,
    '/contact/index.md': `# Contact Sik\n\n- Email: hello@sikpoket.app\n- GitHub: https://github.com/njrankitsam11-gif/SikPoket\n- Address: Remote, Global, 00000 US\n`,
    '/privacy/index.md': `# Privacy — SikPoket Zero-Data\n\nEffective: 2026-08-17. Zero collection. All data in chrome.storage.local, encrypted AES-GCM.\n\nFull: https://sikpoket.vercel.app/privacy\n`,
    '/dashboard/index.md': `# SikPoket Dashboard — Vault\n\nLocal-first vault: URLs, notes, API keys, passwords. Spaces with wallpapers, TF-IDF search.\n\nOpen: https://sikpoket.vercel.app/dashboard/\n`,
  };
  const content = mdMap[mdPath] || mdMap['/index.md'];
  res.status(200).send(content);
}
