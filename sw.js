const CACHE_NAME = 'pwa-nilai-v6'; // <-- [BARIS 1] Setiap ada update, naikkan versinya (misal v2 jadi v3)
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './app.js',
  './manifest.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// <-- [BARIS 30 UTAMA YANG DIUBAH]
// Mengubah strategi menjadi Network-First (Coba ambil versi terbaru dari server dulu)
self.addEventListener('fetch', (e) => {
  e.respondWith(
    fetch(e.request)
      .then((networkResponse) => {
        // Jika ada koneksi internet, update isi cache dengan file terbaru
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Jika offline / tidak ada koneksi, baru ambil dari cache
        return caches.match(e.request);
      })
  );
});