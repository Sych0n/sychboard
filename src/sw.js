const CACHE = 'sychboard-v6';
const SHELL = ['./', './manifest.json', './styles.css', './renderer.js', './gaming/gaming.css', './gaming/gaming-ui.js',
  './gaming/gaming-cards-stub.js', './gaming/sens.js', './gaming/gaming-sens-ui.js',
  './gaming/stats.js', './gaming/gaming-charts.js', './gaming/gaming-sessions-ui.js',
  './obsidian/obsidian-ui.js', './gaming/framemetrics.js', './gaming/presentpath.js', './gaming/gaming-capture-ui.js', './gaming/gaming-health-ui.js',
  './icons/icon-72.png', './icons/icon-96.png', './icons/icon-128.png',
  './icons/icon-144.png', './icons/icon-180.png', './icons/icon-192.png',
  './icons/icon-512.png', './icons/icon-maskable-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (e.request.url.includes('api.groq.com')) return;
  if (!e.request.url.startsWith(self.location.origin)) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      const network = fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => cached || caches.match('./'));
      return cached || network;
    })
  );
});
