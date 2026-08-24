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
  // Resolve to filesystem
  const root = process.cwd();
  const filePath = path.join(root, mdPath.replace(/^\//, ''));
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    res.status(200).send(content);
  } catch (e) {
    res.status(404).send('# 404 — Markdown not found\n\nTry /sitemap.xml or /llms.txt\n');
  }
}
