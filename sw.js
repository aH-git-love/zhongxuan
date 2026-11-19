/* 中玄 · 推演台 —— Service Worker（离线缓存，PWA 用）
 * 仅在 http/https 下注册；file:// 双击打开时不生效，也不影响使用。 */
const CACHE = 'zhongxuan-v17';
const CARD_ASSETS = [['M',0,22],['W',1,15],['C',1,15],['S',1,15],['P',1,15]].flatMap(([s,start,end]) =>
  Array.from({length:end-start},(_,i) => './assets/tarot/rws/'+s+String(i+start).padStart(2,'0')+'.webp'));
const ASSETS = [
  './', './index.html', './app.html', './art-credits.html',
  './css/app.css', './css/landing.css', './js/landing.js', './assets/tarot/rws/sources.json',
  ...CARD_ASSETS,
  './js/core.js', './js/astro.js', './js/bazi.js', './js/almanac.js',
  './js/methods.js', './js/yishu.js', './js/qimen.js', './js/brain.js',
  './js/danao3d.js', './js/ziwei.js', './js/xuankong.js', './js/liuyao.js', './js/tarot.js', './js/cases.js', './js/auth.js', './js/trainer.js', './js/app.js',
  './icon-192.png', './icon-512.png', './icon-maskable-512.png',
  './manifest.webmanifest'
];

self.addEventListener('install', e => {
  const fresh = ASSETS.map(path => new Request(new URL(path, self.registration.scope).href, { cache:'reload' }));
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(fresh)).then(() => self.skipWaiting())
  );
});

self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE && k.startsWith('zhongxuan-')).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  /* 账号与大脑 API 永不进入离线静态缓存，避免跨账号缓存响应。 */
  if (new URL(e.request.url).pathname.includes('/api/')) return;
  /* 网络优先（在线拿最新），离线回退缓存 */
  e.respondWith(
    fetch(e.request).then(resp => {
      if (resp && resp.ok){
        const copy = resp.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
      }
      return resp;
    }).catch(() =>
      caches.match(e.request).then(hit => {
        if (hit) return hit;
        if (e.request.mode !== 'navigate') return Response.error();
        return caches.match(new URL(e.request.url).pathname.endsWith('/app.html') ? './app.html' : './index.html');
      })
    )
  );
});
