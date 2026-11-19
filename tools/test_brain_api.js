'use strict';

/* Isolated HTTP integration tests: node tools/test_brain_api.js. No live server/data touched. */
const assert = require('assert').strict;
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { BRAIN } = require('../js/brain.js');
const MODULE = require.resolve('../backend/brain-api.js');
const tokens = new Map([
  ['alice-token', { name: 'alice', role: 'user', guest: false }],
  ['alice-token-2', { name: 'alice', role: 'user', guest: false }],
  ['bob-token', { name: 'bob', role: 'user', guest: false }],
  ['guest-token-1', { name: 'same-guest-name', role: 'guest', guest: true }],
  ['guest-token-2', { name: 'same-guest-name', role: 'guest', guest: true }],
  ['prototype-token', { name: '__proto__', role: 'user', guest: false }]
]);
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'zx-brain-api-test-'));
const accountFile = name => path.join(directory, 'brain-users', crypto.createHash('sha256').update('account:' + name).digest('hex') + '.json');
let server;
let handler;
let passed = 0;
let base;

function createHandler() {
  delete require.cache[MODULE];
  return require(MODULE).createBrainApi({
    BRAIN, dataDir: directory,
    me(req) {
      const token = String(req.headers.authorization || '').replace(/^Bearer /, '');
      const user = tokens.get(token);
      return user ? { ...user, token } : null;
    },
    send(res, status, value) {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(value));
    }
  });
}
function request(route, { token, method = 'GET', body, raw, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const content = raw !== undefined ? raw : body === undefined ? undefined : JSON.stringify(body);
    const req = http.request(base + route, {
      method, headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}),
        ...(content !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers }
    }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(Buffer.concat(chunks).toString('utf8')) }); }
        catch (error) { reject(error); }
      });
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(5000, () => req.destroy(new Error('HTTP test timed out')));
    if (content !== undefined) req.write(content);
    req.end();
  });
}
const analyze = (token, extra = {}) => request('/api/brain/analyze', { token, method: 'POST', body: { text: '事业工作升职跳槽', scene: '全部', ...extra } });
const state = token => request('/api/brain/state', { token });
const feedback = (token, inferenceId, ruleId, good = true) => request('/api/brain/feedback', { token, method: 'POST', body: { inferenceId, ruleId, good } });
async function test(name, run) {
  await run();
  passed++;
  console.log('  PASS ' + name);
}
function matched(response) {
  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.ok(response.body.result.matches.length);
  return response.body.result.matches[0].rule.id;
}
function readStore(name) { return JSON.parse(fs.readFileSync(accountFile(name), 'utf8')); }
function saveStore(name, value) { fs.writeFileSync(accountFile(name), JSON.stringify(value)); }

(async () => {
  assert.equal(typeof BRAIN.normalizeState, 'function', 'Real BRAIN must expose the rules-v2 state API');
  handler = createHandler();
  server = http.createServer((req, res) => {
    try {
      if (!handler(req, res, new URL(req.url, 'http://localhost'))) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end('{"ok":false}');
      }
    } catch (error) { res.writeHead(598); res.end(JSON.stringify({ error: String(error) })); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = 'http://127.0.0.1:' + server.address().port;

  await test('public status exposes capabilities and rule count without identity/state', async () => {
    const response = await request('/api/brain/status', { token: 'alice-token' });
    assert.equal(response.status, 200);
    assert.equal(response.body.engineVersion, 'rules-v2');
    assert.equal(response.body.ruleCount, BRAIN.RULES.length);
    assert.ok(response.body.capabilities);
    for (const field of ['name', 'token', 'state', 'counters', 'inferences']) assert.equal(response.body[field], undefined);
    assert.equal((await request('/api/brain/missing')).status, 404);
  });
  await test('wrong methods return 405 and Allow for every owned endpoint', async () => {
    for (const [route, method] of [['status', 'GET'], ['analyze', 'POST'], ['feedback', 'POST'], ['state', 'GET'], ['reset', 'POST']]) {
      const response = await request('/api/brain/' + route, { method: method === 'GET' ? 'POST' : 'GET' });
      assert.equal(response.status, 405, route);
      assert.equal(response.headers.allow, method);
    }
  });
  await test('public and invalid-token analysis use an unmodified baseline without persistence', async () => {
    const response = await analyze(undefined);
    matched(response);
    assert.equal(response.body.result.inferenceId, null);
    assert.equal(response.body.result.personalized, false);
    assert.equal(response.body.result.source, 'server');
    assert.deepEqual(response.body.result.state, BRAIN.normalizeState());
    assert.equal(fs.readdirSync(directory).length, 0);
    const invalid = await analyze('unknown-token', { name: 'alice', state: { good: { A02: 900 } } });
    assert.equal(invalid.body.result.personalized, false);
    assert.deepEqual(invalid.body.result.state, BRAIN.normalizeState());
  });
  await test('validates trimmed text length, type and exact scene membership', async () => {
    for (const text of ['', '   ', 1, null, {}, 'a'.repeat(4001)]) {
      assert.equal((await analyze('alice-token', { text })).status, 400);
    }
    for (const scene of ['__proto__', 'toString', '不存在', null, 1, {}]) {
      assert.equal((await analyze('alice-token', { scene })).status, 400);
    }
    assert.equal((await analyze('alice-token', { text: '  事业  ', scene: BRAIN.SCENES[0] })).status, 200);
    assert.equal((await analyze('alice-token', { text: 'a'.repeat(4000) })).status, 200);
    const omitted = await request('/api/brain/analyze', { token: 'alice-token', method: 'POST', body: { text: '工作' } });
    assert.equal(omitted.status, 200);
  });
  await test('state, reset and feedback require authentication', async () => {
    assert.equal((await state()).status, 401);
    assert.equal((await request('/api/brain/reset', { method: 'POST', body: {} })).status, 401);
    assert.equal((await feedback(undefined, crypto.randomUUID(), 'A02')).status, 401);
  });

  let aliceInference;
  let aliceRule;
  let bobInference;
  let bobRule;
  await test('authenticated results persist only scoped state and inference metadata', async () => {
    const secret = 'UNIQUE_PRIVATE_QUESTION_8829';
    const response = await analyze('alice-token', { text: '工作升职 ' + secret, name: 'bob', token: 'bob-token' });
    aliceRule = matched(response);
    aliceInference = response.body.result.inferenceId;
    assert.match(aliceInference, /^[0-9a-f-]{36}$/);
    assert.equal(response.body.result.personalized, true);
    const contents = fs.readFileSync(accountFile('alice'), 'utf8');
    assert.equal(contents.includes(secret), false);
    for (const value of ['alice-token', 'bob-token', 'alice', 'bob']) assert.equal(contents.includes(value), false);
    const store = readStore('alice');
    assert.ok(store.inferences.some(item => item.id === aliceInference && item.ruleIds.includes(aliceRule)));
    for (const record of store.inferences) assert.deepEqual(Object.keys(record).sort(), ['createdAt', 'id', 'ruleIds', 'votes']);
    assert.equal(store.state.hits[aliceRule] > 0, true);
    assert.equal((await state('bob-token')).body.counters.analyses, 0);
  });
  await test('feedback rejects cross-account and unmatched rule IDs; strict boolean and UUID', async () => {
    assert.equal((await feedback('bob-token', aliceInference, aliceRule)).status, 404);
    const other = BRAIN.RULES.find(rule => !readStore('alice').inferences.find(item => item.id === aliceInference).ruleIds.includes(rule.id)).id;
    assert.equal((await feedback('alice-token', aliceInference, other)).status, 400);
    for (const good of [1, 0, 'true', null, {}]) assert.equal((await feedback('alice-token', aliceInference, aliceRule, good)).status, 400);
    assert.equal((await feedback('alice-token', '../state', aliceRule)).status, 400);
    assert.equal((await feedback('alice-token', aliceInference, '__proto__')).status, 400);
    assert.equal((await feedback('alice-token', aliceInference, 'constructor')).status, 400);
  });
  await test('same vote is idempotent and opposite vote conflicts without additional learning', async () => {
    const response = await feedback('alice-token', aliceInference, aliceRule);
    assert.equal(response.status, 200);
    assert.equal(response.body.duplicate, false);
    const before = (await state('alice-token')).body;
    assert.equal(before.state.good[aliceRule], 1);
    assert.equal(before.counters.feedback, 1);
    const duplicate = await feedback('alice-token', aliceInference, aliceRule);
    assert.equal(duplicate.status, 200);
    assert.equal(duplicate.body.duplicate, true);
    assert.deepEqual((await state('alice-token')).body, before);
    assert.equal((await feedback('alice-token', aliceInference, aliceRule, false)).status, 409);
    assert.deepEqual((await state('alice-token')).body, before);
  });
  await test('account state survives module recreation and token rotation while public stays baseline', async () => {
    const before = (await state('alice-token')).body;
    handler = createHandler();
    assert.deepEqual((await state('alice-token-2')).body, before);
    assert.equal((await feedback('alice-token-2', aliceInference, aliceRule)).body.duplicate, true);
    assert.deepEqual((await analyze()).body.result.state, BRAIN.normalizeState());
    const bob = await analyze('bob-token');
    bobRule = matched(bob);
    bobInference = bob.body.result.inferenceId;
    assert.equal((await feedback('bob-token', bobInference, bobRule, false)).status, 200);
  });
  await test('same-name guests are scoped by trusted token; prototype-shaped account is safe', async () => {
    const first = await analyze('guest-token-1', { name: 'alice' });
    const id = matched(first);
    assert.equal((await feedback('guest-token-1', first.body.result.inferenceId, id)).status, 200);
    assert.equal((await feedback('guest-token-2', first.body.result.inferenceId, id)).status, 404);
    assert.deepEqual((await state('guest-token-2')).body.state, BRAIN.normalizeState());
    assert.equal((await state('guest-token-1')).body.state.good[id], 1);
    const prototype = await analyze('prototype-token');
    assert.equal(prototype.status, 200);
    assert.equal((await state('prototype-token')).status, 200);
    assert.equal({}.polluted, undefined);
  });
  await test('reset removes only the current account state and outstanding inference IDs', async () => {
    const bobBefore = (await state('bob-token')).body;
    const guestBefore = (await state('guest-token-1')).body;
    const response = await request('/api/brain/reset', { token: 'alice-token', method: 'POST', body: { name: 'bob' } });
    assert.equal(response.status, 200);
    assert.deepEqual(response.body.state, BRAIN.normalizeState());
    assert.deepEqual(response.body.counters, { analyses: 0, feedback: 0, pendingInferences: 0 });
    assert.equal((await feedback('alice-token', aliceInference, aliceRule)).status, 404);
    assert.deepEqual((await state('bob-token')).body, bobBefore);
    assert.deepEqual((await state('guest-token-1')).body, guestBefore);
  });
  await test('malformed, non-object and prototype-polluting JSON return 400 without a crash', async () => {
    for (const raw of ['', '{', 'null', '[]', '42', 'true', '"x"', '{"__proto__":{"polluted":true}}',
      '{"text":"工作","state":{"constructor":{"prototype":{"polluted":true}}}}']) {
      assert.equal((await request('/api/brain/analyze', { token: 'alice-token', method: 'POST', raw })).status, 400, raw);
    }
    assert.equal({}.polluted, undefined);
    assert.equal((await request('/api/brain/reset', { token: 'alice-token', method: 'POST', raw: '[]' })).status, 400);
    assert.equal((await request('/api/brain/status')).status, 200);
  });
  await test('oversized chunked and declared bodies return 413; UTF-8 limits count bytes', async () => {
    for (const raw of [JSON.stringify({ text: 'x'.repeat(17000) }), JSON.stringify({ text: '中'.repeat(6000) })]) {
      assert.equal((await request('/api/brain/analyze', { token: 'alice-token', method: 'POST', raw })).status, 413);
      assert.equal((await request('/api/brain/analyze', { token: 'alice-token', method: 'POST', raw,
        headers: { 'Content-Length': Buffer.byteLength(raw) } })).status, 413);
    }
    assert.equal((await request('/api/brain/status')).status, 200);
  });
  await test('corrupt and invalid-schema storage fail 500 without replacing data or leaking paths', async () => {
    const filename = accountFile('bob');
    const valid = fs.readFileSync(filename, 'utf8');
    for (const corrupt of ['{bad-json', '{}', '{"version":1,"state":{},"counters":{},"inferences":[]}']) {
      fs.writeFileSync(filename, corrupt);
      for (const run of [() => state('bob-token'), () => analyze('bob-token'),
        () => feedback('bob-token', bobInference, bobRule),
        () => request('/api/brain/reset', { token: 'bob-token', method: 'POST', body: {} })]) {
        const response = await run();
        assert.equal(response.status, 500);
        assert.equal(JSON.stringify(response.body).includes(directory), false);
        assert.equal(fs.readFileSync(filename, 'utf8'), corrupt);
      }
    }
    fs.writeFileSync(filename, valid);
    assert.equal((await state('bob-token')).status, 200);
  });
  await test('engine and atomic rename failures return safe 500s and preserve committed files', async () => {
    const filename = accountFile('bob');
    const before = fs.readFileSync(filename, 'utf8');
    const originalAnalyze = BRAIN.analyze;
    const originalFeedback = BRAIN.feedback;
    const originalRename = fs.renameSync;
    try {
      BRAIN.analyze = () => { throw new Error('private engine diagnostic ' + directory); };
      assert.equal((await analyze('bob-token')).status, 500);
      BRAIN.analyze = originalAnalyze;
      const inference = await analyze('bob-token');
      const ruleId = matched(inference);
      const committed = fs.readFileSync(filename, 'utf8');
      BRAIN.feedback = () => { throw new Error('private feedback diagnostic ' + directory); };
      const failedVote = await feedback('bob-token', inference.body.result.inferenceId, ruleId);
      assert.equal(failedVote.status, 500);
      assert.equal(JSON.stringify(failedVote.body).includes(directory), false);
      assert.equal(fs.readFileSync(filename, 'utf8'), committed);
      BRAIN.feedback = originalFeedback;
      fs.renameSync = (source, target) => {
        if (target === filename) throw new Error('private rename diagnostic ' + directory);
        return originalRename(source, target);
      };
      const failedWrite = await analyze('bob-token');
      assert.equal(failedWrite.status, 500);
      assert.equal(JSON.stringify(failedWrite.body).includes(directory), false);
      assert.equal(fs.readFileSync(filename, 'utf8'), committed);
      assert.equal(fs.readdirSync(path.dirname(filename)).some(name => name.endsWith('.tmp')), false);
    } finally {
      BRAIN.analyze = originalAnalyze;
      BRAIN.feedback = originalFeedback;
      fs.renameSync = originalRename;
      fs.writeFileSync(filename, before);
    }
    assert.equal((await state('bob-token')).status, 200);
  });
  await test('inference history expires after seven days and is bounded to the latest 100', async () => {
    const store = readStore('bob');
    const oldId = crypto.randomUUID();
    store.inferences = [{ id: oldId, createdAt: Date.now() - 8 * 86400000, ruleIds: [bobRule], votes: {} },
      ...Array.from({ length: 105 }, (_, index) => ({ id: crypto.randomUUID(), createdAt: Date.now() - 1000 + index, ruleIds: [bobRule], votes: {} }))];
    saveStore('bob', store);
    assert.equal((await feedback('bob-token', oldId, bobRule)).status, 404);
    const response = await state('bob-token');
    assert.equal(response.body.counters.pendingInferences, 100);
    assert.equal(readStore('bob').inferences.length, 100);
    assert.equal(readStore('bob').inferences.some(item => item.id === oldId), false);
    assert.equal((await analyze('bob-token')).status, 200);
    assert.equal(readStore('bob').inferences.length, 100);
    assert.equal(fs.readdirSync(path.join(directory, 'brain-users')).some(name => name.endsWith('.tmp')), false);
  });
  await test('parallel same-vote requests commit feedback exactly once', async () => {
    const result = await analyze('bob-token');
    const id = matched(result);
    const before = (await state('bob-token')).body.counters.feedback;
    const responses = await Promise.all(Array.from({ length: 8 }, () => feedback('bob-token', result.body.result.inferenceId, id)));
    assert.ok(responses.every(response => response.status === 200));
    assert.equal(responses.filter(response => !response.body.duplicate).length, 1);
    assert.equal((await state('bob-token')).body.counters.feedback, before + 1);
  });
  await test('analysis limits are per trusted token or unauthenticated IP', async () => {
    handler = createHandler();
    for (let index = 0; index < 30; index++) assert.equal((await analyze('alice-token')).status, 200);
    const limited = await analyze('alice-token');
    assert.equal(limited.status, 429);
    assert.equal(limited.headers['retry-after'], '60');
    assert.equal((await analyze('bob-token')).status, 200);
    for (let index = 0; index < 30; index++) assert.equal((await analyze('forged-' + index)).status, 200);
    assert.equal((await analyze('another-forged-token')).status, 429);
    handler = createHandler();
    const result = await analyze('bob-token');
    const id = matched(result);
    for (let index = 0; index < 60; index++) assert.equal((await feedback('bob-token', result.body.result.inferenceId, id)).status, 200);
    assert.equal((await feedback('bob-token', result.body.result.inferenceId, id)).status, 429);
    assert.equal((await request('/api/brain/status')).status, 200);
  });
  console.log('\nBrain API: ' + passed + ' integration groups passed.');
})().catch(error => {
  process.exitCode = 1;
  console.error('\nBrain API integration failure:', error.stack || error);
}).finally(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  fs.rmSync(directory, { recursive: true, force: true });
});
