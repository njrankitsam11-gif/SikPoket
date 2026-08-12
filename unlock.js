// unlock.js — SikPoket biometric unlock page logic
// Moved out of unlock.html inline script to comply with Chrome MV3 CSP.

const s    = document.getElementById('status');
const ub   = document.getElementById('unlock-btn');
const rb   = document.getElementById('register-btn');
const pw   = document.getElementById('master-pw-input');
const hint = document.getElementById('hint');

// If already unlocked in popup session, just show a message.
if (sessionStorage.getItem('sikpoketMasterPassword')) {
  s.textContent = '✅ Already unlocked! Close this tab and use the popup.';
  ub.style.display = 'none';
  rb.style.display = 'none';
}

// ── UNLOCK with Touch ID ────────────────────────────────────────────────────
ub.onclick = async function () {
  s.textContent  = 'Touch your fingerprint sensor...';
  ub.disabled    = true;

  try {
    const credId     = localStorage.getItem('sikpoketBiometricCredId');
    const bioKey     = localStorage.getItem('sikpoketBioKey');
    const wrappedRaw = localStorage.getItem('sikpoketWrappedPassword');

    if (!credId || !bioKey || !wrappedRaw) {
      s.textContent = '⚠️ No fingerprint registered. Register first below.';
      ub.disabled   = false;
      return;
    }

    await BiometricHelper.authenticate(credId);
    const wrapped   = JSON.parse(wrappedRaw);
    const decrypted = await CryptoHelper.decrypt(wrapped, bioKey);

    if (decrypted && decrypted.value) {
      sessionStorage.setItem('sikpoketMasterPassword', decrypted.value);
      s.style.color  = '#5dcaa5';
      s.textContent  = '✅ Unlocked! Reopen the popup extension now.';
      ub.style.display = 'none';
      rb.style.display = 'none';
    }
  } catch (e) {
    s.style.color = '#e05353';
    s.textContent = '❌ ' + (e.message || e.name);
    ub.disabled   = false;
  }
};

// ── REGISTER Touch ID ───────────────────────────────────────────────────────
rb.onclick = async function () {
  // First click: show password field
  if (pw.style.display === 'none' || !pw.style.display) {
    pw.style.display = 'block';
    pw.focus();
    rb.textContent = 'Confirm — Save Password & Register Touch ID';
    hint.textContent = 'Type your master password, then press this button.';
    return;
  }

  const mp = pw.value.trim();
  if (!mp) { s.textContent = 'Enter your master password first'; return; }

  rb.disabled   = true;
  s.textContent = 'Registering...';

  try {
    const cred = await BiometricHelper.register();
    if (cred && cred.id) {
      const bioKey  = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
      const wrapped = await CryptoHelper.encrypt({ value: mp }, bioKey);

      localStorage.setItem('sikpoketBiometricEnabled', 'true');
      localStorage.setItem('sikpoketBiometricCredId', cred.id);
      localStorage.setItem('sikpoketBioKey', bioKey);
      localStorage.setItem('sikpoketWrappedPassword', JSON.stringify(wrapped));

      s.style.color  = '#5dcaa5';
      s.textContent  = '✅ Touch ID registered! Now unlock with the button above.';
      pw.style.display = 'none';
      rb.textContent   = '👆 Registered — tap unlock above';
    }
  } catch (e) {
    s.style.color = '#e05353';
    s.textContent = '❌ ' + (e.message || e.name);
    rb.disabled   = false;
  }
};

// ── Auto-trigger unlock if already registered ───────────────────────────────
setTimeout(function () {
  const credId = localStorage.getItem('sikpoketBiometricCredId');
  if (credId) ub.click();
}, 200);
