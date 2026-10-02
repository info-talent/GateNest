import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ChevronDown, ChevronUp, Copy, ExternalLink } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';

import { AdminButton, AdminChip, AdminField, AdminMessage, AdminSection } from '@/src/components/admin-ui';
import { LocalizedStackScreen } from '@/src/components/localized-navigation';
import { Text } from '@/src/components/localized-text';
import { ScreenShell } from '@/src/components/screen-shell';
import { copyWithFeedback } from '@/src/lib/clipboard';
import {
  createAccount,
  exchangeAccountAuthCode,
  generateAccountAuthURL,
  listAllGroups,
  listProxies,
} from '@/src/services/admin';
import type {
  AccountPlatform,
  AccountType,
  CreateAccountRequest,
  OAuthSession,
} from '@/src/types/admin';

type AuthMethod = Extract<AccountType, 'oauth' | 'setup-token'>;
type BedrockAuthMode = 'sigv4' | 'apikey';

const PLATFORMS: Array<{ value: AccountPlatform; label: string; detail: string }> = [
  { value: 'anthropic', label: 'Anthropic', detail: 'Claude OAuth、Setup Token、API Key、Bedrock 或 Vertex' },
  { value: 'openai', label: 'OpenAI', detail: 'ChatGPT OAuth 或 OpenAI API Key' },
  { value: 'gemini', label: 'Gemini', detail: 'Google OAuth、AI Studio API Key 或 Vertex' },
  { value: 'antigravity', label: 'Antigravity', detail: 'Google OAuth 或兼容上游' },
  { value: 'grok', label: 'Grok', detail: 'xAI OAuth 或 API Key' },
  { value: 'kimi', label: 'Kimi', detail: 'API Key；协议与套餐可在完整字段中配置' },
  { value: 'zhipu', label: '智谱', detail: 'API Key；请填写实际 API 地址' },
  { value: 'deepseek', label: 'DeepSeek', detail: 'API Key；请填写实际 API 地址' },
  { value: 'minimax', label: 'MiniMax', detail: 'API Key；协议与套餐可在完整字段中配置' },
  { value: 'opencode_go', label: 'OpenCode GO', detail: 'API Key；协议与套餐可在完整字段中配置' },
  { value: 'typesafe', label: 'TypeSafe / Jev', detail: 'TypeSafe API Key' },
];

const METHODS: Record<AccountPlatform, AccountType[]> = {
  anthropic: ['oauth', 'setup-token', 'apikey', 'bedrock', 'service_account'],
  openai: ['oauth', 'apikey'],
  gemini: ['oauth', 'apikey', 'service_account'],
  antigravity: ['oauth', 'upstream'],
  grok: ['oauth', 'apikey'],
  kimi: ['apikey'], zhipu: ['apikey'], deepseek: ['apikey'], minimax: ['apikey'], opencode_go: ['apikey'], typesafe: ['apikey'],
};

const METHOD_LABELS: Record<AccountType, string> = {
  oauth: 'OAuth 授权',
  'setup-token': 'Setup Token',
  apikey: 'API Key',
  upstream: '上游服务',
  bedrock: 'AWS Bedrock',
  service_account: 'Vertex 服务账号',
};

const DEFAULT_BASE_URLS: Partial<Record<AccountPlatform, string>> = {
  anthropic: 'https://api.anthropic.com',
  openai: 'https://api.openai.com',
  gemini: 'https://generativelanguage.googleapis.com',
  grok: 'https://api.x.ai/v1',
};

const DEFAULT_NAMES: Record<AccountPlatform, string> = {
  anthropic: 'Claude Account',
  openai: 'OpenAI Account',
  gemini: 'Gemini Account',
  antigravity: 'Antigravity Account',
  grok: 'Grok Account',
  kimi: 'Kimi Account', zhipu: 'Zhipu Account', deepseek: 'DeepSeek Account', minimax: 'MiniMax Account', opencode_go: 'OpenCode GO Account', typesafe: 'TypeSafe Account',
};

function optionalNumber(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error('请输入有效数字。');
  return parsed;
}

function requiredNumber(value: string, label: string) {
  const parsed = optionalNumber(value);
  if (parsed === undefined) throw new Error(`${label}不能为空。`);
  return parsed;
}

function parseExpiry(value: string) {
  if (!value.trim()) return null;
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value.trim())
    ? `${value.trim()}T23:59:59`
    : value.trim();
  const timestamp = Date.parse(normalized);
  if (!Number.isFinite(timestamp)) throw new Error('到期时间格式无效，请使用 YYYY-MM-DD。');
  return Math.floor(timestamp / 1000);
}

function compactRecord(value: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined && item !== null && item !== '')
  );
}

function parseAuthorizationInput(raw: string, fallbackState?: string) {
  const value = raw.trim();
  if (!value) throw new Error('请粘贴授权码或完整回调地址。');

  try {
    const url = new URL(value);
    return {
      code: url.searchParams.get('code') || value,
      state: url.searchParams.get('state') || fallbackState,
    };
  } catch {
    const codeMatch = value.match(/[?&#]code=([^&#]+)/);
    const stateMatch = value.match(/[?&#]state=([^&#]+)/);
    return {
      code: codeMatch ? decodeURIComponent(codeMatch[1]) : value,
      state: stateMatch ? decodeURIComponent(stateMatch[1]) : fallbackState,
    };
  }
}

function buildOAuthPayload(platform: AccountPlatform, result: Record<string, unknown>) {
  const nested = result.credentials;
  const source = nested && typeof nested === 'object' && !Array.isArray(nested)
    ? nested as Record<string, unknown>
    : result;

  const excluded = new Set(['extra', 'message', 'success', 'account', 'credentials']);
  const credentials = compactRecord(
    Object.fromEntries(Object.entries(source).filter(([key]) => !excluded.has(key)))
  );

  if (platform === 'grok' && !credentials.base_url) {
    credentials.base_url = 'https://cli-chat-proxy.grok.com/v1';
  }
  if (typeof credentials.expires_at === 'number' && (platform === 'gemini' || platform === 'antigravity')) {
    credentials.expires_at = Math.floor(credentials.expires_at).toString();
  }

  const resultExtra = result.extra;
  const extra = resultExtra && typeof resultExtra === 'object' && !Array.isArray(resultExtra)
    ? { ...resultExtra as Record<string, unknown> }
    : {};
  for (const key of ['org_uuid', 'account_uuid', 'email_address', 'email', 'name', 'plan_type', 'subscription_expires_at']) {
    if (result[key] !== undefined) extra[key] = result[key];
  }

  return { credentials, extra: Object.keys(extra).length ? extra : undefined };
}

function parseModelMapping(allowedInput: string, mappingInput: string) {
  const mapping: Record<string, string> = {};
  allowedInput
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .forEach((model) => {
      if (!model.includes('*')) mapping[model] = model;
    });

  mappingInput
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)
    .forEach((row) => {
      const separator = row.includes('=>') ? '=>' : '=';
      const [from, to] = row.split(separator).map((item) => item.trim());
      if (!from || !to) throw new Error(`模型映射格式无效：${row}`);
      if ((from.includes('*') && !from.endsWith('*')) || to.includes('*')) {
        throw new Error(`模型映射通配符无效：${row}`);
      }
      mapping[from] = to;
    });

  return Object.keys(mapping).length ? mapping : undefined;
}

function ToggleRow({ label, detail, value, onChange }: { label: string; detail?: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      className="flex-row items-center gap-3 rounded-2xl border border-[#E8EDF5] dark:border-[#273449] bg-[#F6F8FC] dark:bg-[#152033] px-4 py-3"
    >
      <View className="flex-1">
        <Text className="text-sm font-semibold text-[#172033] dark:text-[#F4F7FB]">{label}</Text>
        {detail ? <Text className="mt-1 text-[11px] leading-4 text-[#7B8798] dark:text-[#9EABC0]">{detail}</Text> : null}
      </View>
      <View className={`h-6 w-11 rounded-full p-1 ${value ? 'bg-[#2F6DF6]' : 'bg-[#CBD5E1] dark:bg-[#3A4658]'}`}>
        <View className={`h-4 w-4 rounded-full bg-white ${value ? 'self-end' : 'self-start'}`} />
      </View>
    </Pressable>
  );
}

export default function CreateAdminAccountScreen() {
  const queryClient = useQueryClient();
  const [platform, setPlatform] = useState<AccountPlatform>('anthropic');
  const [type, setType] = useState<AccountType>('oauth');
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState(DEFAULT_BASE_URLS.anthropic || '');
  const [oauthSession, setOAuthSession] = useState<OAuthSession | null>(null);
  const [authorizationInput, setAuthorizationInput] = useState('');
  const [vertexJson, setVertexJson] = useState('');
  const [vertexProjectId, setVertexProjectId] = useState('');
  const [vertexLocation, setVertexLocation] = useState('us-central1');
  const [bedrockMode, setBedrockMode] = useState<BedrockAuthMode>('sigv4');
  const [bedrockRegion, setBedrockRegion] = useState('us-east-1');
  const [bedrockAccessKey, setBedrockAccessKey] = useState('');
  const [bedrockSecretKey, setBedrockSecretKey] = useState('');
  const [bedrockSessionToken, setBedrockSessionToken] = useState('');
  const [bedrockForceGlobal, setBedrockForceGlobal] = useState(false);
  const [selectedProxyId, setSelectedProxyId] = useState<number | null>(null);
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([]);
  const [concurrency, setConcurrency] = useState('10');
  const [loadFactor, setLoadFactor] = useState('');
  const [priority, setPriority] = useState('1');
  const [rateMultiplier, setRateMultiplier] = useState('1');
  const [expiresAt, setExpiresAt] = useState('');
  const [autoPauseOnExpired, setAutoPauseOnExpired] = useState(true);
  const [upstreamProbe, setUpstreamProbe] = useState(true);
  const [confirmMixedRisk, setConfirmMixedRisk] = useState(false);
  const [allowedModels, setAllowedModels] = useState('');
  const [modelMappings, setModelMappings] = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const methodOptions = METHODS[platform];
  const selectedPlatform = PLATFORMS.find((item) => item.value === platform)!;
  const isAuth = type === 'oauth' || type === 'setup-token';

  const groupsQuery = useQuery({ queryKey: ['groups', 'all'], queryFn: listAllGroups });
  const proxiesQuery = useQuery({ queryKey: ['proxies', 'account-create'], queryFn: () => listProxies('', 1, 100) });
  const proxies = proxiesQuery.data?.items ?? [];
  const groups = groupsQuery.data ?? [];

  useEffect(() => {
    const nextType = METHODS[platform][0];
    setType(nextType);
    setBaseUrl(DEFAULT_BASE_URLS[platform] || '');
    setApiKey('');
    setOAuthSession(null);
    setAuthorizationInput('');
  }, [platform]);

  useEffect(() => {
    setOAuthSession(null);
    setAuthorizationInput('');
  }, [type]);

  const generateMutation = useMutation({
    mutationFn: () => {
      if (!isAuth) throw new Error('当前接入方式不需要 OAuth 授权。');
      return generateAccountAuthURL(platform, type as AuthMethod, {
        proxy_id: selectedProxyId || undefined,
        project_id: platform === 'gemini' ? vertexProjectId.trim() || undefined : undefined,
      });
    },
    onSuccess: (session) => setOAuthSession(session),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const accountName = name.trim();
      if (!accountName) throw new Error('请输入账号名称。');

      let payloadType: AccountType = type;
      let credentials: Record<string, unknown> = {};
      let extra: Record<string, unknown> | undefined;

      if (isAuth) {
        if (!oauthSession) throw new Error('请先生成授权链接并完成授权。');
        const parsed = parseAuthorizationInput(authorizationInput, oauthSession.state);
        const tokenInfo = await exchangeAccountAuthCode(platform, type as AuthMethod, {
          session_id: oauthSession.session_id,
          code: parsed.code,
          state: parsed.state,
          proxy_id: selectedProxyId || undefined,
        });
        const oauthPayload = buildOAuthPayload(platform, tokenInfo);
        credentials = oauthPayload.credentials;
        extra = oauthPayload.extra;
        if (!Object.keys(credentials).length) throw new Error('授权成功，但服务端没有返回可用凭据。');
      } else if (type === 'apikey') {
        if (!apiKey.trim()) throw new Error('请输入 API Key。');
        credentials = {
          base_url: baseUrl.trim() || DEFAULT_BASE_URLS[platform],
          api_key: apiKey.trim(),
          ...(platform === 'gemini' ? { tier_id: 'ai-studio' } : {}),
        };
      } else if (type === 'upstream') {
        if (!baseUrl.trim()) throw new Error('请输入上游 Base URL。');
        if (!apiKey.trim()) throw new Error('请输入上游 API Key。');
        credentials = { base_url: baseUrl.trim(), api_key: apiKey.trim() };
        // 官方 Antigravity 上游最终以 API Key 类型入库。
        if (platform === 'antigravity') payloadType = 'apikey';
      } else if (type === 'bedrock') {
        if (!bedrockRegion.trim()) throw new Error('请输入 AWS Region。');
        credentials = { auth_mode: bedrockMode, aws_region: bedrockRegion.trim() };
        if (bedrockMode === 'sigv4') {
          if (!bedrockAccessKey.trim() || !bedrockSecretKey.trim()) {
            throw new Error('Access Key ID 和 Secret Access Key 均不能为空。');
          }
          credentials.aws_access_key_id = bedrockAccessKey.trim();
          credentials.aws_secret_access_key = bedrockSecretKey.trim();
          if (bedrockSessionToken.trim()) credentials.aws_session_token = bedrockSessionToken.trim();
        } else {
          if (!apiKey.trim()) throw new Error('请输入 Bedrock API Key。');
          credentials.api_key = apiKey.trim();
        }
        if (bedrockForceGlobal) credentials.aws_force_global = 'true';
      } else if (type === 'service_account') {
        if (!vertexJson.trim()) throw new Error('请粘贴服务账号 JSON。');
        let serviceAccount: Record<string, unknown>;
        try {
          serviceAccount = JSON.parse(vertexJson) as Record<string, unknown>;
        } catch {
          throw new Error('服务账号 JSON 格式无效。');
        }
        const projectId = vertexProjectId.trim() || String(serviceAccount.project_id || '').trim();
        const clientEmail = String(serviceAccount.client_email || '').trim();
        if (!projectId || !clientEmail) throw new Error('服务账号 JSON 缺少 project_id 或 client_email。');
        if (!vertexLocation.trim()) throw new Error('请输入 Vertex Location。');
        credentials = {
          service_account_json: vertexJson.trim(),
          project_id: projectId,
          client_email: clientEmail,
          location: vertexLocation.trim(),
          tier_id: 'vertex',
        };
      } else {
        const neverType: never = type;
        throw new Error(`不支持的账号类型：${neverType}`);
      }

      const modelMapping = parseModelMapping(allowedModels, modelMappings);
      if (modelMapping) credentials.model_mapping = modelMapping;

      const payload: CreateAccountRequest = {
        name: accountName,
        notes: notes.trim() || null,
        platform,
        type: payloadType,
        credentials: compactRecord(credentials),
        extra,
        proxy_id: selectedProxyId,
        concurrency: requiredNumber(concurrency, '并发上限'),
        load_factor: optionalNumber(loadFactor) ?? null,
        priority: requiredNumber(priority, '优先级'),
        rate_multiplier: requiredNumber(rateMultiplier, '倍率'),
        group_ids: selectedGroupIds,
        expires_at: parseExpiry(expiresAt),
        auto_pause_on_expired: autoPauseOnExpired,
        upstream_billing_probe_enabled: platform === 'openai' && type === 'apikey' ? upstreamProbe : undefined,
        confirm_mixed_channel_risk: platform === 'antigravity' ? confirmMixedRisk : undefined,
      };

      return createAccount(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      router.replace('/(tabs)/accounts');
    },
  });

  const submitLabel = useMemo(() => {
    if (createMutation.isPending && isAuth) return '正在交换授权并创建…';
    if (createMutation.isPending) return '正在创建…';
    return isAuth ? '完成授权并创建账号' : '创建账号';
  }, [createMutation.isPending, isAuth]);

  return (
    <>
      <LocalizedStackScreen options={{ title: '添加账号' }} />
      <ScreenShell
        title="添加账号"
        subtitle="按官方 Sub2API 流程选择平台和接入方式"
        safeAreaEdges={['bottom']}
        bottomInsetClassName="pb-10"
      >
        <AdminButton label="完整账号字段与协议配置" tone="muted" onPress={() => router.push({ pathname: '/feature-operation', params: { operation: 'POST /api/v1/admin/accounts' } })} />
        <AdminSection title="1. 选择平台" detail="不同平台只展示其支持的账号接入方式。">
          <View className="gap-2">
            {PLATFORMS.map((item) => {
              const selected = item.value === platform;
              return (
                <Pressable
                  key={item.value}
                  onPress={() => setPlatform(item.value)}
                  className={`rounded-2xl border px-4 py-3 ${selected ? 'border-[#2F6DF6] bg-[#EAF2FF] dark:bg-[#172C55]' : 'border-[#E8EDF5] dark:border-[#273449] bg-[#F6F8FC] dark:bg-[#152033]'}`}
                >
                  <View className="flex-row items-center gap-3">
                    <View className={`h-3 w-3 rounded-full ${selected ? 'bg-[#2F6DF6]' : 'bg-[#C5CEDA] dark:bg-[#566176]'}`} />
                    <View className="flex-1">
                      <Text className={`text-sm font-bold ${selected ? 'text-[#2F6DF6]' : 'text-[#172033] dark:text-[#F4F7FB]'}`}>{item.label}</Text>
                      <Text className="mt-1 text-[11px] leading-4 text-[#7B8798] dark:text-[#9EABC0]">{item.detail}</Text>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </AdminSection>

        <AdminSection title="2. 选择接入方式" detail={`${selectedPlatform.label} 当前支持 ${methodOptions.length} 种接入方式。`}>
          <View className="flex-row flex-wrap gap-2">
            {methodOptions.map((item) => (
              <AdminChip key={item} label={METHOD_LABELS[item]} selected={type === item} onPress={() => setType(item)} />
            ))}
          </View>
        </AdminSection>

        <AdminSection title="3. 基础信息">
          <AdminField label="账号名称" value={name} onChangeText={setName} placeholder={DEFAULT_NAMES[platform]} />
          <AdminField label="备注（可选）" value={notes} onChangeText={setNotes} placeholder="例如：生产环境主账号" />
        </AdminSection>

        <AdminSection
          title="4. 凭据与授权"
          detail={isAuth ? '生成授权链接，在浏览器完成授权后粘贴授权码或完整回调地址。' : '字段会根据所选平台和接入方式自动调整。'}
        >
          {isAuth ? (
            <View className="gap-3">
              {platform === 'gemini' ? (
                <AdminField label="Google Project ID（可选）" value={vertexProjectId} onChangeText={setVertexProjectId} autoCapitalize="none" placeholder="my-google-cloud-project" />
              ) : null}
              <AdminButton
                label={oauthSession ? '重新生成授权链接' : '生成授权链接'}
                pending={generateMutation.isPending}
                onPress={() => generateMutation.mutate()}
              />
              <AdminMessage error={generateMutation.error} />
              {oauthSession ? (
                <View className="gap-3 rounded-2xl border border-[#BDD0FA] bg-[#EEF4FF] dark:border-[#315189] dark:bg-[#172C55] p-3">
                  <Text selectable className="text-xs leading-5 text-[#344054] dark:text-[#D5DDEA]">{oauthSession.auth_url}</Text>
                  <View className="flex-row gap-2">
                    <Pressable onPress={() => Linking.openURL(oauthSession.auth_url)} className="flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-[#2F6DF6] px-3 py-3">
                      <ExternalLink size={15} color="#fff" />
                      <Text className="text-xs font-bold text-white">打开授权页</Text>
                    </Pressable>
                    <Pressable onPress={() => void copyWithFeedback(oauthSession.auth_url, '授权链接')} className="flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-white dark:bg-[#273449] px-3 py-3">
                      <Copy size={15} color="#2F6DF6" />
                      <Text className="text-xs font-bold text-[#2F6DF6]">复制链接</Text>
                    </Pressable>
                  </View>
                  <AdminField
                    label="授权码或完整回调地址"
                    value={authorizationInput}
                    onChangeText={setAuthorizationInput}
                    autoCapitalize="none"
                    autoCorrect={false}
                    multiline
                    placeholder="粘贴 code，或浏览器最终跳转的完整地址"
                  />
                </View>
              ) : null}
            </View>
          ) : null}

          {type === 'apikey' || type === 'upstream' ? (
            <View className="gap-3">
              <AdminField
                label={type === 'upstream' ? '上游 Base URL' : 'Base URL'}
                value={baseUrl}
                onChangeText={setBaseUrl}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder={DEFAULT_BASE_URLS[platform] || 'https://example.com'}
              />
              <AdminField
                label={type === 'upstream' ? '上游 API Key' : 'API Key'}
                value={apiKey}
                onChangeText={setApiKey}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
                placeholder="粘贴密钥"
              />
              {platform === 'openai' && type === 'apikey' ? (
                <ToggleRow label="创建后探测上游计费" detail="与官方 Web 端默认行为一致。" value={upstreamProbe} onChange={setUpstreamProbe} />
              ) : null}
            </View>
          ) : null}

          {type === 'bedrock' ? (
            <View className="gap-3">
              <View className="flex-row flex-wrap gap-2">
                <AdminChip label="AWS SigV4" selected={bedrockMode === 'sigv4'} onPress={() => setBedrockMode('sigv4')} />
                <AdminChip label="Bedrock API Key" selected={bedrockMode === 'apikey'} onPress={() => setBedrockMode('apikey')} />
              </View>
              <AdminField label="AWS Region" value={bedrockRegion} onChangeText={setBedrockRegion} autoCapitalize="none" placeholder="us-east-1" />
              {bedrockMode === 'sigv4' ? (
                <>
                  <AdminField label="Access Key ID" value={bedrockAccessKey} onChangeText={setBedrockAccessKey} autoCapitalize="none" autoCorrect={false} placeholder="AKIA…" />
                  <AdminField label="Secret Access Key" value={bedrockSecretKey} onChangeText={setBedrockSecretKey} autoCapitalize="none" autoCorrect={false} secureTextEntry placeholder="AWS Secret" />
                  <AdminField label="Session Token（可选）" value={bedrockSessionToken} onChangeText={setBedrockSessionToken} autoCapitalize="none" autoCorrect={false} secureTextEntry placeholder="临时凭据才需要" />
                </>
              ) : (
                <AdminField label="Bedrock API Key" value={apiKey} onChangeText={setApiKey} autoCapitalize="none" autoCorrect={false} secureTextEntry placeholder="粘贴 Bedrock API Key" />
              )}
              <ToggleRow label="强制使用全局端点" value={bedrockForceGlobal} onChange={setBedrockForceGlobal} />
            </View>
          ) : null}

          {type === 'service_account' ? (
            <View className="gap-3">
              <AdminField
                label="服务账号 JSON"
                value={vertexJson}
                onChangeText={setVertexJson}
                autoCapitalize="none"
                autoCorrect={false}
                multiline
                textAlignVertical="top"
                style={{ minHeight: 140 }}
                placeholder='粘贴包含 project_id、client_email 和 private_key 的 JSON'
              />
              <AdminField label="Project ID（可覆盖 JSON）" value={vertexProjectId} onChangeText={setVertexProjectId} autoCapitalize="none" placeholder="my-google-cloud-project" />
              <AdminField label="Vertex Location" value={vertexLocation} onChangeText={setVertexLocation} autoCapitalize="none" placeholder="us-central1" />
            </View>
          ) : null}
        </AdminSection>

        <AdminSection title="5. 代理与分组" detail="直接从服务器读取，不再手填数字 ID。">
          <Text className="text-xs font-medium text-[#667085] dark:text-[#9EABC0]">代理</Text>
          <View className="flex-row flex-wrap gap-2">
            <AdminChip label="直连" selected={selectedProxyId === null} onPress={() => setSelectedProxyId(null)} />
            {proxies.map((proxy) => (
              <AdminChip
                key={proxy.id}
                label={`${proxy.name}${proxy.status === 'active' ? '' : '（停用）'}`}
                selected={selectedProxyId === proxy.id}
                onPress={() => setSelectedProxyId(proxy.id)}
              />
            ))}
          </View>
          {proxiesQuery.isLoading ? <Text className="text-xs text-[#98A2B3]">正在加载代理…</Text> : null}
          <AdminMessage error={proxiesQuery.error} />

          <Text className="mt-2 text-xs font-medium text-[#667085] dark:text-[#9EABC0]">分组（可多选）</Text>
          <View className="flex-row flex-wrap gap-2">
            {groups.map((group) => {
              const selected = selectedGroupIds.includes(group.id);
              return (
                <AdminChip
                  key={group.id}
                  label={group.name}
                  selected={selected}
                  onPress={() => setSelectedGroupIds(selected ? selectedGroupIds.filter((id) => id !== group.id) : [...selectedGroupIds, group.id])}
                />
              );
            })}
          </View>
          {groupsQuery.isLoading ? <Text className="text-xs text-[#98A2B3]">正在加载分组…</Text> : null}
          {!groupsQuery.isLoading && groups.length === 0 ? <Text className="text-xs text-[#98A2B3]">服务器暂无可用分组。</Text> : null}
          <AdminMessage error={groupsQuery.error} />
        </AdminSection>

        <AdminSection title="6. 高级设置" detail="默认值与官方新增账号页面保持一致。">
          <Pressable onPress={() => setAdvancedOpen(!advancedOpen)} className="flex-row items-center rounded-2xl bg-[#EEF4FF] dark:bg-[#172C55] px-4 py-3">
            <Text className="flex-1 text-sm font-bold text-[#2F6DF6]">{advancedOpen ? '收起高级设置' : '展开高级设置'}</Text>
            {advancedOpen ? <ChevronUp size={18} color="#2F6DF6" /> : <ChevronDown size={18} color="#2F6DF6" />}
          </Pressable>
          {advancedOpen ? (
            <View className="gap-3">
              <View className="flex-row gap-2">
                <View className="flex-1"><AdminField label="优先级" value={priority} onChangeText={setPriority} keyboardType="number-pad" /></View>
                <View className="flex-1"><AdminField label="并发上限" value={concurrency} onChangeText={setConcurrency} keyboardType="number-pad" /></View>
                <View className="flex-1"><AdminField label="倍率" value={rateMultiplier} onChangeText={setRateMultiplier} keyboardType="decimal-pad" /></View>
              </View>
              <AdminField label="负载因子（可选）" value={loadFactor} onChangeText={setLoadFactor} keyboardType="number-pad" placeholder="留空使用默认值" />
              <AdminField label="到期日期（可选）" value={expiresAt} onChangeText={setExpiresAt} autoCapitalize="none" placeholder="YYYY-MM-DD" />
              <ToggleRow label="到期后自动停用" value={autoPauseOnExpired} onChange={setAutoPauseOnExpired} />
              {platform === 'antigravity' ? (
                <ToggleRow label="确认混合渠道风险" detail="仅在服务器检测到渠道冲突时需要开启。" value={confirmMixedRisk} onChange={setConfirmMixedRisk} />
              ) : null}
              <AdminField label="允许的模型（可选）" value={allowedModels} onChangeText={setAllowedModels} multiline placeholder="多个模型用逗号或换行分隔" />
              <AdminField label="模型映射（可选）" value={modelMappings} onChangeText={setModelMappings} multiline placeholder={'每行一条，例如：\ngpt-4o=gpt-4.1\nclaude-*=claude-sonnet-4'} />
            </View>
          ) : null}
        </AdminSection>

        <AdminMessage error={createMutation.error} />
        <AdminButton
          label={submitLabel}
          pending={createMutation.isPending}
          disabled={!name.trim() || (isAuth && (!oauthSession || !authorizationInput.trim()))}
          onPress={() => createMutation.mutate()}
        />
      </ScreenShell>
    </>
  );
}
