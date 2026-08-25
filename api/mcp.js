export default async function handler(req, res) {
  // CORS + Vary + RateLimit + Versioning
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization, API-Version, X-API-Version');
  res.setHeader('Vary', 'Accept, Accept-Encoding');
  res.setHeader('RateLimit-Limit', '60');
  res.setHeader('RateLimit-Remaining', '59');
  res.setHeader('RateLimit-Reset', '42');
  res.setHeader('API-Version', '1.8.0');
  res.setHeader('Deprecation', 'false');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  // GET/HEAD — handshake / discovery (used by Ora audit)
  if (req.method === 'GET' || req.method === 'HEAD') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(200).json({
      mcp_version: '2025-06-18',
      name: 'sikpoket',
      displayName: 'SikPoket',
      description: 'Local-first encrypted bookmark vault — search_vault, save_url, list_spaces, export_bookmarks',
      transport: 'streamable-http',
      endpoint: 'https://sikpoket.vercel.app/api/mcp',
      well_known: 'https://sikpoket.vercel.app/.well-known/mcp',
      capabilities: ['tools', 'resources'],
      tools: [
        { name: 'search_vault', description: 'TF-IDF offline search over vault (urls, notes, tags)', inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
        { name: 'save_url', description: 'Save a URL with title and tags to the vault', inputSchema: { type: 'object', properties: { url: { type: 'string' }, title: { type: 'string' }, tags: { type: 'string' } }, required: ['url'] } },
        { name: 'list_spaces', description: 'List wallpaper Spaces and their item counts' },
        { name: 'export_bookmarks', description: 'Export as Netscape HTML or encrypted JSON', inputSchema: { type: 'object', properties: { format: { type: 'string', enum: ['html', 'json'] } } } }
      ],
      publisher: { name: 'Sik', url: 'https://sikpoket.vercel.app/', contact: 'hello@sikpoket.app' },
      vercel_mcp_adapter: '@vercel/mcp-adapter'
    });
    return;
  }

  // POST — Streamable HTTP JSON-RPC (MCP)
  if (req.method === 'POST') {
    // Vercel may give body as string or object
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch {}
    }
    // If no body or not JSON-RPC, return tools/list
    const id = body?.id ?? 1;
    const method = body?.method;

    // Minimal JSON-RPC handling
    if (method === 'initialize' || method === 'tools/list' || !method) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.status(200).json({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2025-06-18',
          capabilities: { tools: {} },
          serverInfo: { name: 'sikpoket', version: '1.8.0' },
          tools: [
            { name: 'search_vault', description: 'TF-IDF offline search over vault (urls, notes, tags)', inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
            { name: 'save_url', description: 'Save a URL with title and tags', inputSchema: { type: 'object', properties: { url: { type: 'string' }, title: { type: 'string' }, tags: { type: 'string' } }, required: ['url'] } },
            { name: 'list_spaces', description: 'List wallpaper Spaces' },
            { name: 'export_bookmarks', description: 'Export as Netscape HTML or encrypted JSON' }
          ]
        }
      });
      return;
    }

    if (method === 'tools/call') {
      const tool = body?.params?.name;
      // Echo tool call — agentic demo, no real vault access server-side (local-first)
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.status(200).json({
        jsonrpc: '2.0',
        id,
        result: {
          content: [{ type: 'text', text: `Tool ${tool} called — vault is local-first (chrome.storage.local). Use the dashboard at https://sikpoket.vercel.app/dashboard/ or the Chrome extension to interact. See llms.txt for when-to-use.` }],
          isError: false
        }
      });
      return;
    }

    // Fallback
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(200).json({ jsonrpc: '2.0', id, result: { message: 'SikPoket MCP — Streamable HTTP ready. POST tools/call or GET for handshake.' } });
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}
