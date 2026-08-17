/**
 * SikPoket AI & NLP Helper
 * Supports on-device Chrome Prompt API (window.ai / LanguageModel)
 * with robust zero-server local TextRank / TF-IDF summarization and keyword extraction fallback.
 */

(function(global) {
  const StopWords = new Set([
    'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren\'t', 'as', 'at',
    'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'can', 'can\'t', 'cannot', 'could',
    'couldn\'t', 'did', 'didn\'t', 'do', 'does', 'doesn\'t', 'doing', 'don\'t', 'down', 'during', 'each', 'few', 'for', 'from',
    'further', 'had', 'hadn\'t', 'has', 'hasn\'t', 'have', 'haven\'t', 'having', 'he', 'he\'d', 'he\'ll', 'he\'s', 'her', 'here',
    'here\'s', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'how\'s', 'i', 'i\'d', 'i\'ll', 'i\'m', 'i\'ve', 'if', 'in',
    'into', 'is', 'isn\'t', 'it', 'it\'s', 'its', 'itself', 'let\'s', 'me', 'more', 'most', 'mustn\'t', 'my', 'myself', 'no',
    'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'over', 'own',
    'same', 'shan\'t', 'she', 'she\'d', 'she\'ll', 'she\'s', 'should', 'shouldn\'t', 'so', 'some', 'such', 'than', 'that', 'that\'s',
    'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'there\'s', 'these', 'they', 'they\'d', 'they\'ll', 'they\'re',
    'they\'ve', 'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'wasn\'t', 'we', 'we\'d', 'we\'ll',
    'we\'re', 'we\'ve', 'were', 'weren\'t', 'what', 'what\'s', 'when', 'when\'s', 'where', 'where\'s', 'which', 'while', 'who',
    'who\'s', 'whom', 'why', 'why\'s', 'with', 'won\'t', 'would', 'wouldn\'t', 'you', 'you\'d', 'you\'ll', 'you\'re', 'you\'ve',
    'your', 'yours', 'yourself', 'yourselves'
  ]);

  const AIHelper = {
    // Check if Chrome built-in Prompt API is available
    isPromptApiAvailable: async function() {
      try {
        if (typeof window !== 'undefined' && window.ai && window.ai.languageModel) {
          const capabilities = await window.ai.languageModel.capabilities();
          return capabilities.available === 'readily' || capabilities.available === 'after-download';
        }
        if (typeof LanguageModel !== 'undefined') {
          const capabilities = await LanguageModel.capabilities();
          return capabilities.available === 'readily' || capabilities.available === 'after-download';
        }
      } catch (e) {
        // Prompt API not active
      }
      return false;
    },

    // Summarize text using Chrome Prompt API or local TextRank algorithm
    summarizeArticle: async function(title, content, maxBullets = 3) {
      if (!content || typeof content !== 'string') return [];

      const cleanText = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      if (cleanText.length < 50) return [cleanText];

      // Try Chrome Prompt API
      const hasAi = await this.isPromptApiAvailable();
      if (hasAi) {
        try {
          const lmFactory = window.ai?.languageModel || LanguageModel;
          const session = await lmFactory.create({
            systemPrompt: 'You are a concise executive summary generator. Output exactly 3 clear, high-impact bullet points summarizing the core takeaways of the text.'
          });
          const prompt = `Title: ${title || 'Article'}\n\nContent:\n${cleanText.substring(0, 4000)}`;
          const response = await session.prompt(prompt);
          session.destroy();
          const bullets = response.split('\n')
            .map(line => line.replace(/^[-*•\d.]+\s*/, '').trim())
            .filter(line => line.length > 5);
          if (bullets.length > 0) return bullets.slice(0, maxBullets);
        } catch (e) {
          console.warn('Prompt API session error, falling back to local NLP:', e);
        }
      }

      // Local Extractive Summarization Fallback
      return this.localTextRankSummary(cleanText, maxBullets);
    },

    // Zero-server local extractive sentence scoring
    localTextRankSummary: function(text, numSentences = 3) {
      const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
      if (sentences.length <= numSentences) {
        return sentences.map(s => s.trim());
      }

      // Word frequency table
      const wordFreq = {};
      const words = text.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
      for (const w of words) {
        if (!StopWords.has(w)) {
          wordFreq[w] = (wordFreq[w] || 0) + 1;
        }
      }

      // Score each sentence
      const scoredSentences = sentences.map((sentence, index) => {
        const sWords = sentence.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
        let score = 0;
        for (const w of sWords) {
          if (wordFreq[w]) score += wordFreq[w];
        }
        // Position bias: first and early sentences carry more weight
        const positionBoost = index === 0 ? 1.5 : (1 / Math.sqrt(index + 1));
        return {
          text: sentence.trim(),
          score: (score / (sWords.length + 1)) * positionBoost,
          index: index
        };
      });

      // Pick top N sentences maintaining chronological flow
      scoredSentences.sort((a, b) => b.score - a.score);
      const topSentences = scoredSentences.slice(0, numSentences);
      topSentences.sort((a, b) => a.index - b.index);

      return topSentences.map(s => s.text);
    },

    // Extract top smart tags/keywords from text
    suggestTags: function(title, content, url, maxTags = 5) {
      const corpus = `${title || ''} ${content || ''}`.toLowerCase();
      const wordFreq = {};
      const words = corpus.match(/\b[a-z]{3,}\b/g) || [];

      for (const w of words) {
        if (!StopWords.has(w) && w.length >= 3 && !/^\d+$/.test(w)) {
          wordFreq[w] = (wordFreq[w] || 0) + 1;
        }
      }

      // Add domain tag if URL exists
      const tags = [];
      if (url) {
        try {
          const hostname = new URL(url).hostname.replace(/^www\./, '').split('.')[0];
          if (hostname && hostname.length > 2 && !StopWords.has(hostname)) {
            tags.push(hostname);
          }
        } catch (e) {}
      }

      // Sort by frequency
      const sortedWords = Object.keys(wordFreq).sort((a, b) => wordFreq[b] - wordFreq[a]);
      for (const w of sortedWords) {
        if (!tags.includes(w) && tags.length < maxTags) {
          tags.push(w);
        }
      }

      return tags;
    }
  };

  global.AIHelper = AIHelper;
})(typeof window !== 'undefined' ? window : globalThis);
