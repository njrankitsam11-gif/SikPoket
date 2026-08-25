export default function handler(req, res) {
  res.setHeader('Vary', 'Accept, Accept-Encoding');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
  res.setHeader('RateLimit', '60;w=60');
  res.setHeader('RateLimit-Policy', '60;w=60;burst=10');
  res.setHeader('RateLimit-Limit', '60');
  res.setHeader('RateLimit-Remaining', '59');
  res.setHeader('RateLimit-Reset', '42');
  res.setHeader('Retry-After', '42');
  res.setHeader('API-Version', '1.8.0');
  res.setHeader('Deprecation', 'false');
  res.setHeader('Sunset', 'Sat, 25 Aug 2027 00:00:00 GMT');
  if (req.method !== 'GET') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(405).json({
      error: 'Method Not Allowed',
      code: 'METHOD_NOT_ALLOWED',
      message: `Method ${req.method} not allowed for ${req.url}. Use GET.`,
      hint: 'GET /api/health for health, GET /openapi.json for spec, POST /api/mcp for MCP',
      status: 405,
      docs: 'https://sikpoket.vercel.app/developers'
    });
    return;
  }
  // Support Accept negotiation: if client wants markdown, give markdown
  const accept = (req.headers.accept || '').toLowerCase();
  if (accept.includes('text/markdown')) {
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.status(200).send(`# SikPoket Health — ok

- **status:** ok
- **version:** 1.8.0
- **uptime:** ${process.uptime().toFixed(1)}s
- **endpoint:** https://sikpoket.vercel.app/api/health
- **openapi:** https://sikpoket.vercel.app/openapi.json
- **mcp:** https://sikpoket.vercel.app/.well-known/mcp
`);
    return;
  }
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(200).json({
    status: 'ok',
    version: '1.8.0',
    uptime: Number(process.uptime().toFixed(1)),
    endpoint: 'https://sikpoket.vercel.app/api/health',
    openapi: 'https://sikpoket.vercel.app/openapi.json',
    mcp: 'https://sikpoket.vercel.app/.well-known/mcp'
  });
}
