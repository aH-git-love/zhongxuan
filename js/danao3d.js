/* ============================================================
 * 中玄 · 推演台 —— 大脑 3D 图 v2（Canvas 伪 3D，零依赖）
 *
 * 视觉：脑形椭球线框 + 沟回 + 纵裂；场景色斑（脑区）；
 *       规则节点按权重决定大小；连线流动光点；命中脉冲高亮。
 * 交互：拖拽旋转（带惯性）/ 滚轮与双指缩放 / 双击复位 /
 *       悬停看规则名 / 点节点回调出详情 / 点脑区聚焦场景。
 * 依赖：brain.js（浏览器全局 BRAIN / Node require 双口径）
 * ============================================================ */

const DANAO3D = (function(){
  const B = (function(){
    try { if (typeof require !== 'undefined' && typeof module !== 'undefined'){ const m = require('./brain.js'); return m.BRAIN; } } catch (e){}
    return (typeof BRAIN !== 'undefined') ? BRAIN : null;
  })();
  const REDUCE = (function(){
    try { if (typeof matchMedia === 'function') return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e){}
    return false;
  })();

  /* ---------- 确定性伪随机（同一 id 布局每次一致） ---------- */
  function hash01(s){
    let h = 2166136261;
    for (let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
    return ((h >>> 0) % 100000) / 100000;
  }

  /* ---------- 脑形椭球（左右宽 · 上下中 · 前后长，前额稍收） ---------- */
  const RX = 1.0, RY = 0.92, RZ = 1.18;
  function ellipsoid(u, v){
    const sv = Math.sin(v), cv = Math.cos(v);
    let x = RX * sv * Math.cos(u);
    const y = RY * cv;
    let z = RZ * sv * Math.sin(u);
    if (z > 0) x *= 0.94;
    return { x, y, z };
  }
  /* 纬线（淡） */
  const RINGS = [0.30, 0.58, 0.86, 1.14, 1.42, 1.70, 2.00, 2.46, 2.74].map(v => {
    const ring = [];
    for (let i = 0; i <= 40; i++) ring.push(ellipsoid(i / 40 * Math.PI * 2, v));
    return ring;
  });
  /* 皮层沟回（正弦扰动环线） */
  const SULCI = [0.48, 0.72, 0.98, 1.24, 1.52, 1.82, 2.16, 2.52].map((v, k) => {
    const ring = [];
    for (let i = 0; i <= 64; i++){
      const u = i / 64 * Math.PI * 2;
      const wob = 1 + 0.055 * Math.sin(u * 6 + k * 2.1) + 0.028 * Math.sin(u * 11 + k * 4.7);
      const p = ellipsoid(u, v);
      ring.push({ x: p.x * wob, y: p.y, z: p.z * wob });
    }
    return ring;
  });
  /* 纵裂（左右半球分界大圆） */
  const FISSURE = (function(){
    const line = [];
    for (let i = 0; i <= 48; i++){
      const t = i / 48 * Math.PI * 2;
      line.push({ x: 0, y: RY * Math.cos(t) * 0.995, z: RZ * Math.sin(t) * 0.995 });
    }
    return line;
  })();

  /* ---------- 网络数据：场景中心 + 规则节点（带权重） ---------- */
  function sceneCenters(scenes){
    const n = scenes.length || 1;
    return scenes.map((s, i) => {
      const phi = Math.PI * (0.12 + 0.76 * (n === 1 ? 0.5 : i / (n - 1)));
      const th = i * 2.399963229728653 + 0.7;
      const p = ellipsoid(th, phi);
      return { scene: s, i, x: p.x * 1.03, y: p.y * 1.03, z: p.z * 1.03 };
    });
  }
  function buildNetwork(){
    if (!B) return { centers: [], nodes: [], scenes: [] };
    const scenes = B.SCENES, idx = {};
    scenes.forEach((s, i) => idx[s] = i);
    const centers = sceneCenters(scenes);
    /* 反馈自学习后的当前权重（读不到就用静态权重） */
    const wmap = {};
    try { if (B.loadState){ const st = B.loadState(); if (st && st.w) for (const k in st.w) wmap[k] = st.w[k]; } } catch (e){}
    const nodes = B.RULES.map(r => {
      const c = centers[idx[r.scene] !== undefined ? idx[r.scene] : 0];
      const a = hash01(r.id + 'a') - 0.5, b = hash01(r.id + 'b') - 0.5, d = hash01(r.id + 'c') - 0.5;
      const wv = (wmap[r.id] != null) ? wmap[r.id] : (r.weight || 9);
      return { id: r.id, rule: r, title: r.title, scene: r.scene, ci: c.i, c, weight: wv,
        x: c.x + a * 0.36, y: c.y + b * 0.36, z: c.z + d * 0.36 };
    });
    return { centers, nodes, scenes };
  }
  /* 节点半径：权重 1~30 → 3.0~6.4 */
  function nodeR(wv){ return 3.0 + Math.max(0, Math.min(24, (wv || 9) - 1)) / 24 * 3.4; }

  /* ---------- 12 场景配色 ---------- */
  function sceneHue(ci, n){ return (((ci * 360 / (n || 12)) + 38) % 360); }
  function sceneColor(ci, n){ return 'hsl(' + Math.round(sceneHue(ci, n)) + ', 72%, 62%)'; }

  /* ---------- 纯投影（可测试） ---------- */
  function project(p, view){
    const V = view || {};
    const rotY = V.rotY || 0, rotX = V.rotX || 0, zoom = V.zoom || 1;
    const W = V.W || 600, H = V.H || 400;
    const cy = Math.cos(rotY), sy = Math.sin(rotY);
    const cx = Math.cos(rotX), sx = Math.sin(rotX);
    const x = p.x * cy - p.z * sy;
    const z1 = p.x * sy + p.z * cy;
    const y2 = p.y * cx - z1 * sx;
    const z2 = p.y * sx + z1 * cx;
    const f = 3.4;
    const k = f / Math.max(0.42, f + z2);
    const m = Math.min(W, H) * 0.36 * zoom;
    return { x: W / 2 + x * k * m, y: H / 2 - y2 * k * m, z: z2, k };
  }

  /* ---------- 挂载 ---------- */
  let CURRENT = null;
  function mount(canvas, opts){
    if (!canvas || typeof canvas.getContext !== 'function') return null;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const opt = opts || {};
    const NET = buildNetwork();
    const N = NET.centers.length;
    const S = {
      rotY: 0.62, rotX: -0.24, zoom: 1, time: 0, last: 0,
      dragging: false, inertia: 0, lastUser: 0, running: false, rafId: 0,
      hit: null, hover: null, hoverCenter: null, focusScene: null,
      pinch: null, W: 600, H: 420, pts: new Map()
    };
    const now = () => (typeof performance !== 'undefined' && performance.now) ? performance.now() : S.time;

    function resize(){
      const dpr = (typeof devicePixelRatio !== 'undefined' && devicePixelRatio) ? devicePixelRatio : 1;
      const w = canvas.clientWidth || 600, h = canvas.clientHeight || 420;
      S.W = w; S.H = h;
      if (canvas.width !== undefined){
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        if (ctx.setTransform) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    }
    const view = () => ({ rotY: S.rotY, rotX: S.rotX, zoom: S.zoom, W: S.W, H: S.H });
    const front = p => 1 - (p.z + 1.3) / 3.0;

    function drawPolyline(pts, frontC, backC, width){
      for (let i = 0; i < pts.length - 1; i++){
        const a = project(pts[i], S), b = project(pts[i + 1], S);
        if (a.z > 1.6 || b.z > 1.6) continue; /* 背面剪裁 */
        const fr = Math.max(0, Math.min(1, 1 - (Math.min(a.z, b.z) + 1.3) / 3.0));
        if (fr <= 0.02) continue;
        ctx.strokeStyle = 'rgba(' + (fr > 0.5 ? frontC : backC) + ',' + (0.05 + fr * fr * 0.30).toFixed(3) + ')';
        ctx.lineWidth = width || 1;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    }

    function draw(){
      ctx.clearRect(0, 0, S.W, S.H);
      /* 底光 */
      const R = Math.max(S.W, S.H) * 0.62;
      const g = ctx.createRadialGradient(S.W / 2, S.H / 2, 0, S.W / 2, S.H / 2, R);
      g.addColorStop(0, 'rgba(212,175,55,0.06)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, S.W, S.H);

      /* 脑壳线框 */
      RINGS.forEach(r => drawPolyline(r, '150,140,120', '110,110,130', 1));
      SULCI.forEach(r => drawPolyline(r, '212,175,55', '160,150,90', 1.2));
      drawPolyline(FISSURE, '240,216,120', '170,150,80', 1.4);

      /* 场景色斑（脑区光晕） */
      for (const c of NET.centers){
        const p = project(c, S);
        const fr = Math.max(0, front(p));
        if (fr < 0.25) continue;
        const dim = S.focusScene && S.focusScene !== c.scene ? 0.5 : 1;
        const r = 44 * p.k * dim;
        const h = Math.round(sceneHue(c.i, N));
        const a = (0.10 + fr * 0.14) * dim;
        const gg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        gg.addColorStop(0, 'hsla(' + h + ',72%,62%,' + a.toFixed(3) + ')');
        gg.addColorStop(1, 'hsla(' + h + ',72%,62%,0)');
        ctx.fillStyle = gg;
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 7); ctx.fill();
      }

      /* 连线：场景中心 → 规则节点 */
      for (const n of NET.nodes){
        const a = project(n.c, S), b = project(n, S);
        const isHit = S.hit && S.hit.has(n.id);
        const isHover = S.hover && S.hover.id === n.id;
        const dim = S.focusScene && n.scene !== S.focusScene ? 0.4 : 1;
        const alpha = (isHit ? 0.55 : (isHover ? 0.45 : 0.10 + 0.16 * Math.max(0, front(a)))) * dim;
        if (alpha <= 0.03) continue;
        ctx.strokeStyle = isHit ? 'rgba(240,216,120,' + alpha + ')' : 'rgba(150,160,180,' + alpha + ')';
        ctx.lineWidth = isHit ? 1.6 : 1;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }

      /* 流动光点（沿连线） */
      if (!REDUCE){
        for (const n of NET.nodes){
          if (S.focusScene && n.scene !== S.focusScene) continue;
          const a = project(n.c, S), b = project(n, S);
          const fr = Math.max(0, Math.min(1, front(a)));
          if (fr < 0.3) continue;
          const isHit = S.hit && S.hit.has(n.id);
          const t = (S.time * (isHit ? 0.0016 : 0.0005) + hash01(n.id + 'f')) % 1;
          const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
          ctx.fillStyle = isHit ? 'rgba(240,216,120,0.92)' : 'rgba(240,216,120,' + (0.16 + fr * 0.30).toFixed(3) + ')';
          ctx.beginPath(); ctx.arc(x, y, isHit ? 1.9 : 1.3, 0, 7); ctx.fill();
        }
      }

      /* 场景中心 + 标签 */
      for (const c of NET.centers){
        const p = project(c, S);
        const fr = Math.max(0, front(p));
        if (fr < 0.12) continue;
        const dim = S.focusScene && S.focusScene !== c.scene ? 0.5 : 1;
        const isFc = S.focusScene === c.scene;
        ctx.fillStyle = isFc ? 'rgba(240,216,120,' + (0.5 + fr * 0.5) + ')' : 'rgba(232,226,212,' + (0.28 + fr * 0.5) * dim + ')';
        ctx.beginPath(); ctx.arc(p.x, p.y, (isFc ? 3.4 : 2.4) * p.k, 0, 7); ctx.fill();
        if (fr > 0.45){
          ctx.font = (isFc ? 'bold 12px' : '11px') + ' "Microsoft YaHei",sans-serif';
          ctx.fillStyle = isFc ? 'rgba(240,216,120,' + (0.7 + fr * 0.3) + ')'
            : 'rgba(139,147,167,' + ((fr - 0.45) * 1.6 * dim).toFixed(3) + ')';
          ctx.textAlign = 'center';
          ctx.fillText(c.scene + (isFc ? ' ●' : ''), p.x, p.y - 9 * p.k - 2);
        }
      }

      /* 规则节点（深度排序，远→近） */
      const drawn = NET.nodes.map(n => ({ n, p: project(n, S) })).sort((a, b) => a.p.z - b.p.z);
      for (const { n, p } of drawn){
        const isHit = S.hit && S.hit.has(n.id);
        const isHover = S.hover && S.hover.id === n.id;
        const dim = S.focusScene && n.scene !== S.focusScene ? 0.45 : 1;
        const fr = Math.max(0, Math.min(1, front(p)));
        const alpha = (0.30 + fr * 0.62) * dim;
        let r = Math.max(1.8, p.k * nodeR(n.weight)) + (isHit ? 0.9 * Math.sin(S.time / 160) : 0);
        if (isHit) r = Math.max(r, 5.5);

        if (isHit || isHover){
          const gg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 4.4);
          gg.addColorStop(0, isHit ? 'rgba(240,216,120,0.52)' : 'rgba(255,255,255,0.35)');
          gg.addColorStop(1, 'rgba(240,216,120,0)');
          ctx.fillStyle = gg;
          ctx.beginPath(); ctx.arc(p.x, p.y, r * 4.4, 0, 7); ctx.fill();
        }
        ctx.fillStyle = isHit ? '#f0d878' : sceneColor(n.ci, N);
        ctx.globalAlpha = alpha;
        ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1, r), 0, 7); ctx.fill();
        if (isHover){
          ctx.globalAlpha = 1;
          ctx.strokeStyle = 'rgba(255,255,255,0.92)';
          ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.arc(p.x, p.y, r + 2.5, 0, 7); ctx.stroke();
          const label = n.id + ' ' + n.title + ' · 权重' + Math.round(n.weight);
          ctx.font = '12px "Microsoft YaHei",sans-serif';
          const tw = ctx.measureText(label).width + 14;
          let lx = p.x + 12, ly = p.y - 26;
          if (lx + tw > S.W - 6) lx = p.x - 12 - tw;
          if (ly < 6) ly = p.y + 14;
          ctx.fillStyle = 'rgba(13,15,20,0.9)';
          ctx.strokeStyle = 'rgba(212,175,55,0.45)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(lx, ly, tw, 22, 5); else ctx.rect(lx, ly, tw, 22);
          ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#f0d878';
          ctx.textAlign = 'left';
          ctx.fillText(label, lx + 7, ly + 15);
        }
        ctx.globalAlpha = 1;
      }

      /* 左上角图例 */
      ctx.font = '11px "Microsoft YaHei",sans-serif';
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(139,147,167,0.92)';
      let legend;
      if (S.focusScene) legend = '聚焦脑区：' + S.focusScene + ' · 点该脑区中心取消';
      else if (S.hit && S.hit.size) legend = '命中点亮 ' + S.hit.size + ' 条 · ' + NET.nodes.length + ' 条规则 / ' + NET.centers.length + ' 个脑区';
      else legend = NET.nodes.length + ' 条规则 · ' + NET.centers.length + ' 个脑区 · 拖拽旋转 / 滚轮缩放 / 点节点看详情 / 点脑区聚焦';
      ctx.fillText(legend, 12, 20);
      if (REDUCE){ ctx.fillStyle = 'rgba(139,147,167,0.6)'; ctx.fillText('已按系统设置减少动态效果', 12, 34); }
    }

    /* ---------- 动画循环（惯性 + 自动慢转） ---------- */
    function loop(t){
      if (!S.running) return;
      S.time += Math.min(50, t - (S.last || t));
      S.last = t;
      if (!S.dragging){
        if (S.inertia){ S.rotY += S.inertia; S.inertia *= 0.94; if (Math.abs(S.inertia) < 1e-4) S.inertia = 0; }
        if (!S.inertia && t - S.lastUser > 3000) S.rotY += 0.0032;
      }
      draw();
      S.rafId = requestAnimationFrame(loop);
    }
    function start(){
      if (S.running) return;
      S.running = true; S.last = 0;
      if (typeof requestAnimationFrame === 'function') S.rafId = requestAnimationFrame(loop);
      else draw();
    }
    function stop(){
      S.running = false;
      if (S.rafId && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(S.rafId);
      S.rafId = 0;
    }

    /* ---------- 拾取（节点 / 脑区中心） ---------- */
    function pickAt(mx, my){
      let best = null, bd = 18 * 18;
      for (const n of NET.nodes){
        const p = project(n, S);
        const d = (p.x - mx) * (p.x - mx) + (p.y - my) * (p.y - my);
        if (d < bd){ bd = d; best = { kind: 'node', id: n.id, rule: n.rule, p }; }
      }
      if (best) return best;
      let bc = null, bcd = 20 * 20;
      for (const c of NET.centers){
        const p = project(c, S);
        const d = (p.x - mx) * (p.x - mx) + (p.y - my) * (p.y - my);
        if (d < bcd){ bcd = d; bc = { kind: 'center', scene: c.scene, p }; }
      }
      return bc;
    }

    /* ---------- 交互 ---------- */
    const listeners = [];
    function on(el, ev, fn, o){
      if (el && typeof el.addEventListener === 'function'){ el.addEventListener(ev, fn, o); listeners.push([el, ev, fn, o]); }
    }
    const xy = e => { const rc = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : { left: 0, top: 0 }; return { x: e.clientX - rc.left, y: e.clientY - rc.top }; };
    const pinchDist = () => {
      const a = [...S.pts.values()];
      return a.length >= 2 ? Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) : null;
    };
    on(canvas, 'pointerdown', e => {
      S.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (S.pts.size >= 2){ S.dragging = false; S.pinch = pinchDist(); return; }
      S.dragging = true; S.inertia = 0; S.lastUser = now();
      if (canvas.style) canvas.style.cursor = 'grabbing';
      if (canvas.setPointerCapture && e.pointerId !== undefined){ try { canvas.setPointerCapture(e.pointerId); } catch (err){} }
    });
    on(canvas, 'pointermove', e => {
      S.lastUser = now();
      if (S.pts.has(e.pointerId)) S.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      /* 双指缩放 */
      if (S.pts.size >= 2){
        const d = pinchDist();
        if (d && S.pinch) S.zoom = Math.max(0.55, Math.min(2.4, S.zoom * (d / S.pinch)));
        S.pinch = d || null;
        return;
      }
      const { x: mx, y: my } = xy(e);
      if (S.dragging){
        const dx = (e.movementX || 0);
        const dy = (e.movementY || 0);
        S.rotY += dx * 0.006;
        S.rotX = Math.max(-1.3, Math.min(1.3, S.rotX - dy * 0.006));
        S.inertia = dx * 0.0055; /* 释放后的惯性速度 */
      } else {
        const h = pickAt(mx, my);
        S.hover = (h && h.kind === 'node') ? h : null;
        S.hoverCenter = (h && h.kind === 'center') ? h : null;
        if (canvas.style) canvas.style.cursor = h ? 'pointer' : 'grab';
      }
    });
    const endPtr = e => {
      if (S.pts.has(e.pointerId)) S.pts.delete(e.pointerId);
      if (S.pts.size < 2) S.pinch = null;
      if (S.pts.size === 0){ S.dragging = false; if (canvas.style) canvas.style.cursor = 'grab'; }
    };
    on(canvas, 'pointerup', endPtr);
    on(canvas, 'pointercancel', endPtr);
    on(canvas, 'pointerleave', e => { endPtr(e); S.hover = null; S.hoverCenter = null; });
    on(canvas, 'wheel', e => {
      if (e.preventDefault) e.preventDefault();
      S.zoom = Math.max(0.55, Math.min(2.4, S.zoom * (e.deltaY < 0 ? 1.08 : 0.93)));
    }, { passive: false });
    on(canvas, 'dblclick', () => { S.rotY = 0.62; S.rotX = -0.24; S.zoom = 1; S.hit = null; S.focusScene = null; });
    on(canvas, 'click', e => {
      const { x: mx, y: my } = xy(e);
      const h = pickAt(mx, my);
      if (h && h.kind === 'node'){
        S.hit = new Set([h.id]);
        if (typeof opt.onPick === 'function') opt.onPick(h.rule);
      } else if (h && h.kind === 'center'){
        S.focusScene = (S.focusScene === h.scene) ? null : h.scene;
        S.hoverCenter = null;
      } else {
        S.focusScene = null;
      }
    });

    /* 可见性控制：离开页面停转 */
    let io = null;
    if (typeof IntersectionObserver === 'function'){
      io = new IntersectionObserver(es => { es.forEach(x => x.isIntersecting ? start() : stop()); }, { threshold: 0.05 });
      io.observe(canvas);
    } else start();
    const onVis = () => { (typeof document !== 'undefined' && document.hidden) ? stop() : start(); };
    if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('visibilitychange', onVis);
    resize();
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function'){
      const r = () => resize();
      window.addEventListener('resize', r);
      listeners.push([window, 'resize', r, undefined]);
    }

    const api = {
      highlight(ids){ S.hit = (ids && ids.length) ? new Set(ids) : null; if (!S.running && !io) draw(); },
      focusScene(scene){ S.focusScene = scene || null; },
      reset(){ S.rotY = 0.62; S.rotX = -0.24; S.zoom = 1; S.hit = null; S.focusScene = null; },
      start, stop,
      destroy(){
        stop();
        if (io) io.disconnect();
        if (typeof document !== 'undefined' && document.removeEventListener) document.removeEventListener('visibilitychange', onVis);
        listeners.forEach(([el, ev, fn, o]) => { if (el.removeEventListener) el.removeEventListener(ev, fn, o); });
        if (CURRENT === api) CURRENT = null;
      },
      get state(){ return S; }
    };
    CURRENT = api;
    return api;
  }

  return {
    mount,
    network: buildNetwork,
    project,
    sceneColor,
    highlight(ids){ if (CURRENT) CURRENT.highlight(ids); },
    focusScene(s){ if (CURRENT) CURRENT.focusScene(s); },
    current(){ return CURRENT; }
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = { DANAO3D };
