const CACHE = "bigbossyan-v15";
const ASSETS = [
  "./",
  "./index.html",
  "./css/fonts.css",
  "./css/styles.css",
  "./js/data.js",
  "./js/storage.js",
  "./js/project.js",
  "./js/chat.js",
  "./js/docs.js",
  "./js/app.js",
  "./manifest.json",
  "./icon.svg",
  "./reset.html",
  "./assets/logo-icon.png",
  "./assets/fonts/unbounded-500.woff2",
  "./assets/fonts/unbounded-700.woff2",
  "./assets/fonts/unbounded-cyr-500.woff2",
  "./assets/fonts/unbounded-cyr-700.woff2",
  "./assets/fonts/manrope-400.woff2",
  "./assets/fonts/manrope-500.woff2",
  "./assets/fonts/manrope-600.woff2",
  "./assets/fonts/manrope-700.woff2",
  "./assets/fonts/manrope-cyr-400.woff2",
  "./assets/fonts/manrope-cyr-500.woff2",
  "./assets/fonts/manrope-cyr-600.woff2",
  "./assets/fonts/manrope-cyr-700.woff2",
  "./assets/fonts/syne-700.woff2",
  "./assets/fonts/syne-800.woff2",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  // JS/CSS всегда с сети, чтобы не залипала старая модель чата
  if (/\.(js|css)(\?|$)/i.test(url.pathname) || /\/sw\.js$/i.test(url.pathname)) {
    e.respondWith(
      fetch(e.request, { cache: "no-store" }).catch(() => caches.match(e.request))
    );
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request).then((c) => c || caches.match("./index.html")))
  );
});
