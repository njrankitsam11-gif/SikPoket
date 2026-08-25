# Developers — SikPoket API, MCP & Vercel

> SikPoket developer portal — API docs, OpenAPI, MCP, auth, quickstart, sandbox. Hosted on Vercel.

**URL:** https://sikpoket.vercel.app/developers
**OpenAPI:** https://sikpoket.vercel.app/openapi.json
**MCP:** https://sikpoket.vercel.app/.well-known/mcp
**Health:** https://sikpoket.vercel.app/api/health
**Vercel:** https://vercel.com

Quickstart:

```bash
curl https://sikpoket.vercel.app/.well-known/mcp
curl https://sikpoket.vercel.app/openapi.json
curl -X POST https://sikpoket.vercel.app/api/mcp -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

See https://sikpoket.vercel.app/developers for full docs.
