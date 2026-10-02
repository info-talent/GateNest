import * as DocumentPicker from 'expo-document-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { AdminButton, AdminChip, AdminField, AdminMessage, AdminSection } from '@/src/components/admin-ui';
import { ScreenShell } from '@/src/components/screen-shell';
import { Text, localizedAlert } from '@/src/components/localized-text';
import { LocalizedStackScreen } from '@/src/components/localized-navigation';
import { adminConfigState } from '@/src/store/admin-config';
import { createAdminWebSocket } from '@/src/lib/admin-fetch';
import { copyWithFeedback } from '@/src/lib/clipboard';
import { canUseFeature, featureBody, featureFieldLabel, featureOperations, featurePath, featureTitle, runFeature, uploadFeature } from '@/src/services/sub2api-features';
const { useSnapshot } = require('valtio/react');

export default function FeatureOperationScreen() {
  const params = useLocalSearchParams<{ operation: string; record?: string }>();
  const config = useSnapshot(adminConfigState);
  const key = `${config.activeAccountId}:${config.baseUrl}:${params.operation}:${params.record || ''}`;
  return <Operation key={key} id={params.operation} record={params.record} />;
}

function Operation({ id, record }: { id: string; record?: string }) {
  const operation = featureOperations.find(op => op.id === id);
  const [path, setPath] = useState<Record<string, string>>(() => { try { const row = JSON.parse(record || '{}'); return Object.fromEntries((operation?.pathParams || []).flatMap(name => row[name] !== undefined ? [[name, String(row[name])]] : row.id !== undefined && (name === 'id' || name.endsWith('_id')) ? [[name, String(row.id)]] : [])); } catch { return {}; } });
  const [query, setQuery] = useState<Record<string, string>>({});
  const [extraQuery, setExtraQuery] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [raw, setRaw] = useState('');
  const [filter, setFilter] = useState('');
  const [result, setResult] = useState<unknown>();
  const [error, setError] = useState<unknown>();
  const [pending, setPending] = useState(false);
  const [socketStatus, setSocketStatus] = useState('');
  const controller = useRef<AbortController | null>(null);
  const socket = useRef<WebSocket | null>(null);
  useEffect(() => () => { controller.current?.abort(); socket.current?.close(); }, []);
  if (!operation || !canUseFeature(operation)) return <ScreenShell title="无法打开操作" subtitle="请检查登录身份"><Text>此操作不存在或当前账号无权访问。</Text></ScreenShell>;
  const op = operation;
  const setValue = (name: string, value: string) => setValues(current => ({ ...current, [name]: value }));
  const execute = async () => {
    if (pending) return;
    setError(undefined); setPending(true); setResult(undefined);
    controller.current?.abort(); controller.current = new AbortController();
    const signal = controller.current.signal;
    try {
      const url = featurePath(op, path, query, extraQuery);
      if (op.transport === 'websocket') {
        socket.current?.close(); setSocketStatus('连接中');
        const connection = createAdminWebSocket(url); socket.current = connection;
        connection.onopen = () => setSocketStatus('已连接');
        connection.onmessage = event => setResult((current: unknown) => [...(Array.isArray(current) ? current.slice(-99) : []), String(event.data)]);
        connection.onerror = () => setSocketStatus('连接失败');
        connection.onclose = () => setSocketStatus('已断开');
        return;
      }
      let data: unknown;
      if (op.fileField) {
        const pick = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
        if (pick.canceled || signal.aborted) return;
        data = await uploadFeature(op, url, pick.assets[0], signal);
      } else {
        const body = op.method === 'GET' ? undefined : raw.trim() ? JSON.parse(raw) : op.bodySchema === 'fields' ? featureBody(op, values) : undefined;
        if (op.bodySchema === 'json' && body === undefined) throw new Error('请填写配置内容');
        data = await runFeature(op, url, body, signal);
      }
      if (!signal.aborted) setResult(data ?? { message: '操作成功' });
    } catch (reason) { if (!signal.aborted) setError(reason); }
    finally { if (!signal.aborted) setPending(false); }
  };
  const submit = () => {
    if (op.method === 'GET') return void execute();
    let url: string;
    try { url = featurePath(op, path, query, extraQuery); } catch (reason) { setError(reason); return; }
    localizedAlert('确认提交', `${featureTitle(op)}\n${url}\n此操作会修改当前站点的数据。`, [{ text: '取消', style: 'cancel' }, { text: '确认', style: op.method === 'DELETE' ? 'destructive' : 'default', onPress: () => void execute() }]);
  };
  const loadCurrent = async () => {
    const read = featureOperations.find(item => item.path === op.path && item.method === 'GET');
    if (!read) return;
    setPending(true); setError(undefined);
    controller.current?.abort(); const task = new AbortController(); controller.current = task;
    try {
      const data = await runFeature(read, featurePath(read, path, {}), undefined, task.signal);
      if (task.signal.aborted || !data || typeof data !== 'object' || Array.isArray(data)) return;
      const source = data as Record<string, unknown>;
      setValues(Object.fromEntries(op.bodyFields.filter(field => source[field.name] !== undefined && !/password|secret|token/i.test(field.name)).map(field => [field.name, field.type === 'json' ? JSON.stringify(source[field.name]) : String(source[field.name])])));
      setResult(data);
    } catch (reason) { if (!task.signal.aborted) setError(reason); }
    finally { if (!task.signal.aborted) setPending(false); }
  };
  return <>
    <LocalizedStackScreen options={{ title: featureTitle(op), headerShown: true }} />
    <ScreenShell title={featureTitle(op)} subtitle={op.path} safeAreaEdges={['bottom']}>
      {op.pathParams.length ? <AdminSection title="选择记录">{op.pathParams.map(name => <AdminField key={name} label={featureFieldLabel(name)} value={path[name] || ''} onChangeText={value => setPath(current => ({ ...current, [name]: value }))} />)}</AdminSection> : null}
      {op.query.length ? <AdminSection title="筛选与分页">{op.query.map(name => <AdminField key={name} label={featureFieldLabel(name)} value={query[name] || ''} onChangeText={value => setQuery(current => ({ ...current, [name]: value }))} />)}</AdminSection> : null}
      <AdminField label="其他筛选条件（可选）" value={extraQuery} onChangeText={setExtraQuery} placeholder="page=1&page_size=20" autoCapitalize="none" autoCorrect={false} />
      {op.bodyFields.length ? <AdminSection title="配置字段" detail="未填写的字段不会发送。布尔项可以选择不修改；复杂列表和对象使用 JSON。">
        {featureOperations.some(item => item.path === op.path && item.method === 'GET') ? <AdminButton label="读取当前配置" tone="muted" disabled={pending} onPress={() => void loadCurrent()} /> : null}
        {op.bodyFields.length > 12 ? <AdminField label="查找字段" value={filter} onChangeText={setFilter} /> : null}
        {op.bodyFields.filter(field => field.name.toLowerCase().includes(filter.toLowerCase())).map(field => <View key={field.name} className="gap-2">
          {field.type === 'boolean' ? <><Text className="text-xs text-[#667085]">{featureFieldLabel(field.name)}{field.required ? ' *' : ''}</Text><View className="flex-row gap-2">{[['', '不修改'], ['true', '开启'], ['false', '关闭']].map(([value, label]) => <AdminChip key={value} label={label} selected={(values[field.name] || '') === value} onPress={() => setValue(field.name, value)} />)}</View></> : <AdminField label={`${featureFieldLabel(field.name)}${field.required ? ' *' : ''}`} value={values[field.name] || ''} onChangeText={value => setValue(field.name, value)} keyboardType={field.type === 'number' ? 'numbers-and-punctuation' : 'default'} multiline={field.type === 'json'} secureTextEntry={field.type === 'string' && /password|secret|token/i.test(field.name)} autoCapitalize="none" autoCorrect={false} placeholder={field.nullable ? `${field.goType}（null 表示清空）` : field.goType} />}
        </View>)}
      </AdminSection> : null}
      {op.bodySchema === 'json' ? <AdminSection title="配置内容"><AdminField label="JSON" value={raw} onChangeText={setRaw} multiline autoCapitalize="none" autoCorrect={false} /></AdminSection> : null}
      <AdminButton label={op.fileField ? '选择文件并上传' : op.method === 'GET' ? '加载' : '提交修改'} pending={pending} onPress={submit} tone={op.method === 'DELETE' ? 'danger' : 'primary'} />
      {socketStatus ? <><Text>{socketStatus}</Text><AdminButton label="断开" tone="muted" onPress={() => socket.current?.close()} /></> : null}
      <AdminMessage error={error} />
      {error && adminConfigState.authMode === 'password' ? <AdminButton label="敏感操作二次验证" tone="muted" onPress={() => router.push({ pathname: '/feature-operation', params: { operation: 'POST /api/v1/user/totp/step-up' } })} /> : null}
      {result !== undefined ? <AdminSection title="结果"><AdminButton label="复制结果" tone="muted" onPress={() => void copyWithFeedback(typeof result === 'string' ? result : JSON.stringify(result, null, 2), '结果')} /><ResultValue value={result} module={op.module} audience={op.audience} /></AdminSection> : null}
    </ScreenShell>
  </>;
}

function ResultValue({ value, module, audience, depth = 0 }: { value: unknown; module: string; audience: string; depth?: number }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const [limit, setLimit] = useState(40);
  if (value === null || typeof value !== 'object') return <Text selectable className="text-xs leading-5 text-[#344054] dark:text-[#D5DDEA]">{String(value ?? '')}</Text>;
  const entries = Array.isArray(value) ? value.map((item, index) => [String(index + 1), item] as const) : Object.entries(value);
  const row = !Array.isArray(value) ? value as Record<string, unknown> : null;
  const related = row?.id !== undefined ? featureOperations.filter(op => op.module === module && op.audience === audience && op.pathParams.length === 1 && op.pathParams[0] === 'id' && canUseFeature(op)) : [];
  return <View className="gap-2">
    <Pressable onPress={() => setExpanded(current => !current)}><Text className="text-xs font-bold text-[#2F6DF6]">{expanded ? '收起' : '展开'} · {entries.length} 项{row?.name ? ` · ${row.name}` : ''}</Text></Pressable>
    {expanded ? entries.slice(0, limit).map(([key, item]) => <View key={key} className="border-l border-[#DDE6F2] pl-3 dark:border-[#273449]"><Text className="text-[10px] text-[#667085]">{key}</Text><ResultValue value={item} module={module} audience={audience} depth={depth + 1} /></View>) : null}
    {expanded && entries.length > limit ? <AdminButton label={`显示更多（剩余 ${entries.length - limit} 项）`} tone="muted" onPress={() => setLimit(current => current + 40)} /> : null}
    {related.length ? <View className="flex-row flex-wrap gap-2">{related.map(op => <AdminChip key={op.id} label={featureTitle(op)} selected={false} onPress={() => router.push({ pathname: '/feature-operation', params: { operation: op.id, record: JSON.stringify({ id: row?.id }) } })} />)}</View> : null}
  </View>;
}
