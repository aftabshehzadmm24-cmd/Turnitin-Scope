const CACHE_PREFIX = 'turnitscope-shell-';
const CACHE_NAME = `${CACHE_PREFIX}v1`;
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (
    request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api/')
  ) {
    return;
  }

  if (request.mode === 'navigate') {
    const networkResponse = fetch(request);
    event.waitUntil(
      networkResponse
        .then(response => response.ok
          ? caches.open(CACHE_NAME).then(cache => cache.put('/index.html', response.clone()))
          : undefined)
        .catch(() => undefined)
    );
    event.respondWith(
      networkResponse.catch(async () => (await caches.match('/index.html')) || (await caches.match('/')))
    );
    return;
  }

  if (['script', 'style', 'font', 'image'].includes(request.destination)) {
    const networkResponse = fetch(request).then(response => {
      if (response.ok) {
        const copy = response.clone();
        return caches.open(CACHE_NAME)
          .then(cache => cache.put(request, copy))
          .then(() => response);
      }
      return response;
    });
    event.waitUntil(networkResponse.then(() => undefined).catch(() => undefined));
    event.respondWith(
      caches.match(request).then(cached => cached || networkResponse)
    );
  }
});
