import manifest from '@/src/generated/sub2api-features.json';
import { adminResponseFetch, publicFetch } from '@/src/lib/admin-fetch';
import { adminConfigState, isAdminSession } from '@/src/store/admin-config';
import { getServerRootUrl } from '@/src/lib/server-url';

export type FeatureField = { name: string; type: string; required: boolean; nullable: boolean; goType: string };
export type FeatureOperation = {
  id: string; method: string; path: string; handler: string; source: string; handlerSource?: string;
  audience: string; module: string; action: string; pathParams: string[]; query: string[];
  bodyFields: FeatureField[]; bodySchema: string; fileField?: string; transport: string;
};
export const featureOperations = manifest.operations as FeatureOperation[];
export const upstreamCommit = manifest.commit;

export function featureFieldLabel(name: string) {
  const labels: Record<string, string> = { id: '记录 ID', name: '名称', description: '说明', status: '状态', email: '邮箱', username: '用户名', password: '密码', old_password: '当前密码', new_password: '新密码', group_id: '分组 ID', user_id: '用户 ID', account_id: '账号 ID', proxy_id: '代理 ID', platform: '平台', type: '类型', api_base_url: 'API 端点地址', base_url: '服务地址', api_key: 'API 密钥', accept_untested: '允许未经兼容性测试的版本', rollout_percent: '分配流量比例（%）', amount: '金额', reason: '原因', notes: '备注', quota: '额度', enabled: '是否启用', code: '验证码', totp_code: '双因素验证码', verification_code: '邮箱验证码', setup_token: '设置令牌', page: '页码', page_size: '每页数量', search: '搜索', start_date: '开始日期', end_date: '结束日期', site_name: '站点名称', smtp_host: 'SMTP 服务器', smtp_port: 'SMTP 端口', smtp_password: 'SMTP 密码', passkey_enabled: '启用 Passkey', step_up_enabled: '启用敏感操作二次验证' };
  return labels[name] || name;
}

export const featureModuleLabels: Record<string, string> = {
  accounts: '账号与额度', users: '用户管理', groups: '分组与模型', settings: '系统设置',
  plugins: 'Sub2API 插件', payment: '支付管理', subscriptions: '订阅', affiliates: '邀请返利',
  user: '个人资料与安全', keys: 'API 密钥', usage: '用量与错误', redeem: '兑换',
  announcements: '公告', channels: '渠道', 'channel-monitors': '渠道监控', 'channel-monitor-v2': '渠道监控 V2',
  'channel-monitor-templates': '监控模板', proxies: '代理', 'redeem-codes': '兑换码', 'promo-codes': '优惠码',
  'risk-control': '风控', 'prompt-audit': '提示词审计', 'data-management': '数据管理', backups: '备份与恢复',
  ops: '运行监控', dashboard: '仪表盘', system: '系统维护', 'user-attributes': '用户属性',
  'error-passthrough-rules': '错误透传', 'tls-fingerprint-profiles': 'TLS 指纹', 'scheduled-test-plans': '定时测试',
  'cn-providers': '国产供应商', openai: 'OpenAI 账号', gemini: 'Gemini 账号', grok: 'Grok 账号', antigravity: 'Antigravity 账号',
  'api-keys': '用户密钥', 'audit-logs': '操作审计', compliance: '合规确认', 'model-plaza': '模型广场',
};
export function featureTitle(operation: FeatureOperation) {
  const words: Record<string, string> = { Get: '查看', List: '列表', Create: '创建', Update: '修改', Delete: '删除', Set: '设置', Reset: '重置', Batch: '批量', Bulk: '批量', Enable: '启用', Disable: '停用', Test: '测试', Refresh: '刷新', Export: '导出', Import: '导入', Revoke: '撤销', Restore: '恢复', Query: '查询', Upload: '上传', Save: '保存', Config: '配置', Settings: '设置', User: '用户', Users: '用户', Account: '账号', Accounts: '账号', Group: '分组', Groups: '分组', Model: '模型', Models: '模型', Quota: '额度', Usage: '用量', Stats: '统计', Status: '状态', Runtime: '运行状态', Clear: '清除', Error: '错误', Errors: '错误', Rate: '速率', Limit: '限制', Limits: '限制', Available: '可用', Today: '今日', Duplicate: '复制', Apply: '应用', History: '历史', Run: '执行', Send: '发送', Invite: '邀请', Referrals: '邀请记录', Preview: '预览', Probe: '探测', Endpoint: '端点', Events: '事件', Event: '事件', Profile: '资料', Password: '密码', Change: '修改', Email: '邮箱', Notify: '通知', Verify: '验证', Code: '验证码', Setup: '设置', Initiate: '开始', Bind: '绑定', Unbind: '解绑', Identity: '身份', Remove: '移除', Toggle: '切换', Snapshot: '快照', Matrix: '矩阵', Dimensions: '维度', Data: '数据', By: '按', Filter: '筛选', Admin: '管理', Active: '活动', Summary: '汇总', Progress: '进度', Schedule: '计划', Backup: '备份', Backups: '备份', Plans: '套餐', Plan: '套餐', Providers: '支付渠道', Provider: '支付渠道', Orders: '订单', Order: '订单', Detail: '详情', Balance: '余额', Accept: '确认', Health: '健康状态', Redeem: '兑换', Expire: '设为过期', Generate: '生成', Renew: '续期', Extend: '延期', Assign: '分配', Withdraw: '提现', Transfer: '转入', Affiliate: '邀请返利', And: '并', From: '从', Check: '检查', Updates: '更新', Restart: '重启', Service: '服务', Rollback: '回滚', Version: '版本', Versions: '版本', Mark: '标记', Read: '已读', Cancel: '取消', Logs: '日志', Search: '查找', All: '全部' };
  return (operation.action.match(/[A-Z]+(?=[A-Z][a-z]|\d|$)|[A-Z]?[a-z]+|\d+/g) || [operation.action]).map(word => words[word] || word).join(' ');
}

export function featurePath(operation: FeatureOperation, path: Record<string, string>, query: Record<string, string>, extraQuery = '') {
  const resolved = operation.path.replace(/[:*](\w+)/g, (_, name) => {
    if (!path[name]?.trim()) throw new Error(`请填写 ${name}`);
    return encodeURIComponent(path[name].trim());
  });
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value.trim()) params.set(key, value.trim());
  const extra = new URLSearchParams(extraQuery.replace(/^\?/, ''));
  extra.forEach((value, name) => { if (!Object.hasOwn(query, name) || !query[name].trim()) params.append(name, value); });
  return resolved + (params.size ? `?${params}` : '');
}

export function featureBody(operation: FeatureOperation, values: Record<string, string>) {
  const body: Record<string, unknown> = {};
  for (const field of operation.bodyFields) {
    const value = values[field.name];
    if (value === undefined || (value === '' && field.type !== 'string')) {
      if (field.required) throw new Error(`请填写 ${field.name}`);
      continue;
    }
    if (field.required && value === '') throw new Error(`请填写 ${field.name}`);
    if (value === 'null' && field.nullable) { body[field.name] = null; continue; }
    if (field.type === 'number') {
      const number = Number(value);
      if (!value.trim() || !Number.isFinite(number)) throw new Error(`${field.name} 必须是数字`);
      if (/int/.test(field.goType) && !Number.isSafeInteger(number)) throw new Error(`${field.name} 必须是安全范围内的整数`);
      body[field.name] = number;
    } else if (field.type === 'boolean') {
      if (!['true', 'false'].includes(value)) throw new Error(`${field.name} 必须为 true 或 false`);
      body[field.name] = value === 'true';
    } else if (field.type === 'json') {
      try { body[field.name] = JSON.parse(value); } catch { throw new Error(`${field.name} 不是有效的 JSON`); }
    } else body[field.name] = value;
  }
  return body;
}

export function canUseFeature(operation: FeatureOperation) {
  if (operation.audience === 'public') return true;
  if (operation.audience === 'admin') return isAdminSession();
  return adminConfigState.authMode === 'password' && Boolean(adminConfigState.accessToken);
}

export async function runFeature(operation: FeatureOperation, path: string, body?: unknown, signal?: AbortSignal) {
  if (!featureOperations.some(item => item.id === operation.id) || !canUseFeature(operation)) throw new Error('当前登录身份不能执行此操作');
  const init: RequestInit = { method: operation.method, signal };
  if (body !== undefined) init.body = JSON.stringify(body);
  if (operation.audience === 'public') return publicFetch<unknown>(adminConfigState.baseUrl, path, init);
  const response = await adminResponseFetch(path, init);
  return readFeatureResponse(response);
}

async function readFeatureResponse(response: Response) {
  const text = await response.text();
  let result;
  try { result = text ? JSON.parse(text) : undefined; }
  catch { if (!response.ok) throw new Error(`HTTP ${response.status}`); return text; }
  if (!response.ok || (result && typeof result === 'object' && typeof result.code === 'number' && result.code !== 0)) throw new Error(result?.reason || result?.message || `HTTP ${response.status}`);
  return result && typeof result === 'object' && 'code' in result ? result.data : result;
}

export async function uploadFeature(operation: FeatureOperation, path: string, file: { uri: string; name: string; mimeType?: string; file?: File }, signal?: AbortSignal) {
  if (!operation.fileField || !canUseFeature(operation)) throw new Error('不支持此文件操作');
  const form = new FormData();
  form.append(operation.fileField, file.file || ({ uri: file.uri, name: file.name, type: file.mimeType || 'application/octet-stream' } as unknown as Blob));
  return readFeatureResponse(await adminResponseFetch(path, { method: operation.method, body: form, signal }));
}

export function officialPageUrl(serverUrl: string, page: string) {
  const allowed = ['/login', '/register', '/forgot-password', '/purchase', '/orders', '/profile'];
  if (!allowed.includes(page)) throw new Error('不支持的官方页面');
  const base = new URL(getServerRootUrl(serverUrl));
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password) throw new Error('请输入有效的服务器地址');
  base.search = ''; base.hash = '';
  return base.toString().replace(/\/+$/, '') + page;
}
