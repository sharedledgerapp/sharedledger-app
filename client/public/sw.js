const CACHE_VERSION = 'v5';
const STATIC_CACHE = `sharedledger-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `sharedledger-dynamic-${CACHE_VERSION}`;

const PRECACHE_ASSETS = [
  '/',
  '/manifest.json',
  '/favicon.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

const API_ROUTES = ['/api/'];
const NAVIGATION_FALLBACK = '/';

self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Pre-caching core assets');
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => {
        console.log('[SW] Installation complete');
      })
  );
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => {
            return (name.startsWith('family-ledger-') || name.startsWith('sharedledger-')) && 
                   name !== STATIC_CACHE && 
                   name !== DYNAMIC_CACHE;
          })
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      console.log('[SW] Claiming clients');
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  if (event.request.method !== 'GET') {
    return;
  }

  if (url.origin !== location.origin) {
    return;
  }

  const isApiRequest = API_ROUTES.some(route => url.pathname.startsWith(route));
  const isAssetRequest = url.pathname.startsWith('/assets/') || 
                         url.pathname.endsWith('.js') || 
                         url.pathname.endsWith('.css') ||
                         url.pathname.endsWith('.woff') ||
                         url.pathname.endsWith('.woff2');
  const isNavigationRequest = event.request.mode === 'navigate';

  if (isApiRequest) {
    event.respondWith(networkFirst(event.request));
  } else if (isNavigationRequest) {
    event.respondWith(navigationHandler(event.request));
  } else if (isAssetRequest) {
    event.respondWith(cacheFirstWithNetwork(event.request));
  } else {
    event.respondWith(cacheFirst(event.request));
  }
});

self.addEventListener('push', (event) => {
  let data = { title: 'SharedLedger', body: 'You have a new notification' };
  
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: data.tag || 'sharedledger-notification',
    data: {
      url: data.url || '/',
    },
    vibrate: [200, 100, 200],
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(urlToOpen);
          return client.focus();
        }
      }
      return self.clients.openWindow(urlToOpen);
    })
  );
});

async function navigationHandler(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(NAVIGATION_FALLBACK, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log('[SW] Navigation offline, serving cached fallback');
    const cachedResponse = await caches.match(NAVIGATION_FALLBACK);
    if (cachedResponse) {
      return cachedResponse;
    }
    return new Response(
      '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Offline</title></head><body><h1>You are offline</h1><p>Please check your internet connection and try again.</p></body></html>',
      { status: 503, headers: { 'Content-Type': 'text/html' } }
    );
  }
}

async function cacheFirstWithNetwork(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log('[SW] Asset fetch failed:', request.url);
    throw error;
  }
}

async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const fallback = await caches.match(request);
    if (fallback) return fallback;
    throw error;
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log('[SW] Serving cached API response for:', request.url);
      return cachedResponse;
    }
    return new Response(
      JSON.stringify({ error: 'You are offline and no cached data is available' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] Received skip waiting message, activating new version');
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    event.waitUntil(
      self.registration.showNotification(event.data.title, {
        body: event.data.body,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        tag: event.data.title,
      })
    );
  }
});
