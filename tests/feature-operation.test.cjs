const assert = require('node:assert/strict');
const test = require('node:test');
const React = require('react');
const { act, create } = require('react-test-renderer');
const { loadTypeScript } = require('./load-typescript.cjs');
const manifest = require('../src/generated/sub2api-features.json');
global.IS_REACT_ACT_ENVIRONMENT = true;

test('native operation form confirms the selected record and submits typed fields', async () => {
  const state = { activeAccountId: 'admin-one', baseUrl: 'https://console.example.com', authMode: 'admin_key' };
  const calls = [];
  let confirmation;
  const service = loadTypeScript('src/services/sub2api-features.ts', {
    '@/src/generated/sub2api-features.json': { default: manifest },
    '@/src/lib/admin-fetch': {},
    '@/src/store/admin-config': { adminConfigState: state, isAdminSession: () => true },
    '@/src/lib/server-url': {},
  });
  const { default: Screen } = loadTypeScript('app/feature-operation.tsx', {
    'expo-document-picker': {},
    'expo-router': { router: {}, useLocalSearchParams: () => ({ operation: 'POST /api/v1/admin/plugins/:id/enable', record: '{"id":3}' }) },
    'react-native': { Pressable: 'Pressable', View: 'View' },
    '@/src/components/admin-ui': Object.fromEntries(['AdminButton', 'AdminChip', 'AdminField', 'AdminMessage', 'AdminSection'].map(name => [name, name])),
    '@/src/components/screen-shell': { ScreenShell: 'ScreenShell' },
    '@/src/components/localized-text': { Text: 'Text', localizedAlert: (...args) => { confirmation = args; } },
    '@/src/components/localized-navigation': { LocalizedStackScreen: 'LocalizedStackScreen' },
    '@/src/store/admin-config': { adminConfigState: state },
    '@/src/lib/admin-fetch': {},
    '@/src/lib/clipboard': {},
    '@/src/services/sub2api-features': { ...service, runFeature: async (...args) => { calls.push(args); return { state: 'enabled' }; } },
    'valtio/react': { useSnapshot: value => value },
  });
  let root;
  await act(async () => { root = create(React.createElement(Screen)); });
  assert.equal(root.root.findAllByType('AdminField').find(node => node.props.label === '记录 ID').props.value, '3');
  await act(async () => {
    root.root.findAllByType('AdminField').find(node => node.props.label === '分配流量比例（%）').props.onChangeText('25');
    root.root.findAllByType('AdminChip').find(node => node.props.label === '关闭').props.onPress();
  });
  await act(async () => root.root.findAllByType('AdminButton').find(node => node.props.label === '提交修改').props.onPress());
  assert.equal(calls.length, 0);
  assert.match(confirmation[1], /plugins\/3\/enable/);
  await act(async () => { confirmation[2][1].onPress(); });
  assert.equal(calls.length, 1);
  assert.equal(calls[0][1], '/api/v1/admin/plugins/3/enable');
  assert.deepEqual(calls[0][2], { accept_untested: false, rollout_percent: 25 });
  await act(async () => root.unmount());
});
