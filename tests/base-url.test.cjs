const assert = require('node:assert/strict');
const test = require('node:test');
const React = require('react');
const { act, create } = require('react-test-renderer');
const { QueryClient, QueryClientProvider } = require('@tanstack/react-query');
const { loadTypeScript } = require('./load-typescript.cjs');

global.IS_REACT_ACT_ENVIRONMENT = true;
const urls = loadTypeScript('src/lib/server-url.ts');

test('OpenAI addresses prefer settings and preserve API prefixes', () => {
  const login = 'https://console.example.com/api/v1';
  for (const [configured, expected] of [
    ['https://api.example.com', 'https://api.example.com/v1'],
    [' https://api.example.com/gateway/v1/// ', 'https://api.example.com/gateway/v1'],
    ['https://api.example.com/custom/api', 'https://api.example.com/custom/api/v1'],
    ['', 'https://console.example.com/v1'],
    ['   ', 'https://console.example.com/v1'],
    [null, 'https://console.example.com/v1'],
    [undefined, 'https://console.example.com/v1'],
  ]) assert.equal(urls.getOpenAIBaseUrl(login, configured), expected);
  assert.equal(urls.getOpenAIBaseUrl(''), '');
  assert.equal(urls.getOpenAIBaseUrl('https://console.example.com/sub/api'), 'https://console.example.com/sub/v1');
});

test('public settings are requested at the login host without session credentials', async (t) => {
  const requests = [];
  const previousFetch = global.fetch;
  t.after(() => { global.fetch = previousFetch; });
  global.fetch = async (url, init) => {
    requests.push({ url, init });
    return new Response(JSON.stringify({ code: 0, data: { api_base_url: 'https://api.example.com/gateway' } }));
  };
  const fetchers = loadTypeScript('src/lib/admin-fetch.ts', {
    '@/src/store/admin-config': { adminConfigState: {} },
    '@/src/lib/server-url': urls,
    'react-native': { Platform: { OS: 'ios' } },
  });
  const { getPublicSettings } = loadTypeScript('src/services/admin.ts', {
    '@/src/lib/admin-fetch': fetchers,
    '@/src/store/admin-config': {},
  });
  const controller = new AbortController();
  const result = await getPublicSettings('https://console.example.com/sub/api/v1/', controller.signal);
  assert.equal(result.api_base_url, 'https://api.example.com/gateway');
  assert.equal(requests[0].url, 'https://console.example.com/sub/api/v1/settings/public');
  assert.equal(requests[0].init.signal, controller.signal);
  assert.equal(requests[0].init.headers.get('Authorization'), null);
  assert.equal(requests[0].init.headers.get('x-api-key'), null);
});

async function hookHarness(t, getPublicSettings) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const { useOpenAIBaseUrl } = loadTypeScript('src/hooks/use-openai-base-url.ts', {
    '@/src/lib/server-url': urls,
    '@/src/services/admin': { getPublicSettings },
  });
  let state;
  function Harness({ url }) { state = useOpenAIBaseUrl(url); return null; }
  const tree = (url) => React.createElement(QueryClientProvider, { client }, React.createElement(Harness, { url }));
  let root;
  await act(async () => { root = create(tree('https://first.example.com')); });
  t.after(async () => { await act(async () => root.unmount()); client.clear(); });
  return {
    state: () => state,
    switchTo: async (url) => { await act(async () => root.update(tree(url))); },
    settle: async (predicate) => {
      for (let i = 0; i < 50 && !predicate(state); i++) {
        await act(async () => { await new Promise((resolve) => setTimeout(resolve, 5)); });
      }
      assert(predicate(state), 'Query did not reach the expected state');
    },
  };
}

test('settings queries isolate sites and ignore a late previous-site response', async (t) => {
  const pending = new Map();
  const harness = await hookHarness(t, (url) => new Promise((resolve) => pending.set(url, resolve)));
  assert.equal(harness.state().baseUrl, '', 'Do not guess an address while settings load');
  await harness.switchTo('https://second.example.com');
  assert.equal(harness.state().baseUrl, '');
  await act(async () => pending.get('https://first.example.com')({ api_base_url: 'https://old-api.example.com' }));
  assert.equal(harness.state().baseUrl, '');
  await act(async () => pending.get('https://second.example.com')({ api_base_url: 'https://new-api.example.com/gateway/v1' }));
  await harness.settle((state) => state.isSuccess);
  assert.equal(harness.state().baseUrl, 'https://new-api.example.com/gateway/v1');
  await harness.switchTo('');
  assert.equal(harness.state().baseUrl, '');
});

test('settings errors do not become fallback URLs; retry and refresh update the address', async (t) => {
  let response = new Error('Offline');
  const harness = await hookHarness(t, async () => {
    if (response instanceof Error) throw response;
    return response;
  });
  await harness.settle((state) => state.isError);
  assert.equal(harness.state().baseUrl, '');
  response = { api_base_url: '' };
  await act(async () => { await harness.state().refetch(); });
  await harness.settle((state) => state.isSuccess);
  assert.equal(harness.state().baseUrl, 'https://first.example.com/v1');
  response = { api_base_url: 'https://configured.example.com/proxy' };
  await act(async () => { await harness.state().refetch(); });
  await harness.settle((state) => state.baseUrl === 'https://configured.example.com/proxy/v1');
});

test('AI model and response requests use the resolved API host instead of the login host', async () => {
  const requests = [];
  const ai = loadTypeScript('src/services/ai.ts', {
    '@/src/lib/admin-fetch': {
      fetchWithWebProxy: async (url, init) => {
        requests.push({ url, init });
        return new Response(JSON.stringify({ data: [{ id: 'test-model' }], output_text: 'OK' }));
      },
    },
  });
  const config = { baseUrl: urls.getOpenAIBaseUrl('https://console.example.com', 'https://api.example.com/proxy/v1/'), apiKey: 'test-key', model: 'test-model', reasoningEffort: 'medium' };
  assert.deepEqual(await ai.listAIModels(config), ['test-model']);
  assert.equal((await ai.testAIProvider(config)).text, 'OK');
  assert.deepEqual(requests.map(({ url }) => url), ['https://api.example.com/proxy/v1/models', 'https://api.example.com/proxy/v1/responses']);
});
