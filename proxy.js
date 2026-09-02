import { next, rewrite } from '@vercel/functions';
import { mdMap } from './lib/markdown-content.js';
export default function proxy(request) {
  const accept = request.headers.get('accept') || '';
  const url = new URL(request.url);
  const pathname = url.pathname;

  if (accept.includes('text/markdown')) {
    let mdPath = null;
    if (pathname === '/' || pathname === '/index.html') mdPath = '/index.md';
    else if (pathname === '/about' || pathname === '/about/') mdPath = '/about/index.md';
    else if (pathname === '/contact' || pathname === '/contact/') mdPath = '/contact/index.md';
    else if (pathname === '/privacy' || pathname === '/privacy/') mdPath = '/privacy/index.md';
    else if (pathname === '/dashboard' || pathname === '/dashboard/') mdPath = '/dashboard/index.md';
    else if (pathname === '/developers' || pathname === '/developers/') mdPath = '/developers/index.md';
    else if (pathname === '/vercel' || pathname === '/vercel/') mdPath = '/vercel/index.md';
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

  // MCP — rewrite both GET and POST to /api/mcp (preserves method/body)
  if (pathname === '/.well-known/mcp') {
    return rewrite(new URL('/api/mcp', request.url));
  }

  // For non-markdown, continue to static/rewrites (api/404 for unknown)
  return next();
}
