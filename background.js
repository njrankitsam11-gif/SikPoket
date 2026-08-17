chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'save-link',
      title: 'Save Link to SikPoket',
      contexts: ['link']
    });

    chrome.contextMenus.create({
      id: 'save-selection',
      title: 'Save Selection to SikPoket',
      contexts: ['selection']
    });

    chrome.contextMenus.create({
      id: 'save-highlight',
      title: 'Save Highlight to SikPoket',
      contexts: ['selection']
    });

    chrome.contextMenus.create({
      id: 'save-page',
      title: 'Save Page to SikPoket',
      contexts: ['page']
    });
  });

  updateBadgeCount();
});

chrome.runtime.onStartup.addListener(() => {
  updateBadgeCount();
});

// Sync badge count on storage changes
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.sikpoketData) {
    updateBadgeCount();
  }
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  let savedType = '';
  let savedItem = null;

  if (info.menuItemId === 'save-link') {
    savedType = 'urls';
    let title = info.linkUrl;
    try { title = new URL(info.linkUrl).hostname; } catch (e) {}
    savedItem = {
      id: Date.now().toString(),
      url: info.linkUrl,
      title: title,
      tags: [],
      createdAt: Date.now(),
      archived: false,
      favorite: false
    };
    await saveItem(savedType, savedItem);
  } else if (info.menuItemId === 'save-selection') {
    savedType = 'notes';
    savedItem = {
      id: Date.now().toString(),
      title: `Selection from ${new URL(tab.url).hostname}`,
      content: info.selectionText,
      tags: [],
      createdAt: Date.now(),
      archived: false,
      favorite: false
    };
    await saveItem(savedType, savedItem);
  } else if (info.menuItemId === 'save-highlight') {
    savedType = 'notes';
    let hostname = '';
    try { hostname = new URL(tab.url).hostname.replace(/^www\./, ''); } catch {}
    savedItem = {
      id: Date.now().toString(),
      title: tab.title || hostname,
      content: info.selectionText,
      url: tab.url,
      tags: ['highlight'],
      color: 'purple',
      createdAt: Date.now(),
      archived: false,
      favorite: false
    };
    await saveItem(savedType, savedItem);
  } else if (info.menuItemId === 'save-page') {
    savedType = 'urls';
    savedItem = {
      id: Date.now().toString(),
      url: tab.url,
      title: tab.title,
      tags: [],
      createdAt: Date.now(),
      archived: false,
      favorite: false
    };
    await saveItem(savedType, savedItem);
  }

  // Notify tab to show visual toast confirmation
  if (tab?.id && savedItem) {
    try {
      chrome.tabs.sendMessage(tab.id, {
        action: 'item-saved',
        type: savedType,
        item: savedItem
      });
    } catch (e) {
      console.warn('Could not send message to tab:', e);
    }
  }
});

async function saveItem(type, item) {
  const data = await chrome.storage.local.get(['sikpoketData']);
  const sikpoketData = data.sikpoketData || { urls: [], apiKeys: [], passwords: [], notes: [] };
  
  // Initialize fields if missing
  sikpoketData.urls = sikpoketData.urls || [];
  sikpoketData.apiKeys = sikpoketData.apiKeys || [];
  sikpoketData.passwords = sikpoketData.passwords || [];
  sikpoketData.notes = sikpoketData.notes || [];

  sikpoketData[type].unshift(item);
  await chrome.storage.local.set({ sikpoketData });
}

async function updateBadgeCount() {
  const data = await chrome.storage.local.get(['sikpoketData']);
  const allData = data.sikpoketData || { urls: [], apiKeys: [], passwords: [], notes: [] };
  
  const urlsCount = (allData.urls || []).filter(u => !u.archived).length;
  const keysCount = (allData.apiKeys || []).filter(k => !k.archived).length;
  const pwdsCount = (allData.passwords || []).filter(p => !p.archived).length;
  const notesCount = (allData.notes || []).filter(n => !n.archived).length;

  const totalUnread = urlsCount + keysCount + pwdsCount + notesCount;
  
  chrome.action.setBadgeText({ text: totalUnread > 0 ? String(totalUnread) : '' });
  chrome.action.setBadgeBackgroundColor({ color: '#7c6af7' });
}

// Listen to message from content script for bookmarklet saves
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'save-item-external') {
    (async () => {
      await saveItem(message.type, message.item);
      if (sender.tab?.id) {
        try {
          chrome.tabs.sendMessage(sender.tab.id, {
            action: 'item-saved',
            type: message.type,
            item: message.item
          });
        } catch (e) {
          console.warn('Could not send confirmation to sender tab:', e);
        }
      }
    })();
    return true;
  }
});

// Reminder alarm handler
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (!alarm.name?.startsWith('sikpoket_reminder_')) return;
  const withoutPrefix = alarm.name.replace('sikpoket_reminder_', '');
  const underscoreIdx = withoutPrefix.indexOf('_');
  if (underscoreIdx === -1) return;
  const type = withoutPrefix.substring(0, underscoreIdx);
  const id = withoutPrefix.substring(underscoreIdx + 1);

  const data = await chrome.storage.local.get(['sikpoketData']);
  const allData = data.sikpoketData || {};
  const item = (allData[type] || []).find(i => i.id === id);
  const title = item?.title || item?.name || 'SikPoket Reminder';

  chrome.notifications.create(alarm.name, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon48.png'),
    title: '🔔 SikPoket Reminder',
    message: title
  });
});

// Omnibox keyword search ('sik <query>')
function escapeXml(unsafe) {
  return String(unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

if (chrome.omnibox) {
  chrome.omnibox.setDefaultSuggestion({
    description: 'Search SikPoket bookmarks and notes for <match>%s</match>'
  });

  chrome.omnibox.onInputChanged.addListener(async (text, suggest) => {
    const q = text.trim().toLowerCase();
    if (!q) return;

    try {
      const data = await chrome.storage.local.get(['sikpoketData']);
      const allData = data.sikpoketData || { urls: [], notes: [] };
      const results = [];

      const urls = (allData.urls || []).filter(u => !u.archived);
      for (const item of urls) {
        const title = item.title || item.url || '';
        const url = item.url || '';
        const tags = (item.tags || []).join(' ');
        if (title.toLowerCase().includes(q) || url.toLowerCase().includes(q) || tags.toLowerCase().includes(q)) {
          results.push({
            content: url,
            description: `<match>${escapeXml(title)}</match> - <dim>${escapeXml(url)}</dim>`
          });
        }
        if (results.length >= 6) break;
      }

      if (results.length < 6) {
        const notes = (allData.notes || []).filter(n => !n.archived);
        for (const item of notes) {
          const title = item.title || 'Note';
          const content = item.content || '';
          if (title.toLowerCase().includes(q) || content.toLowerCase().includes(q)) {
            results.push({
              content: chrome.runtime.getURL('dashboard/index.html?search=' + encodeURIComponent(q)),
              description: `<match>Note: ${escapeXml(title)}</match> - <dim>${escapeXml(content.substring(0, 50))}</dim>`
            });
          }
          if (results.length >= 6) break;
        }
      }

      suggest(results);
    } catch (e) {
      console.warn('Omnibox search error:', e);
    }
  });

  chrome.omnibox.onInputEntered.addListener((text, disposition) => {
    let targetUrl = text.trim();
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://') && !targetUrl.startsWith('chrome-extension://')) {
      targetUrl = chrome.runtime.getURL('dashboard/index.html?search=' + encodeURIComponent(targetUrl));
    }

    if (disposition === 'currentTab') {
      chrome.tabs.update({ url: targetUrl });
    } else if (disposition === 'newForegroundTab') {
      chrome.tabs.create({ url: targetUrl, active: true });
    } else if (disposition === 'newBackgroundTab') {
      chrome.tabs.create({ url: targetUrl, active: false });
    }
  });
}

// Side Panel keyboard command trigger (Ctrl+Shift+E)
if (chrome.commands) {
  chrome.commands.onCommand.addListener(async (command) => {
    if (command === 'toggle-side-panel') {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && chrome.sidePanel) {
        try {
          await chrome.sidePanel.open({ windowId: tab.windowId });
        } catch (e) {
          console.warn('Could not open side panel:', e);
        }
      }
    }
  });
}

// Tab Session Snapshot & Restore Handlers
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'save-window-session') {
    (async () => {
      try {
        const tabs = await chrome.tabs.query({ currentWindow: true });
        const validTabs = tabs
          .filter(t => t.url && !t.url.startsWith('chrome://') && !t.url.startsWith('chrome-extension://'))
          .map(t => ({ url: t.url, title: t.title || t.url, favIconUrl: t.favIconUrl || '' }));

        if (validTabs.length === 0) {
          sendResponse({ success: false, error: 'No saveable tabs found' });
          return;
        }

        const data = await chrome.storage.local.get(['sikpoketSessions']);
        const sessions = data.sikpoketSessions || [];
        const newSession = {
          id: Date.now().toString(),
          name: message.name || `Session ${new Date().toLocaleDateString('en-GB')} (${validTabs.length} tabs)`,
          tabs: validTabs,
          createdAt: Date.now()
        };
        sessions.unshift(newSession);
        await chrome.storage.local.set({ sikpoketSessions: sessions });
        sendResponse({ success: true, session: newSession });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  if (message.action === 'restore-session') {
    (async () => {
      try {
        const session = message.session;
        if (!session?.tabs?.length) {
          sendResponse({ success: false, error: 'No tabs in session' });
          return;
        }
        // Open tabs in a new browser window
        const win = await chrome.windows.create({ url: session.tabs[0].url });
        for (let i = 1; i < session.tabs.length; i++) {
          await chrome.tabs.create({ windowId: win.id, url: session.tabs[i].url, active: false });
        }
        sendResponse({ success: true, windowId: win.id });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }
});


