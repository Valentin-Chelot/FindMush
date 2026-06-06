/* sw.js — service worker : met en cache la coquille de l'app pour un usage hors-ligne.
   Les tuiles de carte (tile.openstreetmap.org) ne sont PAS mises en cache : elles
   nécessitent le réseau (choix assumé). Le reste s'ouvre sans réseau. */

const CACHE = 'findmush-v1';
const SHELL = [
  '.',
  'index.html',
  'css/style.css',
  'js/app.js',
  'js/storage.js',
  'manifest.webmanifest',
  'vendor/leaflet/leaflet.js',
  'vendor/leaflet/leaflet.css',
  'vendor/leaflet/images/marker-icon.png',
  'vendor/leaflet/images/marker-icon-2x.png',
  'vendor/leaflet/images/marker-shadow.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  // Tuiles de carte : réseau direct, jamais en cache.
  if (url.hostname.endsWith('tile.openstreetmap.org')) return;

  // Fichiers de l'app : réseau d'abord (toujours à jour quand connecté),
  // cache en repli quand hors-ligne. On rafraîchit le cache à chaque succès.
  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
  }
});
