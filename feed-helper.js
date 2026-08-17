/**
 * SikPoket Offline RSS/Atom Feed Reader Engine (feed-helper.js)
 * 100% Client-Side XML DOMParser for RSS 2.0 and Atom feeds.
 */

(function(global) {
  const FeedHelper = {
    // Parse raw RSS 2.0 or Atom XML text into structured articles
    parseFeedXml: function(xmlText, feedUrl = '') {
      if (!xmlText) return { title: 'Unknown Feed', items: [] };

      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlText, 'text/xml');

      // Check XML parsing error
      if (doc.querySelector('parsererror')) {
        throw new Error('Invalid XML feed structure');
      }

      // 1. Detect RSS 2.0
      const channel = doc.querySelector('channel');
      if (channel) {
        const feedTitle = channel.querySelector('title')?.textContent?.trim() || 'RSS Feed';
        const feedLink = channel.querySelector('link')?.textContent?.trim() || feedUrl;
        const itemNodes = Array.from(channel.querySelectorAll('item'));

        const items = itemNodes.map(node => {
          const title = node.querySelector('title')?.textContent?.trim() || 'Untitled Article';
          const link = node.querySelector('link')?.textContent?.trim() || '';
          const description = node.querySelector('description')?.textContent?.trim() || '';
          const content = node.querySelector('content\\:encoded, encoded')?.textContent?.trim() || description;
          const pubDate = node.querySelector('pubDate')?.textContent?.trim() || new Date().toISOString();
          const author = node.querySelector('author, dc\\:creator, creator')?.textContent?.trim() || '';

          return {
            title,
            url: link,
            content: content || description,
            excerpt: description.replace(/<[^>]*>/g, ' ').slice(0, 160).trim(),
            publishedAt: new Date(pubDate).getTime() || Date.now(),
            author,
            feedTitle
          };
        });

        return { title: feedTitle, link: feedLink, items };
      }

      // 2. Detect Atom Feed
      const feed = doc.querySelector('feed');
      if (feed) {
        const feedTitle = feed.querySelector('title')?.textContent?.trim() || 'Atom Feed';
        const feedLink = feed.querySelector('link[rel="alternate"], link')?.getAttribute('href') || feedUrl;
        const entryNodes = Array.from(feed.querySelectorAll('entry'));

        const items = entryNodes.map(node => {
          const title = node.querySelector('title')?.textContent?.trim() || 'Untitled Article';
          const link = node.querySelector('link[rel="alternate"], link')?.getAttribute('href') || '';
          const summary = node.querySelector('summary')?.textContent?.trim() || '';
          const content = node.querySelector('content')?.textContent?.trim() || summary;
          const updated = node.querySelector('updated, published')?.textContent?.trim() || new Date().toISOString();
          const author = node.querySelector('author name')?.textContent?.trim() || '';

          return {
            title,
            url: link,
            content: content || summary,
            excerpt: (summary || content).replace(/<[^>]*>/g, ' ').slice(0, 160).trim(),
            publishedAt: new Date(updated).getTime() || Date.now(),
            author,
            feedTitle
          };
        });

        return { title: feedTitle, link: feedLink, items };
      }

      return { title: 'Unknown Feed', items: [] };
    },

    // Fetch and parse feed
    fetchFeed: async function(url) {
      if (!url) return null;
      try {
        const res = await fetch(url, { headers: { 'Accept': 'application/rss+xml, application/xml, text/xml, */*' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const xmlText = await res.text();
        return this.parseFeedXml(xmlText, url);
      } catch (err) {
        console.warn('Direct feed fetch failed, attempting proxy/cached fetch:', err);
        throw err;
      }
    }
  };

  global.FeedHelper = FeedHelper;
})(typeof window !== 'undefined' ? window : globalThis);
