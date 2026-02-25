// Lurk service worker - cache static assets, but keep HTML fresh.
const CACHE_NAME = 'lurk-v4';
const ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/main.js',
  '/favicon.png',
  '/manifest.json',
  '/socket.io/socket.io.js'
];

// Install - cache all static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate - cleanup old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch strategy:
// - HTML/documents: network-first (prevents stale app pages)
// - Static assets: cache-first with background refresh
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  const accept = request.headers.get('accept') || '';
  const isSameOrigin = url.origin === self.location.origin;
  const isSocket = url.pathname.startsWith('/socket.io/');
  const isApi =
    url.pathname.startsWith('/threads') ||
    url.pathname.startsWith('/auth') ||
    url.pathname.startsWith('/admin') ||
    url.pathname.startsWith('/users') ||
    url.pathname.startsWith('/reports') ||
    url.pathname.startsWith('/uploads') ||
    url.pathname.startsWith('/health') ||
    url.pathname.startsWith('/_next/data') ||
    accept.includes('application/json');

  // Skip API and cross-origin requests so thread/post data is always fresh
  if (request.method !== 'GET' || !isSameOrigin || isSocket || isApi) return;

  const isDocument =
    request.mode === 'navigate' ||
    request.destination === 'document' ||
    accept.includes('text/html');

  if (isDocument) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          return caches.match('/index.html');
        })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        });

      if (cached) {
        event.waitUntil(networkFetch.catch(() => null));
        return cached;
      }
      return networkFetch.catch(() => caches.match('/index.html'));
    })
  );
});
