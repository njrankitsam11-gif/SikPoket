/**
 * SikPoket Offline Page Archiver (archive-helper.js)
 * Captures clean, distraction-free DOM article snapshots and stores them offline with zero web decay.
 */

(function(global) {
  const ArchiveHelper = {
    // Generate an offline snapshot from raw article HTML or plain text
    createSnapshot: function(item, rawHtml = '') {
      const title = item.title || item.name || 'Untitled Snapshot';
      const url = item.url || '';
      const date = new Date().toISOString();

      // Clean HTML
      let cleanHtml = rawHtml;
      if (!cleanHtml && item.content) {
        cleanHtml = item.content.split(/\n\s*\n/).map(p => `<p>${p.trim().replace(/\n/g, '<br>')}</p>`).join('');
      }

      return {
        id: item.id,
        title: title,
        url: url,
        savedAt: date,
        html: cleanHtml || '<p>No content captured.</p>',
        wordCount: (cleanHtml || '').replace(/<[^>]*>/g, ' ').trim().split(/\s+/).length
      };
    },

    // Save snapshot to local storage
    saveSnapshot: async function(itemId, snapshot) {
      if (!itemId || !snapshot) return false;
      try {
        const key = `archive_snap_${itemId}`;
        await chrome.storage.local.set({ [key]: snapshot });
        return true;
      } catch (e) {
        console.warn('Failed to save offline snapshot:', e);
        return false;
      }
    },

    // Retrieve snapshot from local storage
    getSnapshot: async function(itemId) {
      if (!itemId) return null;
      try {
        const key = `archive_snap_${itemId}`;
        const data = await chrome.storage.local.get([key]);
        return data[key] || null;
      } catch (e) {
        return null;
      }
    },

    // Check if item has an offline snapshot
    hasSnapshot: async function(itemId) {
      const snap = await this.getSnapshot(itemId);
      return snap !== null;
    }
  };

  global.ArchiveHelper = ArchiveHelper;
})(typeof window !== 'undefined' ? window : globalThis);
