const assert = require('node:assert/strict');
const test = require('node:test');
const React = require('react');
const { act, create } = require('react-test-renderer');
const { loadTypeScript } = require('./load-typescript.cjs');
global.IS_REACT_ACT_ENVIRONMENT = true;

test('password login waits for TOTP without saving the temporary token', async () => {
  const saved = [], verified = [], navigated = [];
  const config = { baseUrl: '', adminApiKey: '', accounts: [] };
  const exports = loadTypeScript('app/login.tsx', {
    'expo-router': { Redirect: 'Redirect', router: { replace: value => navigated.push(value) } },
    'lucide-react-native': new Proxy({}, { get: (_target, name) => String(name) }),
    'react-native': { ActivityIndicator: 'ActivityIndicator', Keyboard: { dismiss() {} }, KeyboardAvoidingView: 'KeyboardAvoidingView', Linking: { openURL() {} }, Platform: { OS: 'ios' }, Pressable: 'Pressable', ScrollView: 'ScrollView', View: 'View' },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    uniwind: { useUniwind: () => ({ theme: 'light' }) },
    '@/src/services/admin': { loginWithPassword: async () => ({ requires_2fa: true, temp_token: 'temporary-token' }), loginWithTwoFactor: async (...args) => { verified.push(args); return { access_token: 'session-token', refresh_token: 'refresh-token', user: { id: 1, role: 'user' } }; } },
    '@/src/services/sub2api-features': { officialPageUrl: () => '' },
    '@/src/services/cliproxy': {},
    '@/src/store/admin-config': { adminConfigState: config, hasAuthenticatedAdminSession: () => false, saveAdminConfig: async value => saved.push(value) },
    '@/src/store/cliproxy-config': { cliProxyConfigState: {} },
    '@/src/store/ui-preferences': { languageState: { value: 'zh' } },
    '@/src/store/workspace-mode': { workspaceModeState: { mode: 'sub2api' } },
    '@/src/components/localized-text': { Text: 'Text', TextInput: 'TextInput', localizedAlert() {} },
    'valtio/react': { useSnapshot: value => value },
  });
  let root;
  await act(async () => { root = create(React.createElement(exports.default)); });
  const field = label => root.root.findAllByType('TextInput').find(node => node.props.label === label);
  await act(async () => {
    field('服务地址').props.onChangeText('https://console.example.com');
    field('邮箱').props.onChangeText('user@example.com');
    root.root.findAllByType('TextInput').find(node => node.props.secureTextEntry === true).props.onChangeText('test-password');
  });
  const submit = () => root.root.findAllByType('Pressable').find(node => node.props.style?.height === 50);
  await act(async () => { await submit().props.onPress(); });
  assert.equal(saved.length, 0);
  assert(field('双因素验证码'));
  await act(async () => field('双因素验证码').props.onChangeText('123456'));
  await act(async () => { await submit().props.onPress(); });
  assert.deepEqual(verified, [['https://console.example.com', 'temporary-token', '123456']]);
  assert.equal(saved[0].accessToken, 'session-token');
  assert(!JSON.stringify(saved).includes('temporary-token'));
  assert.deepEqual(navigated, ['/api-keys']);
  await act(async () => root.unmount());
});
