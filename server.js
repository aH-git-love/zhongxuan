/* 中玄 · 推演台 —— 本地服务（静态文件 + 登录 API）
 * 用法：node server.js  →  http://localhost:8765
 * 手机同 Wi-Fi 访问 http://<电脑IP>:8765
 *
 * 登录体系
 *   游客：POST /api/login {mode:'guest'} → 免密发 token，role=guest
 *   账号：POST /api/login {name,pass}   → 校验 users.json，role=admin|user
 *   会话：token 存 sessions.json（重启不丢），GET /api/me 校验
 *   管理：GET/POST/DELETE /api/users（仅 admin），POST /api/pass 改自己口令
 * 默认管理员：admin / admin123（首次登录后请在管理面板改掉）
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const PORT = process.env.PORT || 8765;
const DATA_DIR = process.env.ZX_DATA_DIR ? path.resolve(process.env.ZX_DATA_DIR) : path.join(ROOT,'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SESS_FILE = path.join(DATA_DIR, 'sessions.json');
const { BRAIN } = require('./js/brain.js');
const { createBrainApi } = require('./backend/brain-api.js');
const brainApi = createBrainApi({ BRAIN, dataDir:DATA_DIR, me, send });

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.ico':  'image/x-icon',
  '.zip':  'application/zip'
};

/* ---------------- 存储 ---------------- */
function ensureData(){
  const d = DATA_DIR;
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}
function readJson(file, fallback){
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch (e){ return fallback }
}
function writeJson(file, obj){
  ensureData();
  fs.writeFileSync(file, JSON.stringify(obj, null, 2), 'utf8');
}
function hash(pass, salt){
  return crypto.createHash('sha256').update(salt + ':' + pass).digest('hex');
}
function loadUsers(){
  let u = readJson(USERS_FILE, null);
  if (!u || !Array.isArray(u.users)){
    const salt = crypto.randomBytes(8).toString('hex');
    u = {
      salt,
      users: [{ name: 'admin', role: 'admin', pass: hash('admin123', salt), created: Date.now(), note: '默认管理员，请在管理面板改口令' }]
    };
    writeJson(USERS_FILE, u);
  }
  return u;
}
function saveUsers(u){ writeJson(USERS_FILE, u); }
function loadSessions(){ return readJson(SESS_FILE, { tokens: {} }); }
function saveSessions(s){ writeJson(SESS_FILE, s); }

/* ---------------- HTTP 工具 ---------------- */
function send(res, code, obj){
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}
function body(req, cb){
  let raw = '';
  req.on('data', c => { raw += c; if (raw.length > 1e6) req.destroy() });
  req.on('end', () => {
    let o = {};
    try { o = JSON.parse(raw || '{}') } catch (e){ o = {} }
    cb(o);
  });
}
function tokenOf(req){
  const h = req.headers['authorization'] || '';
  if (h.startsWith('Bearer ')) return h.slice(7);
  return req.headers['x-zx-token'] || '';
}
function me(req){
  const t = tokenOf(req);
  if (!t) return null;
  const s = loadSessions();
  const rec = s.tokens[t];
  if (!rec) return null;
  if (rec.expire && rec.expire < Date.now()){ delete s.tokens[t]; saveSessions(s); return null; }
  return { token: t, name: rec.name, role: rec.role, guest: rec.role === 'guest' };
}

/* ---------------- API ---------------- */
function api(req, res, url){
  const p = url.pathname;
  if (brainApi(req,res,url)) return;

  if (p === '/api/ping'){
    return send(res, 200, { ok: true, server: '中玄·推演台', version: '1.0', auth: true, time: Date.now() });
  }

  /* 登录 */
  if (p === '/api/login' && req.method === 'POST'){
    return body(req, (o) => {
      const sessions = loadSessions();
      if (o.mode === 'guest'){
        const t = crypto.randomBytes(18).toString('hex');
        sessions.tokens[t] = { name: o.name || ('游客' + String(Date.now()).slice(-4)), role: 'guest', created: Date.now() };
        saveSessions(sessions);
        return send(res, 200, { ok: true, token: t, name: sessions.tokens[t].name, role: 'guest' });
      }
      const u = loadUsers();
      const rec = u.users.find(x => x.name === String(o.name || '').trim());
      if (!rec) return send(res, 401, { ok: false, error: '账号不存在' });
      if (hash(String(o.pass || ''), u.salt) !== rec.pass) return send(res, 401, { ok: false, error: '口令错误' });
      const t = crypto.randomBytes(18).toString('hex');
      sessions.tokens[t] = { name: rec.name, role: rec.role, created: Date.now() };
      saveSessions(sessions);
      return send(res, 200, { ok: true, token: t, name: rec.name, role: rec.role });
    });
  }

  if (p === '/api/logout' && req.method === 'POST'){
    const t = tokenOf(req);
    if (t){ const s = loadSessions(); delete s.tokens[t]; saveSessions(s); }
    return send(res, 200, { ok: true });
  }

  if (p === '/api/me'){
    const m = me(req);
    if (!m) return send(res, 401, { ok: false, error: '未登录或会话已失效' });
    return send(res, 200, { ok: true, name: m.name, role: m.role });
  }

  /* 用户管理（admin） */
  if (p === '/api/users' && req.method === 'GET'){
    const m = me(req);
    if (!m) return send(res, 401, { ok: false, error: '未登录' });
    if (m.role !== 'admin') return send(res, 403, { ok: false, error: '仅管理员可查看' });
    const u = loadUsers();
    return send(res, 200, { ok: true, users: u.users.map(x => ({ name: x.name, role: x.role, created: x.created, note: x.note || '' })) });
  }

  if (p === '/api/users' && req.method === 'POST'){
    const m = me(req);
    if (!m) return send(res, 401, { ok: false, error: '未登录' });
    if (m.role !== 'admin') return send(res, 403, { ok: false, error: '仅管理员可操作' });
    return body(req, (o) => {
      const name = String(o.name || '').trim();
      const pass = String(o.pass || '');
      if (name.length < 2) return send(res, 400, { ok: false, error: '账号至少 2 字' });
      if (pass.length < 4) return send(res, 400, { ok: false, error: '口令至少 4 位' });
      const u = loadUsers();
      if (u.users.some(x => x.name === name)) return send(res, 409, { ok: false, error: '账号已存在' });
      u.users.push({ name, role: o.role === 'admin' ? 'admin' : 'user', pass: hash(pass, u.salt), created: Date.now() });
      saveUsers(u);
      return send(res, 200, { ok: true, name });
    });
  }

  if (p === '/api/users' && req.method === 'DELETE'){
    const m = me(req);
    if (!m) return send(res, 401, { ok: false, error: '未登录' });
    if (m.role !== 'admin') return send(res, 403, { ok: false, error: '仅管理员可操作' });
    return body(req, (o) => {
      const name = String(o.name || '').trim();
      if (name === m.name) return send(res, 400, { ok: false, error: '不能删除自己' });
      const u = loadUsers();
      const before = u.users.length;
      u.users = u.users.filter(x => x.name !== name);
      if (u.users.length === before) return send(res, 404, { ok: false, error: '账号不存在' });
      if (!u.users.some(x => x.role === 'admin')) return send(res, 400, { ok: false, error: '至少保留一个管理员' });
      saveUsers(u);
      return send(res, 200, { ok: true });
    });
  }

  /* 改口令（自己 / 管理员改他人） */
  if (p === '/api/pass' && req.method === 'POST'){
    const m = me(req);
    if (!m) return send(res, 401, { ok: false, error: '未登录' });
    if (m.role === 'guest') return send(res, 403, { ok: false, error: '游客无口令' });
    return body(req, (o) => {
      const target = m.role === 'admin' && o.name ? String(o.name) : m.name;
      const newPass = String(o.pass || '');
      if (newPass.length < 4) return send(res, 400, { ok: false, error: '新口令至少 4 位' });
      if (target !== m.name && m.role !== 'admin') return send(res, 403, { ok: false, error: '无权修改他人口令' });
      const u = loadUsers();
      const rec = u.users.find(x => x.name === target);
      if (!rec) return send(res, 404, { ok: false, error: '账号不存在' });
      /* 改自己需旧口令 */
      if (target === m.name && hash(String(o.oldPass || ''), u.salt) !== rec.pass){
        return send(res, 401, { ok: false, error: '原口令错误' });
      }
      rec.pass = hash(newPass, u.salt);
      saveUsers(u);
      return send(res, 200, { ok: true });
    });
  }

  return send(res, 404, { ok: false, error: 'no such api' });
}

http.createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://' + (req.headers.host || 'localhost'));
  if (url.pathname.startsWith('/api/')) return api(req, res, url);

  let p = decodeURIComponent(url.pathname);
  if (p === '/') p = '/index.html';
  if (/\.(?:apk|aab|zip)$/i.test(p)){ res.writeHead(404, { 'Content-Type':'text/plain; charset=utf-8' }); return res.end('下载功能已关闭；请使用官方网页 https://ah-git-love.github.io/zhongxuan/'); }
  const f = path.normalize(path.join(ROOT, p));
  if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end('forbidden'); }
  if (f.includes(path.sep + 'data' + path.sep)){ res.writeHead(403); return res.end('forbidden'); }
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('404 Not Found: ' + p); }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    });
    res.end(d);
  });
}).listen(PORT, '0.0.0.0', () => {
  console.log('[中玄·推演台] 已启动: http://localhost:' + PORT + '  （0.0.0.0 监听，手机同 Wi-Fi 可访问）');
  console.log('[登录] 管理员默认 admin / admin123；游客免密进入；账号存 data/users.json');
});
