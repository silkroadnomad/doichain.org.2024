const CACHE_NAME = 'doichain-cache-v1';
const urlsToCache = [
  '/',
//   '/index.html',
//   '/global.css',
//   '/build/bundle.css',
//   '/build/bundle.js'
];

self.addEventListener('install', (event) => {
  // Automatically take control of clients when new service worker is installed
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener('activate', (event) => {
  // Automatically claim clients when service worker activates
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              return caches.delete(cacheName);
            }
          })
        );
      })
    ])
  );
});

self.addEventListener('fetch', (event) => {
  // Skip non-HTTP(S) requests and specific protocols
  if (
    event.request.url.includes('libp2p') ||
    event.request.url.startsWith('chrome-extension://') ||
    !event.request.url.startsWith('http')
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Always try network first, fall back to cache
        return fetch(event.request)
          .then(networkResponse => {
            // Update cache with new response
            if (networkResponse.ok) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, responseClone);
              });
            }
            return networkResponse;
          })
          .catch(() => {
            // Return cached response if network fails
            return response || caches.match('/offline.html');
          });
      })
  );
});

// Optional: Listen for new content
self.addEventListener('sync', (event) => {
  if (event.tag === 'update-content') {
    event.waitUntil(
      // Perform background sync
      updateContent()
    );
  }
});

// Optional: Listen for push notifications
self.addEventListener('push', (event) => {
  if (event.data) {
    const options = {
      body: event.data.text(),
      icon: '/icon.png',
      badge: '/badge.png'
    };
    
    event.waitUntil(
      self.registration.showNotification('Update Available', options)
    );
  }
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
