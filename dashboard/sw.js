/**
 * SikPoket Dashboard Service Worker
 * Provides offline caching and instant loading for PWA desktop mode.
 */

const CACHE_NAME = 'sikpoket-pwa-v1.5.2';
const ASSETS_TO_CACHE = [
  '/dashboard/index.html',
  '/dashboard/app.css',
  '/dashboard/app.js',
  '/dashboard/standalone.html',
  '/qr-helper.js',
  '/ai-helper.js',
  '/audio-helper.js',
  '/search-helper.js',
  '/graph-helper.js',
  '/reader-helper.js',
  '/icons/icon16.png',
  '/icons/icon48.png',
  '/icons/icon128.png',
  '/dashboard/manifest.webmanifest'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('PWA service worker asset caching skipped for some routes:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  // Network first for fresh styling updates, fallback to cache
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        }
        return networkResponse;
      })
      .catch(() => caches.match(event.request))
  );
});
