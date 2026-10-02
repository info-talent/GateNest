const assert = require('node:assert/strict');
const test = require('node:test');
const { loadTypeScript } = require('./load-typescript.cjs');
const manifest = require('../src/generated/sub2api-features.json');
const urls = loadTypeScript('src/lib/server-url.ts');

function featureService(overrides = {}) {
  const state = { authMode: 'password', accessToken: 'test-token', baseUrl: 'https://console.example.com', user: { role: 'user' } };
  const service = loadTypeScript('src/services/sub2api-features.ts', {
    '@/src/generated/sub2api-features.json': { default: manifest },
    '@/src/lib/admin-fetch': overrides,
    '@/src/store/admin-config': { adminConfigState: state, isAdminSession: () => state.authMode === 'admin_key' || state.user?.role === 'admin' },
    '@/src/lib/server-url': urls,
  });
  return { service, state };
}

test('pinned catalog includes payment and empty-group V2 routes, excludes removed group route', () => {
  const ids = new Set(manifest.operations.map(op => op.id));
  assert.equal(ids.size, manifest.operations.length);
  assert.match(manifest.commit, /^[a-f0-9]{40}$/);
  for (const id of ['GET /api/v1/admin/channel-monitor-v2/snapshot', 'PUT /api/v1/admin/channel-monitor-v2/config', 'PUT /api/v1/admin/payment/config', 'POST /api/v1/admin/plugins/upload', 'GET /api/v1/admin/groups/:id/model-allowlist-candidates', 'POST /api/v1/user/totp/step-up']) assert(ids.has(id), id);
  assert(!ids.has('GET /api/v1/admin/groups/:id/models-list-candidates'));
  const settings = manifest.operations.find(op => op.id === 'PUT /api/v1/admin/settings');
  for (const field of ['api_base_url', 'smtp_host', 'passkey_enabled', 'step_up_enabled']) assert(settings.bodyFields.some(f => f.name === field));
  const plugin = manifest.operations.find(op => op.id === 'POST /api/v1/admin/plugins/:id/enable');
  assert.deepEqual(plugin.bodyFields.map(f => f.name), ['accept_untested', 'rollout_percent']);
});

test('forms preserve false, zero, explicit empty strings, null and omission', () => {
  const { service } = featureService();
  const fields = [{ name: 'enabled', type: 'boolean' }, { name: 'limit', type: 'number', goType: '*int' }, { name: 'description', type: 'string' }, { name: 'optional', type: 'number', nullable: true }, { name: 'ids', type: 'json' }, { name: 'secret', type: 'string' }];
  assert.deepEqual(service.featureBody({ bodyFields: fields }, { enabled: 'false', limit: '0', description: '', optional: 'null', ids: '[1,2]' }), { enabled: false, limit: 0, description: '', optional: null, ids: [1, 2] });
  assert.throws(() => service.featureBody({ bodyFields: fields }, { limit: '1.5' }), /整数/);
  assert.throws(() => service.featureBody({ bodyFields: fields }, { limit: 'Infinity' }), /数字/);
  assert.throws(() => service.featureBody({ bodyFields: fields }, { enabled: 'yes' }), /true/);
  assert.throws(() => service.featureBody({ bodyFields: fields }, { ids: '[1' }), /JSON/);
});

test('path values and filters are encoded without changing the operation endpoint', () => {
  const { service } = featureService();
  const op = { path: '/api/v1/admin/accounts/:id' };
  assert.equal(service.featurePath(op, { id: 'a/b?x=1' }, { search: 'a & b', page: '2' }), '/api/v1/admin/accounts/a%2Fb%3Fx%3D1?search=a+%26+b&page=2');
  assert.throws(() => service.featurePath(op, {}, {}), /id/);
});

test('feature authorization separates user sessions from admin-key sessions', async () => {
  const { service, state } = featureService();
  const admin = manifest.operations.find(op => op.audience === 'admin');
  const user = manifest.operations.find(op => op.audience === 'user');
  assert(!service.canUseFeature(admin));
  assert(service.canUseFeature(user));
  await assert.rejects(service.runFeature(admin, admin.path), /身份/);
  state.authMode = 'admin_key'; state.accessToken = '';
  assert(service.canUseFeature(admin));
  assert(!service.canUseFeature(user));
});

test('operations unwrap envelopes and accept text streams and raw plugin config', async () => {
  let response;
  const { service, state } = featureService({ adminResponseFetch: async () => response });
  state.user.role = 'admin';
  const op = manifest.operations.find(op => op.id === 'GET /api/v1/admin/plugins/:id/config');
  for (const [wire, expected] of [[{ code: 0, data: { enabled: true } }, { enabled: true }], [{ enabled: false }, { enabled: false }]]) {
    response = new Response(JSON.stringify(wire));
    assert.deepEqual(await service.runFeature(op, '/api/v1/admin/plugins/1/config'), expected);
  }
  response = new Response('data: {"success":true}\n\n', { headers: { 'content-type': 'text/event-stream' } });
  assert.equal(await service.runFeature(op, op.path), 'data: {"success":true}\n\n');
  response = new Response(JSON.stringify({ code: 403, reason: 'STEP_UP_REQUIRED' }), { status: 403 });
  await assert.rejects(service.runFeature(op, op.path), /STEP_UP_REQUIRED/);
});

test('official payment/auth pages use the login host and do not include credentials', () => {
  const { service } = featureService();
  assert.equal(service.officialPageUrl('https://console.example.com/sub/api/v1/', '/purchase'), 'https://console.example.com/sub/purchase');
  assert.throws(() => service.officialPageUrl('https://console.example.com', 'https://other.example.com'), /不支持/);
  assert.throws(() => service.officialPageUrl('https://user:password@console.example.com', '/login'), /有效/);
  assert.throws(() => service.officialPageUrl('javascript:alert(1)', '/login'), /有效/);
});

function transport(t, responses) {
  const previous = global.fetch;
  const state = { baseUrl: 'https://console.example.com', activeAccountId: 'account-one', authMode: 'password', accessToken: 'old-token', refreshToken: 'refresh-token', adminApiKey: '', user: { id: 1 } };
  const calls = [], saves = [];
  global.fetch = async (url, init) => { calls.push({ url, init }); return responses.shift()(url, init, state); };
  t.after(() => { global.fetch = previous; });
  const api = loadTypeScript('src/lib/admin-fetch.ts', {
    '@/src/lib/server-url': urls,
    'react-native': { Platform: { OS: 'ios' } },
    '@/src/store/admin-config': { adminConfigState: state, saveAdminConfig: async input => { saves.push(input); Object.assign(state, input); } },
  });
  return { api, state, calls, saves };
}

test('multipart requests retain boundaries and refresh expired sessions before retry', async t => {
  const { api, calls } = transport(t, [() => new Response('{}', { status: 401 }), () => new Response(JSON.stringify({ access_token: 'new-token' })), () => new Response('ok')]);
  const form = new FormData(); form.append('plugin', new Blob(['test']), 'fixture.zip');
  assert.equal(await (await api.adminResponseFetch('/api/v1/admin/plugins/upload', { method: 'POST', body: form })).text(), 'ok');
  assert.equal(calls[0].init.headers.has('Content-Type'), false);
  assert.equal(calls[2].init.headers.get('Authorization'), 'Bearer new-token');
  assert.equal(calls[2].init.body, form);
});

test('a late response cannot refresh or overwrite a newly selected account', async t => {
  const { api, calls, saves } = transport(t, [(_url, _init, state) => { state.baseUrl = 'https://second.example.com'; state.activeAccountId = 'account-two'; return new Response('{}', { status: 401 }); }]);
  await assert.rejects(api.adminResponseFetch('/api/v1/admin/settings'), /SESSION_CHANGED/);
  assert.equal(calls.length, 1);
  assert.equal(saves.length, 0);
});

test('coverage does not label generated wrappers as handwritten integrations', () => {
  const coverage = require('../src/generated/api-coverage.json');
  assert(coverage.counts.dedicated < coverage.counts.total);
  assert(coverage.counts.console_only > 0);
});
