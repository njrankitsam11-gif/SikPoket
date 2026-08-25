import fs from 'fs';
import path from 'path';
export default function proxy(request) {
  const accept = request.headers.get('accept') || '';
  const url = new URL(request.url);
  const pathname = url.pathname;

  const mdMap = {
    '/index.md': `# SikPoket — Encrypted Bookmark Manager & Knowledge Vault\n\n> Zero-knowledge, local-first bookmark vault. Save URLs, notes, API keys and passwords with client-side AES-GCM.\n\n**URL:** https://sikpoket.vercel.app/\n**Dashboard:** https://sikpoket.vercel.app/dashboard/\n**Sitemap:** https://sikpoket.vercel.app/sitemap.xml\n**llms.txt:** https://sikpoket.vercel.app/llms.txt\n`,
    '/about/index.md': `# About Sik — Builders of SikPoket\n\nSik builds local-first tools: SikPoket and SikOgami. Same Paper/Ink/Sick design.\n\nContact: hello@sikpoket.app\nGitHub: https://github.com/njrankitsam11-gif/SikPoket\n`,
    '/contact/index.md': `# Contact Sik\n\n- Email: hello@sikpoket.app\n- GitHub: https://github.com/njrankitsam11-gif/SikPoket\n- Address: Remote, Global, 00000 US\n`,
    '/privacy/index.md': `# Privacy — SikPoket Zero-Data\n\nEffective: 2026-08-17. Zero collection. All data in chrome.storage.local, encrypted AES-GCM.\n\nFull: https://sikpoket.vercel.app/privacy\n`,
    '/dashboard/index.md': `# SikPoket Dashboard — Vault\n\nLocal-first vault: URLs, notes, API keys, passwords. Spaces with wallpapers, TF-IDF search.\n\nOpen: https://sikpoket.vercel.app/dashboard/\n`,
    '/developers/index.md': `# Developers — SikPoket API, MCP & Vercel\n\nQuickstart: https://sikpoket.vercel.app/developers\nOpenAPI: https://sikpoket.vercel.app/openapi.json\nMCP: https://sikpoket.vercel.app/.well-known/mcp\nHealth: https://sikpoket.vercel.app/api/health\n`,
  };

  if (accept.includes('text/markdown')) {
    let mdPath = null;
    if (pathname === '/' || pathname === '/index.html') mdPath = '/index.md';
    else if (pathname === '/about' || pathname === '/about/') mdPath = '/about/index.md';
    else if (pathname === '/contact' || pathname === '/contact/') mdPath = '/contact/index.md';
    else if (pathname === '/privacy' || pathname === '/privacy/') mdPath = '/privacy/index.md';
    else if (pathname === '/dashboard' || pathname === '/dashboard/') mdPath = '/dashboard/index.md';
    else if (pathname === '/developers' || pathname === '/developers/') mdPath = '/developers/index.md';
    if (mdPath && mdMap[mdPath]) {
      return new Response(mdMap[mdPath], {
        status: 200,
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
          'Vary': 'Accept, Accept-Encoding',
          'Cache-Control': 'public, max-age=0, must-revalidate',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }
  }

  // MCP — proxy both GET and POST to /api/mcp
  if (pathname === '/.well-known/mcp') {
    const target = new URL('/api/mcp', request.url);
    const init = {
      method: request.method,
      headers: request.headers,
    };
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      init.body = request.body;
      init.duplex = 'half';
    }
    return fetch(new Request(target, init));
  }

  // For non-markdown, serve static HTML directly to avoid fetch loop / 520 for external IPs
  const htmlMap = {
    '/': '/index.html',
    '/index.html': '/index.html',
    '/about': '/about/index.html',
    '/about/': '/about/index.html',
    '/contact': '/contact/index.html',
    '/contact/': '/contact/index.html',
    '/privacy': '/privacy/index.html',
    '/privacy/': '/privacy/index.html',
    '/dashboard': '/dashboard/index.html',
    '/dashboard/': '/dashboard/index.html',
    '/developers': '/developers/index.html',
    '/developers/': '/developers/index.html',
  };
  if (htmlMap[pathname]) {
    try {
      const filePath = path.join(process.cwd(), htmlMap[pathname].replace(/^\//, ''));
      const html = fs.readFileSync(filePath, 'utf8');
      return new Response(html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Vary': 'Accept, Accept-Encoding',
          'Cache-Control': 'public, max-age=0, must-revalidate',
        },
      });
    } catch (e) {
      // fall through to fetch
    }
  }
  // MCP already handled above; for other paths, let Vercel handle (will go to api/404 via rewrites)
  return;
}
