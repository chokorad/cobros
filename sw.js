const CACHE = 'cobros-v2';
const SHELL = ['./', 'index.html', 'app.js', 'config.js', 'manifest.json', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'favicon-32.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  // Archivos propios: primero red (para que tus cambios se vean), caché si no hay señal.
  if (url.origin === location.origin) {
    e.respondWith(
      fetch(e.request)
        .then(r => { const copia = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copia)); return r; })
        .catch(() => caches.match(e.request).then(r => r || caches.match('index.html')))
    );
    return;
  }

  // SDK de Firebase (versión fija): primero caché.
  if (url.hostname === 'www.gstatic.com') {
    e.respondWith(
      caches.match(e.request).then(r => r || fetch(e.request).then(res => {
        const copia = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copia)); return res;
      }))
    );
  }
});
