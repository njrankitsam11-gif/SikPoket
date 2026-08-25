export default function handler(req, res) {
  const accept = (req.headers.accept || '').toLowerCase();
  const isJson = accept.includes('application/json') || req.url.startsWith('/api/');
  const isMarkdown = accept.includes('text/markdown');

  res.setHeader('Vary', 'Accept, Accept-Encoding');
  res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
  res.setHeader('RateLimit-Limit', '60');
  res.setHeader('RateLimit-Remaining', '59');
  res.setHeader('RateLimit-Reset', '42');
  res.setHeader('API-Version', '1.8.0');

  if (isJson) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(404).json({
      error: 'Not Found',
      code: 'RESOURCE_NOT_FOUND',
      message: `The path ${req.url} does not exist on SikPoket.`,
      hint: 'Try /sitemap.xml, /llms.txt, /openapi.json, or /developers for discovery. For API, POST /api/mcp for MCP or GET /openapi.json for spec.',
      status: 404,
      docs: 'https://sikpoket.vercel.app/llms.txt'
    });
    return;
  }

  if (isMarkdown) {
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.status(404).send(`# 404 — Not found

The path \`${req.url}\` does not exist on **SikPoket** (https://sikpoket.vercel.app/).

Try:

- **Sitemap:** https://sikpoket.vercel.app/sitemap.xml — all indexable URLs
- **Agent guide:** https://sikpoket.vercel.app/llms.txt — when to use SikPoket + tool list
- **Docs:** https://sikpoket.vercel.app/about • https://sikpoket.vercel.app/contact • https://sikpoket.vercel.app/privacy
- **Dashboard:** https://sikpoket.vercel.app/dashboard/
- **Developers:** https://sikpoket.vercel.app/developers — API docs + OpenAPI
- **OpenAPI:** https://sikpoket.vercel.app/openapi.json
- **MCP handshake:** https://sikpoket.vercel.app/.well-known/mcp

> Need to save a page? Use the Chrome extension (Ctrl+Shift+S) or side panel (Ctrl+Shift+E) — it works offline.
`);
    return;
  }

  // default HTML
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(404).send(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>404 — SikPoket</title></head><body><h1>404 — Not found</h1><p>The path ${req.url} does not exist.</p><ul><li><a href="/sitemap.xml">sitemap.xml</a></li><li><a href="/llms.txt">llms.txt</a></li><li><a href="/openapi.json">openapi.json</a></li><li><a href="/developers">developers</a></li></ul></body></html>`);
}
