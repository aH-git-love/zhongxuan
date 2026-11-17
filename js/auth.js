/* ============================================================
 * 中玄 · 推演台 —— 登录体系（AUTH）
 *
 * 双轨：
 *   server 模式：canvas 通过 server.js 访问（http/https）→ 走 /api/* 服务端会话
 *                （users.json 持久、SHA-256 加盐、token 存 sessions.json）
 *   local  模式：file:// 双击打开 / 静态托管无后端 → 本地会话
 *                （localStorage 存账号与口令摘要，离线可用）
 *
 * 角色：admin（管理员 · 可管理用户） / user（普通用户） / guest（游客 · 免密）
 * 默认管理员：admin / admin123（首次登录后请在「账号」里改掉）
 * 纯渲染函数 renderAuthButton / renderLoginView / renderAccountView 返回 HTML，可单测。
 * ============================================================ */

const AUTH = (function(){
  const K_USERS = 'zx_auth_users';
  const K_SESS = 'zx_auth_sess';
  const GUEST_KEY = 'zx_guest';

  let mode = 'local';           /* 'server' | 'local' */
  let mem = null;               /* Node/沙箱 无 localStorage 时的兜底 */

  const store = {
    get(k){
      try { return typeof localStorage !== 'undefined' ? localStorage.getItem(k) : (mem ? mem[k] : null) }
      catch (e){ return mem ? mem[k] : null }
    },
    set(k, v){
      try { if (typeof localStorage !== 'undefined') return localStorage.setItem(k, v) } catch (e){}
      if (!mem) mem = {};
      mem[k] = v;
    },
    del(k){
      try { if (typeof localStorage !== 'undefined') return localStorage.removeItem(k) } catch (e){}
      if (mem) delete mem[k];
    }
  };

  /* 本地摘要（FNV/djb2 多轮，仅用于离线降级；服务端用 SHA-256） */
  function h(str){
    let x = 5381;
    for (let i = 0; i < str.length; i++) x = ((x << 5) + x + str.charCodeAt(i)) | 0;
    x ^= x >>> 13; x = (x * 0x5bd1e995) | 0; x ^= x >>> 15;
    return (x >>> 0).toString(16);
  }
  function hashPass(pass, salt){
    let s = salt + '|' + pass + '|';
    for (let i = 0; i < 120; i++) s = h(s) + h(s + ':' + i);
    return h(s);
  }
  function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2, 10); }

  /* ---------- 本地用户表 ---------- */
  function loadUsers(){
    let o = null;
    try { o = JSON.parse(store.get(K_USERS) || 'null') } catch (e){ o = null }
    if (!o || !Array.isArray(o.users)){
      const salt = uid();
      o = { salt, users: [{ name: 'admin', role: 'admin', pass: hashPass('admin123', salt), created: Date.now(), note: '默认管理员，请改口令' }] };
      store.set(K_USERS, JSON.stringify(o));
    }
    return o;
  }
  function saveUsers(o){ store.set(K_USERS, JSON.stringify(o)); }

  /* ---------- 会话 ---------- */
  function getSession(){
    try { return JSON.parse(store.get(K_SESS) || 'null') || null } catch (e){ return null }
  }
  function setSession(s){ if (s) store.set(K_SESS, JSON.stringify(s)); else store.del(K_SESS); }
  function session(){ return getSession(); }
  function isAdmin(){ const s = getSession(); return !!s && s.role === 'admin'; }
  function isGuest(){ const s = getSession(); return !!s && s.role === 'guest'; }

  /* ---------- 服务端模式探测 ---------- */
  async function detect(){
    if (typeof fetch !== 'function' || typeof location === 'undefined' || !/^https?:/.test(location.protocol)){
      mode = 'local';
      return mode;
    }
    try {
      const r = await fetch('api/ping', { headers: { 'cache-control': 'no-cache' } });
      const j = await r.json();
      mode = j && j.auth ? 'server' : 'local';
    } catch (e){ mode = 'local' }
    return mode;
  }
  function modeOf(){ return mode; }

  function apiCall(path, opts){
    const token = (getSession() || {}).token || '';
    return fetch(path, Object.assign({
      headers: { 'content-type': 'application/json', authorization: token ? 'Bearer ' + token : '' }
    }, opts || {})).then(r => r.json());
  }

  /* ---------- 登录 / 登出 ---------- */
  async function loginGuest(name){
    if (mode === 'server'){
      const r = await apiCall('api/login', { method: 'POST', body: JSON.stringify({ mode: 'guest', name: name || '' }) });
      if (r && r.ok){ setSession({ name: r.name, role: r.role, token: r.token }); return { ok: true, session: getSession() } }
      return { ok: false, error: (r && r.error) || '游客登录失败' };
    }
    const nm = (name && String(name).trim()) || ('游客' + String(Date.now()).slice(-4));
    setSession({ name: nm, role: 'guest', local: true });
    return { ok: true, session: getSession() };
  }

  async function login(name, pass){
    const nm = String(name || '').trim();
    const pw = String(pass || '');
    if (!nm || !pw) return { ok: false, error: '请填账号与口令' };
    if (mode === 'server'){
      const r = await apiCall('api/login', { method: 'POST', body: JSON.stringify({ name: nm, pass: pw }) });
      if (r && r.ok){ setSession({ name: r.name, role: r.role, token: r.token }); return { ok: true, session: getSession() } }
      return { ok: false, error: (r && r.error) || '登录失败' };
    }
    const u = loadUsers();
    const rec = u.users.find(x => x.name === nm);
    if (!rec) return { ok: false, error: '账号不存在' };
    if (rec.pass !== hashPass(pw, u.salt)) return { ok: false, error: '口令错误' };
    setSession({ name: rec.name, role: rec.role, local: true });
    return { ok: true, session: getSession() };
  }

  async function logout(){
    if (mode === 'server'){
      try { await apiCall('api/logout', { method: 'POST' }) } catch (e){}
    }
    setSession(null);
    return { ok: true };
  }

  /* 启动校验：服务端模式下 token 失效则清掉本地会话 */
  async function verify(){
    const s = getSession();
    if (!s) return null;
    if (mode === 'server' && s.token){
      try {
        const r = await apiCall('api/me');
        if (r && r.ok){
          const merged = Object.assign({}, s, { name: r.name, role: r.role });
          setSession(merged);
          return merged;
        }
      } catch (e){}
      /* 服务端不可达时保留本地会话（离线容忍） */
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return s;
      setSession(null);
      return null;
    }
    return s;
  }

  /* ---------- 用户管理 ---------- */
  async function listUsers(){
    if (mode === 'server'){
      const r = await apiCall('api/users');
      if (r && r.ok) return r.users;
      return { error: (r && r.error) || '读取失败' };
    }
    const s = getSession();
    if (!s || s.role !== 'admin') return { error: '仅管理员可查看' };
    return loadUsers().users.map(x => ({ name: x.name, role: x.role, created: x.created, note: x.note || '' }));
  }

  async function addUser(name, pass, role){
    const nm = String(name || '').trim(), pw = String(pass || '');
    if (nm.length < 2) return { ok: false, error: '账号至少 2 字' };
    if (pw.length < 4) return { ok: false, error: '口令至少 4 位' };
    if (mode === 'server'){
      const r = await apiCall('api/users', { method: 'POST', body: JSON.stringify({ name: nm, pass: pw, role: role === 'admin' ? 'admin' : 'user' }) });
      return r && r.ok ? { ok: true } : { ok: false, error: (r && r.error) || '新增失败' };
    }
    const s = getSession();
    if (!s || s.role !== 'admin') return { ok: false, error: '仅管理员可操作' };
    const u = loadUsers();
    if (u.users.some(x => x.name === nm)) return { ok: false, error: '账号已存在' };
    u.users.push({ name: nm, role: role === 'admin' ? 'admin' : 'user', pass: hashPass(pw, u.salt), created: Date.now() });
    saveUsers(u);
    return { ok: true };
  }

  async function delUser(name){
    const nm = String(name || '').trim();
    if (mode === 'server'){
      const r = await apiCall('api/users', { method: 'DELETE', body: JSON.stringify({ name: nm }) });
      return r && r.ok ? { ok: true } : { ok: false, error: (r && r.error) || '删除失败' };
    }
    const s = getSession();
    if (!s || s.role !== 'admin') return { ok: false, error: '仅管理员可操作' };
    if (nm === s.name) return { ok: false, error: '不能删除自己' };
    const u = loadUsers();
    const before = u.users.length;
    u.users = u.users.filter(x => x.name !== nm);
    if (u.users.length === before) return { ok: false, error: '账号不存在' };
    if (!u.users.some(x => x.role === 'admin')) return { ok: false, error: '至少保留一个管理员' };
    saveUsers(u);
    return { ok: true };
  }

  async function changePass(oldPass, newPass, name){
    const np = String(newPass || '');
    if (np.length < 4) return { ok: false, error: '新口令至少 4 位' };
    if (mode === 'server'){
      const r = await apiCall('api/pass', { method: 'POST', body: JSON.stringify({ oldPass: String(oldPass || ''), pass: np, name: name || '' }) });
      return r && r.ok ? { ok: true } : { ok: false, error: (r && r.error) || '改口令失败' };
    }
    const s = getSession();
    if (!s) return { ok: false, error: '未登录' };
    if (s.role === 'guest') return { ok: false, error: '游客无口令' };
    const target = s.role === 'admin' && name ? name : s.name;
    const u = loadUsers();
    const rec = u.users.find(x => x.name === target);
    if (!rec) return { ok: false, error: '账号不存在' };
    if (target === s.name && rec.pass !== hashPass(String(oldPass || ''), u.salt)) return { ok: false, error: '原口令错误' };
    rec.pass = hashPass(np, u.salt);
    saveUsers(u);
    return { ok: true };
  }

  /* ---------- 纯渲染 ---------- */
  function roleLabel(role){ return role === 'admin' ? '管理员' : role === 'guest' ? '游客' : '用户'; }

  function renderAuthButton(sess){
    if (!sess) return '<span class="auth-txt">未登录</span>';
    const cls = sess.role === 'admin' ? 'auth-admin' : sess.role === 'guest' ? 'auth-guest' : 'auth-user';
    return `<b class="${cls}">👤 ${sess.name}</b><span class="auth-role">${roleLabel(sess.role)}</span>`;
  }

  function renderLoginView(hint){
    return `<div class="au-cards">
      <div class="au-card">
        <h3>游客进入</h3>
        <p class="hint">免密，直接试用全部功能：排盘、择日、推演、术数、大脑与案例库。数据只存本机浏览器。</p>
        <div class="field"><label>昵称（选填）</label><input id="au-guest-name" type="text" placeholder="游客"></div>
        <button class="btn primary" id="au-guest-go">以游客身份进入</button>
      </div>
      <div class="au-card">
        <h3>账号登录</h3>
        <p class="hint">管理员可管理用户；普通用户与游客权限相同，但数据独立保存。</p>
        <div class="field"><label>账号</label><input id="au-name" type="text" placeholder="admin" autocomplete="username"></div>
        <div class="field"><label>口令</label><input id="au-pass" type="password" placeholder="••••••" autocomplete="current-password"></div>
        <button class="btn primary" id="au-go">登录</button>
        <p class="hint au-tip">默认管理员：admin / admin123（登录后请改口令）</p>
      </div>
    </div>
    <p class="au-msg" id="au-msg">${hint || ''}</p>`;
  }

  function renderAccountView(sess, users, msg){
    if (!sess) return '<p class="hint">未登录。</p>';
    const isAdminRole = sess.role === 'admin';
    const usersHtml = (users && Array.isArray(users)) ? users.map(u => `<tr>
        <td>${u.name}</td><td>${roleLabel(u.role)}</td>
        <td>${u.name === sess.name ? '<span class="tag gold">当前</span>' : ''}</td>
        <td>${isAdminRole && u.name !== sess.name ? `<button class="btn au-del" data-del="${u.name}">删除</button>` : ''}</td>
      </tr>`).join('') : '';
    return `<div class="au-acc">
      <p class="au-who">当前登录：<b>${sess.name}</b> <span class="tag ${isAdminRole ? 'gold' : 'blue'}">${roleLabel(sess.role)}</span> <span class="tag">${modeOf() === 'server' ? '服务端会话' : '本地会话'}</span></p>
      ${sess.role !== 'guest' ? `<div class="field"><label>改口令</label>
        <div class="row">
          <input id="au-old" type="password" placeholder="原口令">
          <input id="au-new" type="password" placeholder="新口令（≥4 位）">
          <button class="btn" id="au-pass-go">保存</button>
        </div></div>` : ''}
      ${isAdminRole ? `<h3 class="au-sub">用户管理</h3>
        <div class="field"><label>新增用户</label>
          <div class="row">
            <input id="au-new-name" type="text" placeholder="账号（≥2 字）">
            <input id="au-new-pass" type="password" placeholder="口令（≥4 位）">
            <select id="au-new-role"><option value="user">普通用户</option><option value="admin">管理员</option></select>
            <button class="btn" id="au-add">新增</button>
          </div></div>
        <table class="au-users"><thead><tr><th>账号</th><th>角色</th><th>标记</th><th>操作</th></tr></thead><tbody>${usersHtml}</tbody></table>` : ''}
      <p class="au-msg">${msg || ''}</p>
      <button class="btn" id="au-logout">退出登录</button>
    </div>`;
  }

  return { detect, modeOf, session, isAdmin, isGuest, loginGuest, login, logout, verify,
    listUsers, addUser, delUser, changePass,
    renderAuthButton, renderLoginView, renderAccountView, roleLabel, hashPass,
    _reset(){ store.del(K_USERS); store.del(K_SESS); mem = null; } };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = { AUTH };
