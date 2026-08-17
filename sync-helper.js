/**
 * SikPoket Encrypted Cloud Sync Helper
 * Supports zero-server, end-to-end encrypted backup to private GitHub Gists.
 */

(function(global) {
  const GIST_FILENAME = 'sikpoket-vault.enc.json';

  const SyncHelper = {
    // Test GitHub Token validity
    validateToken: async function(token) {
      if (!token) throw new Error('Token required');
      const res = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${token.trim()}`,
          Accept: 'application/vnd.github.v3+json'
        }
      });
      if (!res.ok) throw new Error(`GitHub auth failed (${res.status})`);
      const user = await res.json();
      return { username: user.login, name: user.name || user.login };
    },

    // Push encrypted vault to GitHub Gist
    pushToGist: async function(token, gistId, rawData, masterPassword) {
      if (!token) throw new Error('GitHub token missing');
      if (!masterPassword) throw new Error('Master password required to encrypt vault');

      // 1. Encrypt payload
      const jsonString = JSON.stringify(rawData);
      let payload = jsonString;
      if (global.CryptoHelper) {
        const encryptedObj = await global.CryptoHelper.encrypt(jsonString, masterPassword);
        payload = JSON.stringify({
          version: 3,
          encrypted: true,
          updatedAt: new Date().toISOString(),
          data: encryptedObj
        });
      }

      // 2. Create or Update Gist
      const isUpdate = !!gistId;
      const url = isUpdate ? `https://api.github.com/gists/${gistId}` : 'https://api.github.com/gists';
      const method = isUpdate ? 'PATCH' : 'POST';

      const body = {
        description: 'SikPoket Encrypted Vault Backup (Client-Side Encrypted)',
        public: false,
        files: {
          [GIST_FILENAME]: {
            content: payload
          }
        }
      };

      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token.trim()}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Gist push failed (${res.status})`);
      }

      const result = await res.json();
      return {
        gistId: result.id,
        updatedAt: result.updated_at,
        htmlUrl: result.html_url
      };
    },

    // Pull and decrypt vault from GitHub Gist
    pullFromGist: async function(token, gistId, masterPassword) {
      if (!token || !gistId) throw new Error('Token and Gist ID required');

      const res = await fetch(`https://api.github.com/gists/${gistId}`, {
        headers: {
          Authorization: `Bearer ${token.trim()}`,
          Accept: 'application/vnd.github.v3+json'
        }
      });

      if (!res.ok) throw new Error(`Failed to fetch Gist (${res.status})`);
      const result = await res.json();
      const file = result.files[GIST_FILENAME];
      if (!file) throw new Error('No SikPoket vault found in this Gist');

      const rawContent = file.content;
      try {
        const parsed = JSON.parse(rawContent);
        if (parsed.encrypted && parsed.data && global.CryptoHelper) {
          const decrypted = await global.CryptoHelper.decrypt(parsed.data, masterPassword);
          return JSON.parse(decrypted.value);
        }
        return parsed;
      } catch (e) {
        throw new Error('Failed to decrypt Gist vault. Incorrect master password?');
      }
    }
  };

  global.SyncHelper = SyncHelper;
})(typeof window !== 'undefined' ? window : globalThis);
