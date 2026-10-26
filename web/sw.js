/* ============================================================
   web/sw.js —— 裁间管理后台 Service Worker
   · 页面导航：网络优先，离线回退到缓存的应用外壳
   · 脚本 / 样式 / 清单：网络优先（发布后立即生效），离线回退缓存
   · 图片 / 字体：Stale-While-Revalidate
   · 跨域请求与 /api/ 接口：不拦截（避免缓存业务数据）
   更新 VERSION 即可让旧缓存失效
   ============================================================ */
'use strict';

const VERSION = 'v5';
const CACHE = `cj-admin-${VERSION}`;

const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './icons.css',
  './styles/base.css',
  './styles/theme.css',
  './styles/layout.css',
  './styles/components.css',
  './styles/pages.css',
  './styles/responsive.css',
  './styles/print.css',
  './js/app.js',
  './js/bus.js',
  './js/config.js',
  './js/shortcuts.js',
  './js/shell.js',
  './js/store.js',
  './js/theme.js',
  './js/ui.js',
  './js/utils.js',
  './js/pages/dashboard.js',
  './js/pages/goods.js',
  './js/pages/billing.js',
  './js/pages/orders.js',
  './js/pages/customers.js',
  './js/pages/shop.js',
  './js/pages/platform.js',
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
      // 代理 / 网关返回 5xx 时优先使用缓存，避免离线或后端异常时白屏
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
  if (url.pathname.includes('/api/')) return;

  const isImage = req.destination === 'image' || req.destination === 'font';

  if (req.mode === 'navigate') {
    event.respondWith(networkFirst(req, './index.html'));
  } else if (isImage) {
    event.respondWith(staleWhileRevalidate(req));
  } else {
    event.respondWith(networkFirst(req));
  }
});
