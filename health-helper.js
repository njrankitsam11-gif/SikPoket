/**
 * SikPoket Health Helper
 * Performs background health checks on saved URLs to detect broken links.
 */

(function(global) {
  const HealthHelper = {
    scanAll: async function() {
      try {
        const data = await chrome.storage.local.get(['sikpoketData', 'sikpoketDashboardData']);
        const urlsToCheck = [];
        
        // Grab from popup data
        if (data.sikpoketData && data.sikpoketData.urls) {
           urlsToCheck.push(...data.sikpoketData.urls.filter(i => !i.archived && i.url).map(i => ({id: i.id, url: i.url})));
        }
        
        // Grab from dashboard spaces
        if (data.sikpoketDashboardData && data.sikpoketDashboardData.spaces) {
           for (const space of data.sikpoketDashboardData.spaces) {
             if (space.items) {
               urlsToCheck.push(...space.items.filter(i => i.type === 'url' && !i.archived && i.url).map(i => ({id: i.id, url: i.url})));
             }
           }
        }
        
        const brokenIds = new Set();
        
        // Lightweight batched HEAD requests
        const checks = urlsToCheck.map(async (item) => {
          try {
            const ctrl = new AbortController();
            const t = setTimeout(() => ctrl.abort(), 8000);
            await fetch(item.url, { method: 'HEAD', mode: 'no-cors', signal: ctrl.signal });
            clearTimeout(t);
          } catch (e) {
            if (e.name === 'AbortError' || !navigator.onLine) {
              brokenIds.add(item.id);
            }
          }
        });
        
        await Promise.all(checks);
        
        // Store the results
        const resultArr = Array.from(brokenIds);
        await chrome.storage.local.set({ sikpoketBrokenLinks: resultArr });
        return resultArr;
      } catch (e) {
        console.warn('Health check failed', e);
        return [];
      }
    }
  };

  global.HealthHelper = HealthHelper;
})(typeof self !== 'undefined' ? self : this);
