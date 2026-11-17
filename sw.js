/* 中玄 · 推演台 —— Service Worker（离线缓存，PWA 用）
 * 仅在 http/https 下注册；file:// 双击打开时不生效，也不影响使用。 */
const CACHE = 'zhongxuan-v8';
const ASSETS = [
  './', './index.html',
  './css/app.css',
  './js/core.js', './js/astro.js', './js/bazi.js', './js/almanac.js',
  './js/methods.js', './js/yishu.js', './js/qimen.js', './js/brain.js',
  './js/danao3d.js', './js/ziwei.js', './js/xuankong.js', './js/liuyao.js', './js/cases.js', './js/auth.js', './js/trainer.js', './js/app.js',
  './icon-192.png', './icon-512.png', './icon-maskable-512.png',
  './manifest.webmanifest'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
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
  /* 网络优先（在线拿最新），离线回退缓存 */
  e.respondWith(
    fetch(e.request).then(resp => {
      if (resp && resp.ok){
        const copy = resp.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
      }
      return resp;
    }).catch(() =>
      caches.match(e.request).then(hit => hit || caches.match('./index.html'))
    )
  );
});
