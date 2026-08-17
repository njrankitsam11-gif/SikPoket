/**
 * SikPoket Smart Duplicate Detector & Merger Engine (dedup-helper.js)
 * Normalizes URLs, identifies duplicate records across spaces, and merges tags with 1 click.
 */

(function(global) {
  const TRACKING_PARAMS = new Set([
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
    'fbclid', 'gclid', 'ref', 'source', 'igshid', '_hsenc', 'mc_cid',
    'yclid', 'twclid', 'gbraid', 'wbraid', 'si', 'feature'
  ]);

  const DedupHelper = {
    // Normalize URL: remove tracking query params, fragments, trailing slashes
    normalizeUrl: function(rawUrl) {
      if (!rawUrl || typeof rawUrl !== 'string') return '';
      try {
        const u = new URL(rawUrl.trim());
        // Strip tracking params
        const params = new URLSearchParams(u.search);
        TRACKING_PARAMS.forEach(p => params.delete(p));
        
        const cleanSearch = params.toString() ? `?${params.toString()}` : '';
        const cleanPath = u.pathname.replace(/\/+$/, '') || '/';
        const cleanHost = u.hostname.replace(/^www\./, '').toLowerCase();

        return `${u.protocol}//${cleanHost}${cleanPath}${cleanSearch}`.toLowerCase();
      } catch (e) {
        return rawUrl.trim().toLowerCase().replace(/\/+$/, '');
      }
    },

    // Scan an array of items for duplicates
    findDuplicates: function(items = []) {
      const urlMap = new Map();
      const titleMap = new Map();
      const duplicateGroups = [];

      items.forEach(item => {
        if (!item || item.archived) return;

        // Group by URL
        if (item.url) {
          const normUrl = this.normalizeUrl(item.url);
          if (!urlMap.has(normUrl)) urlMap.set(normUrl, []);
          urlMap.get(normUrl).push(item);
        }

        // Group by Title for notes without URL
        if (!item.url && item.title) {
          const normTitle = item.title.trim().toLowerCase();
          if (normTitle.length > 3) {
            if (!titleMap.has(normTitle)) titleMap.set(normTitle, []);
            titleMap.get(normTitle).push(item);
          }
        }
      });

      // Collect URL duplicate groups with 2+ items
      urlMap.forEach((group, normUrl) => {
        if (group.length > 1) {
          duplicateGroups.push({
            key: normUrl,
            type: 'url',
            items: group,
            count: group.length
          });
        }
      });

      // Collect Note duplicate groups with 2+ items
      titleMap.forEach((group, normTitle) => {
        if (group.length > 1) {
          duplicateGroups.push({
            key: normTitle,
            type: 'note',
            items: group,
            count: group.length
          });
        }
      });

      return duplicateGroups;
    },

    // Merge duplicate group into one primary item
    mergeGroup: function(groupItems = []) {
      if (groupItems.length < 2) return null;

      // Oldest item is primary
      const sorted = [...groupItems].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      const primary = { ...sorted[0] };
      const duplicatesToDelete = sorted.slice(1);

      // Merge unique tags
      const tagSet = new Set(primary.tags || []);
      duplicatesToDelete.forEach(d => {
        (d.tags || []).forEach(t => tagSet.add(t));
      });
      primary.tags = Array.from(tagSet);

      // Merge favorite status
      if (duplicatesToDelete.some(d => d.favorite)) {
        primary.favorite = true;
      }

      // Merge notes content if primary has empty or shorter note
      duplicatesToDelete.forEach(d => {
        if (d.content && !primary.content) {
          primary.content = d.content;
        } else if (d.content && primary.content && !primary.content.includes(d.content)) {
          primary.content += `\n\n--- Merged Note ---\n${d.content}`;
        }
      });

      return {
        mergedItem: primary,
        deletedIds: duplicatesToDelete.map(d => d.id)
      };
    }
  };

  global.DedupHelper = DedupHelper;
})(typeof window !== 'undefined' ? window : globalThis);
