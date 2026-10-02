import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createGroup, deleteGroup, duplicateGroup, getGroup, updateGroup } from '@/src/services/admin';
import type { CreateGroupRequest, GroupPlatform, UpdateGroupRequest } from '@/src/types/admin';
import { Text, TextInput, localizedAlert } from '@/src/components/localized-text';
import { LocalizedStackScreen } from '@/src/components/localized-navigation';

const colors = {
  page: '#F4F7FC',
  card: '#FFFFFF',
  muted: '#F1F5FA',
  border: '#E2E9F3',
  primary: '#2F6DF6',
  text: '#172033',
  subtext: '#667085',
  danger: '#D9475C',
};

const PLATFORMS: GroupPlatform[] = ['anthropic', 'openai', 'gemini', 'antigravity', 'grok', 'kimi', 'zhipu', 'deepseek', 'minimax', 'opencode_go', 'typesafe', 'composite'];
const REASONING_EFFORTS = ['', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const;

function Field({ label, value, onChangeText, placeholder, keyboardType = 'default', multiline = false }: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'decimal-pad' | 'number-pad';
  multiline?: boolean;
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ marginBottom: 6, fontSize: 12, color: colors.subtext }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#98A2B3"
        keyboardType={keyboardType}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={{
          minHeight: multiline ? 88 : undefined,
          backgroundColor: colors.muted,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 12,
          paddingHorizontal: 12,
          paddingVertical: 12,
          color: colors.text,
        }}
      />
    </View>
  );
}

function Toggle({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        borderRadius: 12,
        borderWidth: 1,
        borderColor: active ? colors.primary : colors.border,
        backgroundColor: active ? colors.primary : colors.muted,
        paddingHorizontal: 13,
        paddingVertical: 10,
      }}
    >
      <Text style={{ color: active ? '#fff' : colors.text, fontSize: 12, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

function optionalNumber(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function nullableNumber(value: string) {
  return value.trim() ? optionalNumber(value) : null;
}

function parseReasoningMappings(value: string) {
  const mappings = value
    .split(/[\n,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => entry.split(/\s*(?:=>|=|→)\s*/, 2))
    .filter((entry): entry is [string, string] => entry.length === 2 && Boolean(entry[0]) && Boolean(entry[1]))
    .map(([from, to]) => ({ from, to }));
  return [...new Map(mappings.map((item) => [item.from, item])).values()];
}

export function GroupFormScreen({ groupId }: { groupId?: number }) {
  const editing = Number.isFinite(groupId);
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [platform, setPlatform] = useState<GroupPlatform>('anthropic');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [subscriptionType, setSubscriptionType] = useState<'standard' | 'subscription'>('standard');
  const [exclusive, setExclusive] = useState(false);
  const [rateMultiplier, setRateMultiplier] = useState('1');
  const [rpmLimit, setRpmLimit] = useState('');
  const [dailyLimit, setDailyLimit] = useState('');
  const [weeklyLimit, setWeeklyLimit] = useState('');
  const [monthlyLimit, setMonthlyLimit] = useState('');
  const [maxReasoningEffort, setMaxReasoningEffort] = useState('');
  const [reasoningMappings, setReasoningMappings] = useState('');
  const [error, setError] = useState('');

  const groupQuery = useQuery({
    queryKey: ['group', groupId],
    queryFn: () => getGroup(groupId as number),
    enabled: editing,
  });

  useEffect(() => {
    const group = groupQuery.data;
    if (!group) return;
    setName(group.name ?? '');
    setDescription(group.description ?? '');
    setPlatform((group.platform || 'anthropic') as GroupPlatform);
    setStatus(group.status === 'inactive' ? 'inactive' : 'active');
    setSubscriptionType(group.subscription_type === 'subscription' ? 'subscription' : 'standard');
    setExclusive(Boolean(group.is_exclusive));
    setRateMultiplier(String(group.rate_multiplier ?? 1));
    setRpmLimit(group.rpm_limit == null ? '' : String(group.rpm_limit));
    setDailyLimit(group.daily_limit_usd == null ? '' : String(group.daily_limit_usd));
    setWeeklyLimit(group.weekly_limit_usd == null ? '' : String(group.weekly_limit_usd));
    setMonthlyLimit(group.monthly_limit_usd == null ? '' : String(group.monthly_limit_usd));
    setMaxReasoningEffort(group.max_reasoning_effort ?? '');
    setReasoningMappings((group.reasoning_effort_mappings ?? []).map((item) => `${item.from}=${item.to}`).join(', '));
  }, [groupQuery.data]);

  const supportsReasoningPolicy = platform === 'openai' || platform === 'composite';
  const payload = useMemo<UpdateGroupRequest>(() => ({
    name: name.trim(),
    description: description.trim() || null,
    platform,
    status,
    subscription_type: subscriptionType,
    is_exclusive: exclusive,
    rate_multiplier: optionalNumber(rateMultiplier) ?? 1,
    rpm_limit: optionalNumber(rpmLimit),
    daily_limit_usd: nullableNumber(dailyLimit),
    weekly_limit_usd: nullableNumber(weeklyLimit),
    monthly_limit_usd: nullableNumber(monthlyLimit),
    max_reasoning_effort: supportsReasoningPolicy ? maxReasoningEffort : '',
    reasoning_effort_mappings: supportsReasoningPolicy ? parseReasoningMappings(reasoningMappings) : [],
  }), [dailyLimit, description, exclusive, maxReasoningEffort, monthlyLimit, name, platform, rateMultiplier, reasoningMappings, rpmLimit, status, subscriptionType, supportsReasoningPolicy, weeklyLimit]);

  const saveMutation = useMutation({
    mutationFn: () => {
      if (editing) return updateGroup(groupId as number, payload);
      const { status: _status, ...createPayload } = payload;
      return createGroup(createPayload as CreateGroupRequest);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['groups'] });
      router.replace('/(tabs)/groups');
    },
    onError: (value) => setError(value instanceof Error ? value.message : '保存分组失败'),
  });

  const duplicateMutation = useMutation({
    mutationFn: () => duplicateGroup(groupId as number),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['groups'] });
      router.replace('/(tabs)/groups');
    },
    onError: (value) => setError(value instanceof Error ? value.message : '复制分组失败'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteGroup(groupId as number),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['groups'] });
      router.replace('/(tabs)/groups');
    },
    onError: (value) => setError(value instanceof Error ? value.message : '删除分组失败'),
  });

  const busy = saveMutation.isPending || duplicateMutation.isPending || deleteMutation.isPending;

  return (
    <>
      <LocalizedStackScreen options={{ title: editing ? '编辑分组' : '新增分组', headerShown: true }} />
      <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.page }}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <View style={{ backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16 }}>
            <Field label="分组名称" value={name} onChangeText={setName} placeholder="请输入分组名称" />
            <Field label="说明" value={description} onChangeText={setDescription} placeholder="可选" multiline />

            <Text style={{ marginBottom: 8, fontSize: 12, color: colors.subtext }}>平台</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
              {PLATFORMS.map((item) => <Toggle key={item} label={item} active={platform === item} onPress={() => setPlatform(item)} />)}
            </View>

            <Text style={{ marginBottom: 8, fontSize: 12, color: colors.subtext }}>状态与计费类型</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
              <Toggle label="启用" active={status === 'active'} onPress={() => setStatus('active')} />
              <Toggle label="停用" active={status === 'inactive'} onPress={() => setStatus('inactive')} />
              <Toggle label="按量" active={subscriptionType === 'standard'} onPress={() => setSubscriptionType('standard')} />
              <Toggle label="订阅" active={subscriptionType === 'subscription'} onPress={() => setSubscriptionType('subscription')} />
              <Toggle label="独占分组" active={exclusive} onPress={() => setExclusive((value) => !value)} />
            </View>

            <Field label="倍率" value={rateMultiplier} onChangeText={setRateMultiplier} keyboardType="decimal-pad" />
            <Field label="RPM 上限（留空为默认）" value={rpmLimit} onChangeText={setRpmLimit} keyboardType="number-pad" />
            <Field label="每日限额 USD（留空为不限）" value={dailyLimit} onChangeText={setDailyLimit} keyboardType="decimal-pad" />
            <Field label="每周限额 USD（留空为不限）" value={weeklyLimit} onChangeText={setWeeklyLimit} keyboardType="decimal-pad" />
            <Field label="每月限额 USD（留空为不限）" value={monthlyLimit} onChangeText={setMonthlyLimit} keyboardType="decimal-pad" />

            {supportsReasoningPolicy ? (
              <View style={{ marginTop: 4, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: '#F8FAFD', padding: 12 }}>
                <Text style={{ marginBottom: 4, fontSize: 14, fontWeight: '700', color: colors.text }}>推理强度策略</Text>
                <Text style={{ marginBottom: 10, fontSize: 11, lineHeight: 17, color: colors.subtext }}>同时适用于 OpenAI 与 Composite 分组；上限为空表示不限制，映射只处理客户端明确传入的 effort。</Text>
                <Text style={{ marginBottom: 7, fontSize: 12, color: colors.subtext }}>推理强度上限</Text>
                <View style={{ marginBottom: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
                  {REASONING_EFFORTS.map((effort) => <Toggle key={effort || 'unlimited'} label={effort || '不限制'} active={maxReasoningEffort === effort} onPress={() => setMaxReasoningEffort(effort)} />)}
                </View>
                <Field label="精确映射（逗号或换行分隔）" value={reasoningMappings} onChangeText={setReasoningMappings} placeholder="例如 max=xhigh, xhigh=high" multiline />
              </View>
            ) : null}
          </View>

          {groupQuery.error || error ? (
            <View style={{ marginTop: 12, borderRadius: 12, backgroundColor: '#FFF0F2', padding: 12 }}>
              <Text style={{ color: colors.danger }}>{error || (groupQuery.error as Error)?.message}</Text>
            </View>
          ) : null}

          <Pressable
            disabled={!name.trim() || busy}
            onPress={() => { setError(''); saveMutation.mutate(); }}
            style={{ marginTop: 14, borderRadius: 12, backgroundColor: !name.trim() || busy ? '#7C8AA0' : colors.primary, paddingVertical: 14, alignItems: 'center' }}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>{saveMutation.isPending ? '保存中…' : '保存分组'}</Text>
          </Pressable>

          {editing ? (
            <View style={{ marginTop: 10, flexDirection: 'row', gap: 10 }}>
              <Pressable disabled={busy} onPress={() => duplicateMutation.mutate()} style={{ flex: 1, borderRadius: 12, backgroundColor: colors.muted, paddingVertical: 13, alignItems: 'center' }}>
                <Text style={{ color: colors.text, fontWeight: '700' }}>复制分组</Text>
              </Pressable>
              <Pressable
                disabled={busy}
                onPress={() => localizedAlert('删除分组', `确定删除“${name}”吗？`, [
                  { text: '取消', style: 'cancel' },
                  { text: '删除', style: 'destructive', onPress: () => deleteMutation.mutate() },
                ])}
                style={{ flex: 1, borderRadius: 12, backgroundColor: '#FFF0F2', paddingVertical: 13, alignItems: 'center' }}
              >
                <Text style={{ color: colors.danger, fontWeight: '700' }}>删除分组</Text>
              </Pressable>
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </>
  );
}
