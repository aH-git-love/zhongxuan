'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MAX_BODY = 16 * 1024;
const RECORD_TTL = 7 * 24 * 60 * 60 * 1000;
const MAX_RECORDS = 100;
const RATE_WINDOW = 60 * 1000;
const MAX_RATE_KEYS = 2048;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function dangerousKeys(value) {
  if (!value || typeof value !== 'object') return false;
  return Object.keys(value).some(key => key === '__proto__' || key === 'constructor' || key === 'prototype' || dangerousKeys(value[key]));
}

/** Mount before the server's generic /api fallback; returns a synchronous handled flag. */
function createBrainApi({ BRAIN, dataDir, me, send }) {
  if (!BRAIN || !Array.isArray(BRAIN.RULES) || !Array.isArray(BRAIN.SCENES) ||
      typeof BRAIN.normalizeState !== 'function' || typeof BRAIN.analyze !== 'function' ||
      typeof BRAIN.feedback !== 'function' || typeof me !== 'function' || typeof send !== 'function' ||
      typeof dataDir !== 'string' || !dataDir) {
    throw new TypeError('Invalid brain API dependencies');
  }
  const directory = path.join(dataDir, 'brain-users');
  const rules = new Set(BRAIN.RULES.map(rule => rule.id));
  const scenes = new Set(['全部', ...BRAIN.SCENES]);
  const rates = new Map();
  const routes = new Map([
    ['/api/brain/status', 'GET'], ['/api/brain/analyze', 'POST'],
    ['/api/brain/feedback', 'POST'], ['/api/brain/state', 'GET'], ['/api/brain/reset', 'POST']
  ]);

  function reply(res, status, json) {
    if (!res.destroyed && !res.writableEnded) send(res, status, json);
  }
  function failure(res, status, error) { reply(res, status, { ok: false, error }); }
  function normalize(state) { return BRAIN.normalizeState(state); }
  function identity(user) {
    if (!user) return null;
    const guest = user.guest === true || user.role === 'guest';
    const value = guest ? user.token : user.name;
    if (typeof value !== 'string' || !value) return null;
    return crypto.createHash('sha256').update((guest ? 'guest:' : 'account:') + value).digest('hex');
  }
  function fresh() {
    return { version: 1, state: normalize(), counters: { analyses: 0, feedback: 0 }, inferences: [] };
  }
  function validCount(value) { return Number.isSafeInteger(value) && value >= 0; }
  function readStore(key) {
    const filename = path.join(directory, key + '.json');
    let raw;
    try { raw = fs.readFileSync(filename, 'utf8'); }
    catch (error) { if (error.code === 'ENOENT') return fresh(); throw error; }
    const store = JSON.parse(raw);
    if (!object(store) || dangerousKeys(store) || store.version !== 1 || !object(store.state) ||
        !object(store.counters) || !validCount(store.counters.analyses) || !validCount(store.counters.feedback) ||
        !Array.isArray(store.inferences) || store.inferences.some(record =>
          !object(record) || typeof record.id !== 'string' || !UUID.test(record.id) ||
          !Number.isSafeInteger(record.createdAt) || record.createdAt < 0 ||
          !Array.isArray(record.ruleIds) || record.ruleIds.some(id => typeof id !== 'string' || !rules.has(id)) ||
          !object(record.votes) || Object.keys(record.votes).some(id =>
            !record.ruleIds.includes(id) || typeof record.votes[id] !== 'boolean'))) {
      throw new Error('Invalid brain state file');
    }
    store.state = normalize(store.state);
    return store;
  }
  function prune(store) {
    const cutoff = Date.now() - RECORD_TTL;
    const before = store.inferences.length;
    store.inferences = store.inferences.filter(record => record.createdAt > cutoff).slice(-MAX_RECORDS);
    return store.inferences.length !== before;
  }
  function writeStore(key, store) {
    fs.mkdirSync(directory, { recursive: true });
    const filename = path.join(directory, key + '.json');
    const temporary = filename + '.' + crypto.randomUUID() + '.tmp';
    try {
      fs.writeFileSync(temporary, JSON.stringify(store), { encoding: 'utf8', flag: 'wx', mode: 0o600 });
      fs.renameSync(temporary, filename);
    } finally {
      try { fs.unlinkSync(temporary); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
  }
  function rateAllowed(req, user, operation) {
    const now = Date.now();
    for (const [key, value] of rates) {
      if (value.last <= now - RATE_WINDOW) rates.delete(key);
    }
    const scope = user && typeof user.token === 'string' && user.token
      ? 'token:' + user.token : 'ip:' + (req.socket.remoteAddress || 'unknown');
    const key = operation + ':' + crypto.createHash('sha256').update(scope).digest('hex');
    let entry = rates.get(key);
    if (!entry) {
      // Refuse new buckets when full: evicting active buckets would bypass the limit.
      if (rates.size >= MAX_RATE_KEYS) return false;
      entry = { times: [], last: now };
      rates.set(key, entry);
    }
    entry.times = entry.times.filter(time => time > now - RATE_WINDOW);
    entry.last = now;
    const limit = operation === 'analyze' ? 30 : 60;
    if (entry.times.length >= limit) return false;
    entry.times.push(now);
    return true;
  }
  function parseBody(req, res, callback) {
    let size = 0;
    let done = false;
    const chunks = [];
    function reject(status, message) {
      if (done) return;
      done = true;
      chunks.length = 0;
      failure(res, status, message);
    }
    req.on('error', () => reject(400, 'Invalid request body'));
    req.on('aborted', () => reject(400, 'Invalid request body'));
    req.on('data', chunk => {
      if (done) return;
      size += Buffer.byteLength(chunk);
      if (size > MAX_BODY) return reject(413, 'Request body too large');
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (done) return;
      let value;
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        value = JSON.parse(raw);
        if (!object(value) || dangerousKeys(value)) throw new Error('Invalid object');
      } catch (error) { return reject(400, 'Expected a JSON object'); }
      done = true;
      try { callback(value); } catch (error) { failure(res, 500, 'Brain storage or engine error'); }
    });
    const length = req.headers['content-length'];
    if (length !== undefined && Number(length) > MAX_BODY) reject(413, 'Request body too large');
  }

  return function handler(req, res, url) {
    const pathname = typeof url === 'string' ? new URL(url, 'http://localhost').pathname : url && url.pathname;
    if (!routes.has(pathname)) return false;
    try {
      const method = routes.get(pathname);
      if (req.method !== method) {
        res.setHeader('Allow', method);
        failure(res, 405, 'Method not allowed');
        return true;
      }
      if (pathname === '/api/brain/status') {
        reply(res, 200, {
          ok: true, engineVersion: 'rules-v2', ruleCount: rules.size,
          capabilities: { analyze: true, feedback: true, userState: true, reset: true, persistence: true }
        });
        return true;
      }
      const user = me(req);
      const key = identity(user);
      if (pathname !== '/api/brain/analyze' && !key) {
        failure(res, 401, 'Authentication required');
        return true;
      }
      if (pathname === '/api/brain/state') {
        const store = readStore(key);
        if (prune(store)) writeStore(key, store);
        reply(res, 200, { ok: true, state: store.state, counters: { ...store.counters, pendingInferences: store.inferences.length } });
        return true;
      }
      const operation = pathname.slice('/api/brain/'.length);
      if ((operation === 'analyze' || operation === 'feedback') && !rateAllowed(req, user, operation)) {
        res.setHeader('Retry-After', '60');
        failure(res, 429, 'Too many requests');
        return true;
      }
      parseBody(req, res, input => {
        if (operation === 'reset') {
          // Read first: an unreadable/corrupt account must never be silently overwritten.
          readStore(key);
          const store = fresh();
          writeStore(key, store);
          return reply(res, 200, { ok: true, state: store.state, counters: { ...store.counters, pendingInferences: 0 } });
        }
        if (operation === 'analyze') {
          const scene = own(input, 'scene') ? input.scene : '全部';
          if (typeof input.text !== 'string' || input.text.trim().length < 1 || input.text.trim().length > 4000 ||
              typeof scene !== 'string' || !scenes.has(scene)) {
            return failure(res, 400, 'Invalid text or scene');
          }
          const store = key ? readStore(key) : fresh();
          const result = BRAIN.analyze(input.text.trim(), scene, { state: store.state, recordHits: false });
          const inferenceId = key ? crypto.randomUUID() : null;
          if (key) {
            store.state = normalize(result.state);
            const ruleIds = [...new Set((result.matches || []).map(match => match.rule && match.rule.id).filter(id => rules.has(id)))];
            // The engine is pure for server calls; retain its historical top-two hit semantics here.
            for (const id of ruleIds.slice(0, 2)) store.state.hits[id] = (store.state.hits[id] || 0) + 1;
            store.counters.analyses++;
            prune(store);
            store.inferences.push({ id: inferenceId, createdAt: Date.now(), ruleIds, votes: {} });
            store.inferences = store.inferences.slice(-MAX_RECORDS);
            writeStore(key, store);
          }
          return reply(res, 200, { ok: true, result: { ...result, state: store.state, inferenceId, source: 'server', personalized: !!key } });
        }
        if (typeof input.good !== 'boolean' || typeof input.inferenceId !== 'string' || !UUID.test(input.inferenceId) ||
            typeof input.ruleId !== 'string' || !rules.has(input.ruleId)) {
          return failure(res, 400, 'Invalid feedback');
        }
        const store = readStore(key);
        prune(store);
        const record = store.inferences.find(item => item.id === input.inferenceId);
        if (!record) return failure(res, 404, 'Inference not found');
        if (!record.ruleIds.includes(input.ruleId)) return failure(res, 400, 'Rule was not matched');
        if (own(record.votes, input.ruleId)) {
          if (record.votes[input.ruleId] !== input.good) return failure(res, 409, 'Feedback already recorded');
          return reply(res, 200, { ok: true, duplicate: true, state: store.state });
        }
        store.state = normalize(BRAIN.feedback(input.ruleId, input.good, { state: store.state }));
        record.votes[input.ruleId] = input.good;
        store.counters.feedback++;
        writeStore(key, store);
        reply(res, 200, { ok: true, duplicate: false, state: store.state });
      });
    } catch (error) {
      failure(res, 500, 'Brain storage or engine error');
    }
    return true;
  };
}

module.exports = { createBrainApi };
