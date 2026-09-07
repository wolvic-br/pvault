// sw.js — cacheia o app inteiro para funcionar offline, como um app de
// verdade. Como o PassVault é 100% local (sem chamadas de rede além de
// carregar os próprios arquivos), isso é só "cache tudo, sempre".

const CACHE_NAME = "passvault-v1";
const FILES_TO_CACHE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/styles.css",
  "./js/schemas.js",
  "./js/crypto.js",
  "./js/db.js",
  "./js/vault.js",
  "./js/icons.js",
  "./js/app.js",
  "./vendor/argon2-bundled.min.js",
  "./vendor/argon2.wasm",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(FILES_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
