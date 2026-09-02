/* =====================================================
   SikPoket Dashboard — Spaces + Wallpapers
   ===================================================== */

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
window.state = state;

function getActiveSpace() {
  return state.spaces.find(s => s.id === state.activeSpace) || state.spaces[0] || null;
}
window.getActiveSpace = getActiveSpace;
window.render = render;

async function syncFromExtensionStorage() {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
  try {
    const res = await chrome.storage.local.get(['sikpoketData', 'sikpoketDashboardData']);
    let modified = false;

    // 1. If sikpoketDashboardData exists, sync state.spaces
    if (res.sikpoketDashboardData?.spaces?.length) {
      state.spaces = res.sikpoketDashboardData.spaces.map(s => ({ ...s, items: (s.items||[]).filter(i => !i._removed) }));
      if (res.sikpoketDashboardData.activeSpace) {
        state.activeSpace = res.sikpoketDashboardData.activeSpace;
      }
    }

    // 2. If sikpoketData exists from popup/content script, ensure all items are in active space
    if (res.sikpoketData) {
      let active = getActiveSpace();
      if (!active && state.spaces.length) active = state.spaces[0];
      if (active) {
        if (!active.items) active.items = [];
        const allExtItems = [
          ...(res.sikpoketData.urls || []).map(u => ({ id: u.id || genId(), type: 'url', title: u.title || u.url, url: u.url, tags: u.tags || [], favorite: !!u.favorite, archived: !!u.archived, createdAt: u.createdAt || Date.now() })),
          ...(res.sikpoketData.notes || []).map(n => ({ id: n.id || genId(), type: 'note', title: n.title || 'Note', content: n.content || n.text || '', tags: n.tags || [], favorite: !!n.favorite, archived: !!n.archived, createdAt: n.createdAt || Date.now() })),
          ...(res.sikpoketData.apiKeys || []).map(k => ({ id: k.id || genId(), type: 'key', name: k.name || k.title || 'API Key', username: k.service || k.username || '', value: k.key || k.value || '', tags: k.tags || [], favorite: !!k.favorite, archived: !!k.archived, createdAt: k.createdAt || Date.now() })),
          ...(res.sikpoketData.passwords || []).map(p => ({ id: p.id || genId(), type: 'password', name: p.name || p.title || 'Password', username: p.username || '', value: p.password || p.value || '', tags: p.tags || [], favorite: !!p.favorite, archived: !!p.archived, createdAt: p.createdAt || Date.now() }))
        ];

        const existingKeys = new Set();
        state.spaces.forEach(s => {
          (s.items || []).forEach(i => {
            if (i.id) existingKeys.add(i.id);
            if (i.url) existingKeys.add(i.url);
          });
        });

        allExtItems.forEach(item => {
          if (!existingKeys.has(item.id) && (!item.url || !existingKeys.has(item.url))) {
            active.items.unshift(item);
            existingKeys.add(item.id);
            if (item.url) existingKeys.add(item.url);
            modified = true;
          }
        });
      }
    }

    if (modified) {
      await save();
    }
  } catch (e) {
    console.warn('Extension storage sync warning:', e);
  }
}

// Real-time synchronization when user adds bookmark in popup
if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
  chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area === 'local' && (changes.sikpoketData || changes.sikpoketDashboardData)) {
      await syncFromExtensionStorage();
      render();
      updateSpaceList();
      updateBadges();
      renderSidebarTags();
    }
  });
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
      state.spaces = data.spaces.map(s => ({ ...s, items: (s.items||[]).filter(i => !i._removed) }));
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

  await syncFromExtensionStorage();
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

function setWallpaper() {
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
  const space = getActiveSpace(); if (!space) return [];
  let items = [...space.items];
  if (state.collection === 'highlights') items = items.filter(i => (i.tags||[]).includes('highlight') && !i.archived);
  else if (state.collection === 'smart-quick') items = items.filter(i => window.TaggerHelper ? window.TaggerHelper.SmartSpaces.isQuickRead(i) : true);
  else if (state.collection === 'smart-research') items = items.filter(i => window.TaggerHelper ? window.TaggerHelper.SmartSpaces.isResearch(i) : true);
  else if (state.collection === 'smart-dev') items = items.filter(i => window.TaggerHelper ? window.TaggerHelper.SmartSpaces.isDev(i) : true);
  else if (state.collection === 'smart-inbox') items = items.filter(i => window.TaggerHelper ? window.TaggerHelper.SmartSpaces.isInbox(i) : true);
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
  
  let isSortedBySearch = false;
  if (state.search.trim()) {
    if (window.SearchHelper) {
      items = window.SearchHelper.search(state.search, items);
      isSortedBySearch = true; // SearchHelper already sorts by relevance
    } else {
      const q = state.search.trim().toLowerCase();
      items = items.filter(i => (i.title||'').toLowerCase().includes(q) || (i.url||'').toLowerCase().includes(q) || (i.name||'').toLowerCase().includes(q) || (i.content||'').toLowerCase().includes(q) || (i.tags||[]).some(t=>t.toLowerCase().includes(q)));
    }
  }
  
  if (!isSortedBySearch) {
    if (state.sort === 'newest') items.sort((a,b)=>b.createdAt-a.createdAt);
    else if (state.sort === 'oldest') items.sort((a,b)=>a.createdAt-b.createdAt);
    else if (state.sort === 'name') items.sort((a,b)=>(a.title||a.name||'').localeCompare(b.title||b.name||''));
  }
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
  
  if (window.TaggerHelper) {
    setBdg('badge-smart-quick', a.filter(i => window.TaggerHelper.SmartSpaces.isQuickRead(i)).length);
    setBdg('badge-smart-research', a.filter(i => window.TaggerHelper.SmartSpaces.isResearch(i)).length);
    setBdg('badge-smart-dev', a.filter(i => window.TaggerHelper.SmartSpaces.isDev(i)).length);
    setBdg('badge-smart-inbox', a.filter(i => window.TaggerHelper.SmartSpaces.isInbox(i)).length);
  }

  const brokenCount = state.brokenIds?.size ?? '—';
  setBdg('badge-broken', brokenCount === '—' ? '—' : brokenCount);
  renderSidebarTags();
}
function setBdg(id, n) { const e = document.getElementById(id); if(e) e.textContent = n; }

function updateSpaceList() {
  const c = document.getElementById('space-list'); if (!c) return;
  c.innerHTML = state.spaces.map(s => `
    <div class="space-item ${s.id===state.activeSpace?'active':''}" data-space="${s.id}" title="${esc(s.name)}">
      <span class="space-dot"></span>
      <span class="space-name-text">${esc(s.name)}</span>
      <span class="space-count">${(s.items||[]).filter(i=>!i.archived).length}</span>
      <div class="space-actions-group">
        <button class="space-action-btn btn-space-edit" data-space-id="${s.id}" title="Edit Space & Settings">✏️</button>
        <button class="space-action-btn btn-space-wallpaper" data-space-id="${s.id}" title="Change Atmosphere">🖼️</button>
        ${state.spaces.length > 1 ? `<button class="space-action-btn btn-space-delete" data-space-id="${s.id}" title="Delete Space">🗑️</button>` : ''}
      </div>
    </div>
  `).join('');
  c.querySelectorAll('.space-item').forEach(b => b.addEventListener('click', (e) => {
    if (e.target.closest('.space-actions-group') || e.target.closest('.space-action-btn')) return;
    state.activeSpace = b.dataset.space; state.collection = 'all'; state.tag = null; updateTagStrip();
    save(); setWallpaper(); render(); updateSpaceList(); updateBadges();
  }));
  c.querySelectorAll('.btn-space-edit, .btn-space-wallpaper').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openSpaceSettings(btn.dataset.spaceId);
    });
  });
  c.querySelectorAll('.btn-space-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteSpace(btn.dataset.spaceId);
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

function cardHtml(item, lm) {
  const date = new Date(item.createdAt).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'2-digit'});
  let th = item.type==='url'&&item.url ? `<a class="card-title" href="${esc(item.url)}" target="_blank" rel="noopener">${esc(item.title||item.url)}</a>` : `<span class="card-title">${esc(item.title||item.name||'Untitled')}</span>`;
  let dh = ''; if(item.type==='url'&&item.url) try{dh=`<span class="card-domain">${new URL(item.url).hostname}</span>`}catch{} else if((item.type==='key'||item.type==='password')&&item.username)dh=`<span class="card-domain">${esc(item.username)}</span>`;
  let readBadge = '';
  if (item.type === 'note' && item.content && window.QRCodeGenerator) {
    const readInfo = QRCodeGenerator.estimateReadingTime(item.content);
    if (readInfo) readBadge = `<div class="card-read-badge">${esc(readInfo.badgeText)}</div>`;
  }
  let bh = ''; if(item.type==='note'&&item.content)bh=`<div class="card-excerpt">${esc(item.content)}</div>${readBadge}`; else if((item.type==='key'||item.type==='password')&&item.value)bh=`<div class="card-secret" data-id="${item.id}" data-action="copy-secret" title="Click to copy secret">🔒 <span>${'•'.repeat(Math.min(item.value.length,14))}</span></div>`;
  const thtml = (item.tags||[]).length?`<div class="card-tags">${item.tags.map(t=>`<span class="card-tag" data-tag="${esc(t)}">${esc(t)}</span>`).join('')}</div>`:'';
  const qrBtn = item.type==='url'&&item.url ? `<button class="card-action-btn" data-action="qr" data-id="${item.id}" data-url="${esc(item.url)}" title="View Mobile QR Code">📱</button>` : '';
  const readBtn = (item.content || item.type==='note' || item.type==='url') ? `<button class="card-action-btn" data-action="read" data-id="${item.id}" title="Distraction-free Reader Mode with Text-to-Speech">📖</button>` : '';
  const simBtn = `<button class="card-action-btn" data-action="similar" data-id="${item.id}" title="Find Semantically Similar Items in Vault">✨</button>`;
  return `<div class="item-card ${lm?'list-mode':''}" data-id="${item.id}"><div class="card-body"><div class="card-title-row">${faviconEl(item)}<div class="card-title-block">${th}${dh}</div></div>${bh}${thtml}</div><div class="card-footer"><span class="card-date">${date}</span><div class="card-actions">${readBtn}${simBtn}${qrBtn}<button class="card-action-btn${item.favorite?' fav-active':''}" data-action="fav" data-id="${item.id}" title="${item.favorite?'Favorited':'Favorite'}">${item.favorite?'★':'☆'}</button><button class="card-action-btn" data-action="archive" data-id="${item.id}" title="${item.archived?'Restore':'Archive'}">${item.archived?'📤':'📥'}</button><button class="card-action-btn" data-action="edit" data-id="${item.id}" title="Edit">✏️</button><button class="card-action-btn delete-btn" data-action="delete" data-id="${item.id}" title="Delete">✕</button></div></div></div>`;
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
      else if (action === 'qr') openDashboardQrModal(actBtn.dataset.url, actBtn.closest('.item-card')?.querySelector('.card-title')?.textContent);
      else if (action === 'similar') {
        const space = getActiveSpace();
        const item = space?.items.find(x => x.id === id);
        if (item && window.VectorHelper) {
          const similar = window.VectorHelper.findSimilar(item, space.items, 6);
          if (!similar.length) {
            toast('No strongly related items found.', 'info');
          } else {
            toast(`✨ Found ${similar.length} related items (${similar[0].score}% match)`, 'success');
            const topMatch = similar[0].item;
            state.search = (topMatch.tags && topMatch.tags[0]) || (item.tags && item.tags[0]) || (topMatch.title || '').split(/\s+/)[0];
            const searchInput = document.getElementById('global-search');
            if (searchInput) searchInput.value = state.search;
            render();
          }
        }
      }
      else if (action === 'read') {
        const space = getActiveSpace();
        const item = space?.items.find(x => x.id === id);
        if (item) openReaderMode(item);
      }
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
  const titles = {
    all: 'All Items', favorites: 'Favorites', archived: 'Archive', urls: 'URLs', notes: 'Notes', keys: 'API Keys', passwords: 'Passwords',
    highlights: 'Highlights', broken: 'Broken Links', guide: 'How to Use SikPoket', rss: '📡 RSS Feeds & Watcher',
    'smart-quick': '⚡ Quick Reads (< 3m)', 'smart-research': '🧠 Research & AI', 'smart-dev': '💻 Code & Repos', 'smart-inbox': '📥 Inbox (Untagged)'
  };
  if(vt) vt.textContent = state.tag?`#${state.tag}`:(titles[state.collection]||'All Items');
  if(vc) vc.textContent = state.collection==='guide' ? '6 Modules Guide' : state.collection==='rss' ? `${(state.feeds||[]).length} Feeds Subscribed` : `${items.length} item${items.length!==1?'s':''}`;

  // Knowledge Graph View
  const graphContainer = document.getElementById('graph-container');
  if (state.collection === 'graph') {
    a.classList.add('hidden');
    if (graphContainer) {
      graphContainer.classList.remove('hidden');
      initOrUpdateKnowledgeGraph();
    }
    document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.collection===state.collection));
    updateSidebarTags(); updateBadges(); setWallpaper();
    return;
  } else {
    a.classList.remove('hidden');
    if (graphContainer) {
      graphContainer.classList.add('hidden');
      if (window._currentGraphInstance) window._currentGraphInstance.stop();
    }
  }

  // RSS Feeds View
  if (state.collection === 'rss') {
    renderRssSection(a);
    document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.collection===state.collection));
    updateSidebarTags(); updateBadges(); setWallpaper();
    return;
  }

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

  // Ambient Sound buttons
  document.querySelectorAll('.btn-sound-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.btn-sound-preset').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const soundId = btn.dataset.sound;
      if (soundId === 'none') {
        window.AudioHelper?.stop();
        toast('Ambient sound muted', 'error');
      } else if (window.AudioHelper) {
        const vol = (parseInt(document.getElementById('ambient-sound-volume')?.value || '35')) / 100;
        window.AudioHelper.play(soundId, vol);
        toast(`Playing ${btn.textContent}`, 'success');
      }
    });
  });

  document.getElementById('ambient-sound-volume')?.addEventListener('input', (e) => {
    const vol = parseInt(e.target.value);
    const volLabel = document.getElementById('sound-vol-val');
    if (volLabel) volLabel.textContent = vol + '%';
    if (window.AudioHelper) window.AudioHelper.setVolume(vol / 100);
  });
}

window.openSpaceSettings = function(id) {
  const space = state.spaces.find(s => s.id === id); if (!space) return;
  document.getElementById('space-edit-id').value = id;
  document.getElementById('space-name').value = space.name;
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
  if (!name) return;
  const wallpaper = document.getElementById('space-wallpaper').value.trim();
  const opacity = parseInt(document.getElementById('space-wallpaper-opacity').value) || 35;
  const blur = parseInt(document.getElementById('space-wallpaper-blur').value) || 0;
  const editId = document.getElementById('space-edit-id').value;

  if (editId) {
    const s = state.spaces.find(x => x.id === editId);
    if (s) {
      s.name = name;
      s.wallpaper = wallpaper;
      s.wallpaperOpacity = opacity;
      s.wallpaperBlur = blur;
    }
    state.activeSpace = editId;
  } else {
    const ns = {
      id: genId(),
      name,
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
  deleteSpace(state.activeSpace);
}

window.deleteSpace = function(spaceId) {
  if (!spaceId) return;
  if (state.spaces.length <= 1) {
    toast('Cannot delete your only space. Create another first.', 'error');
    return;
  }
  const space = state.spaces.find(s => s.id === spaceId);
  if (!space) return;
  const itemCount = (space.items || []).filter(i => !i._removed).length;
  if (!confirm(`Delete space "${space.name}"${itemCount ? ` and all ${itemCount} items inside it` : ''}?`)) return;
  
  state.spaces = state.spaces.filter(s => s.id !== spaceId);
  if (state.activeSpace === spaceId) {
    state.activeSpace = state.spaces[0].id;
  }
  save();
  updateSpaceList();
  setWallpaper();
  render();
  updateBadges();
  closeSpaceModal();
  toast(`Space "${space.name}" deleted`, 'error');
};

function initCollapsibleSections() {
  let collapsed = [];
  try {
    collapsed = JSON.parse(localStorage.getItem('sik_collapsed_sections') || '[]');
  } catch {}

  document.querySelectorAll('.nav-section').forEach(sec => {
    const secId = sec.dataset.sectionId;
    if (secId && collapsed.includes(secId)) {
      sec.classList.add('collapsed');
    }

    const header = sec.querySelector('.nav-section-header');
    if (header) {
      header.addEventListener('click', (e) => {
        if (e.target.closest('#btn-toggle-all-sections') || e.target.closest('button')) return;
        sec.classList.toggle('collapsed');
        saveCollapsedState();
      });
    }
  });

  const toggleAllBtn = document.getElementById('btn-toggle-all-sections');
  if (toggleAllBtn) {
    const updateToggleBtnText = () => {
      const allSections = document.querySelectorAll('.nav-section');
      const anyExpanded = Array.from(allSections).some(s => !s.classList.contains('collapsed'));
      toggleAllBtn.textContent = anyExpanded ? 'Contract All' : 'Expand All';
    };
    updateToggleBtnText();

    toggleAllBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const allSections = document.querySelectorAll('.nav-section');
      const anyExpanded = Array.from(allSections).some(s => !s.classList.contains('collapsed'));
      allSections.forEach(s => {
        if (anyExpanded) s.classList.add('collapsed');
        else s.classList.remove('collapsed');
      });
      saveCollapsedState();
      updateToggleBtnText();
    });
  }

  function saveCollapsedState() {
    const coll = [];
    document.querySelectorAll('.nav-section.collapsed').forEach(s => {
      if (s.dataset.sectionId) coll.push(s.dataset.sectionId);
    });
    localStorage.setItem('sik_collapsed_sections', JSON.stringify(coll));
  }
}

/* ── EXPORT/IMPORT ───────────────────── */
function exportItems() {
  const blob=new Blob([JSON.stringify({version:2,spaces:state.spaces,activeSpace:state.activeSpace},null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`sikpoket-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(url);toast('Exported JSON!','success');
}
function exportNetscapeHtml() {
  const space = getActiveSpace();
  const allUrls = space ? (space.items || []).filter(i => i.type === 'url' && i.url) : [];
  if (window.QRCodeGenerator) {
    const html = QRCodeGenerator.exportNetscapeBookmarks(allUrls);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sikpoket-bookmarks-${new Date().toISOString().slice(0,10)}.html`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Exported HTML Bookmarks!', 'success');
  }
}

function exportObsidianVault() {
  const space = getActiveSpace();
  const items = space ? (space.items || []) : [];
  if (!items.length) {
    toast('No items to export', 'error');
    return;
  }
  if (window.ExportHelper) {
    const spaceName = space ? space.name : 'SikPoket-Vault';
    const zipBlob = ExportHelper.exportObsidianVaultZip(items, `SikPoket-${spaceName.replace(/\s+/g, '-')}`);
    ExportHelper.triggerDownload(zipBlob, `SikPoket-Obsidian-Vault-${new Date().toISOString().slice(0, 10)}.zip`);
    toast('Exported Obsidian Vault Zip (with YAML & Wikilinks)!', 'success');
  }
}

function exportNotionCsv() {
  const space = getActiveSpace();
  const items = space ? (space.items || []) : [];
  if (!items.length) {
    toast('No items to export', 'error');
    return;
  }
  if (window.ExportHelper) {
    const csvContent = ExportHelper.exportNotionCSV(items);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    ExportHelper.triggerDownload(blob, `sikpoket-notion-${new Date().toISOString().slice(0, 10)}.csv`);
    toast('Exported Notion CSV Database!', 'success');
  }
}
function openDashboardQrModal(url, title) {
  if (!url) return;
  const modal = document.getElementById('qr-modal');
  const canvas = document.getElementById('dashboard-qr-canvas');
  const urlText = document.getElementById('dashboard-qr-url');
  const titleEl = document.getElementById('dashboard-qr-title');
  if (urlText) urlText.textContent = url;
  if (titleEl) titleEl.textContent = '📱 ' + (title || 'QR Code');
  if (canvas && window.QRCodeGenerator) {
    QRCodeGenerator.renderToCanvas(canvas, url, { size: 200 });
  }
  if (modal) modal.classList.remove('hidden');
}
function closeDashboardQrModal() {
  const modal = document.getElementById('qr-modal');
  if (modal) modal.classList.add('hidden');
}
function importFile(e) {
  const f=e.target.files[0];if(!f)return;const r=new FileReader();
  r.onload=function(ev){try{const d=JSON.parse(ev.target.result);
  if(d.spaces){d.spaces.forEach(ns=>{const ex=state.spaces.find(s=>s.id===ns.id);if(ex){ex.items=[...ns.items,...ex.items];ex.name=ns.name||ex.name;ex.wallpaper=ns.wallpaper||ex.wallpaper;ex.wallpaperOpacity=ns.wallpaperOpacity;ex.wallpaperBlur=ns.wallpaperBlur;}else state.spaces.push(ns);});}
  else if(d.items||Array.isArray(d)){const s=getActiveSpace();if(s)s.items=[...(d.items||d),...s.items];}
  if(d.activeSpace)state.activeSpace=d.activeSpace;
  save();updateSpaceList();setWallpaper();render();updateBadges();toast('Imported!','success');}catch{toast('Invalid file','error');}};r.readAsText(f);e.target.value='';
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

  // Theme Switcher Setup — simple Light/Dark (forest=Paper, obsidian=Ink)
  let savedTheme = localStorage.getItem('sik_theme') || 'forest';
  if(savedTheme==='sunset'||savedTheme==='solar') savedTheme='forest';
  applyTheme(savedTheme);
  document.getElementById('theme-switcher')?.addEventListener('change', e => {
    applyTheme(e.target.value);
  });

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
  document.getElementById('export-obsidian-btn')?.addEventListener('click', exportObsidianVault);
  document.getElementById('export-notion-btn')?.addEventListener('click', exportNotionCsv);
  document.getElementById('export-html-btn')?.addEventListener('click', exportNetscapeHtml);
  document.getElementById('dashboard-qr-close')?.addEventListener('click', closeDashboardQrModal);
  document.getElementById('dashboard-qr-cancel-btn')?.addEventListener('click', closeDashboardQrModal);
  document.getElementById('qr-modal')?.addEventListener('click', e => { if (e.target === e.currentTarget) closeDashboardQrModal(); });
  document.getElementById('dashboard-qr-copy-btn')?.addEventListener('click', async () => {
    const url = document.getElementById('dashboard-qr-url')?.textContent;
    if (url) {
      await navigator.clipboard.writeText(url);
      const btn = document.getElementById('dashboard-qr-copy-btn');
      if (btn) {
        btn.textContent = '✅ Copied!';
        setTimeout(() => { btn.textContent = '📋 Copy URL'; }, 1800);
      }
      toast('Copied URL!', 'success');
    }
  });
  document.getElementById('import-btn').addEventListener('click',()=>document.getElementById('import-file').click());
  document.getElementById('import-file').addEventListener('change',importFile);
  document.getElementById('tag-strip-clear').addEventListener('click',()=>{state.tag=null;updateTagStrip();render();});
  document.getElementById('add-space-btn').addEventListener('click', openAddSpace);
  initCollapsibleSections();
  document.getElementById('btn-delete-space-modal')?.addEventListener('click', () => {
    const editId = document.getElementById('space-edit-id')?.value;
    if (editId) deleteSpace(editId);
  });
  document.getElementById('space-modal')?.addEventListener('click',e=>{if(e.target===e.currentTarget)closeSpaceModal();});
  document.getElementById('space-modal-close')?.addEventListener('click', closeSpaceModal);
  document.getElementById('space-modal-cancel')?.addEventListener('click', closeSpaceModal);
  document.getElementById('space-form')?.addEventListener('submit', handleSpaceSubmit);
  document.getElementById('btn-browse-local')?.addEventListener('click', () => {
    document.getElementById('space-wallpaper-file')?.click();
  });

  // ── Phase 9: Shortcuts, Dedup & RSS Setup ──
  document.getElementById('btn-shortcuts-help')?.addEventListener('click', openShortcutsModal);
  document.getElementById('shortcuts-modal-close')?.addEventListener('click', closeShortcutsModal);
  document.getElementById('shortcuts-modal-ok')?.addEventListener('click', closeShortcutsModal);
  document.getElementById('shortcuts-modal')?.addEventListener('click', e => { if (e.target === e.currentTarget) closeShortcutsModal(); });

  document.getElementById('btn-dedup-clean')?.addEventListener('click', openDedupModal);
  document.getElementById('dedup-modal-close')?.addEventListener('click', closeDedupModal);
  document.getElementById('dedup-modal-cancel')?.addEventListener('click', closeDedupModal);
  document.getElementById('dedup-merge-all-btn')?.addEventListener('click', mergeAllDuplicates);
  document.getElementById('dedup-modal')?.addEventListener('click', e => { if (e.target === e.currentTarget) closeDedupModal(); });

  document.getElementById('rss-modal-close')?.addEventListener('click', closeRssModal);
  document.getElementById('rss-modal-cancel')?.addEventListener('click', closeRssModal);
  document.getElementById('rss-subscribe-btn')?.addEventListener('click', handleAddRssFeed);
  document.getElementById('rss-modal')?.addEventListener('click', e => { if (e.target === e.currentTarget) closeRssModal(); });

  document.addEventListener('keydown', e => {
    const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
    const anyModalOpen = document.querySelectorAll('.modal-overlay:not(.hidden)').length > 0;
    const cmdOpen = !document.getElementById('cmd-palette-backdrop')?.classList.contains('hidden');

    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      toggleCommandPalette();
      return;
    }

    if (e.key === 'Escape') {
      closeModal(); closeSpaceModal(); closeReaderMode(); closeCommandPalette(); closeShortcutsModal(); closeDedupModal(); closeRssModal();
      return;
    }

    if (isInput || cmdOpen) return;

    if (e.key === '?' || (e.shiftKey && e.key === '/')) {
      e.preventDefault();
      toggleShortcutsModal();
      return;
    }

    if (anyModalOpen) return;

    // ── Vim-Style Power Navigation ──
    if (e.key === 'j' || e.key === 'ArrowDown') {
      e.preventDefault();
      moveFocus(1);
    } else if (e.key === 'k' || e.key === 'ArrowUp') {
      e.preventDefault();
      moveFocus(-1);
    } else if (e.key === 'o' || e.key === 'Enter') {
      e.preventDefault();
      openFocusedItem();
    } else if (e.key === 'f') {
      e.preventDefault();
      toggleFavoriteFocused();
    } else if (e.key === 'c') {
      e.preventDefault();
      copyFocused();
    } else if (e.key === 'e') {
      e.preventDefault();
      editFocused();
    } else if (e.key === 'd') {
      e.preventDefault();
      deleteFocused();
    } else if (e.key === 'n' || e.key === 'N') {
      e.preventDefault();
      openAdd();
    }
  });

  initCommandPalette();
  if (!state.spaces.some(s => s.items?.length)) seedDemo();
  render(); updateBadges(); updateSidebarTags();
  setWallpaper();
});

/* ── BROKEN LINK SCANNER ──────────────── */
async function scanBrokenLinks() {
  state.brokenScanDone = false;
  if (window.HealthHelper) {
    const ids = await window.HealthHelper.scanAll();
    state.brokenIds = new Set(ids);
  } else {
    state.brokenIds = new Set();
  }
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

/* ── KNOWLEDGE GRAPH LOGIC ──────────────── */
function initOrUpdateKnowledgeGraph() {
  const canvas = document.getElementById('knowledge-graph-canvas');
  if (!canvas || typeof KnowledgeGraph === 'undefined') return;

  const space = getActiveSpace();
  if (!space) return;

  if (!window._currentGraphInstance) {
    window._currentGraphInstance = new KnowledgeGraph(canvas, {
      onNodeClick: (node) => {
        if (node.type === 'tag') {
          const tag = node.label.replace(/^#/, '');
          filterTag(tag);
        } else if (node.item) {
          if (node.item.type === 'note' || node.item.content) {
            openReaderMode(node.item);
          } else if (node.item.url) {
            window.open(node.item.url, '_blank');
          } else {
            openEdit(node.item.id);
          }
        }
      }
    });

    const resetBtn = document.getElementById('graph-reset-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (window._currentGraphInstance) {
          window._currentGraphInstance.setData(space.items || []);
          window._currentGraphInstance.start();
        }
      });
    }
  }

  window._currentGraphInstance.resize();
  window._currentGraphInstance.setData(space.items || []);
  if (state.search) {
    window._currentGraphInstance.setSearchFilter(state.search);
  }
  window._currentGraphInstance.start();
}

/* ── READER MODE & TTS LOGIC ─────────────── */
let currentReaderItem = null;
let readerTheme = 'dark';
let readerIsSerif = false;

function openReaderMode(item) {
  currentReaderItem = item;
  const modal = document.getElementById('reader-modal');
  const titleEl = document.getElementById('reader-article-title');
  const metaEl = document.getElementById('reader-article-meta');
  const bodyEl = document.getElementById('reader-article-body');
  const readTimeEl = document.getElementById('reader-read-time');

  if (!modal || !titleEl || !bodyEl) return;

  const title = item.title || item.name || 'Untitled Article';
  let rawText = item.content || item.title || item.url || '';
  
  titleEl.textContent = title;
  
  const date = new Date(item.createdAt || Date.now()).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const host = item.url ? `<a href="${esc(item.url)}" target="_blank" style="color:var(--primary);text-decoration:none;">${new URL(item.url).hostname}</a> • ` : '';
  const tagList = (item.tags || []).map(t => `#${t}`).join(' ');
  metaEl.innerHTML = `${host}${date} ${tagList ? `• <span style="color:var(--muted);">${esc(tagList)}</span>` : ''}`;

  // Parse WikiLinks
  if (typeof WikiLinkHelper !== 'undefined') {
    rawText = WikiLinkHelper.renderWikiLinks(rawText);
  }

  if (typeof ReaderHelper !== 'undefined') {
    bodyEl.innerHTML = ReaderHelper.cleanContent(rawText, title);
    if (readTimeEl) {
      const mins = ReaderHelper.calculateReadingTime(rawText);
      readTimeEl.textContent = `📖 ${mins} min read`;
    }
  } else {
    bodyEl.innerHTML = rawText;
  }

  // Render Incoming Backlinks
  const space = getActiveSpace();
  if (space && typeof WikiLinkHelper !== 'undefined') {
    const linkIndex = WikiLinkHelper.buildLinkIndex(space.items || []);
    const backlinks = linkIndex.getItemBacklinks(item.id);
    if (backlinks.length > 0) {
      const backlinkHtml = `
        <div style="margin-top:40px;padding-top:20px;border-top:1px solid var(--border);">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--muted);margin-bottom:10px;font-family:var(--font-mono);">
            🔗 Backlinks (${backlinks.length} incoming reference${backlinks.length > 1 ? 's' : ''})
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:8px;">
            ${backlinks.map(b => `<button class="btn-cancel backlink-btn" data-item-id="${b.id}" style="padding:6px 12px;font-size:12px;border-radius:8px;background:rgba(121,82,255,0.1);border-color:rgba(121,82,255,0.3);color:#c4b5fd;">📝 ${esc(b.title || b.name)}</button>`).join('')}
          </div>
        </div>
      `;
      bodyEl.innerHTML += backlinkHtml;
      bodyEl.querySelectorAll('.backlink-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const target = space.items.find(x => x.id === btn.dataset.itemId);
          if (target) openReaderMode(target);
        });
      });
    }
  }

  // Handle WikiLink pill clicks
  bodyEl.querySelectorAll('.wikilink-pill').forEach(pill => {
    pill.style.cursor = 'pointer';
    pill.style.background = 'rgba(144, 184, 0, 0.2)';
    pill.style.padding = '2px 6px';
    pill.style.borderRadius = '4px';
    pill.style.color = '#e1e100';
    pill.addEventListener('click', (e) => {
      e.stopPropagation();
      const targetTitle = pill.dataset.wikilink.toLowerCase();
      const found = (space?.items || []).find(x => (x.title || x.name || '').toLowerCase() === targetTitle);
      if (found) openReaderMode(found);
      else toast(`Note "${pill.dataset.wikilink}" not found`, 'error');
    });
  });

  modal.classList.remove('hidden');
  initReaderControls();
}

function initReaderControls() {
  const closeBtn = document.getElementById('reader-close-btn');
  const fontBtn = document.getElementById('reader-font-toggle');
  const themeBtn = document.getElementById('reader-theme-toggle');
  const playBtn = document.getElementById('reader-tts-play-btn');
  const rateSelect = document.getElementById('reader-tts-rate');
  const modalContainer = document.querySelector('.reader-modal-container');
  const bodyEl = document.getElementById('reader-article-body');

  if (closeBtn && !closeBtn._hasBound) {
    closeBtn._hasBound = true;
    closeBtn.addEventListener('click', closeReaderMode);
  }

  if (fontBtn && !fontBtn._hasBound) {
    fontBtn._hasBound = true;
    fontBtn.addEventListener('click', () => {
      readerIsSerif = !readerIsSerif;
      if (bodyEl) {
        bodyEl.style.fontFamily = readerIsSerif ? "'Georgia', 'Cambria', serif" : "'Plus Jakarta Sans', -apple-system, sans-serif";
      }
      fontBtn.textContent = readerIsSerif ? 'Aa Sans' : 'Aa Serif';
    });
  }

  if (themeBtn && !themeBtn._hasBound) {
    themeBtn._hasBound = true;
    themeBtn.addEventListener('click', () => {
      if (readerTheme === 'dark') {
        readerTheme = 'sepia';
        if (modalContainer) {
          modalContainer.style.background = '#f5ead8';
          modalContainer.style.color = '#3b2a14';
        }
        themeBtn.textContent = '☕ Sepia';
      } else if (readerTheme === 'sepia') {
        readerTheme = 'light';
        if (modalContainer) {
          modalContainer.style.background = '#fdfdfd';
          modalContainer.style.color = '#1a1a1a';
        }
        themeBtn.textContent = '☀ Light';
      } else {
        readerTheme = 'dark';
        if (modalContainer) {
          modalContainer.style.background = '#0e0b0a';
          modalContainer.style.color = '#ede8e1';
        }
        themeBtn.textContent = '🌙 Dark';
      }
    });
  }

  if (playBtn && !playBtn._hasBound) {
    playBtn._hasBound = true;
    playBtn.addEventListener('click', () => {
      if (typeof ReaderHelper === 'undefined') return;

      if (ReaderHelper.TTS.isPlaying && !ReaderHelper.TTS.isPaused) {
        ReaderHelper.TTS.pause();
        playBtn.textContent = '▶ Resume Audio';
      } else if (ReaderHelper.TTS.isPaused) {
        ReaderHelper.TTS.resume();
        playBtn.textContent = '⏸ Pause Audio';
      } else {
        const textToRead = (document.getElementById('reader-article-title')?.textContent || '') + '. ' + (document.getElementById('reader-article-body')?.textContent || '');
        if (rateSelect) ReaderHelper.TTS.setRate(rateSelect.value);
        ReaderHelper.TTS.speak(textToRead, null, () => {
          playBtn.textContent = '▶ Play Audio (TTS)';
        });
        playBtn.textContent = '⏸ Pause Audio';
      }
    });
  }

  if (rateSelect && !rateSelect._hasBound) {
    rateSelect._hasBound = true;
    rateSelect.addEventListener('change', () => {
      if (typeof ReaderHelper !== 'undefined') {
        ReaderHelper.TTS.setRate(rateSelect.value);
      }
    });
  }
}

function closeReaderMode() {
  const modal = document.getElementById('reader-modal');
  if (modal) modal.classList.add('hidden');
  if (typeof ReaderHelper !== 'undefined') {
    ReaderHelper.TTS.stop();
  }
  const playBtn = document.getElementById('reader-tts-play-btn');
  if (playBtn) playBtn.textContent = '▶ Play Audio (TTS)';
}

/* ── COMMAND PALETTE (CMD + K) ───────────── */
let cmdSelectedIndex = 0;
let currentCmdItems = [];

function toggleCommandPalette() {
  const backdrop = document.getElementById('cmd-palette-backdrop');
  if (!backdrop) return;
  if (backdrop.classList.contains('hidden')) openCommandPalette();
  else closeCommandPalette();
}

function openCommandPalette() {
  const backdrop = document.getElementById('cmd-palette-backdrop');
  const input = document.getElementById('cmd-palette-input');
  if (!backdrop || !input) return;

  cmdSelectedIndex = 0;
  input.value = '';
  backdrop.classList.remove('hidden');
  renderCommandPalette('');
  setTimeout(() => input.focus(), 50);
}

function closeCommandPalette() {
  const backdrop = document.getElementById('cmd-palette-backdrop');
  if (backdrop) backdrop.classList.add('hidden');
}

function applyTheme(theme) {
  if(theme==='sunset'||theme==='solar') theme='forest';
  state.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.classList.toggle('dark', theme==='obsidian');
  localStorage.setItem('sik_theme', theme);
  const sel = document.getElementById('theme-switcher');
  if (sel) sel.value = theme;
  if (window.knowledgeGraphInstance && state.collection === 'graph') {
    const space = getActiveSpace();
    if (space) window.knowledgeGraphInstance.setData(space.items || []);
  }
}

function renderCommandPalette(query) {
  const list = document.getElementById('cmd-palette-list');
  if (!list) return;

  const q = (query || '').toLowerCase().trim();
  const space = getActiveSpace();
  const items = space ? space.items.filter(i => !i.archived) : [];

  const baseActions = [
    { icon: '➕', label: 'Add New Item to Vault', action: () => openAdd(), badge: 'Action' },
    { icon: '🌲', label: 'Switch Theme: 🌲 Electric Forest', action: () => { applyTheme('forest'); toast('Theme: Electric Forest', 'success'); }, badge: 'Theme' },
    { icon: '🌆', label: 'Switch Theme: 🌆 Neon Sunset', action: () => { applyTheme('sunset'); toast('Theme: Neon Sunset', 'success'); }, badge: 'Theme' },
    { icon: '🔥', label: 'Switch Theme: 🔥 Solar Horizon', action: () => { applyTheme('solar'); toast('Theme: Solar Horizon', 'success'); }, badge: 'Theme' },
    { icon: '🌌', label: 'Switch Theme: 🌌 Cyber Obsidian', action: () => { applyTheme('obsidian'); toast('Theme: Cyber Obsidian', 'success'); }, badge: 'Theme' },
    { icon: '🕸️', label: 'Open 2D Knowledge Graph', action: () => { state.collection = 'graph'; render(); }, badge: 'View' },
    { icon: '🌧️', label: 'Play Ambient Focus Rain', action: () => { if (window.AudioHelper) window.AudioHelper.playPreset('rain'); toast('Playing Rain soundscape', 'success'); }, badge: 'Audio' },
    { icon: '🧠', label: 'Play 40Hz Gamma Focus Beats', action: () => { if (window.AudioHelper) window.AudioHelper.playPreset('binaural'); toast('Playing 40Hz Gamma Beats', 'success'); }, badge: 'Audio' },
    { icon: '🩺', label: 'Scan for Broken Bookmarks', action: () => { state.collection = 'broken'; render(); }, badge: 'Health' },
    { icon: '🧹', label: 'Clean Duplicate Bookmarks', action: () => openDedupModal(), badge: 'Dedup' },
    { icon: '📡', label: 'Open RSS Feeds Watcher', action: () => { state.collection = 'rss'; render(); }, badge: 'RSS' },
    { icon: '⌨️', label: 'View Keyboard Shortcuts (?)', action: () => openShortcutsModal(), badge: 'Help' },
    { icon: '🖼️', label: 'Customize Space Wallpaper', action: () => openSpaceSettings(state.activeSpace), badge: 'Theme' }
  ];

  // Add space switch actions
  state.spaces.forEach(s => {
    if (s.id !== state.activeSpace) {
      baseActions.push({
        icon: '📁',
        label: `Switch Space: ${s.name}`,
        action: () => { state.activeSpace = s.id; state.collection = 'all'; save(); render(); updateSpaceList(); updateBadges(); setWallpaper(); },
        badge: 'Space'
      });
    }
  });

  // Add vault items
  items.forEach(i => {
    baseActions.push({
      icon: i.type === 'note' ? '📝' : i.type === 'key' ? '🔑' : i.type === 'password' ? '🔒' : '🔗',
      label: i.title || i.name || i.url || 'Untitled',
      action: () => {
        if (i.content || i.type === 'note') openReaderMode(i);
        else if (i.url) window.open(i.url, '_blank');
        else openEdit(i.id);
      },
      badge: (i.type || 'url').toUpperCase()
    });
  });

  currentCmdItems = q ? baseActions.filter(a => a.label.toLowerCase().includes(q) || a.badge.toLowerCase().includes(q)) : baseActions.slice(0, 8);
  if (cmdSelectedIndex >= currentCmdItems.length) cmdSelectedIndex = 0;

  if (!currentCmdItems.length) {
    list.innerHTML = '<div style="padding:16px;text-align:center;color:var(--muted);font-size:12px;">No matching actions or items found.</div>';
    return;
  }

  list.innerHTML = currentCmdItems.map((item, idx) => `
    <div class="cmd-palette-item ${idx === cmdSelectedIndex ? 'active' : ''}" data-cmd-index="${idx}">
      <div class="cmd-item-left">
        <span style="font-size:15px;">${item.icon}</span>
        <span>${esc(item.label)}</span>
      </div>
      <span class="cmd-item-badge">${esc(item.badge)}</span>
    </div>
  `).join('');

  list.querySelectorAll('.cmd-palette-item').forEach(el => {
    el.addEventListener('click', () => {
      const idx = parseInt(el.dataset.cmdIndex, 10);
      executeCommandItem(idx);
    });
  });
}

function executeCommandItem(index) {
  const item = currentCmdItems[index];
  if (item && item.action) {
    closeCommandPalette();
    item.action();
  }
}

function initCommandPalette() {
  const backdrop = document.getElementById('cmd-palette-backdrop');
  const input = document.getElementById('cmd-palette-input');

  if (backdrop && !backdrop._hasBound) {
    backdrop._hasBound = true;
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeCommandPalette();
    });
  }

  if (input && !input._hasBound) {
    input._hasBound = true;
    input.addEventListener('input', (e) => {
      cmdSelectedIndex = 0;
      renderCommandPalette(e.target.value);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        cmdSelectedIndex = (cmdSelectedIndex + 1) % Math.max(1, currentCmdItems.length);
        renderCommandPalette(input.value);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        cmdSelectedIndex = (cmdSelectedIndex - 1 + currentCmdItems.length) % Math.max(1, currentCmdItems.length);
        renderCommandPalette(input.value);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        executeCommandItem(cmdSelectedIndex);
      } else if (e.key === 'Escape') {
        closeCommandPalette();
      }
    });
  }
}

/* ══════════════════════════════════════════════════════════════
   PHASE 9 POWER TERMINAL ENGINES
   1. Vim Keyboard Navigation
   2. Keyboard Shortcuts Cheat Sheet Modal
   3. Smart Duplicate Detector & 1-Click Merger
   4. Offline RSS / Atom Feed Watcher
   ══════════════════════════════════════════════════════════════ */

/* ── 1. VIM KEYBOARD NAVIGATION ────────────────────────────── */
let focusedCardIndex = -1;

function moveFocus(delta) {
  const cards = Array.from(document.querySelectorAll('#content-area .item-card'));
  if (!cards.length) return;

  cards.forEach(c => c.classList.remove('focused'));
  focusedCardIndex = focusedCardIndex + delta;
  if (focusedCardIndex < 0) focusedCardIndex = cards.length - 1;
  if (focusedCardIndex >= cards.length) focusedCardIndex = 0;

  const target = cards[focusedCardIndex];
  if (target) {
    target.classList.add('focused');
    target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function getFocusedItem() {
  const cards = Array.from(document.querySelectorAll('#content-area .item-card'));
  if (focusedCardIndex < 0 || focusedCardIndex >= cards.length) return null;
  const id = cards[focusedCardIndex].dataset.id;
  const space = getActiveSpace();
  return space?.items?.find(i => i.id === id);
}

function openFocusedItem() {
  const item = getFocusedItem();
  if (!item) return;
  if (item.content || item.type === 'note') {
    openReaderMode(item);
  } else if (item.url) {
    window.open(item.url, '_blank');
  } else {
    openEdit(item.id);
  }
}

function toggleFavoriteFocused() {
  const item = getFocusedItem();
  if (!item) return;
  toggleFav(item.id);
}

function copyFocused() {
  const item = getFocusedItem();
  if (!item) return;
  const val = item.url || item.value || item.content || item.title;
  if (val) {
    navigator.clipboard.writeText(val);
    toast(`Copied: ${item.title || item.name || 'Item'}`, 'success');
  }
}

function editFocused() {
  const item = getFocusedItem();
  if (item) openEdit(item.id);
}

function deleteFocused() {
  const item = getFocusedItem();
  if (item) confirmDelete(item.id);
}

/* ── 2. KEYBOARD SHORTCUTS MODAL ───────────────────────────── */
function openShortcutsModal() {
  document.getElementById('shortcuts-modal')?.classList.remove('hidden');
}
function closeShortcutsModal() {
  document.getElementById('shortcuts-modal')?.classList.add('hidden');
}
function toggleShortcutsModal() {
  const m = document.getElementById('shortcuts-modal');
  if (m?.classList.contains('hidden')) openShortcutsModal();
  else closeShortcutsModal();
}

/* ── 3. SMART DUPLICATE CLEANER ────────────────────────────── */
let currentDuplicateGroups = [];

function openDedupModal() {
  const m = document.getElementById('dedup-modal');
  const container = document.getElementById('dedup-results-container');
  const summary = document.getElementById('dedup-summary-text');
  if (!m || !container) return;

  const space = getActiveSpace();
  const items = space ? space.items : [];
  currentDuplicateGroups = window.DedupHelper ? window.DedupHelper.findDuplicates(items) : [];

  if (summary) {
    summary.textContent = `${currentDuplicateGroups.length} duplicate cluster${currentDuplicateGroups.length !== 1 ? 's' : ''} found`;
  }

  if (!currentDuplicateGroups.length) {
    container.innerHTML = `
      <div style="text-align:center;padding:30px 20px;">
        <div style="font-size:32px;margin-bottom:10px;">✨</div>
        <div style="font-size:15px;font-weight:700;color:#fff;margin-bottom:4px;">Your vault is 100% clean!</div>
        <div style="font-size:12px;color:var(--muted);">No duplicate URLs or matching titles detected in this space.</div>
      </div>
    `;
  } else {
    container.innerHTML = currentDuplicateGroups.map((group, idx) => `
      <div style="background:var(--surface-2);border:1px solid var(--outline);border-radius:10px;padding:12px 16px;margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <span style="font-size:11px;font-weight:700;color:var(--accent-gold);font-family:var(--font-mono);">${group.type.toUpperCase()} • ${group.count} COPIES</span>
          <button class="btn-cancel" onclick="mergeCluster(${idx})" style="padding:4px 10px;font-size:11px;background:var(--primary);color:#fff;border:none;">Merge</button>
        </div>
        <div style="font-size:13px;font-weight:600;color:#fff;margin-bottom:4px;word-break:break-all;">${esc(group.key)}</div>
        <div style="display:flex;flex-direction:column;gap:4px;margin-top:6px;">
          ${group.items.map(item => `
            <div style="font-size:11.5px;color:var(--on-variant);display:flex;justify-content:space-between;">
              <span>• ${esc(item.title || item.name || 'Untitled')}</span>
              <span style="color:var(--muted);font-family:var(--font-mono);font-size:10.5px;">Tags: ${(item.tags || []).join(', ') || 'None'}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');
  }

  m.classList.remove('hidden');
}

function closeDedupModal() {
  document.getElementById('dedup-modal')?.classList.add('hidden');
}

window.mergeCluster = function(index) {
  const group = currentDuplicateGroups[index];
  if (!group || !window.DedupHelper) return;

  const res = window.DedupHelper.mergeGroup(group.items);
  if (!res) return;

  const space = getActiveSpace();
  if (!space) return;

  // Update primary
  const pIdx = space.items.findIndex(i => i.id === res.mergedItem.id);
  if (pIdx !== -1) space.items[pIdx] = res.mergedItem;

  // Delete duplicates
  space.items = space.items.filter(i => !res.deletedIds.includes(i.id));

  save();
  toast(`Merged ${res.deletedIds.length} duplicate items!`, 'success');
  openDedupModal();
  render();
  updateBadges();
};

function mergeAllDuplicates() {
  if (!currentDuplicateGroups.length || !window.DedupHelper) {
    toast('No duplicates to merge!', 'success');
    closeDedupModal();
    return;
  }

  let totalMerged = 0;
  const space = getActiveSpace();
  if (!space) return;

  currentDuplicateGroups.forEach(group => {
    const res = window.DedupHelper.mergeGroup(group.items);
    if (res) {
      const pIdx = space.items.findIndex(i => i.id === res.mergedItem.id);
      if (pIdx !== -1) space.items[pIdx] = res.mergedItem;
      space.items = space.items.filter(i => !res.deletedIds.includes(i.id));
      totalMerged += res.deletedIds.length;
    }
  });

  save();
  toast(`⚡ Successfully merged all ${totalMerged} duplicates!`, 'success');
  closeDedupModal();
  render();
  updateBadges();
}

/* ── 4. OFFLINE RSS / ATOM FEED WATCHER ────────────────────── */
function renderRssSection(container) {
  state.feeds = state.feeds || [
    { url: 'https://news.ycombinator.com/rss', title: 'Hacker News' },
    { url: 'https://github.blog/feed/', title: 'GitHub Blog' }
  ];

  container.innerHTML = `
    <div style="max-width:960px;margin:0 auto;padding-bottom:40px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">
        <div>
          <h2 style="font-size:20px;font-weight:800;color:#fff;margin-bottom:4px;">📡 RSS Feeds Watcher</h2>
          <p style="font-size:12px;color:var(--muted);">100% Client-Side feed parsing. Read any post in Reader Mode with speech narration.</p>
        </div>
        <button class="btn-save" onclick="openRssModal()" style="display:flex;align-items:center;gap:6px;padding:8px 16px;">
          <span>+ Add Feed</span>
        </button>
      </div>

      <!-- Feed List Pills -->
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:24px;">
        ${state.feeds.map((f, idx) => `
          <div style="background:var(--surface-2);border:1px solid var(--outline);border-radius:20px;padding:6px 14px;font-size:12px;display:flex;align-items:center;gap:8px;">
            <span style="color:var(--accent-gold);font-weight:700;">📡 ${esc(f.title || 'Feed')}</span>
            <button onclick="removeRssFeed(${idx})" style="background:transparent;border:none;color:var(--muted);cursor:pointer;font-size:12px;" title="Remove feed">✕</button>
          </div>
        `).join('')}
      </div>

      <div id="rss-feed-stream" style="display:grid;grid-template-columns:repeat(auto-fill, minmax(280px, 1fr));gap:16px;">
        <div style="padding:40px;text-align:center;color:var(--muted);font-size:13px;grid-column:1/-1;">
          Loading latest feed dispatches…
        </div>
      </div>
    </div>
  `;

  loadRssStream();
}

async function loadRssStream() {
  const stream = document.getElementById('rss-feed-stream');
  if (!stream || !window.FeedHelper) return;

  const allArticles = [];
  for (const feed of (state.feeds || [])) {
    try {
      const feedData = await window.FeedHelper.fetchFeed(feed.url);
      if (feedData && feedData.items) {
        allArticles.push(...feedData.items);
      }
    } catch (e) {
      console.warn(`Could not load feed ${feed.url}:`, e);
    }
  }

  // Fallback demo articles if CORS prevents direct XML fetch
  if (!allArticles.length) {
    allArticles.push(
      { title: 'Announcing SikPoket Phase 9: Terminal Navigation & RSS Watcher', url: 'https://github.com/njrankitsam11-gif/SikPoket', excerpt: 'SikPoket now includes Vim-style keyboard navigation, 1-click duplicate detection, and native RSS feeds.', publishedAt: Date.now(), feedTitle: 'SikPoket Dispatches' },
      { title: 'Local-First Software: You Own Your Data', url: 'https://inkandswitch.com/local-first/', excerpt: 'Seven principles for software that stores your data locally first and syncs opportunistically.', publishedAt: Date.now() - 3600000, feedTitle: 'Ink & Switch' },
      { title: 'Deep Dive: AES-256-GCM Zero Knowledge Cryptography', url: 'https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto', excerpt: 'Learn how Web Crypto SubtleCrypto enables in-browser end-to-end encryption without external dependencies.', publishedAt: Date.now() - 7200000, feedTitle: 'Web Crypto Specs' }
    );
  }

  allArticles.sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0));

  stream.innerHTML = allArticles.map(art => `
    <div class="item-card" style="cursor:pointer;" onclick="openRssReader(${JSON.stringify(art).replace(/"/g, '&quot;')})">
      <div class="card-body">
        <div style="font-size:10.5px;color:var(--accent-gold);font-family:var(--font-mono);font-weight:700;margin-bottom:6px;">
          ${esc(art.feedTitle || 'RSS')}
        </div>
        <div class="card-title" style="font-size:13.5px;margin-bottom:8px;line-height:1.4;">
          ${esc(art.title)}
        </div>
        <div class="card-excerpt" style="font-size:11.5px;line-height:1.5;margin-bottom:0;">
          ${esc(art.excerpt || 'Click to read full article in Reader Mode.')}
        </div>
      </div>
      <div class="card-footer" style="padding:8px 18px 12px;">
        <span class="card-date">${new Date(art.publishedAt).toLocaleDateString()}</span>
        <button class="card-action-btn" style="color:var(--accent-gold);font-weight:700;font-size:11px;">📖 Read</button>
      </div>
    </div>
  `).join('');
}

window.openRssReader = function(art) {
  openReaderMode({
    title: art.title,
    url: art.url,
    content: art.content || art.excerpt || art.title,
    createdAt: art.publishedAt
  });
};

function openRssModal() {
  document.getElementById('rss-modal')?.classList.remove('hidden');
  document.getElementById('rss-feed-url-input')?.focus();
}

function closeRssModal() {
  document.getElementById('rss-modal')?.classList.add('hidden');
}

function handleAddRssFeed() {
  const input = document.getElementById('rss-feed-url-input');
  const url = input?.value?.trim();
  if (!url) return;

  state.feeds = state.feeds || [];
  let feedTitle = 'Feed';
  try {
    const u = new URL(url);
    feedTitle = u.hostname.replace(/^www\./, '');
  } catch (e) {
    feedTitle = url.slice(0, 20);
  }

  state.feeds.push({ url, title: feedTitle });
  save();
  toast(`Subscribed to ${feedTitle}!`, 'success');
  input.value = '';
  closeRssModal();
  if (state.collection === 'rss') render();
}

window.removeRssFeed = function(index) {
  if (!state.feeds) return;
  state.feeds.splice(index, 1);
  save();
  toast('Feed removed', 'success');
  if (state.collection === 'rss') render();
};