/**
 * SikPoket — VectorHelper (Client-Side Semantic Vector Search & Similarity Engine)
 * 100% Local-First, Zero-Server, High-Performance Sparse Vector & Cosine Similarity Engine.
 */

const VectorHelper = (function () {
  'use strict';

  // Common English stopwords
  const STOP_WORDS = new Set([
    'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and',
    'any', 'are', 'aren\'t', 'as', 'at', 'be', 'because', 'been', 'before', 'being',
    'below', 'between', 'both', 'but', 'by', 'can', 'cannot', 'could', 'couldn\'t',
    'did', 'didn\'t', 'do', 'does', 'doesn\'t', 'doing', 'don\'t', 'down', 'during',
    'each', 'few', 'for', 'from', 'further', 'had', 'hadn\'t', 'has', 'hasn\'t',
    'have', 'haven\'t', 'having', 'he', 'he\'d', 'he\'ll', 'he\'s', 'her', 'here',
    'here\'s', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'how\'s', 'i',
    'i\'d', 'i\'ll', 'i\'m', 'i\'ve', 'if', 'in', 'into', 'is', 'isn\'t', 'it',
    'it\'s', 'its', 'itself', 'let\'s', 'me', 'more', 'most', 'mustn\'t', 'my',
    'myself', 'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or',
    'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same',
    'shan\'t', 'she', 'she\'d', 'she\'ll', 'she\'s', 'should', 'shouldn\'t', 'so',
    'some', 'such', 'than', 'that', 'that\'s', 'the', 'their', 'theirs', 'them',
    'themselves', 'then', 'there', 'there\'s', 'these', 'they', 'they\'d', 'they\'ll',
    'they\'re', 'they\'ve', 'this', 'those', 'through', 'to', 'too', 'under',
    'until', 'up', 'very', 'was', 'wasn\'t', 'we', 'we\'d', 'we\'ll', 'we\'re',
    'we\'ve', 'were', 'weren\'t', 'what', 'what\'s', 'when', 'when\'s', 'where',
    'where\'s', 'which', 'while', 'who', 'who\'s', 'whom', 'why', 'why\'s', 'with',
    'won\'t', 'would', 'wouldn\'t', 'you', 'you\'d', 'you\'ll', 'you\'re', 'you\'ve',
    'your', 'yours', 'yourself', 'yourselves', 'http', 'https', 'com', 'org', 'net'
  ]);

  /**
   * Tokenizes text into normalized word tokens and character n-grams
   */
  function tokenize(text) {
    if (!text || typeof text !== 'string') return [];
    const rawTokens = text
      .toLowerCase()
      .replace(/[^a-z0-9\s_-]/g, ' ')
      .split(/[\s_-]+/)
      .filter(t => t.length >= 2 && !STOP_WORDS.has(t));

    const tokens = [...rawTokens];
    // Add subword 3-grams for semantic fuzzy matching
    rawTokens.forEach(token => {
      if (token.length >= 4) {
        for (let i = 0; i <= token.length - 3; i++) {
          tokens.push(`_${token.slice(i, i + 3)}`);
        }
      }
    });

    return tokens;
  }

  /**
   * Generates a weighted term frequency vector from item fields
   */
  function itemToVector(item) {
    const vector = new Map();

    function addTokens(text, weight) {
      if (!text) return;
      const tokens = tokenize(text);
      tokens.forEach(token => {
        const current = vector.get(token) || 0;
        vector.set(token, current + weight);
      });
    }

    // Heavy weighting on title and tags
    addTokens(item.title, 3.5);
    if (Array.isArray(item.tags)) {
      addTokens(item.tags.join(' '), 4.0);
    } else if (typeof item.tags === 'string') {
      addTokens(item.tags, 4.0);
    }

    // Medium weighting on space, summary, notes
    addTokens(item.space, 2.0);
    addTokens(item.aiSummary || item.summary, 2.5);
    addTokens(item.notes || item.content, 1.5);
    addTokens(item.url, 1.0);

    return normalizeVector(vector);
  }

  /**
   * Generates a normalized vector from a search query
   */
  function queryToVector(query) {
    const vector = new Map();
    const tokens = tokenize(query);
    tokens.forEach(token => {
      const current = vector.get(token) || 0;
      vector.set(token, current + 1.0);
    });
    return normalizeVector(vector);
  }

  /**
   * Normalizes vector to unit length (L2 norm)
   */
  function normalizeVector(vector) {
    let sumSq = 0;
    for (const val of vector.values()) {
      sumSq += val * val;
    }
    const magnitude = Math.sqrt(sumSq);
    if (magnitude === 0) return vector;

    const normalized = new Map();
    for (const [term, val] of vector.entries()) {
      normalized.set(term, val / magnitude);
    }
    return normalized;
  }

  /**
   * Computes Cosine Similarity between two sparse vectors
   */
  function cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.size === 0 || vecB.size === 0) return 0;

    let dotProduct = 0;
    // Iterate over the smaller vector for speed
    const [small, large] = vecA.size <= vecB.size ? [vecA, vecB] : [vecB, vecA];

    for (const [term, valA] of small.entries()) {
      const valB = large.get(term);
      if (valB) {
        dotProduct += valA * valB;
      }
    }

    return Math.max(0, Math.min(1, dotProduct));
  }

  /**
   * Finds the top K most semantically similar items to a target item
   */
  function findSimilar(targetItem, allItems, topK = 5) {
    if (!targetItem || !allItems || allItems.length <= 1) return [];

    const targetVec = itemToVector(targetItem);
    const results = [];

    allItems.forEach(item => {
      // Exclude identical item
      if (item === targetItem) return;
      if (item.id && targetItem.id && item.id === targetItem.id) return;
      if (item.url && targetItem.url && item.url === targetItem.url) return;

      const itemVec = itemToVector(item);
      const similarity = cosineSimilarity(targetVec, itemVec);

      if (similarity > 0.05) {
        results.push({
          item,
          score: Math.round(similarity * 100),
          similarity
        });
      }
    });

    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, topK);
  }

  /**
   * Performs semantic vector search for a freeform query string
   */
  function semanticSearch(query, items, topK = 20) {
    if (!query || !query.trim() || !items || items.length === 0) return [];

    const queryVec = queryToVector(query);
    const scored = [];

    items.forEach(item => {
      const itemVec = itemToVector(item);
      const similarity = cosineSimilarity(queryVec, itemVec);

      if (similarity > 0.02) {
        scored.push({
          item,
          similarity,
          scorePercent: Math.round(similarity * 100)
        });
      }
    });

    scored.sort((a, b) => b.similarity - a.similarity);
    return scored.slice(0, topK);
  }

  /**
   * Semantic clustering of vault items into topic clusters (K-Means on sparse vectors)
   */
  function clusterItems(items, numClusters = 4) {
    if (!items || items.length === 0) return [];
    const k = Math.min(numClusters, items.length);
    if (k <= 1) return [{ name: 'Vault Knowledge', items }];

    const itemVectors = items.map(item => ({
      item,
      vector: itemToVector(item)
    }));

    // Pick K diverse items as initial centroids (K-Means++)
    const centroids = [itemVectors[0].vector];
    while (centroids.length < k) {
      let bestCandidate = null;
      let maxMinDist = -1;

      itemVectors.forEach(({ vector }) => {
        let minSim = 1;
        centroids.forEach(c => {
          const sim = cosineSimilarity(vector, c);
          if (sim < minSim) minSim = sim;
        });
        const dist = 1 - minSim;
        if (dist > maxMinDist) {
          maxMinDist = dist;
          bestCandidate = vector;
        }
      });

      centroids.push(bestCandidate || itemVectors[centroids.length].vector);
    }

    // Run 5 iterations of assignment & centroid update
    let clusters = Array.from({ length: k }, () => []);

    for (let iter = 0; iter < 5; iter++) {
      clusters = Array.from({ length: k }, () => []);

      itemVectors.forEach(entry => {
        let bestCluster = 0;
        let maxSim = -1;

        centroids.forEach((c, idx) => {
          const sim = cosineSimilarity(entry.vector, c);
          if (sim > maxSim) {
            maxSim = sim;
            bestCluster = idx;
          }
        });

        clusters[bestCluster].push(entry);
      });

      // Update centroids
      clusters.forEach((clusterEntries, idx) => {
        if (clusterEntries.length === 0) return;
        const newCentroid = new Map();
        clusterEntries.forEach(({ vector }) => {
          for (const [term, val] of vector.entries()) {
            newCentroid.set(term, (newCentroid.get(term) || 0) + val);
          }
        });
        centroids[idx] = normalizeVector(newCentroid);
      });
    }

    // Label clusters by top terms
    return clusters
      .map((entries, idx) => {
        const clusterItems = entries.map(e => e.item);
        if (clusterItems.length === 0) return null;

        // Find top defining term in centroid
        const topTerms = Array.from(centroids[idx].entries())
          .filter(([t]) => !t.startsWith('_'))
          .sort((a, b) => b[1] - a[1])
          .slice(0, 2)
          .map(([t]) => t.toUpperCase());

        const label = topTerms.length > 0 ? `Topic: ${topTerms.join(' & ')}` : `Cluster #${idx + 1}`;

        return {
          id: `cluster-${idx + 1}`,
          name: label,
          items: clusterItems
        };
      })
      .filter(Boolean);
  }

  return {
    tokenize,
    itemToVector,
    queryToVector,
    cosineSimilarity,
    findSimilar,
    semanticSearch,
    clusterItems
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = VectorHelper;
}
