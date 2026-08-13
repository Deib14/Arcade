/* ============================================================
   Corner Arcade — sw.js
   Cache-first service worker. Bump CACHE_VERSION whenever any
   cached file changes — that's what forces old clients to pick
   up the new build instead of serving stale JS forever.
   ============================================================ */

const CACHE_VERSION = 'corner-arcade-v2.11.0';

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/style.css',
  '/js/core/storage.js',
  '/js/core/sound.js',
  '/js/core/achievements.js',
  '/js/core/difficulty.js',
  '/js/core/shell.js',
  '/js/games/flappy.js',
  '/js/games/snake.js',
  '/js/games/breakout.js',
  '/js/games/g2048.js',
  '/js/games/dino.js',
  '/js/games/pong.js',
  '/js/games/memory.js',
  '/js/games/whack.js',
  '/js/games/minesweeper.js',
  '/js/games/tetris.js',
  '/js/games/invaders.js',
  '/js/games/sudoku.js',
  '/js/games/spaceimpact.js',
  '/js/games/bounce.js',
  '/js/app.js',
  '/js/pwa.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith('corner-arcade-') && key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Only handle same-origin GET requests — everything else (e.g. any
  // future cross-origin API calls) passes straight through to the network.
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        // Cache-first: serve immediately, refresh the cache in the
        // background so next launch has whatever changed server-side.
        fetchAndCache(event.request);
        return cached;
      }
      return fetchAndCache(event.request);
    })
  );
});

function fetchAndCache(request) {
  return fetch(request)
    .then((response) => {
      if (response && response.status === 200) {
        const clone = response.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
      }
      return response;
    })
    .catch(() => caches.match(request));
}

// Lets the page force this waiting worker to activate immediately
// when the user taps "refresh" on the update banner.
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
