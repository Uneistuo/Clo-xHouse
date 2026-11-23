/* ============================================================
   web/sw.js —— 裁间项目展示页 Service Worker
   · 页面导航：网络优先，离线回退缓存外壳
   · 样式 / 脚本 / 清单：网络优先（发布后立即生效），离线回退缓存
   · 图片 / 字体：Stale-While-Revalidate
   更新 VERSION 即可让旧缓存失效
   ============================================================ */
'use strict';

const VERSION = 'v1';
const CACHE = `cj-site-${VERSION}`;

const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './icons.css',
  './styles/tokens.css',
  './styles/base.css',
  './styles/layout.css',
  './styles/components.css',
  './styles/animations.css',
  './js/main.js',
  './assets/favicon.svg',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/icon-maskable-512.png',
  './assets/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function putInCache(req, res) {
  if (res && res.status === 200 && res.type === 'basic') {
    const copy = res.clone();
    caches.open(CACHE).then((cache) => cache.put(req, copy));
  }
  return res;
}

function networkFirst(req, fallback) {
  return fetch(req)
    .then(async (res) => {
      if (res && res.status >= 500) {
        const cached = (await caches.match(req)) || (fallback ? await caches.match(fallback) : null);
        if (cached) return cached;
      }
      return putInCache(req, res);
    })
    .catch(async () => (await caches.match(req)) || (fallback ? await caches.match(fallback) : Response.error()));
}

function staleWhileRevalidate(req) {
  return caches.match(req).then((cached) => {
    const network = fetch(req)
      .then((res) => putInCache(req, res))
      .catch(() => cached || Response.error());
    return cached || network;
  });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const isImage = req.destination === 'image' || req.destination === 'font';

  if (req.mode === 'navigate') {
    event.respondWith(networkFirst(req, './index.html'));
  } else if (isImage) {
    event.respondWith(staleWhileRevalidate(req));
  } else {
    event.respondWith(networkFirst(req));
  }
});
