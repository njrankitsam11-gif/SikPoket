document.addEventListener('DOMContentLoaded', async () => {
  try {
  const $ = id => document.getElementById(id);
  const tabs = document.querySelectorAll('.sp-tab');
  const tabContents = document.querySelectorAll('.sp-section');
  const searchInput = $('search');
  const exportBtn = $('export-btn');
  const dashboardExportBtn = $('dashboard-export-btn');
  const lockBtn = $('lock-btn');
  const settingsBtn = $('settings-btn');
  const settingsModal = $('settings-modal');
  const syncStatus = $('sync-status');
  const filterTag = $('filter-tag');
  const filterStatus = $('filter-status');
  const sortOrder = $('sort-order');
  const tagManager = $('tag-manager');
  const urlsList = $('urls-list');
  const apiKeysList = $('api-keys-list');
  const passwordsList = $('passwords-list');
  const notesList = $('notes-list');
  const unlockOverlay = $('unlock-overlay');
  const unlockInput = $('unlock-input');
  const unlockBtn = $('unlock-btn');

  // Reader elements
  const readerOverlay = $('reader-overlay');
  const closeReader = $('close-reader');
  const readerFontToggle = $('reader-font-toggle');
  const readerFontSmaller = $('reader-font-smaller');
  const readerFontLarger = $('reader-font-larger');
  const readerTitleDisplay = $('reader-title-display');
  const readerBodyDisplay = $('reader-body-display');
  const readerLink = $('reader-link');
  const readerTime = $('reader-time');
  const readerProgress = $('reader-progress');

  let masterPassword = sessionStorage.getItem('sikpoketMasterPassword');
  let allData = { urls: [], apiKeys: [], passwords: [], notes: [] };
  let currentTab = 'urls';

  // Batch select state
  let selectMode = false;
  let selectedItems = new Set(); // Set of "type:id" strings

  // Reader State
  let currentReaderItem = null;
  let readerFontSize = parseInt(localStorage.getItem('sikpoketReaderFontSize') || '15');
  let readerFontFamily = localStorage.getItem('sikpoketReaderFontFamily') || 'sans-serif';
  let readerTheme = localStorage.getItem('sikpoketReaderTheme') || 'sepia';

  /* --- Unlock screen logic --- */
  function doUnlock(pw) {
    if (!pw) return;
    masterPassword = pw;
    sessionStorage.setItem('sikpoketMasterPassword', pw);
    unlockOverlay?.classList.remove('show');
    renderCurrentTab();
  }

  if (!masterPassword) {
    unlockOverlay?.classList.add('show');
    unlockInput?.focus();
  } else {
    unlockOverlay?.classList.remove('show');
  }

  unlockBtn?.addEventListener('click', () => {
    const pw = unlockInput?.value?.trim();
    if (!pw) { unlockInput?.classList.add('shake'); setTimeout(() => unlockInput?.classList.remove('shake'), 400); return; }
    doUnlock(pw);
  });

  unlockInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const pw = unlockInput?.value?.trim();
      if (!pw) { unlockInput?.classList.add('shake'); setTimeout(() => unlockInput?.classList.remove('shake'), 400); return; }
      doUnlock(pw);
    }
  });

  // Biometric unlock handler
  const triggerBiometrics = async () => {
    try {
      const bioCredId = localStorage.getItem('sikpoketBiometricCredId');
      const bioKey = localStorage.getItem('sikpoketBioKey');
      const wrappedRaw = localStorage.getItem('sikpoketWrappedPassword');
      if (!bioCredId || !bioKey || !wrappedRaw) return;

      // Authenticate with Touch ID / Windows Hello
      await BiometricHelper.authenticate(bioCredId);
      
      // Decrypt wrapped master password
      const wrapped = JSON.parse(wrappedRaw);
      const decrypted = await CryptoHelper.decrypt(wrapped, bioKey);
      if (decrypted && decrypted.value) {
        doUnlock(decrypted.value);
      }
    } catch (e) {
      const msg = '🔐 ' + (e.message || 'Touch ID failed');
      const go = confirm(msg + '\n\nOpen full unlock page in a new tab? (Tip uses browser tab where Touch ID works)');
      if (go) {
        if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
          chrome.tabs.create({ url: chrome.runtime.getURL('unlock.html') });
        } else {
          window.open('unlock.html', '_blank');
        }
      }
    }
  };

  const biometricUnlockBtn = $('biometric-unlock-btn');
  if (biometricUnlockBtn) {
    biometricUnlockBtn.addEventListener('click', triggerBiometrics);
  }

  // Fallback: open full unlock page in a tab
  const unlockInTabBtn = $('unlock-in-tab-btn');
  if (unlockInTabBtn) {
    unlockInTabBtn.addEventListener('click', async () => {
      if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
        const url = chrome.runtime.getURL('unlock.html');
        await chrome.tabs.create({ url });
      } else {
        window.open('unlock.html', '_blank');
      }
    });
  }

  // Auto-trigger biometric on load if enabled
  if (localStorage.getItem('sikpoketBiometricEnabled') === 'true' && typeof BiometricHelper !== 'undefined') {
    setTimeout(() => triggerBiometrics().catch(() => {}), 300);
  }

  /* --- Load data --- */
  try {
    await loadAllData();
  } catch (e) {
    console.error('Init error:', e);
  }

  /* --- Tab switching --- */
  tabs.forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  /* --- Show/hide forms --- */
  $('show-url-form')?.addEventListener('click', () => toggleForm('url'));
  $('show-api-key-form')?.addEventListener('click', () => toggleForm('api-key'));
  $('show-password-form')?.addEventListener('click', () => toggleForm('password'));
  $('show-note-form')?.addEventListener('click', () => toggleForm('note'));

  /* --- Search & filters --- */
  if (searchInput) searchInput.addEventListener('input', renderCurrentTab);
  if (filterTag) filterTag.addEventListener('change', renderCurrentTab);
  if (filterStatus) filterStatus.addEventListener('change', renderCurrentTab);
  if (sortOrder) sortOrder.addEventListener('change', renderCurrentTab);

  /* --- Filter pill buttons (drive the hidden selects) --- */
  document.querySelectorAll('.sp-pill[data-status]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sp-pill[data-status]').forEach(b => b.classList.remove('sp-pill-active'));
      btn.classList.add('sp-pill-active');
      if (filterStatus) {
        filterStatus.value = btn.dataset.status;
        filterStatus.dispatchEvent(new Event('change'));
      }
    });
  });

  /* --- Sort pill cycles through options --- */
  const sortBtn = document.getElementById('sort-btn');
  const sortLabels = { newest: 'Newest', oldest: 'Oldest', name: 'A–Z' };
  const sortKeys = ['newest', 'oldest', 'name'];
  if (sortBtn && sortOrder) {
    sortBtn.title = 'Sort: Newest';
    sortBtn.addEventListener('click', () => {
      const cur = sortOrder.value;
      const next = sortKeys[(sortKeys.indexOf(cur) + 1) % sortKeys.length];
      sortOrder.value = next;
      sortBtn.title = `Sort: ${sortLabels[next]}`;
      sortBtn.classList.toggle('pill-active', next !== 'newest');
      sortOrder.dispatchEvent(new Event('change'));
    });
  }

  /* --- Form submits --- */
  $('url-form')?.addEventListener('submit', async (e) => { e.preventDefault(); await saveUrl(); });
  $('api-key-form')?.addEventListener('submit', async (e) => { e.preventDefault(); await saveApiKey(); });
  $('password-form')?.addEventListener('submit', async (e) => { e.preventDefault(); await savePassword(); });
  $('note-form')?.addEventListener('submit', async (e) => { e.preventDefault(); await saveNote(); });

  /* --- Action buttons --- */
  $('save-article-btn')?.addEventListener('click', saveArticle);
  exportBtn?.addEventListener('click', exportData);
  dashboardExportBtn?.addEventListener('click', dashboardExport);
  lockBtn?.addEventListener('click', lock);
  settingsBtn?.addEventListener('click', () => toggleModal('settings-modal', true));

  // Select mode toggle
  $('select-mode-btn')?.addEventListener('click', toggleSelectMode);
  $('bulk-cancel')?.addEventListener('click', exitSelectMode);
  $('bulk-favorite')?.addEventListener('click', () => applyBulkAction('favorite'));
  $('bulk-archive')?.addEventListener('click', () => applyBulkAction('archive'));
  $('bulk-delete')?.addEventListener('click', () => applyBulkAction('delete'));

  // Help & User Guide triggers
  $('help-btn')?.addEventListener('click', () => toggleModal('guide-modal', true));
  $('guide-footer-btn')?.addEventListener('click', () => toggleModal('guide-modal', true));
  $('guide-open-dash-btn')?.addEventListener('click', dashboardExport);
  $('open-guide-from-settings')?.addEventListener('click', () => {
    toggleModal('settings-modal', false);
    toggleModal('guide-modal', true);
  });

  // Guide tabs switcher
  document.querySelectorAll('.sp-guide-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.sp-guide-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.sp-guide-section').forEach(s => s.classList.remove('active'));
      tab.classList.add('active');
      const targetSec = $(`guide-sec-${tab.dataset.guide}`);
      targetSec?.classList.add('active');
    });
  });

  document.querySelectorAll('.close-modal').forEach(el => {
    el.addEventListener('click', () => toggleModal(el.dataset.modal, false));
  });

  $('save-firebase-config')?.addEventListener('click', saveFirebaseConfig);
  $('clear-firebase-config')?.addEventListener('click', clearFirebaseConfig);
  $('find-duplicates-btn')?.addEventListener('click', renderDuplicates);

  /* --- Tag suggestions --- */
  setupTagSuggestions('url');
  setupTagSuggestions('api-key');
  setupTagSuggestions('password');
  setupTagSuggestions('note');

  /* --- Keyboard --- */
  document.addEventListener('keydown', handleKeyboardShortcuts);

  /* --- Wallpaper --- */
  $('wallpaper-btn')?.addEventListener('click', () => toggleModal('wallpaper-modal', true));
  initWallpaper();

  /* --- Reader Mode setup --- */
  setupReaderControls();

  /* ========== CORE ========== */

  function switchTab(name) {
    currentTab = name;
    tabs.forEach(t => t.classList.remove('active'));
    tabContents.forEach(c => c.classList.remove('active'));
    document.querySelector(`[data-tab="${name}"]`)?.classList.add('active');
    $(`${name}-content`)?.classList.add('active');
    renderCurrentTab();
  }

  function toggleForm(prefix) {
    const btn = $(`show-${prefix}-form`);
    const form = $(`${prefix}-form`);
    if (!btn || !form) return;
    const isHidden = form.classList.contains('sp-hidden') || form.classList.contains('hidden') || form.style.display === 'none' || getComputedStyle(form).display === 'none';
    if (isHidden) {
      form.classList.remove('sp-hidden');
      form.classList.remove('hidden');
      form.style.display = 'flex';
      btn.textContent = '− Cancel';
      form.querySelector('input')?.focus();
    } else {
      form.classList.add('sp-hidden');
      form.classList.add('hidden');
      form.style.display = 'none';
      btn.textContent = `+ Add ${toLabel(prefix)}`;
    }
  }

  function hideForm(prefix) {
    const btn = $(`show-${prefix}-form`);
    const form = $(`${prefix}-form`);
    if (!btn || !form) return;
    form.classList.add('sp-hidden');
    form.classList.add('hidden');
    form.style.display = 'none';
    btn.textContent = `+ Add ${toLabel(prefix)}`;
  }

  function toLabel(p) {
    return p === 'url' ? 'URL' : p === 'api-key' ? 'API Key' : p === 'password' ? 'Password' : 'Note';
  }

  async function loadAllData() {
    let raw = {};
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      raw = await chrome.storage.local.get(['sikpoketData']);
    } else {
      try {
        raw = { sikpoketData: JSON.parse(localStorage.getItem('sikpoketData')) };
      } catch {}
    }
    allData = raw?.sikpoketData || { urls: [], apiKeys: [], passwords: [], notes: [] };
    
    // Normalize data (ensure new fields are present)
    for (const key of ['urls', 'apiKeys', 'passwords', 'notes']) {
      allData[key] = (allData[key] || []).map(item => ({
        archived: false,
        favorite: false,
        tags: [],
        ...item
      }));
    }
    
    updateTabCounts();
    renderCurrentTab();
    buildTagFilter();
    renderTagManager();
    loadSyncConfig();
  }

  function updateTabCounts() {
    const map = { urls: 'urls', apiKeys: 'api-keys', passwords: 'passwords', notes: 'notes' };
    const status = filterStatus?.value || 'active';
    
    for (const [key, tabName] of Object.entries(map)) {
      const el = $(`count-${tabName}`);
      if (el) {
        let list = allData[key] || [];
        if (status === 'active') list = list.filter(item => !item.archived);
        else if (status === 'archived') list = list.filter(item => item.archived);
        else if (status === 'favorites') list = list.filter(item => item.favorite);
        el.textContent = list.length;
      }
    }
  }

  function getFilteredItems() {
    const items = {
      urls: [...allData.urls], apiKeys: [...allData.apiKeys],
      passwords: [...allData.passwords], notes: [...allData.notes]
    };
    const query = searchInput?.value.toLowerCase().trim() || '';
    const tag = filterTag?.value || '';
    const status = filterStatus?.value || 'active';
    const sort = sortOrder?.value || 'newest';

    for (const key of ['urls', 'apiKeys', 'passwords', 'notes']) {
      let list = items[key];
      
      // Filter by Archive/Active/Favorite Status
      if (status === 'active') {
        list = list.filter(item => !item.archived);
      } else if (status === 'archived') {
        list = list.filter(item => item.archived);
      } else if (status === 'favorites') {
        list = list.filter(item => item.favorite);
      }

      // Filter by Search Query
      if (query) {
        list = list.filter(item => {
          const s = [item.title || '', item.name || '', item.url || '', item.content || '', item.username || '', ...(item.tags || [])].join(' ').toLowerCase();
          return s.includes(query);
        });
      }
      
      // Filter by Tag
      if (tag) list = list.filter(item => item.tags?.includes(tag));
      
      // Sort
      list.sort((a, b) => {
        if (sort === 'oldest') return (a.createdAt || 0) - (b.createdAt || 0);
        if (sort === 'name') return (a.title || a.name || '').localeCompare(b.title || b.name || '');
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
      items[key] = list;
    }
    return items;
  }

  function renderCurrentTab() {
    const items = getFilteredItems();
    renderUrls(items.urls);
    renderApiKeys(items.apiKeys);
    renderPasswords(items.passwords);
    renderNotes(items.notes);
    updateTabCounts();
  }

  function esc(s) {
      if (!s) return '';
      const d = document.createElement('div');
      d.textContent = String(s);
      return d.innerHTML;
    }

    // ── SHARED CARD HELPERS ──────────────────────────────
    function favBtn(item) {
      return `<button class="sp-act fav-btn ${item.favorite?'fav-active':''}" data-id="${item.id}" title="Favourite">${item.favorite?'★':'☆'}</button>`;
    }
    function archBtn(item) {
      const isArc = item.archived;
      return `<button class="sp-act archive-btn" data-id="${item.id}" title="${isArc?'Restore':'Archive'}">${isArc?'↑':'↓'}</button>`;
    }
    function editBtn(item) {
      return `<button class="sp-act edit-btn" data-id="${item.id}" title="Edit tags">✎</button>`;
    }
    function delBtn(item) {
      return `<button class="sp-act delete-btn" data-id="${item.id}" title="Delete">✕</button>`;
    }
    function cardActions(item, type) {
      const reminderKey = `sikpoketReminder_${type}_${item.id}`;
      const hasReminder = !!localStorage.getItem(reminderKey);
      const remBtn = `<button class="sp-act sp-reminder-btn${hasReminder?' sp-reminder-set':''}" data-id="${item.id}" data-type="${type||''}" title="${hasReminder?'Edit reminder':'Set reminder'}">🔔</button>`;
      return `<div class="sp-card-acts" style="position:relative">${favBtn(item)}${archBtn(item)}${remBtn}${editBtn(item)}${delBtn(item)}</div>`;
    }

    function renderUrls(urls) {
      if (!urlsList) return;
      urlsList.innerHTML = urls.length === 0
        ? emptyMsg('No URLs saved yet.')
        : urls.map(u => {
            let domain = '';
            try { domain = new URL(u.url).hostname.replace(/^www\./, ''); } catch {}
            const favSrc = domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=32` : '';
            return `<div class="sp-card${selectMode?' sp-card-selectable':''}${selectedItems.has('urls:'+u.id)?' sp-selected':''}" data-id="${u.id}">
              <div class="sp-card-check"></div>
              <div class="sp-fav">
                ${favSrc
                  ? `<img src="${esc(favSrc)}" loading="lazy" alt="" onerror="this.parentNode.textContent='🔗'">`
                  : '🔗'}
              </div>
              <div class="sp-card-body">
                <a href="${esc(u.url)}" target="_blank" rel="noopener" class="sp-card-title">${esc(u.title||domain||u.url)}</a>
                <span class="sp-card-sub">${esc(domain)}</span>
                ${renderTags(u.tags)}
              </div>
              ${cardActions(u, 'urls')}
            </div>`;
          }).join('');
      attachItemHandlers('urls');
    }

  function renderApiKeys(keys) {
      if (!apiKeysList) return;
      apiKeysList.innerHTML = keys.length === 0
        ? emptyMsg('No API keys saved yet.')
        : keys.map(k => `<div class="sp-card${selectMode?' sp-card-selectable':''}${selectedItems.has('apiKeys:'+k.id)?' sp-selected':''}" data-id="${k.id}">
            <div class="sp-card-check"></div>
            <div class="sp-fav sp-fav-key"><span>🔑</span></div>
            <div class="sp-card-body">
              <span class="sp-card-title">${esc(k.name)}</span>
              <span class="sp-card-secret" data-encrypted="true">•••••••••••• copy</span>
              ${renderTags(k.tags)}
            </div>
            ${cardActions(k, 'apiKeys')}
          </div>`).join('');
      attachItemHandlers('apiKeys');
      apiKeysList.querySelectorAll('.sp-card-secret').forEach(span => {
        span.addEventListener('click', async () => {
          const id = span.closest('.sp-card')?.dataset.id;
          const item = allData.apiKeys.find(k => k.id === id);
          if (!item) return;
          try {
            const d = await CryptoHelper.decrypt(item.key, masterPassword);
            await copyToClipboard(d.value);
            span.textContent = '✅ Copied!';
            setTimeout(() => { span.textContent = '•••••••••••• copy'; }, 2000);
          } catch { alert('❌ Failed to decrypt. Wrong password?'); }
        });
      });
    }

    function renderPasswords(pwds) {
      if (!passwordsList) return;
      passwordsList.innerHTML = pwds.length === 0
        ? emptyMsg('No passwords saved yet.')
        : pwds.map(p => `<div class="sp-card${selectMode?' sp-card-selectable':''}${selectedItems.has('passwords:'+p.id)?' sp-selected':''}" data-id="${p.id}">
            <div class="sp-card-check"></div>
            <div class="sp-fav sp-fav-pwd"><span>🔒</span></div>
            <div class="sp-card-body">
              <span class="sp-card-title">${esc(p.name)}</span>
              <span class="sp-card-sub">${esc(p.username||'—')}</span>
              <span class="sp-card-secret" data-encrypted="true">•••••••• copy pwd</span>
              ${renderTags(p.tags)}
            </div>
            ${cardActions(p, 'passwords')}
          </div>`).join('');
      attachItemHandlers('passwords');
      passwordsList.querySelectorAll('.sp-card-secret').forEach(span => {
        span.addEventListener('click', async () => {
          const id = span.closest('.sp-card')?.dataset.id;
          const item = allData.passwords.find(p => p.id === id);
          if (!item) return;
          try {
            const d = await CryptoHelper.decrypt(item.password, masterPassword);
            await copyToClipboard(d.value);
            span.textContent = '✅ Copied!';
            setTimeout(() => { span.textContent = '•••••••• copy pwd'; }, 2000);
          } catch { alert('❌ Failed to decrypt. Wrong password?'); }
        });
      });
    }

    function renderNotes(notes) {
      if (!notesList) return;
      notesList.innerHTML = notes.length === 0
        ? emptyMsg('No notes saved yet.')
        : notes.map(n => {
            const isArticle = n.tags?.includes('article');
            const isHighlight = n.tags?.includes('highlight');
            const color = n.color || 'purple';
            if (isHighlight) {
              return `<div class="sp-card sp-highlight-card${selectedItems.has('notes:'+n.id)?' sp-selected':''}" data-id="${n.id}" data-color="${esc(color)}">
                <div class="sp-card-check"></div>
                <div class="sp-fav sp-fav-note"><span>&#x270D;&#xFE0F;</span></div>
                <div class="sp-card-body">
                  <span class="sp-card-title">${esc(n.title)}</span>
                  <div class="sp-highlight-quote">&ldquo;${esc((n.content||'').substring(0,120))}&rdquo;</div>
                  ${n.url ? `<div class="sp-highlight-source">&#x2197; ${esc(n.url.replace(/^https?:\/\/(www\.)?/,'').substring(0,50))}</div>` : ''}
                  <div class="sp-color-picker">
                    ${['purple','yellow','green','blue','pink'].map(c=>`<div class="sp-color-swatch${color===c?' active':''}" data-color="${c}" data-noteid="${n.id}"></div>`).join('')}
                  </div>
                  ${renderTags(n.tags.filter(t=>t!=='highlight'))}
                </div>
                ${cardActions(n, 'notes')}
              </div>`;
            }
            return `<div class="sp-card${selectMode?' sp-card-selectable':''}${selectedItems.has('notes:'+n.id)?' sp-selected':''}" data-id="${n.id}">
              <div class="sp-card-check"></div>
              <div class="sp-fav sp-fav-note"><span>${isArticle?'📄':'📝'}</span></div>
              <div class="sp-card-body">
                <span class="sp-card-title sp-card-title-clickable ${isArticle?'article-note-title':''}">${esc(n.title)}</span>
                <span class="sp-card-sub">${esc((n.content||'').substring(0,80))}${(n.content||'').length>80?'…':''}</span>
                ${renderTags(n.tags)}
              </div>
              ${cardActions(n, 'notes')}
            </div>`;
          }).join('');
      attachItemHandlers('notes');
      // Highlight color swatches
      notesList.querySelectorAll('.sp-color-swatch').forEach(sw => {
        sw.addEventListener('click', async (e) => {
          e.stopPropagation();
          const noteId = sw.dataset.noteid;
          const note = allData.notes.find(n => n.id === noteId);
          if (!note) return;
          note.color = sw.dataset.color;
          await saveAndRefresh();
        });
      });
      notesList.querySelectorAll('.sp-card-title-clickable').forEach(el => {
        el.addEventListener('click', () => {
          const id = el.closest('.sp-card')?.dataset.id;
          const note = allData.notes.find(n => n.id === id);
          if (note) openReaderMode(note);
        });
      });
    }

  function renderTags(tags) {
    if (!tags?.length) return '';
    return `<div class="sp-card-tags">${tags.map(t=>`<span class="sp-tag" data-tag="${esc(t)}">${esc(t)}</span>`).join('')}</div>`;
  }

  function emptyMsg(msg) {
    return `<div class="sp-empty"><span class="sp-empty-text">${esc(msg)}</span></div>`;
  }

  function attachItemHandlers(type) {
    const container = { urls: urlsList, apiKeys: apiKeysList, passwords: passwordsList, notes: notesList }[type];
    container?.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', () => deleteItem(btn.dataset.id, type)));
    container?.querySelectorAll('.edit-btn').forEach(btn => btn.addEventListener('click', () => editItemTags(btn.dataset.id, type)));
    container?.querySelectorAll('.fav-btn').forEach(btn => btn.addEventListener('click', () => toggleFavorite(btn.dataset.id, type)));
    container?.querySelectorAll('.archive-btn').forEach(btn => btn.addEventListener('click', () => toggleArchive(btn.dataset.id, type)));
    // Reminder buttons
    container?.querySelectorAll('.sp-reminder-btn').forEach(btn => btn.addEventListener('click', (e) => { e.stopPropagation(); openReminderPopover(btn, btn.dataset.id, btn.dataset.type || type); }));
    // Batch select checkboxes
    container?.querySelectorAll('.sp-card-check').forEach(chk => {
      chk.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!selectMode) return;
        const card = chk.closest('.sp-card');
        const key = `${type}:${card?.dataset.id}`;
        if (selectedItems.has(key)) selectedItems.delete(key);
        else selectedItems.add(key);
        card?.classList.toggle('sp-selected', selectedItems.has(key));
        updateBulkBar();
      });
    });
    container?.querySelectorAll('.sp-tag').forEach(el => {
      el.addEventListener('click', e => {
        e.stopPropagation();
        if (filterTag) filterTag.value = filterTag.value === el.dataset.tag ? '' : el.dataset.tag;
        renderCurrentTab();
      });
    });
  }

  function parseTags(val) {
    return val.split(',').map(t => t.trim().toLowerCase()).filter(t => t);
  }

  async function saveUrl() {
    let urlVal = $('url-input')?.value?.trim();
    if (!urlVal) return;
    if (!/^https?:\/\//i.test(urlVal)) {
      urlVal = 'https://' + urlVal;
    }
    let hostname = urlVal;
    try { hostname = new URL(urlVal).hostname; } catch {}
    const title = $('url-title')?.value?.trim() || hostname;
    const tags = parseTags($('url-tags')?.value || '');
    
    allData.urls.unshift({
      id: Date.now().toString(),
      url: urlVal,
      title,
      tags,
      createdAt: Date.now(),
      archived: false,
      favorite: false
    });
    
    await saveAndRefresh();
    ['url-input', 'url-title', 'url-tags'].forEach(id => { if ($(id)) $(id).value = ''; });
    hideForm('url');
  }

  async function saveApiKey() {
    const name = $('api-key-name')?.value?.trim();
    const value = $('api-key-value')?.value?.trim();
    if (!name || !value) return;
    if (!masterPassword) {
      masterPassword = prompt('Enter a master password to encrypt this API key:');
      if (!masterPassword) { alert('A master password is required to encrypt secrets.'); return; }
      sessionStorage.setItem('sikpoketMasterPassword', masterPassword);
    }
    const tags = parseTags($('api-key-tags')?.value || '');
    const key = await CryptoHelper.encrypt({ value }, masterPassword);
    
    allData.apiKeys.unshift({
      id: Date.now().toString(),
      name,
      key,
      tags,
      createdAt: Date.now(),
      archived: false,
      favorite: false
    });
    
    await saveAndRefresh();
    ['api-key-name', 'api-key-value', 'api-key-tags'].forEach(id => { if ($(id)) $(id).value = ''; });
    hideForm('api-key');
  }

  async function savePassword() {
    const name = $('password-name')?.value?.trim();
    const username = $('password-username')?.value?.trim() || '';
    const value = $('password-value')?.value?.trim();
    if (!name || !value) return;
    if (!masterPassword) {
      masterPassword = prompt('Enter a master password to encrypt this password:');
      if (!masterPassword) { alert('A master password is required to encrypt secrets.'); return; }
      sessionStorage.setItem('sikpoketMasterPassword', masterPassword);
    }
    const tags = parseTags($('password-tags')?.value || '');
    const password = await CryptoHelper.encrypt({ username, value }, masterPassword);
    
    allData.passwords.unshift({
      id: Date.now().toString(),
      name,
      username,
      password,
      tags,
      createdAt: Date.now(),
      archived: false,
      favorite: false
    });
    
    await saveAndRefresh();
    ['password-name', 'password-username', 'password-value', 'password-tags'].forEach(id => { if ($(id)) $(id).value = ''; });
    hideForm('password');
  }

  async function saveNote() {
    const title = $('note-title')?.value?.trim();
    const content = $('note-content')?.value?.trim();
    if (!title || !content) return;
    const tags = parseTags($('note-tags')?.value || '');
    
    allData.notes.unshift({
      id: Date.now().toString(),
      title,
      content,
      tags,
      createdAt: Date.now(),
      archived: false,
      favorite: false
    });
    
    await saveAndRefresh();
    ['note-title', 'note-content', 'note-tags'].forEach(id => { if ($(id)) $(id).value = ''; });
    hideForm('note');
  }

  async function saveArticle() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) { alert('No active tab found'); return; }
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const t = document.title;
          const el = document.querySelector('article') || document.querySelector('main') || document.querySelector('.content') || document.body;
          return { title: t, content: (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim().substring(0, 15000) };
        }
      });
      if (results?.[0]?.result) {
        const a = results[0].result;
        allData.notes.unshift({
          id: Date.now().toString(),
          title: a.title,
          content: a.content,
          tags: ['article'],
          createdAt: Date.now(),
          url: tab.url,
          archived: false,
          favorite: false
        });
        await saveAndRefresh();
        switchTab('notes');
        hideForm('note');
        alert('✅ Article saved!');
      } else {
        alert('❌ Could not extract article content');
      }
    } catch (e) {
      alert('❌ Error: ' + e.message);
    }
  }

  async function deleteItem(id, type) {
    if (!confirm('Delete this item?')) return;
    allData[type] = allData[type].filter(item => item.id !== id);
    await saveAndRefresh();
  }

  async function toggleFavorite(id, type) {
    const item = allData[type].find(i => i.id === id);
    if (item) {
      item.favorite = !item.favorite;
      await saveAndRefresh();
    }
  }

  async function toggleArchive(id, type) {
    const item = allData[type].find(i => i.id === id);
    if (item) {
      item.archived = !item.archived;
      await saveAndRefresh();
    }
  }

  async function editItemTags(id, type) {
    const item = allData[type].find(i => i.id === id);
    if (!item) return;
    const input = prompt('Edit tags (comma separated):', (item.tags || []).join(', '));
    if (input === null) return;
    item.tags = parseTags(input);
    await saveAndRefresh();
  }

  async function saveAndRefresh() {
    await chrome.storage.local.set({ sikpoketData: allData });
    updateTabCounts();
    renderCurrentTab();
    buildTagFilter();
    renderTagManager();
  }

  async function copyToClipboard(text) {
    try { await navigator.clipboard.writeText(text); } catch (e) { console.error('Copy failed', e); }
  }

  async function exportData() {
    const d = {
      urls: allData.urls,
      apiKeys: allData.apiKeys.map(k => ({ ...k, key: 'ENCRYPTED' })),
      passwords: allData.passwords.map(p => ({ ...p, password: 'ENCRYPTED' })),
      notes: allData.notes
    };
    const blob = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sikpoket-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function dashboardExport() {
    // Convert extension data to dashboard format (unified items array)
    const items = [];
    const typeMap = { urls: 'url', apiKeys: 'key', passwords: 'password', notes: 'note' };

    for (const u of allData.urls) {
      items.push({ id: u.id, type: 'url', url: u.url, title: u.title, tags: u.tags, createdAt: u.createdAt, archived: u.archived, favorite: u.favorite });
    }
    for (const n of allData.notes) {
      items.push({ id: n.id, type: 'note', title: n.title, content: n.content, tags: n.tags, createdAt: n.createdAt, archived: n.archived, favorite: n.favorite, url: n.url || undefined });
    }
    for (const k of allData.apiKeys) {
      try {
        const d = await CryptoHelper.decrypt(k.key, masterPassword);
        items.push({ id: k.id, type: 'key', name: k.name, value: d.value, tags: k.tags, createdAt: k.createdAt, archived: k.archived, favorite: k.favorite });
      } catch {
        items.push({ id: k.id, type: 'key', name: k.name, value: '[encrypted - wrong password]', tags: k.tags, createdAt: k.createdAt, archived: k.archived, favorite: k.favorite });
      }
    }
    for (const p of allData.passwords) {
      try {
        const d = await CryptoHelper.decrypt(p.password, masterPassword);
        items.push({ id: p.id, type: 'password', name: p.name, username: d.username, value: d.value, tags: p.tags, createdAt: p.createdAt, archived: p.archived, favorite: p.favorite });
      } catch {
        items.push({ id: p.id, type: 'password', name: p.name, username: p.username, value: '[encrypted - wrong password]', tags: p.tags, createdAt: p.createdAt, archived: p.archived, favorite: p.favorite });
      }
    }

    // Open the dashboard HTML in a new tab
    // We pass data via sessionStorage since same-origin file:// doesn't apply here
    // Instead, open dashboard and inject data message
    const dashboardUrl = chrome.runtime.getURL('dashboard/index.html');
    const tab = await chrome.tabs.create({ url: dashboardUrl });

    // Wait for dashboard to load, then send data
    setTimeout(() => {
      chrome.tabs.sendMessage(tab.id, {
        action: 'load-data',
        items: items
      }).catch(() => {
        // Content script may not be injected on extension pages
        // Fallback: use chrome.storage as a bridge
        chrome.storage.local.set({ sikpoketDashboardData: items });
      });
    }, 800);
  }

  function lock() {
    masterPassword = null;
    sessionStorage.removeItem('sikpoketMasterPassword');
    if (unlockInput) unlockInput.value = '';
    unlockOverlay?.classList.add('show');
    unlockInput?.focus();
    renderCurrentTab();
  }

  /* --- Tag Management --- */

  function getAllTags() {
    const set = new Set();
    for (const key of ['urls', 'apiKeys', 'passwords', 'notes']) {
      for (const item of allData[key]) {
        if (item.tags) item.tags.forEach(t => set.add(t));
      }
    }
    return [...set].sort();
  }

  function buildTagFilter() {
    const tags = getAllTags();
    if (filterTag) {
      filterTag.innerHTML = '<option value="">All Tags</option>' + tags.map(t => `<option value="${t}">${esc(t)}</option>`).join('');
    }
    buildTagSuggestions();
  }

  function buildTagSuggestions() {
    const tags = getAllTags();
    document.querySelectorAll('.tag-suggestions').forEach(el => {
      el.innerHTML = tags.map(t => `<div class="tag-suggestion" data-tag="${t}">${esc(t)}</div>`).join('');
      el.querySelectorAll('.tag-suggestion').forEach(s => {
        s.addEventListener('click', () => {
          const input = el.parentElement.querySelector('input');
          if (!input) return;
          const existing = input.value.split(',').map(x => x.trim()).filter(Boolean);
          if (!existing.includes(s.dataset.tag)) { existing.push(s.dataset.tag); input.value = existing.join(', '); }
          el.classList.remove('show');
          input.focus();
        });
      });
    });
  }

  function setupTagSuggestions(prefix) {
    const input = $(`${prefix}-tags`);
    const suggestions = $(`${prefix}-tag-suggestions`);
    if (!input || !suggestions) return;
    input.addEventListener('focus', () => { if (getAllTags().length > 0) suggestions.classList.add('show'); });
    input.addEventListener('input', () => {
      const val = input.value.toLowerCase();
      suggestions.querySelectorAll('.tag-suggestion').forEach(el => {
        el.style.display = el.dataset.tag.toLowerCase().includes(val) ? 'block' : 'none';
      });
      suggestions.classList.add('show');
    });
    input.addEventListener('blur', () => setTimeout(() => suggestions.classList.remove('show'), 200));
  }

  function renderTagManager() {
    if (!tagManager) return;
    const tags = getAllTags();
    if (tags.length === 0) {
      tagManager.innerHTML = '<p style="color:#666;font-size:11px;">No tags yet.</p>';
      return;
    }
    tagManager.innerHTML = tags.map(t => {
      const count = Object.values(allData).flat().filter(i => i.tags?.includes(t)).length;
      return `<div class="tag-manager-item">
        <span class="tag-manager-name" data-tag="${t}">${esc(t)} <span class="tag-manager-count">(${count})</span></span>
        <div class="tag-manager-actions">
          <button class="tag-manager-btn rename-tag" data-tag="${t}">✏️</button>
          <button class="tag-manager-btn danger delete-tag" data-tag="${t}">✕</button>
        </div>
      </div>`;
    }).join('');
    tagManager.querySelectorAll('.tag-manager-name').forEach(el => {
      el.addEventListener('click', () => {
        if (filterTag) filterTag.value = el.dataset.tag;
        renderCurrentTab();
        toggleModal('settings-modal', false);
      });
    });
    tagManager.querySelectorAll('.rename-tag').forEach(btn => {
      btn.addEventListener('click', async () => {
        const old = btn.dataset.tag;
        const next = prompt('Rename tag to:', old);
        if (!next || next === old) return;
        const norm = next.trim().toLowerCase();
        for (const key of ['urls', 'apiKeys', 'passwords', 'notes']) {
          for (const item of allData[key]) {
            if (item.tags) { const idx = item.tags.indexOf(old); if (idx !== -1) item.tags[idx] = norm; }
          }
        }
        await saveAndRefresh();
        renderTagManager();
      });
    });
    tagManager.querySelectorAll('.delete-tag').forEach(btn => {
      btn.addEventListener('click', async () => {
        const tag = btn.dataset.tag;
        if (!confirm(`Remove tag "${tag}" from all items?`)) return;
        for (const key of ['urls', 'apiKeys', 'passwords', 'notes']) {
          for (const item of allData[key]) {
            if (item.tags) item.tags = item.tags.filter(t => t !== tag);
          }
        }
        await saveAndRefresh();
        renderTagManager();
      });
    });
  }

  /* --- Cloud Sync config --- */

  function loadSyncConfig() {
    try {
      const c = localStorage.getItem('sikpoketFirebaseConfig');
      if (c && $('firebase-config')) $('firebase-config').value = JSON.stringify(JSON.parse(c), null, 2);
    } catch {}
  }

  function saveFirebaseConfig() {
    try {
      const config = JSON.parse($('firebase-config')?.value?.trim() || '');
      localStorage.setItem('sikpoketFirebaseConfig', JSON.stringify(config));
      alert('✅ Firebase config saved. Reload to apply.');
    } catch { alert('❌ Invalid JSON. Please paste the full Firebase config object.'); }
  }

  function clearFirebaseConfig() {
    localStorage.removeItem('sikpoketFirebaseConfig');
    if ($('firebase-config')) $('firebase-config').value = '';
    if (syncStatus) { syncStatus.textContent = ''; syncStatus.className = 'sync-status'; }
    alert('Firebase config cleared.');
  }

  /* --- Keyboard Shortcuts --- */

  function handleKeyboardShortcuts(e) {
    const ctrl = e.ctrlKey || e.metaKey;
    const guideModal = $('guide-modal');
    if (e.key === 'Escape') {
      if (readerOverlay?.classList.contains('show')) { closeReaderView(); e.preventDefault(); return; }
      if (guideModal?.classList.contains('show')) { toggleModal('guide-modal', false); e.preventDefault(); return; }
      if (settingsModal?.classList.contains('show')) { toggleModal('settings-modal', false); e.preventDefault(); return; }
      if (selectMode) { exitSelectMode(); e.preventDefault(); return; }
      if (searchInput?.value) { searchInput.value = ''; renderCurrentTab(); e.preventDefault(); }
      return;
    }
    if (ctrl && e.key === 'f') { e.preventDefault(); searchInput?.focus(); searchInput?.select(); return; }
    if (ctrl && (e.key === 'l' || e.key === 'L')) { e.preventDefault(); lock(); return; }
    if (ctrl && (e.key === 'b' || e.key === 'B')) { e.preventDefault(); toggleSelectMode(); return; }
    if (ctrl && (e.key === 'h' || e.key === 'H')) { e.preventDefault(); toggleModal('guide-modal', true); return; }
    if (e.key === '?' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
      e.preventDefault();
      toggleModal('guide-modal', true);
      return;
    }
    if (ctrl && ['1', '2', '3', '4'].includes(e.key)) {
      e.preventDefault();
      switchTab(['urls', 'api-keys', 'passwords', 'notes'][parseInt(e.key) - 1]);
    }
  }

  function toggleModal(id, show) {
    const el = $(id);
    if (!el) return;
    if (show) { el.classList.add('show'); renderTagManager(); }
    else el.classList.remove('show');
  }

  /* --- Reader Mode Logic --- */

  function setupReaderControls() {
    closeReader?.addEventListener('click', closeReaderView);
    
    // Font switch: Aa
    readerFontToggle?.addEventListener('click', () => {
      readerFontFamily = readerFontFamily === 'sans-serif' ? 'serif' : 'sans-serif';
      localStorage.setItem('sikpoketReaderFontFamily', readerFontFamily);
      applyReaderStyles();
    });

    // Font size controls
    readerFontSmaller?.addEventListener('click', () => {
      if (readerFontSize > 11) {
        readerFontSize -= 1;
        localStorage.setItem('sikpoketReaderFontSize', readerFontSize);
        applyReaderStyles();
      }
    });

    readerFontLarger?.addEventListener('click', () => {
      if (readerFontSize < 28) {
        readerFontSize += 1;
        localStorage.setItem('sikpoketReaderFontSize', readerFontSize);
        applyReaderStyles();
      }
    });

    // Theme switches
    document.querySelectorAll('.theme-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        readerTheme = btn.dataset.theme;
        localStorage.setItem('sikpoketReaderTheme', readerTheme);
        applyReaderStyles();
      });
    });

    // Reading Scroll Progress
    const wrap = document.querySelector('.reader-content-wrap');
    wrap?.addEventListener('scroll', () => {
      const totalHeight = wrap.scrollHeight - wrap.clientHeight;
      if (totalHeight > 0) {
        const scrolled = (wrap.scrollTop / totalHeight) * 100;
        if (readerProgress) readerProgress.style.width = `${scrolled}%`;
      } else {
        if (readerProgress) readerProgress.style.width = '0%';
      }
    });
  }

  function openReaderMode(note) {
    currentReaderItem = note;
    
    if (readerTitleDisplay) readerTitleDisplay.textContent = note.title;
    
    // Render content beautifully
    if (readerBodyDisplay) {
      // Split paragraphs by double newline and wrap in HTML tags
      const paragraphs = (note.content || '').split('\n').filter(p => p.trim());
      readerBodyDisplay.innerHTML = paragraphs.map(p => `<p>${esc(p)}</p>`).join('');
    }

    // Read time calculation
    const words = (note.content || '').split(/\s+/).length;
    const time = Math.max(1, Math.ceil(words / 200));
    if (readerTime) readerTime.textContent = `${time} min read`;

    // Original link
    if (readerLink) {
      if (note.url) {
        readerLink.href = note.url;
        readerLink.style.display = 'inline-block';
      } else {
        readerLink.style.display = 'none';
      }
    }

    applyReaderStyles();
    
    // Show overlay
    readerOverlay?.classList.add('show');
    
    // Reset scroll & progress bar
    const wrap = document.querySelector('.reader-content-wrap');
    if (wrap) wrap.scrollTop = 0;
    if (readerProgress) readerProgress.style.width = '0%';
  }

  function applyReaderStyles() {
    if (!readerOverlay) return;
    
    // Clear existing overlay classes for themes
    readerOverlay.className = 'reader-overlay show';
    readerOverlay.classList.add(`theme-${readerTheme}`);

    // Font Family
    if (readerBodyDisplay) {
      readerBodyDisplay.style.fontFamily = readerFontFamily === 'serif' ? 'Georgia, Merriweather, serif' : "'Inter', system-ui, sans-serif";
      readerBodyDisplay.style.fontSize = `${readerFontSize}px`;
    }

    // Active theme tab styling
    document.querySelectorAll('.theme-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === readerTheme);
    });
  }

  function closeReaderView() {
    readerOverlay?.classList.remove('show');
    currentReaderItem = null;
  }

  // --- Biometric/Touch ID Settings Logic ---
  const toggleBiometricBtn = $('toggle-biometric-btn');
  const settingsBiometricSection = $('settings-biometric-section');

  const checkBiometricAvailability = async () => {
    // Always reveal the fingerprint settings section; on macOS the platform authenticator
    // works only in a full tab, so we direct the user there.
    if (settingsBiometricSection) {
      // The HTML uses the "sp-hidden" class to hide sections initially.
      // Remove that class so the fingerprint settings become visible.
      settingsBiometricSection.classList.remove('sp-hidden');
      settingsBiometricSection.classList.remove('hidden'); // safety fallback
    }
    // Adjust button to open the unlock page in a new tab.
    const btn = document.getElementById('toggle-biometric-btn');
    if (btn) {
      btn.textContent = '👁 Set Up Fingerprint (opens tab)';
      btn.onclick = async () => {
        // Open unlock.html in a new tab where Touch ID works.
        chrome.tabs.create({ url: chrome.runtime.getURL('unlock.html') });
      };
    }
  };

  const updateBiometricSettingsUI = () => {
    if (!toggleBiometricBtn) return;
    const isEnabled = localStorage.getItem('sikpoketBiometricEnabled') === 'true';
    if (isEnabled) {
      toggleBiometricBtn.textContent = '🔴 Disable Fingerprint Unlock';
      toggleBiometricBtn.className = 'settings-btn danger';
      biometricUnlockBtn?.classList.remove('hidden');
    } else {
      toggleBiometricBtn.textContent = '👁️ Set Up Fingerprint';
      toggleBiometricBtn.className = 'settings-btn';
      biometricUnlockBtn?.classList.add('hidden');
    }
  };

  toggleBiometricBtn?.addEventListener('click', async () => {
    const isEnabled = localStorage.getItem('sikpoketBiometricEnabled') === 'true';
    if (isEnabled) {
      // Disable biometric unlock
      localStorage.removeItem('sikpoketBiometricEnabled');
      localStorage.removeItem('sikpoketBiometricCredId');
      localStorage.removeItem('sikpoketBioKey');
      localStorage.removeItem('sikpoketWrappedPassword');
      alert('Fingerprint unlock disabled.');
      updateBiometricSettingsUI();
    } else {
      // Enable biometric unlock
      try {
        if (!masterPassword) {
          alert('You must unlock SikPoket with your master password first.');
          return;
        }
        toggleBiometricBtn.disabled = true;
        toggleBiometricBtn.textContent = 'Registering fingerprint...';
        
        const credential = await BiometricHelper.register();
        if (credential && credential.id) {
          // Generate key to wrap master password
          const bioKey = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
          const wrapped = await CryptoHelper.encrypt({ value: masterPassword }, bioKey);
          
          localStorage.setItem('sikpoketBiometricEnabled', 'true');
          localStorage.setItem('sikpoketBiometricCredId', credential.id);
          localStorage.setItem('sikpoketBioKey', bioKey);
          localStorage.setItem('sikpoketWrappedPassword', JSON.stringify(wrapped));
          
          alert('✅ Touch ID / Fingerprint registered successfully!');
        }
      } catch (e) {
        console.error('Biometric registration error:', e);
        const reason = 'Touch ID setup failed in popup. Open SikPoket in a tab to register.';
        const go = confirm('❌ ' + e.message + '\n\nOpen SikPoket unlock page in a new tab to try again?');
        if (go) {
          chrome.tabs.create({ url: chrome.runtime.getURL('unlock.html') });
        }
      } finally {
        toggleBiometricBtn.disabled = false;
        updateBiometricSettingsUI();
      }
    }
  });

  // Biometric availability check (after unlock + after function definition)
  checkBiometricAvailability();

  /* =========================================================
     MODULE: BATCH SELECT
  ========================================================= */
  function toggleSelectMode() {
    selectMode = !selectMode;
    selectedItems.clear();
    const btn = $('select-mode-btn');
    btn?.classList.toggle('sp-active', selectMode);
    const shell = document.querySelector('.sp-shell');
    shell?.classList.toggle('sp-select-mode', selectMode);
    if (!selectMode) {
      $('bulk-bar')?.classList.add('sp-hidden');
    } else {
      $('bulk-bar')?.classList.remove('sp-hidden');
      updateBulkBar();
    }
    renderCurrentTab();
  }

  function exitSelectMode() {
    selectMode = false;
    selectedItems.clear();
    $('select-mode-btn')?.classList.remove('sp-active');
    document.querySelector('.sp-shell')?.classList.remove('sp-select-mode');
    $('bulk-bar')?.classList.add('sp-hidden');
    renderCurrentTab();
  }

  function updateBulkBar() {
    const count = selectedItems.size;
    const el = $('bulk-count');
    if (el) el.textContent = `${count} selected`;
  }

  async function applyBulkAction(action) {
    if (selectedItems.size === 0) return;
    if (action === 'delete' && !confirm(`Delete ${selectedItems.size} item(s)?`)) return;
    for (const key of selectedItems) {
      const [type, id] = key.split(':');
      if (!type || !id || !allData[type]) continue;
      const item = allData[type].find(i => i.id === id);
      if (!item) continue;
      if (action === 'favorite') item.favorite = !item.favorite;
      else if (action === 'archive') item.archived = !item.archived;
      else if (action === 'delete') allData[type] = allData[type].filter(i => i.id !== id);
    }
    await saveAndRefresh();
    exitSelectMode();
  }

  /* =========================================================
     MODULE: DUPLICATE DETECTOR
  ========================================================= */
  function findDuplicates() {
    const seen = {};
    for (const u of allData.urls) {
      const key = (u.url || '').replace(/\/$/, '').toLowerCase();
      if (!key) continue;
      (seen[key] = seen[key] || []).push(u);
    }
    return Object.values(seen).filter(g => g.length > 1);
  }

  function renderDuplicates() {
    const result = $('duplicates-result');
    if (!result) return;
    const groups = findDuplicates();
    result.classList.remove('sp-hidden');
    if (groups.length === 0) {
      result.innerHTML = `<div class="sp-dup-no-dupes">✅ No duplicate URLs found!</div>`;
      return;
    }
    result.innerHTML = groups.map((group, gi) => {
      let domain = '';
      try { domain = new URL(group[0].url).hostname.replace(/^www\./, ''); } catch { domain = group[0].url; }
      const items = group.map(u => `<div class="sp-dup-item">• ${esc(u.title || u.url)}</div>`).join('');
      return `<div class="sp-dup-group">
        <div class="sp-dup-group-header">
          <span class="sp-dup-domain">${esc(domain)}</span>
          <span class="sp-dup-badge">${group.length} copies</span>
        </div>
        <div class="sp-dup-items">${items}</div>
        <div class="sp-dup-actions">
          <button class="sp-dup-btn" data-gi="${gi}" data-action="keep">Keep Newest</button>
          <button class="sp-dup-btn danger" data-gi="${gi}" data-action="delete-all">Delete All</button>
        </div>
      </div>`;
    }).join('');
    result.querySelectorAll('.sp-dup-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const gi = parseInt(btn.dataset.gi);
        const action = btn.dataset.action;
        const groups2 = findDuplicates();
        const group = groups2[gi];
        if (!group) return;
        if (action === 'keep') {
          group.sort((a,b) => (b.createdAt||0) - (a.createdAt||0));
          const toDelete = group.slice(1).map(u => u.id);
          allData.urls = allData.urls.filter(u => !toDelete.includes(u.id));
        } else if (action === 'delete-all') {
          if (!confirm(`Delete all ${group.length} copies?`)) return;
          const ids = group.map(u => u.id);
          allData.urls = allData.urls.filter(u => !ids.includes(u.id));
        }
        await saveAndRefresh();
        renderDuplicates();
      });
    });
  }

  /* =========================================================
     MODULE: REMINDERS
  ========================================================= */
  let activeReminderPopover = null;

  function openReminderPopover(btn, itemId, type) {
    activeReminderPopover?.remove();
    activeReminderPopover = null;

    const reminderKey = `sikpoketReminder_${type}_${itemId}`;
    const existing = localStorage.getItem(reminderKey);

    const popover = document.createElement('div');
    popover.className = 'sp-reminder-popover';
    const existingVal = existing ? new Date(parseInt(existing)).toISOString().slice(0,16) : '';
    popover.innerHTML = `
      <label>Set Reminder</label>
      <input type="datetime-local" id="reminder-dt-input" value="${esc(existingVal)}">
      <button class="sp-reminder-save" id="reminder-save-btn">Set Reminder</button>
      ${existing ? '<button class="sp-reminder-clear" id="reminder-clear-btn">Remove reminder</button>' : ''}
    `;
    btn.closest('.sp-card-acts').appendChild(popover);
    activeReminderPopover = popover;

    popover.querySelector('#reminder-save-btn')?.addEventListener('click', async () => {
      const dtVal = popover.querySelector('#reminder-dt-input')?.value;
      if (!dtVal) return;
      const dueAt = new Date(dtVal).getTime();
      if (isNaN(dueAt) || dueAt <= Date.now()) { alert('Please set a future date/time.'); return; }
      localStorage.setItem(reminderKey, dueAt.toString());
      const alarmName = `sikpoket_reminder_${type}_${itemId}`;
      if (chrome.alarms) await chrome.alarms.create(alarmName, { when: dueAt });
      btn.classList.add('sp-reminder-set');
      popover.remove(); activeReminderPopover = null;
    });

    popover.querySelector('#reminder-clear-btn')?.addEventListener('click', async () => {
      localStorage.removeItem(reminderKey);
      const alarmName = `sikpoket_reminder_${type}_${itemId}`;
      if (chrome.alarms) await chrome.alarms.clear(alarmName);
      btn.classList.remove('sp-reminder-set');
      popover.remove(); activeReminderPopover = null;
    });

    setTimeout(() => {
      document.addEventListener('click', function handler(e) {
        if (!popover.contains(e.target) && e.target !== btn) {
          popover.remove(); activeReminderPopover = null;
          document.removeEventListener('click', handler);
        }
      });
    }, 0);
  }

  function handleAlarm(alarm) {
    if (!alarm.name?.startsWith('sikpoket_reminder_')) return;
    const withoutPrefix = alarm.name.replace('sikpoket_reminder_', '');
    const underscoreIdx = withoutPrefix.indexOf('_');
    if (underscoreIdx === -1) return;
    const type = withoutPrefix.substring(0, underscoreIdx);
    const id = withoutPrefix.substring(underscoreIdx + 1);
    const item = allData[type]?.find(i => i.id === id);
    const title = item?.title || item?.name || 'SikPoket Item';
    chrome.notifications?.create(alarm.name, {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon48.png'),
      title: '🔔 SikPoket Reminder',
      message: title
    });
    localStorage.removeItem(`sikpoketReminder_${type}_${id}`);
  }

  /* =========================================================
     MODULE: WALLPAPER
  ========================================================= */
  const WALLPAPER_PRESETS = [
    { name: 'Cyberpunk',   url: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80' },
    { name: 'Lo-Fi Cozy',  url: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&q=80' },
    { name: 'Deep Nebula', url: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=800&q=80' },
    { name: 'Forest',      url: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=800&q=80' },
    { name: 'Sunset',      url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80' },
    { name: 'Deep Ocean',  url: 'https://images.unsplash.com/photo-1518020382113-a7e8fc38eac9?w=800&q=80' },
    { name: 'Aurora',      url: 'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=800&q=80' },
    { name: 'City Rain',   url: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=800&q=80' },
    { name: 'Minimal',     url: 'https://images.unsplash.com/photo-1493246507139-91e8fad9978e?w=800&q=80' },
  ];

  function applyWallpaperToDOM(url, opacity) {
    const shell = document.querySelector('.sp-shell');
    if (!shell) return;
    if (url) {
      shell.style.setProperty('--wallpaper-url', `url("${url}")`);
    } else {
      shell.style.setProperty('--wallpaper-url', 'none');
    }
    shell.style.setProperty('--wallpaper-opacity', (opacity / 100).toFixed(2));
  }

  async function initWallpaper() {
    // Load saved wallpaper from storage
    let wpUrl = '', wpOpacity = 30;
    try {
      const res = await chrome.storage.local.get(['sikpoketWallpaperUrl', 'sikpoketWallpaperOpacity']);
      wpUrl     = res.sikpoketWallpaperUrl || '';
      wpOpacity = res.sikpoketWallpaperOpacity ?? 30;
    } catch { /* fallback — extension context not ready */ }

    applyWallpaperToDOM(wpUrl, wpOpacity);

    // Build preset grid
    const grid = $('wallpaper-preset-grid');
    if (grid) {
      grid.innerHTML = WALLPAPER_PRESETS.map((p, i) => `
        <div class="sp-wallpaper-swatch${wpUrl === p.url ? ' active' : ''}"
             style="background-image:url('${p.url}')"
             data-url="${esc(p.url)}" data-idx="${i}" title="${esc(p.name)}">
          <span>${esc(p.name)}</span>
        </div>`).join('');

      grid.querySelectorAll('.sp-wallpaper-swatch').forEach(sw => {
        sw.addEventListener('click', async () => {
          const url     = sw.dataset.url;
          const opacity = parseInt($('wallpaper-opacity')?.value || '30');
          applyWallpaperToDOM(url, opacity);
          await chrome.storage.local.set({ sikpoketWallpaperUrl: url, sikpoketWallpaperOpacity: opacity });
          grid.querySelectorAll('.sp-wallpaper-swatch').forEach(s => s.classList.remove('active'));
          sw.classList.add('active');
          if ($('wallpaper-custom-url')) $('wallpaper-custom-url').value = '';
        });
      });
    }

    // Opacity slider — live preview
    const opacitySlider = $('wallpaper-opacity');
    if (opacitySlider) {
      opacitySlider.value = wpOpacity;
      opacitySlider.addEventListener('input', async () => {
        const opacity = parseInt(opacitySlider.value);
        const currentUrl = (await chrome.storage.local.get('sikpoketWallpaperUrl')).sikpoketWallpaperUrl || '';
        applyWallpaperToDOM(currentUrl, opacity);
        await chrome.storage.local.set({ sikpoketWallpaperOpacity: opacity });
      });
    }

    // Custom URL apply
    $('wallpaper-apply-url')?.addEventListener('click', async () => {
      const url = $('wallpaper-custom-url')?.value?.trim();
      if (!url) return;
      const opacity = parseInt($('wallpaper-opacity')?.value || '30');
      applyWallpaperToDOM(url, opacity);
      await chrome.storage.local.set({ sikpoketWallpaperUrl: url, sikpoketWallpaperOpacity: opacity });
      // Deselect all presets
      document.querySelectorAll('.sp-wallpaper-swatch').forEach(s => s.classList.remove('active'));
    });

    // Clear wallpaper
    $('wallpaper-clear-btn')?.addEventListener('click', async () => {
      applyWallpaperToDOM('', 30);
      await chrome.storage.local.set({ sikpoketWallpaperUrl: '', sikpoketWallpaperOpacity: 30 });
      document.querySelectorAll('.sp-wallpaper-swatch').forEach(s => s.classList.remove('active'));
      if ($('wallpaper-custom-url')) $('wallpaper-custom-url').value = '';
      if ($('wallpaper-opacity'))    $('wallpaper-opacity').value    = '30';
    });
  }

  } catch (e) { console.error('SikPoket init error:', e); }
});
