import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, View } from 'react-native';
import { AdminButton, AdminChip, AdminField, AdminMessage, AdminSection } from '@/src/components/admin-ui';
import { ScreenShell } from '@/src/components/screen-shell';
import { Text } from '@/src/components/localized-text';
import { LocalizedStackScreen } from '@/src/components/localized-navigation';
import { adminConfigState } from '@/src/store/admin-config';
import { useOpenAIBaseUrl } from '@/src/hooks/use-openai-base-url';
import { canUseFeature, featureOperations, featureModuleLabels, featureTitle, officialPageUrl } from '@/src/services/sub2api-features';
const { useSnapshot } = require('valtio/react');

export default function FeatureCenter() {
  const config = useSnapshot(adminConfigState);
  const settings = useOpenAIBaseUrl(config.baseUrl);
  const [search, setSearch] = useState('');
  const [module, setModule] = useState(config.authMode === 'admin_key' || config.user?.role === 'admin' ? 'admin/accounts' : 'user/user');
  const [limit, setLimit] = useState(40);
  useEffect(() => setLimit(40), [module, search]);
  const [error, setError] = useState<unknown>();
  const operations = useMemo(() => featureOperations.filter(op => canUseFeature(op) && !(op.audience === 'public' && op.module === 'auth') && !(op.audience === 'user' && (op.module === 'payment' || op.path.includes('/passkeys') || op.path.includes('/auth-identities/')))), [config.authMode, config.user?.role, config.accessToken]);
  const groups = [...new Set(operations.map(op => `${op.audience}/${op.module}`))];
  const visible = operations.filter(op => (!module || `${op.audience}/${op.module}` === module) && `${featureTitle(op)} ${featureModuleLabels[op.module]} ${op.path}`.toLowerCase().includes(search.toLowerCase()));
  const open = async (page: string) => { try { await Linking.openURL(officialPageUrl(config.baseUrl, page)); } catch (reason) { setError(reason); } };
  return <>
    <LocalizedStackScreen options={{ title: '功能中心', headerShown: true }} />
    <ScreenShell title="功能中心" subtitle="按模块查看、配置和管理当前 Sub2API 站点" safeAreaEdges={['bottom']}>
      <AdminSection title="支付与身份认证" detail="在当前站点的官方网页完成支付和浏览器认证；网页可能需要单独登录。">
        <View className="flex-row flex-wrap gap-2">
          <AdminButton label={settings.data?.payment_enabled === false ? '站点未开启在线支付' : '充值与购买'} disabled={settings.data?.payment_enabled === false} onPress={() => void open('/purchase')} />
          <AdminButton label="我的订单" tone="muted" onPress={() => void open('/orders')} />
          <AdminButton label="Passkey / 账号绑定" tone="muted" onPress={() => void open('/profile')} />
        </View><AdminMessage error={error} />
      </AdminSection>
      <AdminSection title="原生操作">
        <AdminField label="搜索功能" value={search} onChangeText={value => { setSearch(value); if (value) setModule(''); }} placeholder="例如 插件、settings、额度" />
        <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ gap: 8 }}><AdminChip label="全部" selected={!module} onPress={() => setModule('')} />{groups.map(key => <AdminChip key={key} label={`${key.startsWith('admin/') ? '管理 · ' : key.startsWith('public/') ? '站点 · ' : '我的 · '}${featureModuleLabels[key.split('/')[1]] || key.split('/')[1]}`} selected={module === key} onPress={() => setModule(key)} />)}</ScrollView>
      </AdminSection>
      {visible.slice(0, limit).map(op => <Pressable key={op.id} onPress={() => router.push({ pathname: '/feature-operation', params: { operation: op.id } })} className="rounded-2xl bg-white p-4 dark:bg-[#111827]">
        <Text className="text-sm font-bold text-[#172033] dark:text-[#F4F7FB]">{featureTitle(op)}</Text>
        <Text className="mt-1 text-xs text-[#667085]">{featureModuleLabels[op.module] || op.module} · {op.method === 'GET' ? '读取' : '修改'}</Text>
        <Text className="mt-1 text-[10px] text-[#667085]">{op.path.replace('/api/v1/', '')}</Text>
      </Pressable>)}
      {visible.length > limit ? <AdminButton label={`显示更多（剩余 ${visible.length - limit} 项）`} tone="muted" onPress={() => setLimit(current => current + 40)} /> : null}
      {!visible.length ? <Text>没有匹配的功能</Text> : null}
    </ScreenShell>
  </>;
}
