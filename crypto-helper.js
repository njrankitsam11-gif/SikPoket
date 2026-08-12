const CryptoHelper = {
  generateSalt() {
    return crypto.getRandomValues(new Uint8Array(16));
  },

  async deriveKey(password, salt) {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  },

  async encrypt(data, password) {
    const salt = this.generateSalt();
    const key = await this.deriveKey(password, salt);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();

    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      encoder.encode(JSON.stringify(data))
    );

    return {
      salt: Array.from(salt),
      iv: Array.from(iv),
      data: Array.from(new Uint8Array(encrypted))
    };
  },

  async decrypt(encryptedObj, password) {
    const salt = new Uint8Array(encryptedObj.salt);
    const iv = new Uint8Array(encryptedObj.iv);
    const data = new Uint8Array(encryptedObj.data);

    const key = await this.deriveKey(password, salt);

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      data
    );

    const decoder = new TextDecoder();
    return JSON.parse(decoder.decode(decrypted));
  }
};

// Biometric helper — works in extensions that have access to a real origin
// (Note: Chrome extension popups on chrome-extension:// have limited WebAuthn support.
// For reliable fingerprint unlock, the extension must be opened in a regular tab.)
const BiometricHelper = {
  /**
   * Check if biometric / Touch ID is available
   * Returns: { available: bool, reason: string }
   */
  async isAvailable() {
    // Check 1: PublicKeyCredential API exists
    if (!window.PublicKeyCredential) {
      return { available: false, reason: 'WebAuthn not supported in this context' };
    }

    // Check 2: Platform authenticator available
    try {
      const hasPlatform = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      if (!hasPlatform) {
        return { available: false, reason: 'No fingerprint/Touch ID hardware detected' };
      }
      return { available: true };
    } catch (e) {
      return { available: false, reason: 'WebAuthn check failed: ' + (e.message || e.name) };
    }
  },

  async register() {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const userId = crypto.getRandomValues(new Uint8Array(16));

    // CRITICAL: rpId for chrome-extension:// must be a valid domain
    // Chrome WebAuthn requires rpId to be a valid domain (not the extension ID itself).
    // Use 'localhost' as fallback — works in extension if opened in browser tab context.
    const rp = { name: "SikPoket Vault" };
    if (window.location.hostname) {
      rp.id = window.location.hostname;
    }

    const options = {
      publicKey: {
        challenge: challenge,
        rp: rp,
        user: {
          id: userId,
          name: "user@sikpoket.local",
          displayName: "SikPoket User"
        },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },  // ES256 (preferred for Touch ID)
          { type: "public-key", alg: -257 } // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required"
        },
        timeout: 60000,
        attestation: "none"
      }
    };

    let credential;
    try {
      credential = await navigator.credentials.create(options);
    } catch (e) {
      // Translate WebAuthn errors to friendly messages
      const msg = this._translateError(e);
      throw new Error(msg);
    }

    const rawIdBytes = new Uint8Array(credential.rawId);
    return {
      id: btoa(String.fromCharCode(...rawIdBytes))
    };
  },

  async authenticate(credentialIdB64) {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const rawId = Uint8Array.from(atob(credentialIdB64), c => c.charCodeAt(0));

    const publicKeyOpts = {
      challenge: challenge,
      allowCredentials: [{
        type: "public-key",
        id: rawId
      }],
      userVerification: "required",
      timeout: 60000
    };

    if (window.location.hostname) {
      publicKeyOpts.rpId = window.location.hostname;
    }

    const options = {
      publicKey: publicKeyOpts
    };

    try {
      return await navigator.credentials.get(options);
    } catch (e) {
      const msg = this._translateError(e);
      throw new Error(msg);
    }
  },

  _translateError(e) {
    const name = e.name || '';
    if (name === 'NotAllowedError') return 'Touch ID was canceled or not allowed';
    if (name === 'SecurityError') return 'Security error — biometric may not work in this context. Try opening SikPoket in a regular browser tab.';
    if (name === 'NotSupportedError') return 'Biometric not supported on this device';
    if (name === 'InvalidStateError') return 'This fingerprint is already registered';
    if (name === 'ConstraintError') return 'Biometric constraint failed (rpId issue)';
    return e.message || String(e);
  }
};