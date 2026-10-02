import * as SecureStore from 'expo-secure-store';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Eye, EyeOff } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';

import { AdminButton, AdminChip, AdminField, AdminMessage, AdminSection, EmptyState } from '@/src/components/admin-ui';
import { Text } from '@/src/components/localized-text';
import { getFirstCreatedAdmin } from '@/src/lib/admin-user';
import { useOpenAIBaseUrl } from '@/src/hooks/use-openai-base-url';
import { listMyApiKeys, listUserApiKeys, listUsers } from '@/src/services/admin';
import { AI_PROVIDER_STORAGE_KEY, listAIModels, testAIProvider } from '@/src/services/ai';
import type { AIProviderConfig, ReasoningEffort } from '@/src/services/ai';
import { adminConfigState } from '@/src/store/admin-config';

const { useSnapshot } = require('valtio/react');

const efforts: ReasoningEffort[] = ['none', 'low', 'medium', 'high', 'xhigh', 'max'];
const suggestedModels = ['gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna'];

const initialConfig: AIProviderConfig = {
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-5.6-terra',
  reasoningEffort: 'medium',
};

export function AIProviderSettings({ onSaved }: { onSaved?: (config: AIProviderConfig | null) => void }) {
  const adminConfig = useSnapshot(adminConfigState);
  const [config, setConfig] = useState<AIProviderConfig>(initialConfig);
  const [models, setModels] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [loadedKeyName, setLoadedKeyName] = useState('');

  const canSelfManage = adminConfig.authMode === 'password' || Boolean(adminConfig.accessToken.trim() && adminConfig.user);
  const defaultAdminQuery = useQuery({
    queryKey: ['ai-provider-default-admin', adminConfig.activeAccountId],
    queryFn: () => listUsers('', 1, 100),
    enabled: adminConfig.authMode === 'admin_key' && Boolean(adminConfig.baseUrl),
  });
  const defaultAdmin = useMemo(
    () => getFirstCreatedAdmin(defaultAdminQuery.data?.items ?? []),
    [defaultAdminQuery.data?.items],
  );
  const canLoadAccountKeys = Boolean(adminConfig.baseUrl) && (canSelfManage || Boolean(defaultAdmin));
  const accountKeysQuery = useQuery({
    queryKey: ['ai-provider-account-keys', adminConfig.activeAccountId, adminConfig.user?.id ?? defaultAdmin?.id],
    queryFn: () => canSelfManage ? listMyApiKeys('', 1, 100) : listUserApiKeys(defaultAdmin!.id),
    enabled: canLoadAccountKeys,
  });
  const baseUrlQuery = useOpenAIBaseUrl(adminConfig.baseUrl);
  const accountBaseUrl = baseUrlQuery.baseUrl;
  const accountKeys = useMemo(
    () => (accountKeysQuery.data?.items ?? []).filter((item) => item.status === 'active'),
    [accountKeysQuery.data?.items],
  );

  useEffect(() => {
    if (Platform.OS === 'web') return;
    SecureStore.getItemAsync(AI_PROVIDER_STORAGE_KEY).then((value) => {
      if (!value) return;
      try {
        const next = { ...initialConfig, ...JSON.parse(value) };
        setConfig(next);
        setSaved(true);
      } catch {
        setSaved(false);
      }
    });
  }, []);

  const modelQuery = useMutation({ mutationFn: () => listAIModels(config), onSuccess: setModels });
  const test = useMutation({ mutationFn: () => testAIProvider(config) });
  const update = <K extends keyof AIProviderConfig>(key: K, value: AIProviderConfig[K]) => {
    setConfig((current) => ({ ...current, [key]: value }));
    if (key === 'baseUrl' || key === 'apiKey') setLoadedKeyName('');
    setSaved(false);
  };
  const selectAccountKey = (name: string, apiKey: string) => {
    if (!accountBaseUrl) return;
    setConfig((current) => ({ ...current, baseUrl: accountBaseUrl, apiKey }));
    setLoadedKeyName(name);
    setModels([]);
    setSaved(false);
    modelQuery.reset();
    test.reset();
  };
  const save = async () => {
    if (Platform.OS === 'web') return;
    await SecureStore.setItemAsync(AI_PROVIDER_STORAGE_KEY, JSON.stringify(config));
    setSaved(true);
    onSaved?.(config);
  };
  const clear = async () => {
    if (Platform.OS !== 'web') await SecureStore.deleteItemAsync(AI_PROVIDER_STORAGE_KEY);
    setConfig(initialConfig);
    setModels([]);
    setLoadedKeyName('');
    setSaved(false);
    test.reset();
    onSaved?.(null);
  };
  const valid = Boolean(config.baseUrl.trim() && config.apiKey.trim() && config.model.trim());

  return (
    <View className="gap-3">
      <AdminSection title="加载当前账号配置" detail="从当前登录的 Sub2API 服务器加载 OpenAI Base URL 和当前用户的活动密钥；多个密钥可选择其中一个。">
        <View className="rounded-2xl bg-[#F4F7FC] p-3 dark:bg-[#182235]">
          <Text className="text-[10px] text-[#7B8798] dark:text-[#9EABC0]">当前服务器 OpenAI Base URL</Text>
          <Text selectable numberOfLines={2} className="mt-1 text-xs font-semibold text-[#2F6DF6]">{accountBaseUrl || (baseUrlQuery.isLoading ? '正在读取站点配置…' : adminConfig.baseUrl ? '暂未获取 API 地址' : '尚未连接 Sub2API 服务器')}</Text>
        </View>
        {accountKeysQuery.isLoading || defaultAdminQuery.isLoading ? (
          <Text className="py-3 text-center text-xs text-[#7B8798] dark:text-[#9EABC0]">正在加载当前账号密钥…</Text>
        ) : accountKeys.length ? (
          <View className="gap-2">
            {accountKeys.map((item) => {
              const maskedKey = item.key.length > 12 ? `${item.key.slice(0, 7)}••••${item.key.slice(-4)}` : '••••••••';
              const selected = config.baseUrl === accountBaseUrl && config.apiKey === item.key;
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected, disabled: !accountBaseUrl }}
                  disabled={!accountBaseUrl}
                  onPress={() => selectAccountKey(item.name, item.key)}
                  className={`flex-row items-center rounded-2xl border px-3 py-3 ${selected ? 'border-[#8FB2FF] bg-[#EAF2FF] dark:bg-[#172C55]' : 'border-[#E2E9F3] bg-[#F4F7FC] dark:border-[#273449] dark:bg-[#182235]'}`}
                >
                  <View className="flex-1">
                    <Text numberOfLines={1} className={`text-xs font-bold ${selected ? 'text-[#2F6DF6]' : 'text-[#344054] dark:text-[#D5DDEA]'}`}>{item.name}</Text>
                    <Text numberOfLines={1} className="mt-1 text-[10px] text-[#7B8798] dark:text-[#9EABC0]">{maskedKey}</Text>
                  </View>
                  <Text className={`text-[10px] font-bold ${selected ? 'text-[#2F6DF6]' : 'text-[#98A2B3]'}`}>{selected ? '已选择' : '选择'}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <EmptyState label={canLoadAccountKeys ? '当前账号没有可用的活动密钥' : '当前登录模式无法加载用户密钥'} />
        )}
        <AdminButton
          label="刷新当前账号配置"
          tone="muted"
          pending={baseUrlQuery.isFetching || accountKeysQuery.isFetching || defaultAdminQuery.isFetching}
          disabled={!adminConfig.baseUrl}
          onPress={() => { void baseUrlQuery.refetch(); if (canLoadAccountKeys) void accountKeysQuery.refetch(); }}
        />
        <AdminMessage error={baseUrlQuery.isError ? new Error('读取站点配置失败，请刷新当前账号配置后重试。') : undefined} />
        <AdminMessage error={defaultAdminQuery.error || accountKeysQuery.error} success={loadedKeyName ? `已选择“${loadedKeyName}”，请保存配置` : undefined} />
      </AdminSection>

      <AdminSection title="OpenAI 兼容服务" detail="Base URL 请填写到 /v1；API Key 仅保存在当前手机 SecureStore。">
        <AdminField label="Base URL" value={config.baseUrl} onChangeText={(value) => update('baseUrl', value)} placeholder="https://api.openai.com/v1" autoCapitalize="none" autoCorrect={false} />
        <AdminField label="API Key" value={config.apiKey} onChangeText={(value) => update('apiKey', value)} placeholder="sk-..." secureTextEntry={!showApiKey} autoCapitalize="none" autoCorrect={false} />
        <Pressable onPress={() => setShowApiKey((value) => !value)} className="self-start flex-row items-center gap-2 rounded-full bg-[#EEF4FF] dark:bg-[#172C55] px-3 py-2">
          {showApiKey ? <EyeOff size={15} color="#2F6DF6" /> : <Eye size={15} color="#2F6DF6" />}
          <Text className="text-[11px] font-bold text-[#2F6DF6]">{showApiKey ? '隐藏 API Key' : '查看 API Key'}</Text>
        </Pressable>
        <AdminField label="模型" value={config.model} onChangeText={(value) => update('model', value)} placeholder="gpt-5.6-terra" autoCapitalize="none" autoCorrect={false} />
        <View className="flex-row flex-wrap gap-2">{suggestedModels.map((model) => <AdminChip key={model} label={model} selected={config.model === model} onPress={() => update('model', model)} />)}</View>
        <AdminButton label="从服务加载模型" tone="muted" pending={modelQuery.isPending} disabled={!config.baseUrl.trim() || !config.apiKey.trim()} onPress={() => modelQuery.mutate()} />
        {models.length ? <ScrollView nestedScrollEnabled showsVerticalScrollIndicator style={{ maxHeight: 256 }} contentContainerStyle={{ gap: 8, padding: 12 }} className="rounded-2xl bg-[#F1F5FA] dark:bg-[#182235]">{models.slice(0, 50).map((model) => <Pressable key={model} onPress={() => update('model', model)} className="rounded-xl bg-white dark:bg-[#111827] px-3 py-2"><Text numberOfLines={1} className="text-xs text-[#344054] dark:text-[#D5DDEA]">{model}</Text></Pressable>)}</ScrollView> : !modelQuery.isPending ? <EmptyState label="尚未加载远程模型列表" /> : null}
        <AdminMessage error={modelQuery.error} success={models.length ? `已加载 ${models.length} 个模型，显示前 50 个` : undefined} />
      </AdminSection>

      <AdminSection title="推理强度" detail="不同模型和兼容服务支持范围可能不同，请以测试结果为准。">
        <View className="flex-row flex-wrap gap-2">{efforts.map((effort) => <AdminChip key={effort} label={effort} selected={config.reasoningEffort === effort} onPress={() => update('reasoningEffort', effort)} />)}</View>
      </AdminSection>

      <AdminSection title="连接测试" detail="调用 Responses API，要求模型只返回 OK，并显示实际模型与 Token 用量。">
        <AdminButton label="测试模型连接" pending={test.isPending} disabled={!valid} onPress={() => test.mutate()} />
        <AdminMessage error={test.error} success={test.data ? `成功 · ${test.data.model} · ${test.data.text || '收到响应'} · ${test.data.usage?.total_tokens ?? '-'} tokens` : undefined} />
      </AdminSection>

      <AdminSection title="保存配置" detail={Platform.OS === 'web' ? 'Web 版不持久化敏感配置，请在 Android App 中保存。' : '保存后立即供 AI 助手的完整对话与悬浮窗口使用。'}>
        <View className="flex-row gap-2"><View className="flex-1"><AdminButton label={saved ? '配置已保存' : '安全保存配置'} disabled={!valid || Platform.OS === 'web'} onPress={save} /></View><AdminButton label="清除" tone="muted" onPress={clear} /></View>
      </AdminSection>
    </View>
  );
}
