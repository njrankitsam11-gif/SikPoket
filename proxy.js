export default function proxy(request) {
  // Avoid infinite loop: if we already proxied, pass through
  if (request.headers.get('x-proxy-loop')) {
    return;
  }
  const accept = request.headers.get('accept') || '';
  const url = new URL(request.url);
  const pathname = url.pathname;

  const mdMap = {
    '/index.md': `# SikPoket — Encrypted Bookmark Manager & Knowledge Vault\n\n> Zero-knowledge, local-first bookmark vault. Save URLs, notes, API keys and passwords with client-side AES-GCM.\n\n**URL:** https://sikpoket.vercel.app/\n**Dashboard:** https://sikpoket.vercel.app/dashboard/\n**Sitemap:** https://sikpoket.vercel.app/sitemap.xml\n**llms.txt:** https://sikpoket.vercel.app/llms.txt\n`,
    '/about/index.md': `# About Sik — Builders of SikPoket\n\nSik builds local-first tools: SikPoket and SikOgami. Same Paper/Ink/Sick design.\n\nContact: hello@sikpoket.app\nGitHub: https://github.com/njrankitsam11-gif/SikPoket\n`,
    '/contact/index.md': `# Contact Sik\n\n- Email: hello@sikpoket.app\n- GitHub: https://github.com/njrankitsam11-gif/SikPoket\n- Address: Remote, Global, 00000 US\n`,
    '/privacy/index.md': `# Privacy — SikPoket Zero-Data\n\nEffective: 2026-08-17. Zero collection. All data in chrome.storage.local, encrypted AES-GCM.\n\nFull: https://sikpoket.vercel.app/privacy\n`,
    '/dashboard/index.md': `# SikPoket Dashboard — Vault\n\nLocal-first vault: URLs, notes, API keys, passwords. Spaces with wallpapers, TF-IDF search.\n\nOpen: https://sikpoket.vercel.app/dashboard/\n`,
  };

  if (accept.includes('text/markdown')) {
    let mdPath = null;
    if (pathname === '/' || pathname === '/index.html') mdPath = '/index.md';
    else if (pathname === '/about' || pathname === '/about/') mdPath = '/about/index.md';
    else if (pathname === '/contact' || pathname === '/contact/') mdPath = '/contact/index.md';
    else if (pathname === '/privacy' || pathname === '/privacy/') mdPath = '/privacy/index.md';
    else if (pathname === '/dashboard' || pathname === '/dashboard/') mdPath = '/dashboard/index.md';
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

  // For non-markdown, fetch static HTML to avoid proxy loop (matcher is clean URLs, not *.html)
  let staticPath = null;
  if (pathname === '/' || pathname === '/index.html') staticPath = '/index.html';
  else if (pathname === '/about' || pathname === '/about/') staticPath = '/about/index.html';
  else if (pathname === '/contact' || pathname === '/contact/') staticPath = '/contact/index.html';
  else if (pathname === '/privacy' || pathname === '/privacy/') staticPath = '/privacy/index.html';
  else if (pathname === '/dashboard' || pathname === '/dashboard/') staticPath = '/dashboard/index.html';
  if (staticPath) {
    const target = new URL(staticPath, request.url);
    return fetch(target);
  }
  return fetch(request);
}
