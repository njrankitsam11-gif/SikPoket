/* =====================================================
   SikPoket Dashboard — Spaces + Wallpapers
   ===================================================== */

// Use user-scoped storage key + add logout 

const TYPE_META = {
  url:{icon:'🔗',label:'URL',placeholder:'🔗'},
  note:{icon:'📝',label:'Note',placeholder:'📝'},
  key:{icon:'🔑',label:'API Key',placeholder:'🔑'},
  password:{icon:'🔒',label:'Password',placeholder:'🔒'}
};

let state = {
  spaces: [],       // [{id, name, wallpaper, items}]
  activeSpace: null, // space id
  collection: 'all',
  tag: null,
  search: '',
  sort: 'newest',
  viewMode: 'grid',
  editId: null
};


document.getElementById('global-search')?.addEventListener('input', (e) => {
  state.search = e.target.value.trim().toLowerCase();
  render();
});

function getActiveSpace() {
  return state.spaces.find(s => s.id === state.activeSpace) || state.spaces[0] || null;
}

async function load() {
  try {
    let raw = null;
    if (typeof chrome !== 'undefined' && chrome.storage) {
      const res = await chrome.storage.local.get(['sikpoketDashboardData']);
      if (res.sikpoketDashboardData) raw = JSON.stringify(res.sikpoketDashboardData);
    } else {
      raw = localStorage.getItem('sikpoketDashboardData');
    }
    const data = raw ? JSON.parse(raw) : null;
    if (data && data.spaces) {
      state.spaces = data.spaces.map(s => ({ ...s, theme: s.theme || 'default', items: (s.items||[]).filter(i => !i._removed) }));
      state.activeSpace = data.activeSpace || (state.spaces[0]?.id || null);
    } else if (data && Array.isArray(data)) {
      // migrate old flat items format
      state.spaces = [{ id: genId(), name: 'Default', wallpaper: '', items: data }];
      state.activeSpace = state.spaces[0].id;
    }
  } catch { state.spaces = []; state.activeSpace = null; }

  if (!state.spaces.length) {
    seedDemo();
  } else {
    const defaults = {
      'Startups': 'https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=1600&q=80',
      'Research': 'https://images.unsplash.com/photo-1507693769325-4b6d49b0ba76?w=1600&q=80',
      'Personal': 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1600&q=80'
    };
    state.spaces.forEach(s => {
      if (!s.wallpaper && defaults[s.name]) {
        s.wallpaper = defaults[s.name];
        if (s.wallpaperOpacity === undefined) s.wallpaperOpacity = 25;
      }
    });
  }
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.local.get(['sikpoketData'], (r) => {

      // The popup stores data as { urls: [...], apiKeys: [...], passwords: [...], notes: [...] }
      if (r.sikpoketData) {
        let newItems = [];
        const typeMap = { 'urls': 'url', 'apiKeys': 'key', 'passwords': 'password', 'notes': 'note' };
        for (const [pluralKey, singularType] of Object.entries(typeMap)) {
          if (r.sikpoketData[pluralKey]) {
            newItems = newItems.concat(r.sikpoketData[pluralKey].map(item => ({...item, type: singularType})));
          }
        }
        if (newItems.length > 0) {

        const space = getActiveSpace(); if (space) space.items = [...newItems, ...space.items];
        chrome.storage.local.remove('sikpoketData');
        }
        save(); render(); updateBadges(); renderSidebarTags();
      }
    });
  }
}

async function save() {
  const data = { spaces: state.spaces, activeSpace: state.activeSpace };
  if (typeof chrome !== 'undefined' && chrome.storage) {
    await chrome.storage.local.set({ sikpoketDashboardData: data });
  } else {
    localStorage.setItem('sikpoketDashboardData', JSON.stringify(data));
  }
}
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
const WALLPAPER_PRESETS = [
  // Minimal & Abstract
  { id: 'none', name: 'Pure Dark', mood: 'Minimal', category: 'minimal', thumb: '', url: '' },
  { id: 'minimal-obsidian', name: 'Matte Obsidian', mood: 'Dark', category: 'minimal', thumb: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=400&q=80', url: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=1920&q=80' },
  { id: 'minimal-prism', name: 'Dark Prism', mood: 'Prism', category: 'minimal', thumb: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&q=80', url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1920&q=80' },
  { id: 'minimal-silk', name: 'Liquid Silk', mood: 'Smooth', category: 'minimal', thumb: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=400&q=80', url: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=1920&q=80' },
  { id: 'minimal-studio', name: 'Modern Studio', mood: 'Studio', category: 'minimal', thumb: 'https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=400&q=80', url: 'https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=1920&q=80' },

  // 🌸 Anime & Pixel Art
  { id: 'anime-ghibli', name: 'Ghibli Meadow', mood: 'Dreamy', category: 'anime', thumb: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=400&q=80', url: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=1920&q=80' },
  { id: 'anime-synthwave', name: 'Synthwave Sunset', mood: 'Retro', category: 'anime', thumb: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=400&q=80', url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=1920&q=80' },
  { id: 'anime-sakura', name: 'Kyoto Sakura', mood: 'Peaceful', category: 'anime', thumb: 'https://images.unsplash.com/photo-1528164344705-475426879c0d?w=400&q=80', url: 'https://images.unsplash.com/photo-1528164344705-475426879c0d?w=1920&q=80' },
  { id: 'anime-neonstreet', name: 'Akihabara Neon', mood: 'Electric', category: 'anime', thumb: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=400&q=80', url: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=1920&q=80' },
  { id: 'anime-fuji', name: 'Mount Fuji Dusk', mood: 'Zen', category: 'anime', thumb: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=400&q=80', url: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=1920&q=80' },
  { id: 'anime-pixelroom', name: 'Twilight Room', mood: 'Vibe', category: 'anime', thumb: 'https://images.unsplash.com/photo-1511447333015-45b65e60f6d5?w=400&q=80', url: 'https://images.unsplash.com/photo-1511447333015-45b65e60f6d5?w=1920&q=80' },
  { id: 'anime-rainy', name: 'Anime Rain', mood: 'Moody', category: 'anime', thumb: 'https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?w=400&q=80', url: 'https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?w=1920&q=80' },

  // 🌲 Nature & Landscapes
  { id: 'nature-alpine', name: 'Nordic Alpine', mood: 'Majestic', category: 'nature', thumb: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400&q=80', url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1920&q=80' },
  { id: 'nature-forest', name: 'Misty Pines', mood: 'Calm', category: 'nature', thumb: 'https://images.unsplash.com/photo-1507693769325-4b6d49b0ba76?w=400&q=80', url: 'https://images.unsplash.com/photo-1507693769325-4b6d49b0ba76?w=1920&q=80' },
  { id: 'nature-ocean', name: 'Emerald Breaker', mood: 'Serene', category: 'nature', thumb: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=400&q=80', url: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=1920&q=80' },
  { id: 'nature-sunset-dunes', name: 'Golden Dunes', mood: 'Warm', category: 'nature', thumb: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&q=80', url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920&q=80' },
  { id: 'nature-aurora', name: 'Aurora Borealis', mood: 'Ethereal', category: 'nature', thumb: 'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=400&q=80', url: 'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=1920&q=80' },
  { id: 'nature-autumn', name: 'Autumn Maple', mood: 'Cozy', category: 'nature', thumb: 'https://images.unsplash.com/photo-1508873696983-2df5293cb32f?w=400&q=80', url: 'https://images.unsplash.com/photo-1508873696983-2df5293cb32f?w=1920&q=80' },
  { id: 'nature-waterfall', name: 'Black Waterfall', mood: 'Dramatic', category: 'nature', thumb: 'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?w=400&q=80', url: 'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?w=1920&q=80' },
  { id: 'nature-bigsur', name: 'Pacific Coast Fog', mood: 'Atmospheric', category: 'nature', thumb: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=400&q=80', url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1920&q=80' },

  // 🌌 Cosmos & Space
  { id: 'space-nebula', name: 'Cosmic Nebula', mood: 'Deep', category: 'cosmos', thumb: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=400&q=80', url: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=1920&q=80' },
  { id: 'space-milkyway', name: 'Milky Way Sky', mood: 'Stargaze', category: 'cosmos', thumb: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&q=80', url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1920&q=80' },
  { id: 'space-moon', name: 'Supermoon Eclipse', mood: 'Lunar', category: 'cosmos', thumb: 'https://images.unsplash.com/photo-1532693322450-2cb5c511067d?w=400&q=80', url: 'https://images.unsplash.com/photo-1532693322450-2cb5c511067d?w=1920&q=80' },
  { id: 'space-earth', name: 'Earth Orbit', mood: 'Orbit', category: 'cosmos', thumb: 'https://images.unsplash.com/photo-1614728894747-a83421e2b9c9?w=400&q=80', url: 'https://images.unsplash.com/photo-1614728894747-a83421e2b9c9?w=1920&q=80' },
  { id: 'space-starlight', name: 'Andromeda Stars', mood: 'Infinity', category: 'cosmos', thumb: 'https://images.unsplash.com/photo-1502134249126-9f3755a50d78?w=400&q=80', url: 'https://images.unsplash.com/photo-1502134249126-9f3755a50d78?w=1920&q=80' },
  { id: 'space-mars', name: 'Martian Horizon', mood: 'Alien', category: 'cosmos', thumb: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&q=80', url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1920&q=80' },

  // 🏙️ Urban & Cyberpunk
  { id: 'city-cyberpunk', name: 'Cyberpunk 2077', mood: 'Cyber', category: 'city', thumb: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400&q=80', url: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1920&q=80' },
  { id: 'city-hongkong', name: 'Hong Kong Neon', mood: 'Neon', category: 'city', thumb: 'https://images.unsplash.com/photo-1514565131-fce0801e5785?w=400&q=80', url: 'https://images.unsplash.com/photo-1514565131-fce0801e5785?w=1920&q=80' },
  { id: 'city-nyc', name: 'Manhattan Dusk', mood: 'Metro', category: 'city', thumb: 'https://images.unsplash.com/photo-1496868834840-5f4c98840aaa?w=400&q=80', url: 'https://images.unsplash.com/photo-1496868834840-5f4c98840aaa?w=1920&q=80' },
  { id: 'city-seoul', name: 'Seoul Night Market', mood: 'Vibrant', category: 'city', thumb: 'https://images.unsplash.com/photo-1538485399081-7191377e8241?w=400&q=80', url: 'https://images.unsplash.com/photo-1538485399081-7191377e8241?w=1920&q=80' },
  { id: 'city-london', name: 'London Fog Bridge', mood: 'Classic', category: 'city', thumb: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=400&q=80', url: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=1920&q=80' },
  { id: 'city-sf', name: 'Bay Bridge Lights', mood: 'Coastal', category: 'city', thumb: 'https://images.unsplash.com/photo-1506146332389-18140dc7b2fb?w=400&q=80', url: 'https://images.unsplash.com/photo-1506146332389-18140dc7b2fb?w=1920&q=80' },

  // ☕ Cozy & Lo-Fi
  { id: 'lofi-study', name: 'Lo-Fi Desk & Plants', mood: 'Focus', category: 'cozy', thumb: 'https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=400&q=80', url: 'https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=1920&q=80' },
  { id: 'lofi-coffee', name: 'Warm Espresso', mood: 'Cozy', category: 'cozy', thumb: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=400&q=80', url: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=1920&q=80' },
  { id: 'lofi-library', name: 'Vintage Library', mood: 'Books', category: 'cozy', thumb: 'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?w=400&q=80', url: 'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?w=1920&q=80' },
  { id: 'lofi-vinyl', name: 'Vinyl Player & Lamp', mood: 'Acoustic', category: 'cozy', thumb: 'https://images.unsplash.com/photo-1539185441755-769473a23570?w=400&q=80', url: 'https://images.unsplash.com/photo-1539185441755-769473a23570?w=1920&q=80' },
  { id: 'lofi-fireplace', name: 'Cabin Fireplace', mood: 'Warmth', category: 'cozy', thumb: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=400&q=80', url: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=1920&q=80' },
  { id: 'lofi-coding', name: 'Midnight Coding Desk', mood: 'Hacker', category: 'cozy', thumb: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=400&q=80', url: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1920&q=80' }
];

async function setWallpaper() {
  const activeSpaceObj = getActiveSpace();
  if(activeSpaceObj && activeSpaceObj.theme) {
    document.documentElement.setAttribute('data-theme', activeSpaceObj.theme);
    if (activeSpaceObj.theme === 'custom') {
      document.documentElement.style.setProperty('--primary', activeSpaceObj.customAccent || '#7c6af7');
      document.documentElement.style.setProperty('--bg', activeSpaceObj.customBg || '#0c0e12');
      document.documentElement.style.setProperty('--panel-bg', activeSpaceObj.customBg || '#0c0e12');
    } else {
      document.documentElement.style.removeProperty('--primary');
      document.documentElement.style.removeProperty('--bg');
      document.documentElement.style.removeProperty('--panel-bg');
    }
    if(typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set({ sikpoketActiveTheme: activeSpaceObj.theme });
    }
  }
  const el = document.getElementById('wallpaper-bg');
  const space = getActiveSpace();
  if (!el) return;

  if (space?.wallpaper) {
    const opacity = space.wallpaperOpacity !== undefined ? (space.wallpaperOpacity / 100) : 0.25;
    const blur    = space.wallpaperBlur    !== undefined ? space.wallpaperBlur : 0;
    el.style.backgroundImage = `url("${space.wallpaper}")`;
    el.style.opacity = String(opacity);
    el.style.filter  = blur > 0 ? `blur(${blur}px)` : 'none';
  } else {
    el.style.opacity = '0';
    el.style.filter  = 'none';
    el.style.backgroundImage = '';
  }
}

function getFiltered() {
  let items = [];
  if (state.search.trim()) {
    // Search across ALL spaces
    state.spaces.forEach(sp => {
      items = items.concat(sp.items.map(i => ({...i, _spaceName: sp.name})));
    });
  } else {
    // Only current space
    const space = getActiveSpace();
    if (!space) return [];
    items = [...space.items];
  }
  if (state.collection === 'highlights') items = items.filter(i => (i.tags||[]).includes('highlight') && !i.archived);
  else if (state.collection === 'broken') {
    // Broken items are stored in state.brokenIds (populated by scanBrokenLinks)
    const brokenIds = state.brokenIds || new Set();
    items = items.filter(i => i.type === 'url' && brokenIds.has(i.id));
  }
  else if (state.collection === 'favorites') items = items.filter(i => i.favorite && !i.archived);
  else if (state.collection === 'archived') items = items.filter(i => i.archived);
  else if (['urls','notes','keys','passwords'].includes(state.collection)) {
    const m = { urls:'url', notes:'note', keys:'key', passwords:'password' };
    items = items.filter(i => i.type === m[state.collection] && !i.archived);
  } else items = items.filter(i => !i.archived);
  if (state.tag) items = items.filter(i => i.tags && i.tags.includes(state.tag));
  if (state.search.trim()) {
    const q = state.search.trim().toLowerCase();
    items = items.filter(i => (i.title||'').toLowerCase().includes(q) || (i.url||'').toLowerCase().includes(q) || (i.name||'').toLowerCase().includes(q) || (i.content||'').toLowerCase().includes(q) || (i.tags||[]).some(t=>t.toLowerCase().includes(q)));
  }
  if (state.sort === 'newest') items.sort((a,b)=>b.createdAt-a.createdAt);
  else if (state.sort === 'oldest') items.sort((a,b)=>a.createdAt-b.createdAt);
  else if (state.sort === 'name') items.sort((a,b)=>(a.title||a.name||'').localeCompare(b.title||b.name||''));
  return items;
}

function updateBadges() {
  const space = getActiveSpace(); if (!space) return;
  const a = space.items.filter(i => !i.archived);
  setBdg('badge-all', a.length);
  setBdg('badge-favorites', a.filter(i=>i.favorite).length);
  setBdg('badge-archived', space.items.filter(i=>i.archived).length);
  setBdg('badge-urls', a.filter(i=>i.type==='url').length);
  setBdg('badge-notes', a.filter(i=>i.type==='note').length);
  setBdg('badge-keys', a.filter(i=>i.type==='key').length);
  setBdg('badge-passwords', a.filter(i=>i.type==='password').length);
  setBdg('badge-highlights', a.filter(i=>(i.tags||[]).includes('highlight')).length);
  const brokenCount = state.brokenIds?.size ?? '—';
  setBdg('badge-broken', brokenCount === '—' ? '—' : brokenCount);
  renderSidebarTags();
}
function setBdg(id, n) { const e = document.getElementById(id); if(e) e.textContent = n; }

function updateSpaceList() {
  const c = document.getElementById('space-list'); if (!c) return;
  c.innerHTML = state.spaces.map(s => `
    <div class="space-item ${s.id===state.activeSpace?'active':''}" data-space="${s.id}">
      <span class="space-dot"></span>
      <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(s.name)}</span>
      <span class="space-count">${(s.items||[]).filter(i=>!i.archived).length}</span>
      <button class="space-wallpaper-btn" data-space-id="${s.id}" title="Change space atmosphere">🖼</button>
    </div>
  `).join('');
  c.querySelectorAll('.space-item').forEach(b => b.addEventListener('click', (e) => {
    if (e.target.closest('.space-wallpaper-btn')) return;
    state.activeSpace = b.dataset.space; state.collection = 'all'; state.tag = null; updateTagStrip();
    save(); setWallpaper(); render(); updateSpaceList(); updateBadges();
  }));
  c.querySelectorAll('.space-wallpaper-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openSpaceSettings(btn.dataset.spaceId);
    });
  });
}

function renderSidebarTags() {
  const c = document.getElementById('sidebar-tags'); if (!c) return;
  const space = getActiveSpace(); if (!space) return;
  const t = {}; space.items.filter(i=>!i.archived).forEach(i=>(i.tags||[]).forEach(tg=>t[tg]=(t[tg]||0)+1));
  const tags = Object.entries(t).sort((a,b)=>b[1]-a[1]);
  if (!tags.length) { c.innerHTML = '<div style="padding:6px 10px;font-size:11px;color:var(--muted);">No tags yet</div>'; return; }
  c.innerHTML = tags.map(([tag,n]) => `<button class="sidebar-tag-btn ${state.tag===tag?'active':''}" data-tag="${esc(tag)}"><span class="sidebar-tag-dot"></span><span>${esc(tag)}</span><span class="sidebar-tag-count">${n}</span></button>`).join('');
  c.querySelectorAll('.sidebar-tag-btn').forEach(b => b.addEventListener('click', () => { state.tag = state.tag===b.dataset.tag?null:b.dataset.tag; updateTagStrip(); render(); }));
}
const updateSidebarTags = renderSidebarTags;

function updateTagStrip() {
  const s = document.getElementById('tag-strip'), v = document.getElementById('tag-strip-value');
  if (state.tag) { s.classList.remove('hidden'); if(v) v.textContent = state.tag; } else s.classList.add('hidden');
}

function getFaviconUrl(url) { try { return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=64`; } catch { return null; } }

function faviconEl(item) {
  const m = TYPE_META[item.type]||TYPE_META.url;
  if (item.type==='url'&&item.url) {
    const s = getFaviconUrl(item.url);
    if (s) return `<div class="card-favicon"><img src="${esc(s)}" alt="" loading="lazy" onerror="this.parentNode.innerHTML='<span class=card-favicon-placeholder>${m.placeholder}</span>'"></div>`;
  }
  return `<div class="card-favicon"><span class="card-favicon-placeholder">${m.icon}</span></div>`;
}


function parseMarkdown(text) {
  if (!text) return '';
  let html = esc(text);
  // Bold
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  // Italic
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  // Headers (H1, H2, H3)
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
  // Lists
  html = html.replace(/^\- (.*$)/gim, '<ul><li>$1</li></ul>');
  html = html.replace(/<\/ul>\n<ul>/g, '\n');
  return html;
}

function cardHtml(item, lm) {
  const date = new Date(item.createdAt).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'2-digit'});

  const spaceBadge = item._spaceName ? `<div style="font-size: 10px; opacity: 0.7; margin-bottom: 4px; color: var(--accent);">In Space: ${esc(item._spaceName)}</div>` : '';

  let th = item.type==='url'&&item.url ? `<a class="card-title" href="${esc(item.url)}" target="_blank" rel="noopener">${esc(item.title||item.url)}</a>` : `<span class="card-title">${esc(item.title||item.name||'Untitled')}</span>`;
  let dh = ''; if(item.type==='url'&&item.url) try{dh=`<span class="card-domain">${new URL(item.url).hostname}</span>`}catch{} else if((item.type==='key'||item.type==='password')&&item.username)dh=`<span class="card-domain">${esc(item.username)}</span>`;
  let bh = ''; if(item.type==='note'&&item.content)bh=`<div class="card-excerpt markdown-content">${parseMarkdown(item.content)}</div>`; else if((item.type==='key'||item.type==='password')&&item.value)bh=`<div class="card-secret" data-id="${item.id}" data-action="copy-secret" title="Click to copy secret">🔒 <span>${'•'.repeat(Math.min(item.value.length,14))}</span></div>`;
  const thtml = (item.tags||[]).length?`<div class="card-tags">${item.tags.map(t=>`<span class="card-tag" data-tag="${esc(t)}">${esc(t)}</span>`).join('')}</div>`:'';
  return `<div class="item-card ${lm?'list-mode':''}" data-id="${item.id}"><div class="card-body">${spaceBadge}<div class="card-title-row">${faviconEl(item)}<div class="card-title-block">${th}${dh}</div></div>${bh}${thtml}</div><div class="card-footer"><span class="card-date">${date}</span><div class="card-actions"><button class="card-action-btn${item.favorite?' fav-active':''}" data-action="fav" data-id="${item.id}" title="${item.favorite?'Favorited':'Favorite'}">${item.favorite?'★':'☆'}</button><button class="card-action-btn" data-action="archive" data-id="${item.id}" title="${item.archived?'Restore':'Archive'}">${item.archived?'📤':'📥'}</button><button class="card-action-btn" data-action="edit" data-id="${item.id}" title="Edit">✏️</button><button class="card-action-btn delete-btn" data-action="delete" data-id="${item.id}" title="Delete">✕</button></div></div></div>`;
}

function attachCardEventDelegation() {
  const area = document.getElementById('content-area');
  if (!area || area._hasDelegation) return;
  area._hasDelegation = true;

  area.addEventListener('click', (e) => {
    const actBtn = e.target.closest('[data-action]');
    if (actBtn) {
      e.stopPropagation();
      const action = actBtn.dataset.action;
      const id = actBtn.dataset.id;
      if (action === 'fav') toggleFav(id);
      else if (action === 'archive') toggleArchive(id);
      else if (action === 'edit') openEdit(id);
      else if (action === 'delete') confirmDelete(id);
      else if (action === 'copy-secret') copySecret(id);
      return;
    }

    const tagEl = e.target.closest('.card-tag');
    if (tagEl) {
      e.stopPropagation();
      filterTag(tagEl.dataset.tag);
      return;
    }
  });
}

function render() {
  const a = document.getElementById('content-area'), vt = document.getElementById('view-title'), vc = document.getElementById('view-count');
  if (!a) return; const space = getActiveSpace(); if (!space) return;
  attachCardEventDelegation();
  const items = getFiltered(), lm = state.viewMode==='list', mm = state.viewMode==='masonry';
  const titles = {all:'All Items',favorites:'Favorites',archived:'Archive',urls:'URLs',notes:'Notes',keys:'API Keys',passwords:'Passwords',highlights:'Highlights',broken:'Broken Links',guide:'How to Use SikPoket'};
  if(vt) vt.textContent = state.tag?`#${state.tag}`:(titles[state.collection]||'All Items');
  if(vc) vc.textContent = state.collection==='guide' ? '6 Modules Guide' : `${items.length} item${items.length!==1?'s':''}`;

  // Guide View: Render comprehensive documentation
  if (state.collection === 'guide') {
    renderDashboardGuide(a);
    document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.collection===state.collection));
    updateSidebarTags(); updateBadges(); setWallpaper();
    return;
  }

  // Broken Links view: trigger scan if not done
  if (state.collection === 'broken' && !state.brokenScanDone) {
    a.innerHTML = '<div class="empty-state"><div class="empty-icon">🔍</div><div class="empty-title">Scanning links…</div><div class="empty-desc">Checking all URLs for broken links. This may take a moment.</div></div>';
    scanBrokenLinks();
    return;
  }

  if(!items.length) { a.innerHTML = `<div class="empty-state"><div class="empty-icon">${state.search?'🔍':state.collection==='broken'?'✅':'🗂️'}</div><div class="empty-title">${state.search?'No results':state.collection==='broken'?'No broken links found!':'Nothing here yet'}</div><div class="empty-desc">${state.search?`Nothing matches "${esc(state.search)}"`:state.collection==='broken'?'All your saved URLs appear to be working.':'Add your first item with + Add above.'}</div></div>`; return; }
  const layoutClass = lm ? 'items-list' : mm ? 'items-masonry' : 'items-grid';
  a.innerHTML = `<div class="${layoutClass}">${items.map(i=>cardHtml(i,lm)).join('')}</div>`;
  document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.collection===state.collection));
  updateSidebarTags(); updateBadges(); setWallpaper();
}

window.toggleFav = id => { const s=getActiveSpace(); if(!s)return; const i=s.items.find(x=>x.id===id); if(i){i.favorite=!i.favorite;save();render();}};
window.toggleArchive = id => { const s=getActiveSpace(); if(!s)return; const i=s.items.find(x=>x.id===id); if(i){i.archived=!i.archived;save();render();toast(i.archived?'Archived':'Restored','success');}};
window.confirmDelete = id => { const s=getActiveSpace(); if(!s)return; const i=s.items.find(x=>x.id===id); if(!i)return; if(confirm(`Delete "${i.title||i.name}"?`)){s.items=s.items.filter(x=>x.id!==id);save();render();toast('Deleted','error');}};
window.copySecret = id => { const s=getActiveSpace(); if(!s)return; const i=s.items.find(x=>x.id===id); if(!i||!i.value)return; navigator.clipboard.writeText(i.value).then(()=>toast('Copied!','success')).catch(()=>toast('Copy failed','error'));};
window.filterTag = t => { state.tag=state.tag===t?null:t; updateTagStrip(); render(); };

function openAdd() {
  state.editId=null; document.getElementById('item-id').value=''; document.getElementById('item-form').reset();
  document.getElementById('item-type').value='url'; document.getElementById('modal-title').textContent='Add Item';
  document.getElementById('modal-type-pills').style.display='flex';
  document.querySelectorAll('.type-pill').forEach(p=>p.classList.remove('active'));
  document.querySelector('.type-pill[data-type="url"]').classList.add('active');
  showTypeFields('url'); document.getElementById('item-modal').classList.remove('hidden');
  setTimeout(()=>document.getElementById('form-url')?.focus(),100);
}
window.openEdit = id => { const s=getActiveSpace(); if(!s)return; const i=s.items.find(x=>x.id===id); if(!i)return; state.editId=id;
  document.getElementById('modal-title').textContent='Edit Item'; document.getElementById('modal-type-pills').style.display='none';
  document.getElementById('item-id').value=id; document.getElementById('item-type').value=i.type; showTypeFields(i.type);
  if(i.type==='url'){document.getElementById('form-url').value=i.url||'';document.getElementById('form-title').value=i.title||'';}
  else if(i.type==='note'){document.getElementById('form-title').value=i.title||'';document.getElementById('form-content').value=i.content||'';}
  else if(i.type==='key'){document.getElementById('form-name').value=i.name||'';document.getElementById('form-value').value=i.value||'';}
  else if(i.type==='password'){document.getElementById('form-name').value=i.name||'';document.getElementById('form-username').value=i.username||'';document.getElementById('form-value').value=i.value||'';}
  document.getElementById('form-tags').value=(i.tags||[]).join(', '); document.getElementById('item-modal').classList.remove('hidden');
};
function closeModal() { document.getElementById('item-modal').classList.add('hidden'); state.editId=null; }
function showTypeFields(type) {
  ['url','name','title','username','value','content'].forEach(f=>document.getElementById(`field-${f}`)?.classList.add('hidden'));
  if(type==='url')['url','title'].forEach(f=>document.getElementById(`field-${f}`)?.classList.remove('hidden'));
  else if(type==='note')['title','content'].forEach(f=>document.getElementById(`field-${f}`)?.classList.remove('hidden'));
  else if(type==='key')['name','value'].forEach(f=>document.getElementById(`field-${f}`)?.classList.remove('hidden'));
  else if(type==='password')['name','username','value'].forEach(f=>document.getElementById(`field-${f}`)?.classList.remove('hidden'));
}
function handleFormSubmit(e) {
  e.preventDefault(); const s=getActiveSpace(); if(!s)return;
  const type=document.getElementById('item-type').value;
  const tags=document.getElementById('form-tags').value.split(',').map(t=>t.trim()).filter(Boolean);
  let i = state.editId?s.items.find(x=>x.id===state.editId):null;
  if(!i){i={id:genId(),type,createdAt:Date.now(),favorite:false,archived:false};s.items.unshift(i);}
  i.tags=tags;i.type=type;
  if(type==='url'){i.url=document.getElementById('form-url').value.trim();i.title=document.getElementById('form-title').value.trim()||i.url;}
  else if(type==='note'){i.title=document.getElementById('form-title').value.trim()||'Untitled Note';i.content=document.getElementById('form-content').value.trim();}
  else if(type==='key'){i.name=document.getElementById('form-name').value.trim();i.value=document.getElementById('form-value').value.trim();}
  else if(type==='password'){i.name=document.getElementById('form-name').value.trim();i.username=document.getElementById('form-username').value.trim();i.value=document.getElementById('form-value').value.trim();}
  save();closeModal();render();toast(state.editId?'Updated!':'Saved!','success');
}

/* ── SPACES & WALLPAPER STUDIO ─────────── */

function renderWallpaperPresets(currentUrl, activeCategory = 'all') {
  const grid = document.getElementById('wallpaper-preset-grid');
  if (!grid) return;
  
  const filtered = activeCategory === 'all'
    ? WALLPAPER_PRESETS
    : WALLPAPER_PRESETS.filter(p => p.category === activeCategory);

  grid.innerHTML = filtered.map(p => {
    const isSelected = p.url === currentUrl || (!p.url && !currentUrl);
    const bgStyle = p.thumb ? `style="background-image:url('${p.thumb}')"` : '';
    return `
      <div class="wallpaper-preset-card ${isSelected ? 'selected' : ''}" data-url="${esc(p.url)}" data-name="${esc(p.name)}" data-category="${esc(p.category)}">
        <div class="preset-thumb" ${bgStyle}>
          ${!p.thumb ? '<span class="preset-none-icon">🚫</span>' : ''}
        </div>
        <div class="preset-info">
          <span class="preset-name" title="${esc(p.name)}">${esc(p.name)}</span>
          <span class="preset-mood">${esc(p.mood)}</span>
        </div>
      </div>
    `;
  }).join('');

  grid.querySelectorAll('.wallpaper-preset-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.wallpaper-preset-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      const url = card.dataset.url || '';
      document.getElementById('space-wallpaper').value = url;
      document.getElementById('space-wallpaper-url-input').value = url;
      document.getElementById('local-file-name').textContent = 'Supports JPG, PNG, WEBP, GIF (stored locally)';
      updateWallpaperLivePreview(url);

      // Instantly update main page background for instant visual feedback
      const el = document.getElementById('wallpaper-bg');
      if (el) {
        const opacityVal = (parseInt(document.getElementById('space-wallpaper-opacity')?.value || '30')) / 100;
        const blurVal = parseInt(document.getElementById('space-wallpaper-blur')?.value || '0');
        if (url) {
          el.style.backgroundImage = `url("${url}")`;
          el.style.opacity = String(opacityVal);
          el.style.filter = blurVal > 0 ? `blur(${blurVal}px)` : 'none';
        } else {
          el.style.opacity = '0';
          el.style.backgroundImage = '';
        }
      }
    });
  });
}

function updateWallpaperLivePreview(customUrl) {
  const preview = document.getElementById('wallpaper-live-preview');
  if (!preview) return;
  const url = customUrl !== undefined ? customUrl : (document.getElementById('space-wallpaper')?.value || '');
  const opacityVal = (parseInt(document.getElementById('space-wallpaper-opacity')?.value || '30')) / 100;
  const blurVal = parseInt(document.getElementById('space-wallpaper-blur')?.value || '0');
  
  if (url) {
    preview.style.backgroundImage = `linear-gradient(rgba(12,14,18,${1 - opacityVal}), rgba(12,14,18,${1 - opacityVal})), url("${url}")`;
    preview.style.filter = blurVal > 0 ? `blur(${blurVal}px)` : 'none';
  } else {
    preview.style.backgroundImage = 'none';
    preview.style.filter = 'none';
  }
}

function setupWallpaperStudioControls() {
  const fileInput = document.getElementById('space-wallpaper-file');
  fileInput?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(evt) {
      const dataUrl = evt.target.result;
      document.getElementById('space-wallpaper').value = dataUrl;
      document.getElementById('space-wallpaper-url-input').value = `Local: ${file.name}`;
      document.getElementById('local-file-name').textContent = `✅ Loaded: ${file.name} (${Math.round(file.size/1024)} KB)`;
      document.querySelectorAll('.wallpaper-preset-card').forEach(c => c.classList.remove('selected'));
      updateWallpaperLivePreview(dataUrl);

      const el = document.getElementById('wallpaper-bg');
      if (el) {
        const opacityVal = (parseInt(document.getElementById('space-wallpaper-opacity')?.value || '30')) / 100;
        el.style.backgroundImage = `url("${dataUrl}")`;
        el.style.opacity = String(opacityVal);
      }
      toast('Local image loaded!', 'success');
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('space-wallpaper-url-input')?.addEventListener('input', (e) => {
    const val = e.target.value.trim();
    if (!val.startsWith('Local:')) {
      document.getElementById('space-wallpaper').value = val;
      document.querySelectorAll('.wallpaper-preset-card').forEach(c => {
        c.classList.toggle('selected', c.dataset.url === val);
      });
      updateWallpaperLivePreview(val);
      const el = document.getElementById('wallpaper-bg');
      if (el) {
        const opacityVal = (parseInt(document.getElementById('space-wallpaper-opacity')?.value || '30')) / 100;
        if (val) {
          el.style.backgroundImage = `url("${val}")`;
          el.style.opacity = String(opacityVal);
        } else {
          el.style.opacity = '0';
        }
      }
    }
  });

  const opacitySlider = document.getElementById('space-wallpaper-opacity');
  opacitySlider?.addEventListener('input', (e) => {
    document.getElementById('opacity-val').textContent = e.target.value + '%';
    updateWallpaperLivePreview();
    const url = document.getElementById('space-wallpaper')?.value || '';
    const el = document.getElementById('wallpaper-bg');
    if (el && url) {
      el.style.opacity = String(parseInt(e.target.value) / 100);
    }
  });

  const blurSlider = document.getElementById('space-wallpaper-blur');
  blurSlider?.addEventListener('input', (e) => {
    document.getElementById('blur-val').textContent = e.target.value + 'px';
    updateWallpaperLivePreview();
    const url = document.getElementById('space-wallpaper')?.value || '';
    const el = document.getElementById('wallpaper-bg');
    if (el && url) {
      el.style.filter = parseInt(e.target.value) > 0 ? `blur(${e.target.value}px)` : 'none';
    }
  });

  // Bundle category tabs
  document.querySelectorAll('.bundle-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.bundle-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const bundle = tab.dataset.bundle || 'all';
      const currentUrl = document.getElementById('space-wallpaper')?.value || '';
      renderWallpaperPresets(currentUrl, bundle);
    });
  });
}

window.openSpaceSettings = function(id) {
  const space = state.spaces.find(s => s.id === id); if (!space) return;
  document.getElementById('space-edit-id').value = id;
  document.getElementById('space-name').value = space.name;
  if(document.getElementById('space-theme')) document.getElementById('space-theme').value = space.theme || 'default';
  const currentWp = space.wallpaper || '';
  document.getElementById('space-wallpaper').value = currentWp;
  document.getElementById('space-wallpaper-url-input').value = currentWp.startsWith('data:') ? 'Local Image Attached' : currentWp;
  
  const opacity = space.wallpaperOpacity !== undefined ? space.wallpaperOpacity : 35;
  const blur = space.wallpaperBlur !== undefined ? space.wallpaperBlur : 0;
  document.getElementById('space-wallpaper-opacity').value = opacity;
  document.getElementById('opacity-val').textContent = opacity + '%';
  document.getElementById('space-wallpaper-blur').value = blur;
  document.getElementById('blur-val').textContent = blur + 'px';
  document.getElementById('local-file-name').textContent = currentWp.startsWith('data:') ? '✅ Custom Local Image Stored' : 'Supports JPG, PNG, WEBP, GIF (stored locally)';

  document.getElementById('space-modal-title').textContent = `Edit "${space.name}" Atmosphere`;
  renderWallpaperPresets(currentWp);
  updateWallpaperLivePreview(currentWp);
  document.getElementById('space-modal').classList.remove('hidden');
  document.getElementById('space-name').focus();
};

window.closeSpaceModal = function() {
  const m = document.getElementById('space-modal');
  if (m) m.classList.add('hidden');
  setWallpaper();
};
const closeSpaceModal = window.closeSpaceModal;

function openAddSpace() {
  document.getElementById('space-edit-id').value = '';
  document.getElementById('space-name').value = '';
  document.getElementById('space-wallpaper').value = '';
  document.getElementById('space-wallpaper-url-input').value = '';
  document.getElementById('space-wallpaper-opacity').value = 35;
  document.getElementById('opacity-val').textContent = '35%';
  document.getElementById('space-wallpaper-blur').value = 0;
  document.getElementById('blur-val').textContent = '0px';
  document.getElementById('local-file-name').textContent = 'Supports JPG, PNG, WEBP, GIF (stored locally)';
  
  document.getElementById('space-form').reset();
  document.getElementById('space-modal-title').textContent = 'Create Space with Mood Wallpaper';
  renderWallpaperPresets('');
  updateWallpaperLivePreview('');
  document.getElementById('space-modal').classList.remove('hidden');
  document.getElementById('space-name').focus();
}

window.handleSpaceSubmit = function(e) {
  e.preventDefault();
  const name = document.getElementById('space-name').value.trim();
  const theme = document.getElementById('space-theme').value;
  const customAccent = document.getElementById('theme-accent-color').value;
  const customBg = document.getElementById('theme-bg-color').value;
  if (!name) return;
  const wallpaper = document.getElementById('space-wallpaper').value.trim();
  const opacity = parseInt(document.getElementById('space-wallpaper-opacity').value) || 35;
  const blur = parseInt(document.getElementById('space-wallpaper-blur').value) || 0;
  const editId = document.getElementById('space-edit-id').value;

  if (editId) {
    const s = state.spaces.find(x => x.id === editId);
    if (s) {
      s.name = name;
      s.theme = theme;
      if (theme === 'custom') {
        s.customAccent = customAccent;
        s.customBg = customBg;
      }
      s.wallpaper = wallpaper;
      s.wallpaperOpacity = opacity;
      s.wallpaperBlur = blur;
    }
    state.activeSpace = editId;
  } else {
    const ns = {
      customAccent: theme === 'custom' ? customAccent : undefined,
      customBg: theme === 'custom' ? customBg : undefined,
      id: genId(),
      name,
      theme,
      wallpaper,
      wallpaperOpacity: opacity,
      wallpaperBlur: blur,
      items: []
    };
    state.spaces.push(ns);
    state.activeSpace = ns.id;
  }
  save(); updateSpaceList(); setWallpaper(); render(); updateBadges();
  closeSpaceModal();
  toast(editId ? 'Space & wallpaper updated!' : 'Space created with wallpaper!', 'success');
};

function deleteActiveSpace() {
  if (state.spaces.length <= 1) { toast('Cannot delete only space', 'error'); return; }
  const idx = state.spaces.findIndex(s=>s.id===state.activeSpace);
  if (!confirm(`Delete "${state.spaces[idx].name}" and all its items?`)) return;
  state.spaces.splice(idx,1);
  state.activeSpace = state.spaces[0].id;
  save(); updateSpaceList(); setWallpaper(); render(); updateBadges();
  toast('Space deleted','error');
}

/* ── EXPORT/IMPORT ───────────────────── */

/* ── EXPORT/IMPORT ───────────────────── */
function exportItems() {
  const dataToExport = { version: 2, spaces: state.spaces, activeSpace: state.activeSpace };

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['sikpoketData'], (res) => {
      dataToExport.popupData = res.sikpoketData || {};
      downloadJson(dataToExport);
    });
  } else {
    downloadJson(dataToExport);
  }
}

function downloadJson(data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sikpoket-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Exported!', 'success');
}

function importFile(e) {
  const f = e.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = async function(ev) {
    try {
      const d = JSON.parse(ev.target.result);
      if (d.spaces) {
        d.spaces.forEach(ns => {
          const ex = state.spaces.find(s => s.id === ns.id);
          if (ex) {
            ex.items = [...ns.items, ...ex.items];
            ex.name = ns.name || ex.name;
            ex.wallpaper = ns.wallpaper || ex.wallpaper;
            ex.wallpaperOpacity = ns.wallpaperOpacity;
            ex.wallpaperBlur = ns.wallpaperBlur;
          } else state.spaces.push(ns);
        });
      }
      else if (d.items || Array.isArray(d)) {
        const s = getActiveSpace();
        if (s) s.items = [...(d.items || d), ...s.items];
      }

      if (d.activeSpace) state.activeSpace = d.activeSpace;

      if (d.popupData && typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({ sikpoketData: d.popupData });
      }

      save(); updateSpaceList(); setWallpaper(); render(); updateBadges(); toast('Imported!', 'success');
    } catch {
      toast('Invalid file', 'error');
    }
  };
  r.readAsText(f);
  e.target.value = '';
}

function toast(m,t){const el=document.getElementById('toast');if(!el)return;el.textContent=m;el.className=`toast show ${t||''}`;clearTimeout(el._t);el._t=setTimeout(()=>el.classList.remove('show'),2500);}
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}

/* ── SEED ──────────────────────────── */
function seedDemo() {
  state.spaces = [
    {id:genId(),name:'Startups',wallpaper:'https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=1600&q=80',wallpaperOpacity:20,wallpaperBlur:0,items:[{id:genId(),type:'url',createdAt:Date.now()-432000000,title:'Raindrop.io',url:'https://raindrop.io',tags:['tools','productivity'],favorite:true,archived:false},{id:genId(),type:'url',createdAt:Date.now()-259200000,title:'MDN Web Docs',url:'https://developer.mozilla.org',tags:['dev','reference']},{id:genId(),type:'note',createdAt:Date.now()-86400000,title:'Q3 Review',content:'Key takeaways from the quarterly review — increase retention and ship by August.',tags:['work'],favorite:true}]},
    {id:genId(),name:'Research',wallpaper:'https://images.unsplash.com/photo-1507693769325-4b6d49b0ba76?w=1600&q=80',wallpaperOpacity:18,wallpaperBlur:2,items:[{id:genId(),type:'url',createdAt:Date.now()-36000000,title:'arXiv: Machine Learning Papers',url:'https://arxiv.org/list/cs.LG/recent',tags:['papers','ai']},{id:genId(),type:'note',createdAt:Date.now()-7200000,title:'Research Ideas',content:'Explore transformer architectures for edge devices.',tags:['ideas','ai']},{id:genId(),type:'note',createdAt:Date.now()-21600000,title:'Competitor Analysis',content:'Notion, Obsidian, Raindrop — all solving the same problem from different angles.',tags:['competitive']}]},
    {id:genId(),name:'Personal',wallpaper:'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1600&q=80',wallpaperOpacity:22,wallpaperBlur:0,items:[{id:genId(),type:'url',createdAt:Date.now()-60000,title:'Netflix',url:'https://netflix.com',tags:['entertainment']},{id:genId(),type:'password',createdAt:Date.now()-3600000,name:'GitHub',username:'sam@example.com',value:'my-secret-password-prod',tags:['dev']}]},
  ];
  state.activeSpace = state.spaces[0].id;
  save();
  setWallpaper();
}

/* ── INIT ──────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  await load();
  updateSpaceList();
  setupWallpaperStudioControls();

  document.querySelectorAll('.nav-item[data-collection]').forEach(b => b.addEventListener('click',()=>{state.collection=b.dataset.collection;state.tag=null;updateTagStrip();render();}));
  document.getElementById('global-search').addEventListener('input',e=>{state.search=e.target.value;render();});
  document.getElementById('sort-select').addEventListener('change',e=>{state.sort=e.target.value;render();});
  document.getElementById('view-grid').addEventListener('click',()=>{state.viewMode='grid';document.getElementById('view-grid').classList.add('active');document.getElementById('view-list').classList.remove('active');document.getElementById('view-masonry')?.classList.remove('active');render();});
  document.getElementById('view-list').addEventListener('click',()=>{state.viewMode='list';document.getElementById('view-list').classList.add('active');document.getElementById('view-grid').classList.remove('active');document.getElementById('view-masonry')?.classList.remove('active');render();});
  document.getElementById('view-masonry')?.addEventListener('click',()=>{state.viewMode='masonry';document.getElementById('view-masonry').classList.add('active');document.getElementById('view-grid').classList.remove('active');document.getElementById('view-list').classList.remove('active');render();});
  document.getElementById('topbar-wallpaper-btn')?.addEventListener('click', () => openSpaceSettings(state.activeSpace));
  document.getElementById('topbar-add-btn').addEventListener('click',openAdd);
  document.getElementById('sidebar-toggle').addEventListener('click',()=>document.getElementById('sidebar').classList.toggle('collapsed'));
  document.querySelectorAll('.type-pill').forEach(p=>p.addEventListener('click',()=>{document.querySelectorAll('.type-pill').forEach(q=>q.classList.remove('active'));p.classList.add('active');document.getElementById('item-type').value=p.dataset.type;showTypeFields(p.dataset.type);}));
  document.getElementById('modal-close').addEventListener('click',closeModal);
  document.getElementById('modal-cancel').addEventListener('click',closeModal);
  document.getElementById('item-modal').addEventListener('click',e=>{if(e.target===e.currentTarget)closeModal();});
  document.getElementById('item-form').addEventListener('submit',handleFormSubmit);
  document.getElementById('export-btn').addEventListener('click',exportItems);
  document.getElementById('import-btn').addEventListener('click',()=>document.getElementById('import-file').click());
  document.getElementById('import-file').addEventListener('change',importFile);
  document.getElementById('tag-strip-clear').addEventListener('click',()=>{state.tag=null;updateTagStrip();render();});
  document.getElementById('add-space-btn').addEventListener('click', openAddSpace);
  document.getElementById('logout-btn')?.addEventListener('click', () => {
    sessionStorage.removeItem('sikpoket_user');
    window.location.href = 'auth.html';
  });
  document.getElementById('space-modal')?.addEventListener('click',e=>{if(e.target===e.currentTarget)closeSpaceModal();});
  document.getElementById('space-modal-close')?.addEventListener('click', closeSpaceModal);
  document.getElementById('space-modal-cancel')?.addEventListener('click', closeSpaceModal);
  document.getElementById('space-form')?.addEventListener('submit', handleSpaceSubmit);

document.getElementById('space-theme')?.addEventListener('change', (e) => {
  const customOpts = document.getElementById('custom-theme-options');
  if (e.target.value === 'custom') {
    customOpts.classList.remove('hidden');
  } else {
    customOpts.classList.add('hidden');
  }
});

  document.getElementById('btn-browse-local')?.addEventListener('click', () => {
    document.getElementById('space-wallpaper-file')?.click();
  });
  document.addEventListener('keydown',e=>{
    if((e.key==='n'||e.key==='N')&&!e.ctrlKey&&!e.metaKey&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName))openAdd();
    if(e.key==='Escape'){closeModal();closeSpaceModal();}
    if(e.key==='Delete'&&e.ctrlKey){e.preventDefault();deleteActiveSpace();}
  });
  if (!state.spaces.some(s => s.items?.length)) seedDemo();
  render(); updateBadges(); updateSidebarTags();
  setWallpaper();
});

/* ── BROKEN LINK SCANNER ──────────────── */
async function scanBrokenLinks() {
  const space = getActiveSpace(); if (!space) return;
  const urlItems = space.items.filter(i => i.type === 'url' && i.url && !i.archived);
  state.brokenIds = new Set();
  state.brokenScanDone = false;

  const checks = urlItems.map(async (item) => {
    try {
      // Use a no-cors fetch to check if URL is reachable
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      const r = await fetch(item.url, { method: 'HEAD', mode: 'no-cors', signal: ctrl.signal });
      clearTimeout(t);
      // no-cors always returns opaque response (type='opaque'), not an error
      // so we consider non-aborted = reachable
    } catch (e) {
      if (e.name === 'AbortError' || !navigator.onLine) {
        // Timeout or offline — mark as possibly broken
        state.brokenIds.add(item.id);
      }
      // Other network errors (CORS etc.) don't mean broken
    }
  });
  await Promise.all(checks);
  state.brokenScanDone = true;
  setBdg('badge-broken', state.brokenIds.size);
  render();
}

/* ── INTERACTIVE USER GUIDE ───────────── */
function renderDashboardGuide(container) {
  container.innerHTML = `
    <div class="dash-guide-container">

      <!-- ══ HERO ══ -->
      <div class="dash-guide-hero">
        <div class="dash-guide-hero-badge">📖 Interactive User Manual</div>
        <h2 class="dash-guide-hero-title">Mastering SikPoket —<br>Fast, Private & Encrypted</h2>
        <p class="dash-guide-hero-sub">Everything you need to know about capturing links, AES-256 encrypted secrets, batch workflows, multi-space dashboards, mood wallpapers, and keyboard efficiency.</p>
        <div class="dash-guide-hero-stats">
          <div class="dash-guide-stat"><span class="dash-guide-stat-num">38+</span><span class="dash-guide-stat-label">Mood Wallpapers</span></div>
          <div class="dash-guide-stat"><span class="dash-guide-stat-num">AES-256</span><span class="dash-guide-stat-label">Encryption Standard</span></div>
          <div class="dash-guide-stat"><span class="dash-guide-stat-num">5</span><span class="dash-guide-stat-label">Ways to Save</span></div>
          <div class="dash-guide-stat"><span class="dash-guide-stat-num">10</span><span class="dash-guide-stat-label">Keyboard Shortcuts</span></div>
        </div>
      </div>

      <!-- ══ QUICK START FLOW ══ -->
      <div class="dash-guide-flow">
        <div class="dash-guide-flow-step">
          <div class="dash-guide-flow-icon flow-purple">🔌</div>
          <div class="dash-guide-flow-label">Load Extension<br>in Chrome</div>
        </div>
        <div class="dash-guide-flow-arrow">›</div>
        <div class="dash-guide-flow-step">
          <div class="dash-guide-flow-icon flow-blue">🔑</div>
          <div class="dash-guide-flow-label">Set Master<br>Password</div>
        </div>
        <div class="dash-guide-flow-arrow">›</div>
        <div class="dash-guide-flow-step">
          <div class="dash-guide-flow-icon flow-green">🔗</div>
          <div class="dash-guide-flow-label">Save URLs<br>& Secrets</div>
        </div>
        <div class="dash-guide-flow-arrow">›</div>
        <div class="dash-guide-flow-step">
          <div class="dash-guide-flow-icon flow-amber">🖼️</div>
          <div class="dash-guide-flow-label">Set Mood<br>Wallpaper</div>
        </div>
        <div class="dash-guide-flow-arrow">›</div>
        <div class="dash-guide-flow-step">
          <div class="dash-guide-flow-icon flow-pink">🔒</div>
          <div class="dash-guide-flow-label">Lock with<br>Ctrl+L</div>
        </div>
      </div>

      <!-- ══ MODULE CARDS ══ -->
      <div class="dash-guide-grid">

        <!-- Card 1: Saving -->
        <div class="dash-guide-card">
          <div class="dash-guide-card-header">
            <div class="dash-guide-card-icon icon-purple">🔗</div>
            <div class="dash-guide-card-meta">
              <div class="dash-guide-icon-pill pill-purple">Capture &amp; Save</div>
              <h3 class="dash-guide-card-title">5 Ways to Save Content</h3>
            </div>
          </div>
          <ul class="dash-guide-points">
            <li><strong>Right-Click Menu</strong> — Right-click any link, selected text, or page → <em>"Save to SikPoket"</em> from the context menu.</li>
            <li><strong>Text Highlights</strong> — Select any text → right-click → <em>"Save Highlight"</em> to save a quote card with color tags.</li>
            <li><strong>Article Reader</strong> — Click <em>"📄 Save Article"</em> in the popup for distraction-free offline reading mode.</li>
            <li><strong>Keyboard Shortcut</strong> — Press <code>Ctrl+Shift+S</code> from any tab to instantly open the SikPoket popup.</li>
            <li><strong>Quick Add (+)</strong> — Press <code>N</code> or click <em>"+ Add"</em> to save URLs, encrypted API keys, passwords, and notes.</li>
          </ul>
        </div>

        <!-- Card 2: Encryption -->
        <div class="dash-guide-card">
          <div class="dash-guide-card-header">
            <div class="dash-guide-card-icon icon-green">🔒</div>
            <div class="dash-guide-card-meta">
              <div class="dash-guide-icon-pill pill-green">Zero-Knowledge Vault</div>
              <h3 class="dash-guide-card-title">AES-256 GCM Military-Grade Crypto</h3>
            </div>
          </div>
          <ul class="dash-guide-points">
            <li><strong>PBKDF2 — 100,000 Iterations</strong> — Key derived from your master password with a unique cryptographic salt per secret.</li>
            <li><strong>Click-to-Copy</strong> — Passwords &amp; API keys stay masked (<code>••••••••</code>). Click once to copy decrypted value to clipboard.</li>
            <li><strong>Instant Lock</strong> — Press <code>Ctrl+L</code> (or <code>Cmd+L</code>) to instantly wipe master password from memory.</li>
            <li><strong>Touch ID / WebAuthn</strong> — Set up fingerprint unlock via Settings to bypass password typing on supported devices.</li>
            <li><strong>Zero-Server Architecture</strong> — Everything stays in your local browser storage. No cloud, no tracking, no leaks.</li>
          </ul>
        </div>

        <!-- Card 3: Batch Workflows -->
        <div class="dash-guide-card">
          <div class="dash-guide-card-header">
            <div class="dash-guide-card-icon icon-amber">⚡</div>
            <div class="dash-guide-card-meta">
              <div class="dash-guide-icon-pill pill-amber">Pro Productivity</div>
              <h3 class="dash-guide-card-title">Batch Selection &amp; Organization</h3>
            </div>
          </div>
          <ul class="dash-guide-points">
            <li><strong>Batch Mode (<code>Ctrl+B</code>)</strong> — Toggle select mode to check multiple cards and bulk-favorite, archive, or delete them.</li>
            <li><strong>Duplicate URL Cleaner</strong> — Settings → <em>"Scan for Duplicates"</em> → <em>"Keep Newest"</em> to clean your library instantly.</li>
            <li><strong>Reminders 🔔</strong> — Click the bell icon on any item to set due dates and receive desktop Chrome notifications.</li>
            <li><strong>Hierarchical Tags</strong> — Click any tag pill to filter your space, or rename / delete tags globally in the Tag Manager.</li>
            <li><strong>Archive vs Delete</strong> — Archive items to hide without losing them; hard-delete with the ✕ button on each card.</li>
          </ul>
        </div>

        <!-- Card 4: Wallpaper Studio -->
        <div class="dash-guide-card">
          <div class="dash-guide-card-header">
            <div class="dash-guide-card-icon icon-blue">🖼️</div>
            <div class="dash-guide-card-meta">
              <div class="dash-guide-icon-pill pill-blue">Wallpaper Studio</div>
              <h3 class="dash-guide-card-title">Mood Wallpapers, Local Uploads &amp; Layouts</h3>
            </div>
          </div>
          <ul class="dash-guide-points">
            <li><strong>38+ Curated Presets</strong> — Click <em>"🖼️ Wallpaper"</em> in the topbar to browse Anime, Nature, Cosmos, City, Lo-Fi &amp; Minimal bundles.</li>
            <li><strong>Upload Local Images</strong> — Click <em>"📁 Upload Image from Computer"</em> to set any personal photo stored offline via Base64.</li>
            <li><strong>Paste Custom URL</strong> — Drop any Unsplash or direct image link into the URL input box to preview and apply instantly.</li>
            <li><strong>Live Atmosphere Sliders</strong> — Adjust <strong>Opacity (5%–65%)</strong> and <strong>Depth Blur (0px–16px)</strong> with real-time card preview.</li>
            <li><strong>3 View Modes</strong> — Toggle <strong>Grid</strong>, compact <strong>List</strong>, and dynamic <strong>Masonry</strong> in the topbar view buttons.</li>
          </ul>
        </div>

        <!-- Card 5: Spaces -->
        <div class="dash-guide-card">
          <div class="dash-guide-card-header">
            <div class="dash-guide-card-icon icon-pink">🌐</div>
            <div class="dash-guide-card-meta">
              <div class="dash-guide-icon-pill pill-pink">Multi-Space</div>
              <h3 class="dash-guide-card-title">Workspaces &amp; Spaces</h3>
            </div>
          </div>
          <ul class="dash-guide-points">
            <li><strong>Create New Space</strong> — Click <em>"+ New Space"</em> in the sidebar to create a dedicated workspace with its own wallpaper and items.</li>
            <li><strong>Switch Spaces</strong> — Click any space in the sidebar to instantly switch context — each space is fully isolated.</li>
            <li><strong>Edit Space Wallpaper</strong> — Click the 🖼 icon on any space row in the sidebar to open the full Wallpaper Studio for that space.</li>
            <li><strong>Import / Export</strong> — Use the Import &amp; Export buttons in the sidebar footer to back up or migrate your full library as JSON.</li>
            <li><strong>Broken Links Scan</strong> — Click <em>"Broken Links"</em> in the sidebar to verify URL reachability across all saved URLs.</li>
          </ul>
        </div>

        <!-- Card 6: Dashboard Tips -->
        <div class="dash-guide-card">
          <div class="dash-guide-card-header">
            <div class="dash-guide-card-icon icon-violet">💡</div>
            <div class="dash-guide-card-meta">
              <div class="dash-guide-icon-pill pill-violet">Pro Tips</div>
              <h3 class="dash-guide-card-title">Hidden Features &amp; Power Tricks</h3>
            </div>
          </div>
          <ul class="dash-guide-points">
            <li><strong>Search Everything</strong> — The search bar at the top-left filters across all titles, URLs, note content, and tags in real-time.</li>
            <li><strong>Tag Filter Strip</strong> — Click any sidebar tag to instantly filter. A color strip appears with a clear button to reset.</li>
            <li><strong>Sort Options</strong> — Switch between <em>Newest First</em>, <em>Oldest First</em>, and <em>Name A–Z</em> via the sort dropdown in the topbar.</li>
            <li><strong>Favicon Auto-Fetch</strong> — URL cards automatically fetch the site's favicon from Google's icon service for visual recognition.</li>
            <li><strong>Sidebar Collapse</strong> — Click the ☰ hamburger icon to collapse the sidebar and maximize your content reading area.</li>
          </ul>
        </div>

      </div>

      <!-- ══ KEYBOARD SHORTCUTS ══ -->
      <div class="dash-guide-hotkeys-wrap">
        <h3 class="dash-guide-hotkeys-title">⌨️ Keyboard Shortcuts Cheat Sheet</h3>
        <div class="dash-guide-hotkeys-grid">
          <div class="dash-guide-hotkey-row"><kbd>N</kbd><span class="dash-guide-hotkey-desc">Open new item dialog</span></div>
          <div class="dash-guide-hotkey-row"><kbd>Ctrl+L</kbd><span class="dash-guide-hotkey-desc">Lock vault instantly</span></div>
          <div class="dash-guide-hotkey-row"><kbd>Ctrl+B</kbd><span class="dash-guide-hotkey-desc">Toggle multi-select mode</span></div>
          <div class="dash-guide-hotkey-row"><kbd>Ctrl+F</kbd><span class="dash-guide-hotkey-desc">Focus the search bar</span></div>
          <div class="dash-guide-hotkey-row"><kbd>Ctrl+Shift+S</kbd><span class="dash-guide-hotkey-desc">Open popup from any tab</span></div>
          <div class="dash-guide-hotkey-row"><kbd>Ctrl+H</kbd><span class="dash-guide-hotkey-desc">Open this guide</span></div>
          <div class="dash-guide-hotkey-row"><kbd>Esc</kbd><span class="dash-guide-hotkey-desc">Close modals &amp; dialogs</span></div>
          <div class="dash-guide-hotkey-row"><kbd>Ctrl+1</kbd><span class="dash-guide-hotkey-desc">Switch to URLs tab</span></div>
          <div class="dash-guide-hotkey-row"><kbd>Ctrl+2</kbd><span class="dash-guide-hotkey-desc">Switch to API Keys tab</span></div>
          <div class="dash-guide-hotkey-row"><kbd>Ctrl+3</kbd><span class="dash-guide-hotkey-desc">Switch to Passwords tab</span></div>
        </div>
      </div>

    </div>
  `;
}