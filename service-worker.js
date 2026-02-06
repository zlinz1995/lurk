// Lurk service worker - caches core assets for offline use
const CACHE_NAME = 'lurk-v3';
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

// Fetch - serve cached assets when offline
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

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          // Cache new files on the fly
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match('/index.html')); // fallback offline
    })
  );
});
