/**
 * SikPoket Search Helper
 * Provides a lightweight offline full-text indexing and search mechanism.
 * Zero-server, runs entirely on the client.
 */

(function(global) {
  const SearchHelper = {
    // Simple tokenizer
    tokenize: function(text) {
      if (!text) return [];
      return String(text)
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ') // replace punctuation with space
        .split(/\s+/)
        .filter(w => w.length > 1); // ignore single characters
    },

    // Build a simple TF (Term Frequency) profile for an item
    _buildItemProfile: function(item) {
      const textFields = [
        item.title,
        item.url,
        item.name,
        item.content,
        item.username,
        ...(item.tags || [])
      ].filter(Boolean).join(' ');

      const tokens = this.tokenize(textFields);
      const tf = {};
      for (const token of tokens) {
        tf[token] = (tf[token] || 0) + 1;
      }
      return { id: item.id, tf, length: tokens.length, item };
    },

    // Perform a full-text search with basic ranking
    search: function(query, items) {
      if (!query || !query.trim()) return items;

      const queryTokens = this.tokenize(query);
      if (queryTokens.length === 0) {
        // Fallback to simple substring match if tokenizer strips everything
        const q = query.toLowerCase();
        return items.filter(i => 
          (i.title || '').toLowerCase().includes(q) || 
          (i.url || '').toLowerCase().includes(q) || 
          (i.name || '').toLowerCase().includes(q) || 
          (i.content || '').toLowerCase().includes(q) || 
          (i.tags || []).some(t => t.toLowerCase().includes(q))
        );
      }

      // Build profiles for items if not cached (in a real app we'd cache this index)
      const profiles = items.map(i => this._buildItemProfile(i));

      const scoredItems = [];

      for (const profile of profiles) {
        let score = 0;
        let allTokensMatched = true; // require all query tokens to match at least partially

        for (const qToken of queryTokens) {
          let tokenScore = 0;
          for (const [docToken, freq] of Object.entries(profile.tf)) {
            if (docToken === qToken) {
              tokenScore += freq * 2; // exact match bonus
            } else if (docToken.includes(qToken)) {
              tokenScore += freq; // partial match
            }
          }

          if (tokenScore === 0) {
            allTokensMatched = false;
            break;
          }
          score += tokenScore;
        }

        if (allTokensMatched && score > 0) {
          // Normalize by document length (basic TF)
          const normalizedScore = score / Math.max(1, Math.sqrt(profile.length));
          
          // Additional boost if title contains the query exactly
          const title = (profile.item.title || profile.item.name || '').toLowerCase();
          if (title.includes(query.toLowerCase())) {
            score += 5; 
          }

          scoredItems.push({
            item: profile.item,
            score: normalizedScore + (score > 0 ? score : 0) // combined score
          });
        }
      }

      // Sort by descending score
      scoredItems.sort((a, b) => b.score - a.score);

      return scoredItems.map(s => s.item);
    }
  };

  global.SearchHelper = SearchHelper;
})(typeof window !== 'undefined' ? window : globalThis);
