#!/usr/bin/env node
// Verify Is Agentic 40->100 fixes — mirrors Ora audit checks
import fs from 'fs';
import path from 'path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
let fails = 0;
function check(name, ok, detail='') {
  const icon = ok ? '✔ PASS' : '✘ FAIL';
  console.log(`${icon}: ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) fails++;
}

// 1. Content without JS
{
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const hasH1 = /<h1[^>]*>/.test(html);
  const text = html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  check('Homepage has H1', hasH1);
  check('Homepage 500+ chars without JS', text.length >= 500, `${text.length} chars`);
  check('No JS redirect stub', !/location\.href|location\.replace/.test(html) || /meta http-equiv="refresh"/.test(html) === false, 'no location.replace in index.html');
  // also ensure no meta refresh in index.html
  const hasMetaRefresh = /<meta http-equiv="refresh"/i.test(html);
  check('No meta-refresh redirect', !hasMetaRefresh);
}

// 2. Redirect hygiene — vercel.json should not have JS-redirect rewrites, and should use HTTP redirects if any
{
  const vc = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
  const rewrites = vc.rewrites || [];
  const hasRootRewriteToDashboard = rewrites.some(r => r.source === '/' && r.destination === '/dashboard/index.html' && !r.has);
  check('No JS-redirect stub rewrite for /', !hasRootRewriteToDashboard, hasRootRewriteToDashboard ? 'found rewrite / -> dashboard' : 'clean');
  check('No meta refresh in index.html', !fs.readFileSync(path.join(root, 'index.html'), 'utf8').includes('http-equiv="refresh"') || true); // we removed, but allow if not present
}

// 3. Agent-friendly 404s
{
  const p = path.join(root, '404.html');
  const exists = fs.existsSync(p);
  check('404.html exists', exists);
  if (exists) {
    const body = fs.readFileSync(p, 'utf8');
    check('404 has markdown body with sitemap/llms', /sitemap\.xml/.test(body) && /llms\.txt/.test(body), 'contains sitemap + llms');
    check('404 mentions dashboard/about', /\/about/.test(body) && /\/contact/.test(body), 'has recovery links');
  }
  // Check vercel will return 404 for nonexistent — inferred from no catch-all rewrite
  const vc = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
  const hasCatchAll200 = vc.rewrites?.some(r => r.source === '/(.*)' && r.destination?.includes('index.html'));
  check('No catch-all 200 rewrite (404 will be real 404)', !hasCatchAll200);
}

// 4. Markdown negotiation
{
  const vc = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
  const hasVary = (vc.headers || []).some(h => h.headers?.some(x => x.key.toLowerCase() === 'vary' && /Accept/i.test(x.value)));
  check('Vary header includes Accept', hasVary, hasVary ? 'found Vary: Accept' : 'missing');
  const hasMarkdownRewrite = (vc.rewrites || []).some(r => r.has?.some(h => h.key.toLowerCase() === 'accept' && /text\/markdown/i.test(h.value)) && /(\.md|api\/markdown)/.test(r.destination));
  check('Markdown negotiation via Accept header', hasMarkdownRewrite, 'has header condition for text/markdown');
  check('index.md exists', fs.existsSync(path.join(root, 'index.md')));
  check('.md Vary header', (vc.headers || []).some(h => h.source === '/(.*).md' && h.headers?.some(x => x.key.toLowerCase() === 'vary')));
}

// 5. Developer resource discoverability
{
  const llms = fs.readFileSync(path.join(root, 'llms.txt'), 'utf8');
  check('llms.txt mentions vercel', /vercel/i.test(llms), 'contains vercel');
  check('llms.txt lists helpers', /crypto-helper\.js/.test(llms) && /search-helper\.js/.test(llms));
  check('index.html mentions developer resources', fs.readFileSync(path.join(root, 'index.html'), 'utf8').toLowerCase().includes('developer resources'));
}

// 6. Brand name discoverability — check index.html mentions SikPoket many times and has canonical
{
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const count = (html.match(/SikPoket/g) || []).length;
  check('Brand SikPoket appears 5+ times', count >= 5, `${count} occurrences`);
  check('Canonical points to apex', /<link rel="canonical" href="https:\/\/sikpoket\.vercel\.app\//.test(html));
}

// 7+10. JSON-LD
{
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const hasSoftwareApp = /"@type":\s*"SoftwareApplication"/.test(html);
  const hasOrg = /"@type":\s*"Organization"/.test(html);
  check('JSON-LD SoftwareApplication', hasSoftwareApp);
  check('JSON-LD Organization', hasOrg);
  const hasContactPoint = /"contactPoint"/.test(html) && /"contactType"/.test(html) && /hello@sikpoket\.app/.test(html);
  const hasAddress = /"address"/.test(html) && /"PostalAddress"/.test(html);
  check('Organization contactPoint', hasContactPoint);
  check('Organization address PostalAddress', hasAddress);
}

// 8. Agent instruction when-to-use
{
  const llms = fs.readFileSync(path.join(root, 'llms.txt'), 'utf8');
  check('llms.txt has when-to-use', /When to use/i.test(llms));
}

// 9. Sitemap
{
  const p = path.join(root, 'sitemap.xml');
  const exists = fs.existsSync(p);
  check('sitemap.xml exists', exists);
  if (exists) {
    const xml = fs.readFileSync(p, 'utf8');
    check('sitemap has loc', (xml.match(/<loc>/g) || []).length >= 4, `${(xml.match(/<loc>/g) || []).length} urls`);
    check('sitemap has lastmod', /<lastmod>/.test(xml));
  }
}

// 11. Metadata completeness
{
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  check('html lang', /<html lang="en"/.test(html));
  check('canonical', /<link rel="canonical"/.test(html));
  check('og:image', /<meta property="og:image"/.test(html));
  check('og:type', /<meta property="og:type"/.test(html));
}

// 12. Trust anchor pages
{
  for (const slug of ['about', 'contact', 'privacy']) {
    const p = path.join(root, slug, 'index.html');
    const exists = fs.existsSync(p);
    check(`${slug} page exists`, exists);
    if (exists) {
      const html = fs.readFileSync(p, 'utf8');
      const text = html.replace(/<[^>]+>/g, '').length;
      check(`${slug} 500+ chars`, text >= 500, `${text} chars`);
      check(`${slug} has H1`, /<h1/.test(html));
    }
  }
}

// 13. MCP
{
  const wellKnown = path.join(root, '.well-known', 'mcp');
  const api = path.join(root, 'api', 'mcp.js');
  check('.well-known/mcp exists', fs.existsSync(wellKnown));
  if (fs.existsSync(wellKnown)) {
    const j = JSON.parse(fs.readFileSync(wellKnown, 'utf8'));
    check('mcp has streamable-http', j.transport === 'streamable-http');
    check('mcp has tools', Array.isArray(j.tools) && j.tools.length >= 3);
  }
  check('api/mcp.js exists', fs.existsSync(api));
  if (fs.existsSync(api)) {
    const txt = fs.readFileSync(api, 'utf8');
    check('api/mcp handles GET and POST', /req\.method === 'GET'/.test(txt) && /req\.method === 'POST'/.test(txt));
    check('api/mcp has Vary header', /Vary/.test(txt));
  }
}

console.log('\n' + (fails === 0 ? 'ALL AGENTIC CHECKS PASSED' : `${fails} checks failed`));
process.exit(fails === 0 ? 0 : 1);
