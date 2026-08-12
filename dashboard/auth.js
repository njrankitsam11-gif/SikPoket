/* =====================================================
   SikPoket — Auth (login / register)
   Multi-user with SHA-256 hashed passwords
   Each user has their own data namespace
   ===================================================== */

const AUTH_DB_KEY = 'sikpoket_users_db';

let mode = 'login';

function sha256(str) {
  const enc = new TextEncoder();
  const d = enc.encode(str);
  return crypto.subtle.digest('SHA-256', d).then(buf =>
    Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
  );
}
function genSalt() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, '0')).join('');
}
async function hashPw(password, salt) { return sha256(password + salt); }
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

function showMsg(text, ok) {
  const e = document.getElementById('msg');
  e.textContent = text; e.className = 'error-msg' + (ok ? ' success-msg' : '');
}

// Tab switch
document.querySelectorAll('.tab-btn').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('.tab-btn').forEach(x => x.classList.remove('active'));
  b.classList.add('active');
  mode = b.dataset.mode || 'login';
  const cg = document.getElementById('confirm-group');
  if (cg) {
    cg.classList.toggle('hidden', mode !== 'register');
    cg.style.display = mode === 'register' ? 'block' : 'none';
  }
  document.getElementById('submit-btn').textContent = mode === 'login' ? 'Login' : 'Create Account';
  document.getElementById('confirm-password').required = mode === 'register';
  showMsg('');
}));

// Submit
document.getElementById('auth-form').addEventListener('submit', async e => {
  e.preventDefault();
  const user = document.getElementById('username').value.trim().toLowerCase();
  const pass = document.getElementById('password').value;

  if (!user || !pass) { showMsg('Fill in all fields'); return; }
  if (user.length < 3) { showMsg('Username: 3+ characters'); return; }
  if (pass.length < 4) { showMsg('Password: 4+ characters'); return; }

  const btn = document.getElementById('submit-btn'); btn.disabled = true;

  if (mode === 'register') {
    const confirm = document.getElementById('confirm-password').value;
    if (pass !== confirm) { showMsg('Passwords do not match'); btn.disabled = false; return; }
    await doRegister(user, pass);
  } else {
    await doLogin(user, pass);
  }
  btn.disabled = false;
});

document.getElementById('guest-btn')?.addEventListener('click', () => {
  const guestUser = 'guest';
  seedUserData(guestUser);
  sessionStorage.setItem('sikpoket_user', guestUser);
  window.location.href = 'index.html';
});

async function doRegister(username, password) {
  const db = getDb();
  if (db[username]) { showMsg('Username already taken'); return; }

  const salt = genSalt();
  const hash = await hashPw(password, salt);
  db[username] = { hash, salt, createdAt: Date.now() };
  localStorage.setItem(AUTH_DB_KEY, JSON.stringify(db));

  // Seed this user with demo spaces
  seedUserData(username);

  showMsg('Account created!', true);
  loginSuccess(username, 600);
}

async function doLogin(username, password) {
  const db = getDb();
  const u = db[username];
  if (!u) { showMsg('User not found. Register first.'); return; }

  const hash = await hashPw(password, u.salt);
  if (hash !== u.hash) { showMsg('Wrong password'); return; }

  showMsg('Welcome!', true);
  loginSuccess(username, 300);
}

function loginSuccess(user, delay) {
  sessionStorage.setItem('sikpoket_user', user);
  setTimeout(() => { window.location.href = 'index.html'; }, delay);
}

function getDb() {
  try { return JSON.parse(localStorage.getItem(AUTH_DB_KEY)) || {}; }
  catch { return {}; }
}

function seedUserData(user) {
  const ukey = 'sikpoket_' + user;
  if (localStorage.getItem(ukey)) return;
  const s1 = genId(), s2 = genId(), s3 = genId();
  const data = {
    spaces: [
      { id: s1, name: 'Startups', wallpaper: 'https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=1200&q=80',
        items: [
          { id: genId(), type: 'url', createdAt: Date.now() - 432000000, title: 'Raindrop.io', url: 'https://raindrop.io', tags: ['tools'], favorite: true, archived: false },
          { id: genId(), type: 'url', createdAt: Date.now() - 259200000, title: 'MDN Web Docs', url: 'https://developer.mozilla.org', tags: ['dev'], favorite: false, archived: false },
          { id: genId(), type: 'note', createdAt: Date.now() - 86400000, title: 'Q3 Review', content: 'Retention up, ship by August.', tags: ['work'], favorite: true, archived: false }
        ]
      },
      { id: s2, name: 'Research', wallpaper: 'https://images.unsplash.com/photo-1507693769325-4b6d49b0ba76?w=1200&q=80',
        items: [
          { id: genId(), type: 'url', createdAt: Date.now() - 36000000, title: 'arXiv ML Papers', url: 'https://arxiv.org/list/cs.LG/recent', tags: ['papers', 'ai'], favorite: false, archived: false },
          { id: genId(), type: 'note', createdAt: Date.now() - 7200000, title: 'Research Ideas', content: 'Transformer architectures for edge devices.', tags: ['ideas'], favorite: false, archived: false }
        ]
      },
      { id: s3, name: 'Personal', wallpaper: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&q=80',
        items: [
          { id: genId(), type: 'url', createdAt: Date.now(), title: 'Netflix', url: 'https://netflix.com', tags: ['entertainment'], favorite: false, archived: false },
          { id: genId(), type: 'password', createdAt: Date.now(), name: 'GitHub', username: 'user@email.com', value: '•••••', tags: ['dev'], favorite: false, archived: false }
        ]
      }
    ],
    activeSpace: s1
  };
  localStorage.setItem(ukey, JSON.stringify(data));
}

// Check if already logged in
(function init() {
  const u = sessionStorage.getItem('sikpoket_user');
  if (u) window.location.href = 'index.html';
})();