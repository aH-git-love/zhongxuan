/* 首页只负责入口、旧演示链接兼容与轻量更新提示。 */
(() => {
  'use strict';

  const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const requestedSystem = new URLSearchParams(window.location.search).get('sys');
  if (standalone || /^#demo/i.test(window.location.hash) || requestedSystem === 'tarot' || requestedSystem === 'zx') {
    const app = new URL('./app.html', window.location.href);
    app.search = window.location.search;
    app.hash = window.location.hash;
    window.location.replace(app.href);
    return;
  }

  if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;

  const notice = document.getElementById('landing-update');
  const refresh = document.getElementById('landing-refresh');
  const later = document.getElementById('landing-later');
  let registration;
  let dismissed = false;
  let refreshRequested = false;
  let reloaded = false;
  let reloadFallback;
  const hadController = Boolean(navigator.serviceWorker.controller);

  const showUpdate = () => {
    if (!dismissed && notice) notice.hidden = false;
  };
  const reloadOnce = () => {
    if (!refreshRequested || reloaded) return;
    reloaded = true;
    window.clearTimeout(reloadFallback);
    window.location.reload();
  };

  if (later) later.addEventListener('click', () => {
    dismissed = true;
    notice.hidden = true;
  });

  if (refresh) refresh.addEventListener('click', () => {
    refreshRequested = true;
    refresh.disabled = true;
    refresh.textContent = '正在刷新…';
    if (registration && registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      // 即使旧 worker 未响应，也只在这次明确点击后刷新一次。
      reloadFallback = window.setTimeout(reloadOnce, 2500);
    } else {
      reloadOnce();
    }
  });

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshRequested) reloadOnce();
    else if (hadController) showUpdate();
  });

  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then(reg => {
    registration = reg;
    if (reg.waiting && navigator.serviceWorker.controller) showUpdate();
    const watch = worker => {
      if (!worker) return;
      const checkState = () => {
        // 首次缓存成功不显示更新消息。
        if (worker.state === 'installed' && hadController) showUpdate();
      };
      worker.addEventListener('statechange', checkState);
      checkState();
    };
    watch(reg.installing);
    reg.addEventListener('updatefound', () => watch(reg.installing));
    // 浏览器可离线运行；检查失败只保留当前可用版本。
    reg.update().catch(() => {});
  }).catch(() => {
    // 隐私模式或离线首次访问时，首页与普通应用链接仍可正常使用。
  });
})();
