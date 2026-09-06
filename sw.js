/* ════════════════════════════════════════════════════════════════════════
   Service worker — Traduction Live (PWA)

   Stratégie :
   • INSTALL  : précache la coquille (index.html, manifest, icônes) → l'app
     s'ouvre et fonctionne HORS-LIGNE (interface). La transcription Puter et
     la traduction restent des services RÉSEAU par nature : hors-ligne, les
     blocs s'affichent en erreur réseau au lieu de crasher.
   • FETCH    : navigation = réseau d'abord (toujours la version fraîche),
     repli cache si hors-ligne ; fichiers statiques (icônes/manifest) = cache
     d'abord, sinon réseau (puis mise en cache des ressources même-origine).
     Les appels CROSS-ORIGINE (js.puter.com…) passent toujours par le réseau.
   ════════════════════════════════════════════════════════════════════════ */
"use strict";

const CACHE_NAME = "traduction-live-v1";

const PRECACHE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Navigation : réseau d'abord, cache en secours (offline).
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then(res => {
          // Met à jour la coquille en cache pour la prochaine ouverture offline.
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put("./index.html", copy));
          return res;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  // Même-origine (icônes, manifest…) : cache d'abord, sinon réseau + mise en cache.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, copy));
        }
        return res;
      }))
    );
  }
  // Cross-origin (SDK Puter, API de traduction…) : réseau pur, non intercepté.
});
