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
