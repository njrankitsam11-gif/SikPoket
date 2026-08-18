/**
 * SikPoket — ExportHelper (Obsidian Markdown Vault & Notion Exporter)
 * 100% Local-First, Zero-Server, Pure Client-Side Vault Exporter.
 */

const ExportHelper = (function () {
  'use strict';

  /**
   * Sanitizes filenames for Obsidian / filesystem
   */
  function sanitizeFilename(name) {
    if (!name) return 'untitled';
    return name
      .replace(/[\/\\:*?"<>|]/g, '-')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 100);
  }

  /**
   * Converts a single item into Obsidian-compliant Markdown with YAML frontmatter
   */
  function itemToObsidianMarkdown(item) {
    const title = (item.title || 'Untitled Bookmark').replace(/"/g, '\\"');
    const url = item.url || '';
    const date = item.date || item.createdAt || new Date().toISOString();
    const tags = Array.isArray(item.tags)
      ? item.tags
      : (typeof item.tags === 'string' ? item.tags.split(',').map(t => t.trim().replace(/^#/, '')) : []);
    const space = item.space || 'Default';
    const aiSummary = item.aiSummary || item.summary || '';
    const notes = item.notes || item.content || '';
    const readTime = item.readTime ? `${item.readTime} min` : '';

    // YAML Frontmatter
    let md = `---\n`;
    md += `title: "${title}"\n`;
    if (url) md += `url: "${url}"\n`;
    md += `created: ${date}\n`;
    md += `space: "${space}"\n`;
    if (readTime) md += `read_time: "${readTime}"\n`;
    if (tags.length > 0) {
      md += `tags:\n`;
      tags.forEach(t => {
        if (t) md += `  - ${t}\n`;
      });
    }
    md += `---\n\n`;

    // Markdown Content
    md += `# ${item.title || 'Untitled'}\n\n`;
    if (url) {
      md += `🔗 **Link**: [${url}](${url})\n\n`;
    }

    if (tags.length > 0) {
      md += `🏷️ **Tags**: ${tags.map(t => `#${t}`).join(' ')}\n\n`;
    }

    if (aiSummary) {
      md += `### ✨ AI Intelligence Summary\n\n> ${aiSummary.split('\n').join('\n> ')}\n\n`;
    }

    if (notes) {
      md += `### 📝 Notes & Annotations\n\n${notes}\n\n`;
    }

    // Auto-detect and format any [[wikilinks]] in notes
    md += `---\n*Exported from [[SikPoket]] Vault on ${new Date().toLocaleDateString()}*\n`;

    return md;
  }

  /**
   * Generates a combined single Markdown file of all vault items
   */
  function exportCombinedMarkdown(items, vaultName = 'SikPoket Vault') {
    let output = `# 🗂️ ${vaultName} — Master Knowledge Export\n\n`;
    output += `*Exported on ${new Date().toLocaleString()} • Total Items: ${items.length}*\n\n`;
    output += `## Table of Contents\n\n`;

    items.forEach((item, idx) => {
      const cleanTitle = (item.title || 'Untitled').replace(/[\[\]]/g, '');
      output += `${idx + 1}. [${cleanTitle}](#${encodeURIComponent(cleanTitle.toLowerCase().replace(/\s+/g, '-'))})\n`;
    });

    output += `\n---\n\n`;

    items.forEach((item) => {
      output += itemToObsidianMarkdown(item) + '\n\n---\n\n';
    });

    return output;
  }

  /**
   * Converts items into a CSV format optimized for Notion database import
   */
  function exportNotionCSV(items) {
    const headers = ['Title', 'URL', 'Space', 'Tags', 'AI Summary', 'Notes', 'Created Date'];
    const rows = [headers.join(',')];

    items.forEach(item => {
      const escape = (val) => `"${String(val || '').replace(/"/g, '""')}"`;
      const title = escape(item.title || 'Untitled');
      const url = escape(item.url || '');
      const space = escape(item.space || 'Default');
      const tags = escape(Array.isArray(item.tags) ? item.tags.join(', ') : item.tags || '');
      const aiSummary = escape(item.aiSummary || item.summary || '');
      const notes = escape(item.notes || item.content || '');
      const date = escape(item.date || item.createdAt || new Date().toISOString());

      rows.push([title, url, space, tags, aiSummary, notes, date].join(','));
    });

    return rows.join('\r\n');
  }

  /**
   * Pure client-side zero-dependency ZIP archive generator
   * Formats standard PKZIP 2.0 archives in memory
   */
  function createZip(files) {
    const fileEntries = [];
    let localHeadersSize = 0;
    let centralDirSize = 0;

    const textEncoder = new TextEncoder();

    files.forEach(file => {
      const nameBytes = textEncoder.encode(file.name);
      const dataBytes = textEncoder.encode(file.content);

      // CRC32 calculation
      let crc = 0 ^ (-1);
      for (let i = 0; i < dataBytes.length; i++) {
        crc = (crc >>> 8) ^ crcTable[(crc ^ dataBytes[i]) & 0xFF];
      }
      crc = (crc ^ (-1)) >>> 0;

      const offset = localHeadersSize;
      const localHeader = new Uint8Array(30 + nameBytes.length);
      const view = new DataView(localHeader.buffer);

      view.setUint32(0, 0x04034b50, true); // Local file header signature
      view.setUint16(4, 20, true);         // Version needed
      view.setUint16(6, 0x0800, true);     // UTF-8 flag
      view.setUint16(8, 0, true);          // Compression (Store)
      view.setUint16(10, 0, true);         // Mod time
      view.setUint16(12, 0, true);         // Mod date
      view.setUint32(14, crc, true);       // CRC32
      view.setUint32(18, dataBytes.length, true); // Compressed size
      view.setUint32(22, dataBytes.length, true); // Uncompressed size
      view.setUint16(26, nameBytes.length, true); // File name length
      view.setUint16(28, 0, true);         // Extra field length
      localHeader.set(nameBytes, 30);

      localHeadersSize += localHeader.length + dataBytes.length;

      // Central directory header
      const cdHeader = new Uint8Array(46 + nameBytes.length);
      const cdView = new DataView(cdHeader.buffer);
      cdView.setUint32(0, 0x02014b50, true); // Central directory signature
      cdView.setUint16(4, 20, true);         // Version made by
      cdView.setUint16(6, 20, true);         // Version needed
      cdView.setUint16(8, 0x0800, true);     // UTF-8 flag
      cdView.setUint16(10, 0, true);        // Compression (Store)
      cdView.setUint16(12, 0, true);        // Mod time
      cdView.setUint16(14, 0, true);        // Mod date
      cdView.setUint32(16, crc, true);      // CRC32
      cdView.setUint32(20, dataBytes.length, true); // Compressed size
      cdView.setUint32(24, dataBytes.length, true); // Uncompressed size
      cdView.setUint16(28, nameBytes.length, true); // File name length
      cdView.setUint16(30, 0, true);        // Extra field length
      cdView.setUint16(32, 0, true);        // Comment length
      cdView.setUint16(34, 0, true);        // Disk start
      cdView.setUint16(36, 0, true);        // Internal attrs
      cdView.setUint32(38, 0, true);        // External attrs
      cdView.setUint32(42, offset, true);   // Local header offset
      cdHeader.set(nameBytes, 46);

      centralDirSize += cdHeader.length;

      fileEntries.push({ localHeader, dataBytes, cdHeader });
    });

    // End of central directory record (22 bytes)
    const eocd = new Uint8Array(22);
    const eocdView = new DataView(eocd.buffer);
    eocdView.setUint32(0, 0x06054b50, true); // EOCD signature
    eocdView.setUint16(4, 0, true);          // Disk number
    eocdView.setUint16(6, 0, true);          // Start disk
    eocdView.setUint16(8, files.length, true); // Total entries disk
    eocdView.setUint16(10, files.length, true); // Total entries
    eocdView.setUint32(12, centralDirSize, true); // Size of central dir
    eocdView.setUint32(16, localHeadersSize, true); // Central dir offset
    eocdView.setUint16(20, 0, true);         // Comment length

    // Assemble final zip blob
    const totalSize = localHeadersSize + centralDirSize + eocd.length;
    const zipBytes = new Uint8Array(totalSize);
    let cur = 0;

    fileEntries.forEach(entry => {
      zipBytes.set(entry.localHeader, cur);
      cur += entry.localHeader.length;
      zipBytes.set(entry.dataBytes, cur);
      cur += entry.dataBytes.length;
    });

    fileEntries.forEach(entry => {
      zipBytes.set(entry.cdHeader, cur);
      cur += entry.cdHeader.length;
    });

    zipBytes.set(eocd, cur);

    return new Blob([zipBytes], { type: 'application/zip' });
  }

  // Precomputed CRC32 table
  const crcTable = (function () {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[i] = c;
    }
    return table;
  })();

  /**
   * Generates a complete Obsidian Vault Zip with folder structure
   */
  function exportObsidianVaultZip(items, vaultName = 'SikPoket-Obsidian-Vault') {
    const files = [];

    // Add Readme / Vault Overview
    files.push({
      name: `${vaultName}/README.md`,
      content: `# ${vaultName}\n\nWelcome to your exported **SikPoket** knowledge sanctuary.\n- Exported items: ${items.length}\n- Compatible with **Obsidian**, **Logseq**, and **Foam**.`
    });

    // Add each bookmark/note inside space folder
    const seenNames = new Map();

    items.forEach(item => {
      const space = sanitizeFilename(item.space || 'General');
      let baseName = sanitizeFilename(item.title || 'Bookmark');
      
      const count = seenNames.get(baseName) || 0;
      seenNames.set(baseName, count + 1);
      if (count > 0) baseName += ` (${count})`;

      const filePath = `${vaultName}/${space}/${baseName}.md`;
      files.push({
        name: filePath,
        content: itemToObsidianMarkdown(item)
      });
    });

    return createZip(files);
  }

  /**
   * Triggers browser download for a Blob
   */
  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  return {
    sanitizeFilename,
    itemToObsidianMarkdown,
    exportCombinedMarkdown,
    exportNotionCSV,
    createZip,
    exportObsidianVaultZip,
    triggerDownload
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ExportHelper;
}
