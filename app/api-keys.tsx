import * as Clipboard from 'expo-clipboard';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Stack, router } from 'expo-router';
import { Check, Copy, Eye, EyeOff, KeyRound, Pencil, Plus, Shield, Trash2, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, ToastAndroid, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenShell } from '@/src/components/screen-shell';
import { getFirstCreatedAdmin } from '@/src/lib/admin-user';
import { createMyApiKey, deleteMyApiKey, listAvailableGroups, listMyApiKeys, listUserApiKeys, listUsers, updateMyApiKey } from '@/src/services/admin';
import { adminConfigState } from '@/src/store/admin-config';
import { useOpenAIBaseUrl } from '@/src/hooks/use-openai-base-url';
import type { AdminApiKey, ApiKeyWriteRequest } from '@/src/types/admin';
import { Text, TextInput, localizedAlert } from '@/src/components/localized-text';
import { LocalizedStackScreen } from '@/src/components/localized-navigation';
const { useSnapshot } = require('valtio/react');

const blue = '#2F6DF6';
const emptyForm: ApiKeyWriteRequest = { name: '', quota: 0, ip_whitelist: [], ip_blacklist: [], rate_limit_5h: 0, rate_limit_1d: 0, rate_limit_7d: 0 };

export default function ApiKeysScreen() {
  const config = useSnapshot(adminConfigState);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<AdminApiKey | null | undefined>();
  const [visible, setVisible] = useState<Record<number, boolean>>({});
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string }>();
  const [createdKey, setCreatedKey] = useState<AdminApiKey>();
  const canSelfManage = config.authMode === 'password' || Boolean(config.accessToken.trim() && config.user);
  const defaultAdminQuery = useQuery({ queryKey: ['default-admin-user', config.activeAccountId], queryFn: () => listUsers('', 1, 100), enabled: config.authMode === 'admin_key' });
  const defaultAdmin = useMemo(() => getFirstCreatedAdmin(defaultAdminQuery.data?.items ?? []), [defaultAdminQuery.data?.items]);
  const canListKeys = canSelfManage || Boolean(defaultAdmin);
  const showFeedback = (tone: 'success' | 'error', text: string, title = tone === 'success' ? '操作成功' : '操作失败') => {
    setFeedback({ tone, text });
    if (Platform.OS === 'android') ToastAndroid.show(text, ToastAndroid.SHORT);
    else localizedAlert(title, text);
  };
  const query = useQuery({
    queryKey: ['my-api-keys', config.activeAccountId, config.user?.id ?? defaultAdmin?.id, search],
    queryFn: () => canSelfManage ? listMyApiKeys(search) : listUserApiKeys(defaultAdmin!.id),
    enabled: canListKeys,
  });
  const keyItems = useMemo(() => {
    const items = query.data?.items ?? [];
    if (canSelfManage || !search.trim()) return items;
    const keyword = search.trim().toLowerCase();
    return items.filter((item) => `${item.name} ${item.key}`.toLowerCase().includes(keyword));
  }, [canSelfManage, query.data?.items, search]);
  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Partial<ApiKeyWriteRequest> }) => updateMyApiKey(id, body),
    onSuccess: async (_saved, variables) => { const action = variables.body.status === 'active' ? '启用' : '停用'; showFeedback('success', `API 密钥已${action}`); await query.refetch(); },
    onError: (error, variables) => { const action = variables.body.status === 'active' ? '启用' : '停用'; const text = error instanceof Error ? error.message : `${action}失败`; showFeedback('error', text, `${action}失败`); },
  });
  const copy = async (value: string, label: string) => { try { await Clipboard.setStringAsync(value); showFeedback('success', `${label}已复制到剪贴板`, '复制成功'); } catch { showFeedback('error', '复制失败，请重试或长按文本手动复制', '复制失败'); } };
  const baseUrlQuery = useOpenAIBaseUrl(config.baseUrl);
  const openAIBaseUrl = baseUrlQuery.baseUrl;

  return <>
    <LocalizedStackScreen options={{ title: 'API 密钥', headerShown: true }} />
    <ScreenShell title="API 密钥" subtitle="查看 OpenAI 端点与当前账号的访问密钥" bottomInsetClassName="pb-10" safeAreaEdges={['bottom']} refreshing={baseUrlQuery.isFetching || (canListKeys && query.isRefetching)} onRefresh={() => Promise.all([baseUrlQuery.refetch(), ...(canListKeys ? [query.refetch()] : [])]).then(() => undefined)}>
      {feedback ? <Pressable onPress={() => setFeedback(undefined)} className={`rounded-2xl px-4 py-3 ${feedback.tone === 'success' ? 'bg-[#EAF9F0] dark:bg-[#123326]' : 'bg-[#FFF0F3] dark:bg-[#3A1720]'}`}><Text className={`text-xs font-semibold ${feedback.tone === 'success' ? 'text-[#23885A]' : 'text-[#D9475C]'}`}>{feedback.text}</Text></Pressable> : null}
      <View className="rounded-[22px] border border-[#DDE6F2] dark:border-[#273449] bg-white dark:bg-[#111827] p-4">
        <Text className="text-[11px] text-[#7B8798] dark:text-[#9EABC0]">OpenAI Base URL</Text>
        <Pressable disabled={!openAIBaseUrl} onPress={() => copy(openAIBaseUrl, 'OpenAI Base URL')} className="mt-2 flex-row items-center gap-3 rounded-2xl bg-[#F4F7FC] dark:bg-[#0B1220] px-3 py-3"><Text selectable numberOfLines={2} className="flex-1 text-xs font-semibold text-[#2F6DF6]">{openAIBaseUrl || (baseUrlQuery.isLoading ? '正在读取站点配置…' : '暂未获取 API 地址')}</Text><Copy size={17} color={blue} /></Pressable>
        {baseUrlQuery.isError ? <Pressable onPress={() => { void baseUrlQuery.refetch(); }} className="mt-2"><Text className="text-xs text-[#D9475C]">读取站点配置失败，点击重试</Text></Pressable> : null}
      </View>
      <View className="rounded-[22px] border border-[#DDE6F2] dark:border-[#273449] bg-white dark:bg-[#111827] p-4">
        <Text className="text-[11px] text-[#7B8798] dark:text-[#9EABC0]">当前用户创建的密钥</Text>
        <View className="mt-1 flex-row items-center">
          <Text numberOfLines={1} className="flex-1 text-sm font-bold text-[#172033] dark:text-[#F4F7FB]">{config.user?.email || config.user?.username || defaultAdmin?.email || (defaultAdminQuery.isLoading ? '正在查找首个管理员…' : '未找到管理员账号')}</Text>
          <Text className="rounded-full bg-[#EAF2FF] dark:bg-[#172C55] px-2.5 py-1 text-[10px] font-bold text-[#2F6DF6]">{canListKeys ? `${query.data?.total ?? keyItems.length} 个` : '--'}</Text>
        </View>
        {canListKeys ? <View className="mt-3 flex-row gap-2"><TextInput value={search} onChangeText={setSearch} placeholder="搜索名称或密钥" placeholderTextColor="#98A2B3" className="flex-1 rounded-2xl bg-[#F4F7FC] dark:bg-[#0B1220] px-4 py-3 text-sm text-[#172033] dark:text-[#F4F7FB]" />{canSelfManage ? <Pressable accessibilityLabel="新建 API 密钥" onPress={() => setEditing(null)} className="h-12 w-12 items-center justify-center rounded-2xl bg-[#2F6DF6]"><Plus size={21} color="#fff" /></Pressable> : null}</View> : <Text className="mt-2 text-[11px] leading-5 text-[#667085] dark:text-[#9EABC0]">没有找到可作为默认账号的管理员。</Text>}
      </View>
      {canListKeys ? <>
        {query.isLoading ? <Text className="rounded-2xl bg-white dark:bg-[#111827] px-4 py-5 text-center text-xs text-[#667085] dark:text-[#9EABC0]">正在加载密钥…</Text> : !keyItems.length ? <View className="items-center rounded-[22px] border border-[#DDE6F2] dark:border-[#273449] bg-white dark:bg-[#111827] px-4 py-6"><KeyRound size={24} color="#98A2B3" /><Text className="mt-3 text-sm font-bold text-[#172033] dark:text-[#F4F7FB]">{search.trim() ? '没有匹配的密钥' : '当前账号还没有 API 密钥'}</Text><Text className="mt-1 text-center text-[11px] leading-5 text-[#667085] dark:text-[#9EABC0]">{search.trim() ? '请调整搜索关键词。' : canSelfManage ? '点击上方蓝色加号创建第一个密钥。' : '当前为 Admin Key 只读模式。'}</Text></View> : null}
        {keyItems.map((item) => { const windows = [{label:'5h',used:item.usage_5h ?? 0,limit:item.rate_limit_5h ?? 0},{label:'1d',used:item.usage_1d ?? 0,limit:item.rate_limit_1d ?? 0},{label:'7d',used:item.usage_7d ?? 0,limit:item.rate_limit_7d ?? 0}]; const peak = Math.max(0, ...windows.map((w) => w.limit > 0 ? (w.used / w.limit) * 100 : 0)); return <View key={item.id} className="rounded-[22px] border border-[#DDE6F2] dark:border-[#273449] bg-white dark:bg-[#111827] p-4">
          <View className="flex-row items-start gap-3"><View className="h-10 w-10 items-center justify-center rounded-2xl bg-[#EAF2FF] dark:bg-[#172C55]"><KeyRound size={19} color={blue} /></View><View className="flex-1"><View className="flex-row items-center gap-2"><Text className="flex-1 text-sm font-bold text-[#172033] dark:text-[#F4F7FB]">{item.name}</Text><Text className={`rounded-full px-2 py-1 text-[10px] font-bold ${item.status === 'active' ? 'bg-[#EAF9F0] dark:bg-[#123326] text-[#23885A]' : 'bg-[#F1F3F6] text-[#697386]'}`}>{item.status}</Text></View><Text selectable numberOfLines={visible[item.id] ? undefined : 1} className="mt-2 text-xs text-[#5E6D82] dark:text-[#AAB6C8]">{visible[item.id] ? item.key : `${item.key.slice(0, 8)}••••••••${item.key.slice(-4)}`}</Text></View><Pressable onPress={() => setVisible((v) => ({ ...v, [item.id]: !v[item.id] }))}>{visible[item.id] ? <EyeOff size={18} color="#7B8798" /> : <Eye size={18} color="#7B8798" />}</Pressable></View>
          <View className="mt-3 h-2 overflow-hidden rounded-full bg-[#EAF0F7]"><View style={{ width: `${Math.min(100, peak)}%` }} className="h-full rounded-full bg-[#2F6DF6]" /></View><View className="mt-2 flex-row gap-2">{windows.map((window) => <Text key={window.label} className="rounded-full bg-[#F1F5FA] dark:bg-[#182235] px-2 py-1 text-[9px] text-[#68768A] dark:text-[#9EABC0]">{window.label} {window.limit > 0 ? `${Math.min(999, (window.used / window.limit) * 100).toFixed(1)}%` : '不限'}</Text>)}</View>
          <View className="mt-3 flex-row gap-2"><SmallButton label="复制" icon={Copy} onPress={() => copy(item.key, 'API 密钥')} />{canSelfManage ? <><SmallButton label="编辑" icon={Pencil} onPress={() => setEditing(item)} /><SmallButton disabled={updateMutation.isPending} label={updateMutation.isPending && updateMutation.variables?.id === item.id ? '处理中' : item.status === 'active' ? '停用' : '启用'} icon={item.status === 'active' ? X : Check} onPress={() => updateMutation.mutate({ id: item.id, body: { status: item.status === 'active' ? 'inactive' : 'active' } })} /><SmallButton label="删除" icon={Trash2} danger onPress={() => localizedAlert('删除密钥', `确认删除“${item.name}”？`, [{ text: '取消', style: 'cancel' }, { text: '删除', style: 'destructive', onPress: async () => { try { await deleteMyApiKey(item.id); showFeedback('success', `“${item.name}”已删除`, '删除成功'); await query.refetch(); } catch (error) { const text = error instanceof Error ? error.message : '删除失败'; showFeedback('error', text, '删除失败'); } } }])} /></> : defaultAdmin ? <><SmallButton label="编辑分组" icon={Pencil} onPress={() => router.push(`/users/api-key?userId=${defaultAdmin.id}&id=${item.id}`)} /><SmallButton label="删除需登录" icon={Trash2} danger onPress={() => localizedAlert('需要邮箱登录', '当前服务端没有管理员删除用户 API Key 的接口。请使用该用户的邮箱和密码登录后再删除。')} /></> : null}</View>
          {(item.ip_whitelist?.length || item.ip_blacklist?.length) ? <Text className="mt-3 text-[10px] leading-4 text-[#7B8798] dark:text-[#9EABC0]">白名单：{item.ip_whitelist?.join(', ') || '无'}{`\n`}黑名单：{item.ip_blacklist?.join(', ') || '无'}</Text> : null}
        </View>; })}
        {query.isError ? <Text className="text-xs text-[#D9475C]">{(query.error as Error).message}</Text> : null}
      </> : null}
      {!canSelfManage ? <View className="rounded-[22px] border border-[#DDE6F2] dark:border-[#273449] bg-white dark:bg-[#111827] p-4"><Shield size={22} color={blue} /><Text className="mt-3 text-sm font-bold text-[#172033] dark:text-[#F4F7FB]">Admin Key 模式</Text><Text className="mt-1 text-xs leading-5 text-[#667085] dark:text-[#9EABC0]">上方展示创建时间最早的管理员账号及其 Key，并支持修改所属分组。当前服务端没有管理员删除用户 API Key 的接口；完整编辑、启停、新建和删除需改用邮箱密码登录。</Text><Pressable onPress={() => router.push('/users')} className="mt-4 items-center rounded-2xl bg-[#EAF2FF] dark:bg-[#172C55] py-3"><Text className="font-bold text-[#2F6DF6]">打开用户管理</Text></Pressable></View> : null}
    </ScreenShell>
    {editing !== undefined ? <KeyEditor item={editing} onClose={() => setEditing(undefined)} onSaved={(saved) => { const text = editing ? 'API 密钥已保存' : 'API 密钥已创建，可立即复制使用'; setEditing(undefined); if (!editing) setCreatedKey(saved); showFeedback('success', text, editing ? '保存成功' : '创建成功'); query.refetch(); }} /> : null}
    {createdKey ? <Modal visible transparent animationType="fade" onRequestClose={() => setCreatedKey(undefined)}><View className="flex-1 items-center justify-center bg-black/30 px-5"><View className="w-full rounded-[24px] bg-white dark:bg-[#111827] p-5"><Text className="text-base font-bold text-[#172033] dark:text-[#F4F7FB]">密钥创建成功</Text><Text className="mt-2 text-[11px] leading-5 text-[#667085] dark:text-[#9EABC0]">请立即复制保存。服务器可能只在创建时返回完整密钥。</Text><Text selectable className="mt-4 rounded-2xl bg-[#F4F7FC] dark:bg-[#0B1220] p-4 text-xs leading-5 text-[#172033] dark:text-[#F4F7FB]">{createdKey.key}</Text><View className="mt-4 flex-row gap-2"><View className="flex-1"><SmallButton label="复制密钥" icon={Copy} onPress={() => copy(createdKey.key, '新密钥')} /></View><Pressable onPress={() => setCreatedKey(undefined)} className="flex-1 items-center justify-center rounded-xl bg-[#2F6DF6] py-3"><Text className="text-xs font-bold text-white">完成</Text></Pressable></View></View></View></Modal> : null}
  </>;
}

function SmallButton({ label, icon: Icon, onPress, danger, disabled }: { label: string; icon: typeof Copy; onPress: () => void; danger?: boolean; disabled?: boolean }) { return <Pressable disabled={disabled} onPress={onPress} className={`flex-1 flex-row items-center justify-center gap-1 rounded-xl py-2 ${danger ? 'bg-[#FFF0F3] dark:bg-[#3A1720]' : 'bg-[#EEF4FF] dark:bg-[#172C55]'} ${disabled ? 'opacity-50' : ''}`}><Icon size={14} color={danger ? '#D9475C' : blue} /><Text className={`text-[10px] font-bold ${danger ? 'text-[#D9475C]' : 'text-[#2F6DF6]'}`}>{label}</Text></Pressable>; }

function KeyEditor({ item, onClose, onSaved }: { item: AdminApiKey | null; onClose: () => void; onSaved: (saved: AdminApiKey) => void }) {
  const insets = useSafeAreaInsets();
  const config = useSnapshot(adminConfigState);
  const groups = useQuery({ queryKey: ['available-key-groups', config.activeAccountId], queryFn: listAvailableGroups });
  const [form, setForm] = useState<ApiKeyWriteRequest>(item ? { name: item.name, group_id: item.group_id, quota: item.quota, ip_whitelist: item.ip_whitelist ?? [], ip_blacklist: item.ip_blacklist ?? [], rate_limit_5h: item.rate_limit_5h ?? 0, rate_limit_1d: item.rate_limit_1d ?? 0, rate_limit_7d: item.rate_limit_7d ?? 0 } : emptyForm);
  const [customKey, setCustomKey] = useState(''); const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  const setNumber = (key: keyof ApiKeyWriteRequest, value: string) => setForm((v) => ({ ...v, [key]: Number(value) || 0 }));
  const submit = async () => { if (!form.name.trim()) return setError('请输入密钥名称'); if (!form.group_id) return setError('请选择所属分组'); setSaving(true); setError(''); try { const body = { ...form, name: form.name.trim(), ...(customKey.trim() ? { custom_key: customKey.trim() } : {}) }; const saved = item ? await updateMyApiKey(item.id, body) : await createMyApiKey(body); onSaved(saved); } catch (reason) { setError(reason instanceof Error ? reason.message : '保存失败'); } finally { setSaving(false); } };
  return <Modal visible transparent statusBarTranslucent animationType="fade" onRequestClose={onClose}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}><View style={{ flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,.3)', paddingHorizontal: 16, paddingTop: Math.max(16, insets.top + 8), paddingBottom: Math.max(16, insets.bottom + 8) }}><View style={{ maxHeight: '100%', borderRadius: 28, overflow: 'hidden' }} className="bg-[#F4F7FC] dark:bg-[#0B1220]"><View className="flex-row items-center px-5 pb-3 pt-5"><Text className="flex-1 text-lg font-bold text-[#172033] dark:text-[#F4F7FB]">{item ? '编辑 API 密钥' : '新建 API 密钥'}</Text><Pressable accessibilityLabel="关闭密钥编辑器" hitSlop={10} onPress={onClose}><X size={22} color="#667085" /></Pressable></View><ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}>
    <TextInput value={form.name} onChangeText={(name) => setForm((v) => ({ ...v, name }))} placeholder="密钥名称" placeholderTextColor="#98A2B3" className="mb-3 rounded-2xl bg-white dark:bg-[#111827] px-4 py-3 text-sm text-[#172033] dark:text-[#F4F7FB]" />
    <Text className="mb-2 text-xs text-[#667085]">所属分组（必选）</Text><View className="mb-3 flex-row flex-wrap gap-2">{groups.data?.map(group => <Pressable key={group.id} onPress={() => setForm(current => ({ ...current, group_id: group.id }))} className={`rounded-xl p-3 ${form.group_id === group.id ? 'bg-[#2F6DF6]' : 'bg-white dark:bg-[#111827]'}`}><Text className={form.group_id === group.id ? 'text-white' : 'text-[#667085]'}>{group.name} · {group.platform}</Text></Pressable>)}</View>
    {groups.isError ? <Pressable onPress={() => void groups.refetch()}><Text className="mb-3 text-xs text-[#D9475C]">分组读取失败，点击重试</Text></Pressable> : null}
    {!item ? <TextInput value={customKey} onChangeText={setCustomKey} placeholder="自定义 Key（可选）" placeholderTextColor="#98A2B3" autoCapitalize="none" className="mb-3 rounded-2xl bg-white dark:bg-[#111827] px-4 py-3 text-sm text-[#172033] dark:text-[#F4F7FB]" /> : null}
    <TextInput value={String(form.quota || '')} onChangeText={(v) => setNumber('quota', v)} placeholder="额度 USD，0 为不限" keyboardType="decimal-pad" placeholderTextColor="#98A2B3" className="mb-3 rounded-2xl bg-white dark:bg-[#111827] px-4 py-3 text-sm text-[#172033] dark:text-[#F4F7FB]" />
    <TextInput value={form.ip_whitelist?.join(', ')} onChangeText={(v) => setForm((x) => ({ ...x, ip_whitelist: v.split(',').map((s) => s.trim()).filter(Boolean) }))} placeholder="IP 白名单，逗号分隔" placeholderTextColor="#98A2B3" className="mb-3 rounded-2xl bg-white dark:bg-[#111827] px-4 py-3 text-sm text-[#172033] dark:text-[#F4F7FB]" />
    <TextInput value={form.ip_blacklist?.join(', ')} onChangeText={(v) => setForm((x) => ({ ...x, ip_blacklist: v.split(',').map((s) => s.trim()).filter(Boolean) }))} placeholder="IP 黑名单，逗号分隔" placeholderTextColor="#98A2B3" className="mb-3 rounded-2xl bg-white dark:bg-[#111827] px-4 py-3 text-sm text-[#172033] dark:text-[#F4F7FB]" />
    <Text className="mb-2 text-xs font-bold text-[#667085] dark:text-[#9EABC0]">窗口限制（0 为不限）</Text><View className="mb-3 flex-row gap-2">{(['rate_limit_5h', 'rate_limit_1d', 'rate_limit_7d'] as const).map((key) => <TextInput key={key} value={String(form[key] || '')} onChangeText={(v) => setNumber(key, v)} placeholder={key.replace('rate_limit_', '')} keyboardType="number-pad" placeholderTextColor="#98A2B3" className="flex-1 rounded-2xl bg-white dark:bg-[#111827] px-3 py-3 text-center text-xs text-[#172033] dark:text-[#F4F7FB]" />)}</View>
    {error ? <Text className="mb-3 text-xs text-[#D9475C]">{error}</Text> : null}<Pressable disabled={saving} onPress={submit} className={`items-center rounded-2xl bg-[#2F6DF6] py-4 ${saving ? 'opacity-60' : ''}`}><Text className="font-bold text-white">{saving ? '保存中…' : '保存'}</Text></Pressable>
  </ScrollView></View></View></KeyboardAvoidingView></Modal>;
}
