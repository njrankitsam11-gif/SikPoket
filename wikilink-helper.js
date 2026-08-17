/**
 * SikPoket Bi-Directional WikiLinks Engine (wikilink-helper.js)
 * Parses [[WikiLink]] syntax, builds forward & backlink index, and enables connected thought graph.
 */

(function(global) {
  const WikiLinkHelper = {
    // Regex for matching [[Item Title]] or [[Item Title|Custom Alias]]
    WIKILINK_REGEX: /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,

    // Extract all wiki link targets from text
    extractLinks: function(text) {
      if (!text) return [];
      const links = [];
      let match;
      const regex = new RegExp(this.WIKILINK_REGEX);
      while ((match = regex.exec(text)) !== null) {
        links.push({
          target: match[1].trim(),
          alias: match[2] ? match[2].trim() : match[1].trim(),
          raw: match[0]
        });
      }
      return links;
    },

    // Build forward and backlink map across all vault items
    buildLinkIndex: function(items = []) {
      const titleToItemMap = new Map();
      const idToItemMap = new Map();
      const forwardLinks = new Map(); // itemId -> Set of targetItemIds
      const backlinks = new Map();    // itemId -> Set of sourceItemIds

      // 1. Index items by ID and normalized Title
      items.forEach(item => {
        if (!item || item.archived) return;
        idToItemMap.set(item.id, item);
        const title = (item.title || item.name || item.url || '').toLowerCase().trim();
        if (title) titleToItemMap.set(title, item);
        forwardLinks.set(item.id, new Set());
        backlinks.set(item.id, new Set());
      });

      // 2. Parse links in each item's content, title, and notes
      items.forEach(item => {
        if (!item || item.archived) return;
        const textToScan = (item.content || '') + ' ' + (item.title || '');
        const extracted = this.extractLinks(textToScan);

        extracted.forEach(link => {
          const targetTitle = link.target.toLowerCase();
          const targetItem = titleToItemMap.get(targetTitle);
          if (targetItem && targetItem.id !== item.id) {
            forwardLinks.get(item.id).add(targetItem.id);
            backlinks.get(targetItem.id).add(item.id);
          }
        });
      });

      return {
        forwardLinks,
        backlinks,
        getItemBacklinks: (itemId) => {
          const ids = backlinks.get(itemId) || new Set();
          return Array.from(ids).map(id => idToItemMap.get(id)).filter(Boolean);
        },
        getItemForwardLinks: (itemId) => {
          const ids = forwardLinks.get(itemId) || new Set();
          return Array.from(ids).map(id => idToItemMap.get(id)).filter(Boolean);
        }
      };
    },

    // Render text with clickable HTML wiki link badges
    renderWikiLinks: function(text, onLinkClickCallback = null) {
      if (!text) return '';
      return String(text).replace(this.WIKILINK_REGEX, (match, target, alias) => {
        const displayText = alias || target;
        const cleanTarget = target.trim();
        return `<span class="wikilink-pill" data-wikilink="${cleanTarget}" title="Open linked note: ${cleanTarget}">🔗 ${displayText}</span>`;
      });
    }
  };

  global.WikiLinkHelper = WikiLinkHelper;
})(typeof window !== 'undefined' ? window : globalThis);
