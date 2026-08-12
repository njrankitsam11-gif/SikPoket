chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'item-saved') {
    showToast(message.type, message.item);
  }
});

function showToast(type, item) {
  // Remove existing toast if any
  const oldHost = document.getElementById('sikpoket-toast-host');
  if (oldHost) oldHost.remove();

  // Create host element
  const host = document.createElement('div');
  host.id = 'sikpoket-toast-host';
  host.style.position = 'fixed';
  host.style.bottom = '20px';
  host.style.right = '20px';
  host.style.zIndex = '2147483647';
  host.style.fontFamily = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  document.body.appendChild(host);

  // Attach shadow root to isolate styles
  const shadow = host.attachShadow({ mode: 'open' });

  // Stylesheet
  const style = document.createElement('style');
  style.textContent = `
    .toast-card {
      background: var(--c-base);
      border: 1px solid var(--c-border);
      border-radius: 8px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
      color: var(--c-txt);
      padding: 14px 16px;
      width: 310px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      animation: slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      font-size: 13px;
      text-align: left;
    }
    .toast-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .toast-title {
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 6px;
      color: var(--c-acc);
    }
    .toast-close {
      background: transparent;
      border: none;
      color: var(--c-txt2);
      cursor: pointer;
      font-size: 18px;
      padding: 0;
      line-height: 1;
    }
    .toast-close:hover {
      color: var(--c-txt);
    }
    .item-name {
      color: var(--c-txt);
      font-weight: 500;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      margin-bottom: 2px;
    }
    .item-details {
      color: var(--c-txt2);
      font-size: 11px;
    }
    .tag-section {
      display: flex;
      flex-direction: column;
      gap: 5px;
      margin-top: 4px;
      border-top: 1px solid var(--c-border);
      padding-top: 8px;
    }
    .tag-label {
      font-size: 10px;
      color: var(--c-txt2);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-weight: 600;
    }
    .tag-input-row {
      display: flex;
      gap: 6px;
    }
    .tag-input {
      flex: 1;
      background: var(--c-base2);
      border: 1px solid var(--c-border);
      border-radius: 4px;
      padding: 6px 10px;
      color: var(--c-txt);
      font-size: 11px;
      outline: none;
      font-family: inherit;
      transition: border-color 0.2s;
    }
    .tag-input:focus {
      border-color: var(--c-acc);
    }
    .tag-btn {
      background: var(--c-acc);
      border: none;
      border-radius: 4px;
      color: var(--c-base);
      font-size: 11px;
      padding: 0 12px;
      cursor: pointer;
      font-weight: 600;
      transition: opacity 0.2s;
    }
    .tag-btn:hover {
      opacity: 0.9;
    }
    .success-badge {
      display: none;
      font-size: 11px;
      color: var(--c-acc);
      margin-top: 4px;
      font-weight: 500;
    }
    .success-badge.show {
      display: block;
    }
    @keyframes slideIn {
      from { transform: translateY(30px) scale(0.95); opacity: 0; }
      to { transform: translateY(0) scale(1); opacity: 1; }
    }
    @keyframes fadeOut {
      from { transform: translateY(0) scale(1); opacity: 1; }
      to { transform: translateY(20px) scale(0.95); opacity: 0; }
    }
  `;

  const container = document.createElement('div');
  container.className = 'toast-card';

  let displayTitle = item.title || 'Untitled';
  let hostDetails = 'Saved selection';

  if (item.url) {
    try {
      hostDetails = new URL(item.url).hostname;
    } catch (e) {
      hostDetails = item.url;
    }
  }

  container.innerHTML = `
    <div class="toast-header">
      <div class="toast-title">🔐 Saved to SikPoket</div>
      <button class="toast-close">×</button>
    </div>
    <div>
      <div class="item-name">${displayTitle}</div>
      <div class="item-details">${hostDetails}</div>
    </div>
    <div class="tag-section">
      <div class="tag-label">Add tags (comma separated)</div>
      <div class="tag-input-row">
        <input type="text" class="tag-input" placeholder="e.g. design, reading, recipes">
        <button class="tag-btn">Save</button>
      </div>
      <div class="success-badge">Tags saved!</div>
    </div>
  `;

  shadow.appendChild(style);
  shadow.appendChild(container);

  // Auto-close toast after 7 seconds
  let closeTimer = setTimeout(dismissToast, 7000);

  // Event handlers
  const closeBtn = shadow.querySelector('.toast-close');
  closeBtn.addEventListener('click', () => {
    clearTimeout(closeTimer);
    dismissToast();
  });

  const tagInput = shadow.querySelector('.tag-input');
  const tagBtn = shadow.querySelector('.tag-btn');
  const successBadge = shadow.querySelector('.success-badge');

  async function saveTags() {
    const rawTags = tagInput.value;
    const tags = rawTags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
    if (tags.length === 0) return;

    // Get current data
    const data = await chrome.storage.local.get(['sikpoketData']);
    const sikpoketData = data.sikpoketData || { urls: [], apiKeys: [], passwords: [], notes: [] };

    // Find the item and update tags
    const list = sikpoketData[type] || [];
    const savedItem = list.find(i => i.id === item.id);
    if (savedItem) {
      savedItem.tags = [...new Set([...(savedItem.tags || []), ...tags])];
      await chrome.storage.local.set({ sikpoketData });
      
      // Show success feedback
      successBadge.classList.add('show');
      tagInput.value = '';
      clearTimeout(closeTimer);
      setTimeout(() => {
        dismissToast();
      }, 1200);
    }
  }

  tagBtn.addEventListener('click', saveTags);
  tagInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      saveTags();
    }
    // Prevent event propagation so page keyboard shortcuts don't fire
    e.stopPropagation();
  });

  function dismissToast() {
    container.style.animation = 'fadeOut 0.25s forwards';
    container.addEventListener('animationend', () => {
      host.remove();
    });
  }
}

// Bookmarklet Custom Event Listener
window.addEventListener('sikpoket-save-request', (e) => {
  const { url, title } = e.detail || {};
  if (!url) return;
  chrome.runtime.sendMessage({
    action: 'save-item-external',
    type: 'urls',
    item: {
      id: Date.now().toString(),
      url: url,
      title: title || url,
      tags: [],
      createdAt: Date.now(),
      archived: false,
      favorite: false
    }
  });
});

