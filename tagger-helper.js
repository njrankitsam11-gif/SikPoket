/**
 * SikPoket Semantic Auto-Tagger & Smart Spaces Engine (tagger-helper.js)
 * Automatically classifies bookmarks and notes, suggests contextual tags, and powers Smart Collections.
 */

(function(global) {
  const DOMAIN_TAG_RULES = {
    'github.com': ['code', 'github', 'dev', 'opensource'],
    'gitlab.com': ['code', 'gitlab', 'dev'],
    'stackoverflow.com': ['dev', 'troubleshooting', 'programming'],
    'arxiv.org': ['research', 'ai', 'paper', 'academic'],
    'news.ycombinator.com': ['tech', 'news', 'startups'],
    'youtube.com': ['video', 'media', 'learning'],
    'vimeo.com': ['video', 'media'],
    'medium.com': ['article', 'reading', 'blog'],
    'substack.com': ['newsletter', 'reading', 'writing'],
    'figma.com': ['design', 'ui', 'prototype'],
    'dribbble.com': ['design', 'inspiration', 'ui'],
    'behance.net': ['design', 'portfolio', 'creative'],
    'reddit.com': ['community', 'discussion'],
    'twitter.com': ['social', 'news'],
    'x.com': ['social', 'news'],
    'developer.mozilla.org': ['webdev', 'docs', 'javascript'],
    'w3.org': ['standards', 'web'],
    'react.dev': ['react', 'frontend', 'javascript'],
    'nextjs.org': ['nextjs', 'react', 'fullstack']
  };

  const KEYWORD_RULES = [
    { regex: /\b(crypto|bitcoin|ethereum|web3|solana|blockchain)\b/i, tags: ['crypto', 'web3'] },
    { regex: /\b(ai|llm|gpt|gemini|machine learning|deep learning|neural)\b/i, tags: ['ai', 'ml'] },
    { regex: /\b(css|html|frontend|tailwind|ui|ux|responsive)\b/i, tags: ['frontend', 'design'] },
    { regex: /\b(backend|database|sql|postgres|api|graphql|node)\b/i, tags: ['backend', 'database'] },
    { regex: /\b(tutorial|guide|learn|how to|course)\b/i, tags: ['learning', 'guide'] },
    { regex: /\b(security|encryption|vault|aes|auth|password)\b/i, tags: ['security', 'privacy'] }
  ];

  const TaggerHelper = {
    // Generate smart tag suggestions for a given item
    suggestTags: function(item = {}) {
      const suggested = new Set();
      const urlStr = item.url || '';
      const textToScan = `${item.title || ''} ${item.content || ''} ${urlStr}`.toLowerCase();

      // 1. Domain-based matching
      if (urlStr) {
        try {
          const host = new URL(urlStr).hostname.replace(/^www\./, '').toLowerCase();
          Object.keys(DOMAIN_TAG_RULES).forEach(domain => {
            if (host.includes(domain)) {
              DOMAIN_TAG_RULES[domain].forEach(t => suggested.add(t));
            }
          });
        } catch (e) {}
      }

      // 2. Keyword heuristic matching
      KEYWORD_RULES.forEach(rule => {
        if (rule.regex.test(textToScan)) {
          rule.tags.forEach(t => suggested.add(t));
        }
      });

      // Filter out tags the item already has
      const existing = new Set((item.tags || []).map(t => t.toLowerCase()));
      return Array.from(suggested).filter(t => !existing.has(t)).slice(0, 5);
    },

    // Smart Collections Filter Predicates
    SmartSpaces: {
      // < 3 min read or short note
      isQuickRead: function(item) {
        if (!item || item.archived) return false;
        const text = item.content || item.title || '';
        const words = text.trim().split(/\s+/).length;
        return words < 600;
      },

      // Research, papers, or long deep reads
      isResearch: function(item) {
        if (!item || item.archived) return false;
        const tags = (item.tags || []).map(t => t.toLowerCase());
        const text = `${item.title || ''} ${item.content || ''}`.toLowerCase();
        return tags.some(t => ['research', 'ai', 'paper', 'academic', 'ml'].includes(t)) ||
               /arxiv\.org|nature\.com|ieee\.org|biorxiv\.org/i.test(item.url || '') ||
               /\b(research|paper|study|benchmark|architecture)\b/i.test(text);
      },

      // Dev tools, code, repositories
      isDev: function(item) {
        if (!item || item.archived) return false;
        const tags = (item.tags || []).map(t => t.toLowerCase());
        return tags.some(t => ['code', 'dev', 'github', 'webdev', 'api', 'programming'].includes(t)) ||
               /github\.com|gitlab\.com|stackoverflow\.com|developer\.mozilla\.org/i.test(item.url || '');
      },

      // Untagged inbox items needing triage
      isInbox: function(item) {
        return !item.archived && (!item.tags || item.tags.length === 0);
      }
    }
  };

  global.TaggerHelper = TaggerHelper;
})(typeof window !== 'undefined' ? window : globalThis);
