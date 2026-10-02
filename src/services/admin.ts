import { adminFetch, adminRawFetch, publicFetch } from '@/src/lib/admin-fetch';
import { isAdminSession } from '@/src/store/admin-config';
import type {
  AccountModel,
  AccountPlatform,
  AccountTestRequest,
  AccountTestResult,
  AccountTodayStats,
  AccountUsageInfo,
  ActionResult,
  AdminAccount,
  AdminDataImportResult,
  AdminDataPayload,
  AdminApiKey,
  AdminChannel,
  AdminComplianceStatus,
  AdminGroup,
  AdminProxy,
  AdminRedeemCode,
  AdminSettings,
  AdminUsageLog,
  AdminUser,
  AuthResponse,
  ApiKeyWriteRequest,
  AdminAnnouncement,
  AffiliateAdminEntry,
  AffiliateRecord,
  AnnouncementRequest,
  AssignSubscriptionRequest,
  AuditLog,
  BackupAgentHealth,
  BackupJob,
  BackupRecord,
  BackupSchedule,
  BalanceOperation,
  DashboardModelStats,
  DashboardSnapshot,
  DashboardStats,
  DashboardTrend,
  CreateAccountRequest,
  CreateChannelRequest,
  CreateGroupRequest,
  CreateProxyRequest,
  CreateUserRequest,
  GenerateRedeemCodesRequest,
  ContentModerationConfig,
  ContentModerationLog,
  ContentModerationStatus,
  ChannelMonitor,
  ChannelMonitorRequest,
  ErrorPassthroughRule,
  OAuthSession,
  OpsAlertEvent,
  OpsErrorKind,
  OpsErrorLog,
  OpsSystemLog,
  OpenAIQuotaResetResult,
  OpenAIQuotaRefreshResult,
  OpenAIQuotaUsage,
  PaymentOrder,
  RefundResult,
  PaginatedData,
  ProxyQualityCheckResult,
  ProxyTestResult,
  PromoCode,
  PromoCodeRequest,
  PromptAuditConfig,
  PromptAuditEvent,
  PromptAuditRuntime,
  RedeemCodeStats,
  UsageStats,
  UserUsageSummary,
  UpdateAccountRequest,
  UpdateChannelRequest,
  UpdateGroupRequest,
  UpdateProxyRequest,
  UpdateUserRequest,
  SystemVersionInfo,
  TLSFingerprintProfile,
  ScheduledTestPlan,
  UserAttributeDefinition,
  UserAttributeRequest,
  UserSubscription,
} from '@/src/types/admin';

export function loginWithPassword(baseUrl: string, email: string, password: string) {
  return publicFetch<AuthResponse | { requires_2fa: true; temp_token: string; user_email_masked?: string }>(baseUrl, '/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function loginWithTwoFactor(baseUrl: string, tempToken: string, code: string) {
  return publicFetch<AuthResponse>(baseUrl, '/api/v1/auth/login/2fa', {
    method: 'POST', body: JSON.stringify({ temp_token: tempToken, totp_code: code.trim() }),
  });
}

export function testAdminKey(baseUrl: string, adminApiKey: string) {
  return publicFetch<DashboardStats>(baseUrl, '/api/v1/admin/dashboard/stats', {
    headers: { 'x-api-key': adminApiKey },
  });
}

export function getCurrentUser() {
  return adminFetch<{ user?: import('@/src/types/admin').AuthUser } | import('@/src/types/admin').AuthUser>('/api/v1/auth/me');
}

function buildQuery(params: Record<string, string | number | boolean | null | undefined>) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value));
    }
  });

  const value = query.toString();

  return value ? `?${value}` : '';
}

export function getDashboardStats() {
  return adminFetch<DashboardStats>('/api/v1/admin/dashboard/stats');
}

export function getAdminSettings() {
  return adminFetch<AdminSettings>('/api/v1/admin/settings');
}

export function getPublicSettings(serverUrl: string, signal?: AbortSignal) {
  return publicFetch<{ api_base_url?: string | null; payment_enabled?: boolean }>(serverUrl, '/api/v1/settings/public', { signal });
}

export function getUserDashboardStats() {
  return adminFetch<DashboardStats>('/api/v1/usage/dashboard/stats');
}

export function getSessionDashboardStats() {
  return isAdminSession() ? getDashboardStats() : getUserDashboardStats();
}

export function getAdminComplianceStatus() {
  return adminFetch<AdminComplianceStatus>('/api/v1/admin/compliance');
}

export function acceptAdminCompliance(phrase: string, language = 'zh') {
  return adminFetch<AdminComplianceStatus>('/api/v1/admin/compliance/accept', {
    method: 'POST',
    body: JSON.stringify({ phrase, language }),
  });
}

export function updateAdminSettings(body: Partial<AdminSettings>) {
  return adminFetch<AdminSettings>('/api/v1/admin/settings', {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export function getDashboardTrend(params: {
  start_date: string;
  end_date: string;
  granularity?: 'day' | 'hour';
  account_id?: number;
  group_id?: number;
  user_id?: number;
}) {
  return adminFetch<DashboardTrend>(`/api/v1/admin/dashboard/trend${buildQuery(params)}`);
}

export function getDashboardModels(params: { start_date: string; end_date: string }) {
  return adminFetch<DashboardModelStats>(`/api/v1/admin/dashboard/models${buildQuery(params)}`);
}

export function getDashboardSnapshot(params: {
  start_date: string;
  end_date: string;
  granularity?: 'day' | 'hour';
  account_id?: number;
  user_id?: number;
  group_id?: number;
  model?: string;
  request_type?: string;
  billing_type?: string | null;
  include_stats?: boolean;
  include_trend?: boolean;
  include_model_stats?: boolean;
  include_group_stats?: boolean;
  include_users_trend?: boolean;
}) {
  return adminFetch<DashboardSnapshot>(`/api/v1/admin/dashboard/snapshot-v2${buildQuery(params)}`);
}

export function getUsageStats(params: {
  start_date: string;
  end_date: string;
  user_id?: number;
  account_id?: number;
  group_id?: number;
  model?: string;
  request_type?: string;
  billing_type?: string | null;
}) {
  return adminFetch<UsageStats>(`/api/v1/admin/usage/stats${buildQuery(params)}`);
}

export function listUsers(search = '', page = 1, pageSize = 20) {
  return adminFetch<PaginatedData<AdminUser>>(
    `/api/v1/admin/users${buildQuery({ page, page_size: pageSize, search: search.trim() })}`
  );
}

export function getUser(userId: number) {
  return adminFetch<AdminUser>(`/api/v1/admin/users/${userId}`);
}

export function createUser(body: CreateUserRequest) {
  return adminFetch<AdminUser>('/api/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function getUserUsage(userId: number, period: 'day' | 'week' | 'month' = 'month') {
  return adminFetch<UserUsageSummary>(`/api/v1/admin/users/${userId}/usage${buildQuery({ period })}`);
}

export function listUserApiKeys(userId: number) {
  return adminFetch<PaginatedData<AdminApiKey>>(`/api/v1/admin/users/${userId}/api-keys${buildQuery({ page: 1, page_size: 100 })}`);
}

export function updateUserBalance(
  userId: number,
  body: { balance: number; operation: BalanceOperation; notes?: string }
) {
  return adminFetch<AdminUser>(
    `/api/v1/admin/users/${userId}/balance`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
    {
      idempotencyKey: `user-balance-${userId}-${Date.now()}`,
    }
  );
}

export function updateUserStatus(userId: number, status: 'active' | 'disabled') {
  return updateUser(userId, { status });
}

export function getSessionDashboardTrend(params: { start_date: string; end_date: string; granularity?: 'day' | 'hour' }) {
  const prefix = isAdminSession() ? '/api/v1/admin/dashboard/trend' : '/api/v1/usage/dashboard/trend';
  return adminFetch<DashboardTrend>(`${prefix}${buildQuery(params)}`);
}

export function getSessionDashboardModels(params: { start_date: string; end_date: string }) {
  const prefix = isAdminSession() ? '/api/v1/admin/dashboard/models' : '/api/v1/usage/dashboard/models';
  return adminFetch<DashboardModelStats>(`${prefix}${buildQuery(params)}`);
}

export function listMyApiKeys(search = '', page = 1, pageSize = 50) {
  return adminFetch<PaginatedData<AdminApiKey>>(`/api/v1/keys${buildQuery({ page, page_size: pageSize, search: search.trim() })}`);
}

export function listAvailableGroups() {
  return adminFetch<AdminGroup[]>('/api/v1/groups/available');
}

export function getMyApiKey(apiKeyId: number) {
  return adminFetch<AdminApiKey>(`/api/v1/keys/${apiKeyId}`);
}

export function createMyApiKey(body: ApiKeyWriteRequest) {
  return adminFetch<AdminApiKey>('/api/v1/keys', { method: 'POST', body: JSON.stringify(body) });
}

export function updateMyApiKey(apiKeyId: number, body: Partial<ApiKeyWriteRequest>) {
  return adminFetch<AdminApiKey>(`/api/v1/keys/${apiKeyId}`, { method: 'PUT', body: JSON.stringify(body) });
}

export function deleteMyApiKey(apiKeyId: number) {
  return adminFetch<ActionResult>(`/api/v1/keys/${apiKeyId}`, { method: 'DELETE' });
}

export function updateUser(userId: number, body: UpdateUserRequest) {
  return adminFetch<AdminUser>(`/api/v1/admin/users/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export function deleteUser(userId: number) {
  return adminFetch<ActionResult>(`/api/v1/admin/users/${userId}`, { method: 'DELETE' });
}

export function listGroups(search = '', page = 1, pageSize = 20) {
  return adminFetch<PaginatedData<AdminGroup>>(
    `/api/v1/admin/groups${buildQuery({ page, page_size: pageSize, search: search.trim() })}`
  );
}

export function getGroup(groupId: number) {
  return adminFetch<AdminGroup>(`/api/v1/admin/groups/${groupId}`);
}

export function listAllGroups() {
  return adminFetch<AdminGroup[]>('/api/v1/admin/groups/all');
}

export function createGroup(body: CreateGroupRequest) {
  return adminFetch<AdminGroup>('/api/v1/admin/groups', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateGroup(groupId: number, body: UpdateGroupRequest) {
  return adminFetch<AdminGroup>(`/api/v1/admin/groups/${groupId}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export function deleteGroup(groupId: number) {
  return adminFetch<ActionResult>(`/api/v1/admin/groups/${groupId}`, { method: 'DELETE' });
}

export function duplicateGroup(groupId: number) {
  return adminFetch<AdminGroup>(
    `/api/v1/admin/groups/${groupId}/duplicate`,
    { method: 'POST' },
    { idempotencyKey: `group-duplicate-${groupId}-${Date.now()}` }
  );
}

export function updateApiKeyGroup(apiKeyId: number, groupId: number | null) {
  return adminFetch<AdminApiKey>(`/api/v1/admin/api-keys/${apiKeyId}`, {
    method: 'PUT',
    body: JSON.stringify({ group_id: groupId }),
  });
}

export function listAccounts(search = '', page = 1, pageSize = 20) {
  return adminFetch<PaginatedData<AdminAccount>>(
    `/api/v1/admin/accounts${buildQuery({ page, page_size: pageSize, search: search.trim() })}`
  );
}

export function exportAccountData(includeProxies = true) {
  return adminFetch<AdminDataPayload>(
    `/api/v1/admin/accounts/data${includeProxies ? '' : '?include_proxies=false'}`,
  );
}

export function importAccountData(data: AdminDataPayload) {
  return adminFetch<AdminDataImportResult>('/api/v1/admin/accounts/data', {
    method: 'POST',
    body: JSON.stringify({ data, skip_default_group_bind: true }),
  });
}

export function getAccount(accountId: number) {
  return adminFetch<AdminAccount>(`/api/v1/admin/accounts/${accountId}`);
}

export function createAccount(body: CreateAccountRequest) {
  return adminFetch<AdminAccount>('/api/v1/admin/accounts', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateAccount(accountId: number, body: UpdateAccountRequest) {
  return adminFetch<AdminAccount>(`/api/v1/admin/accounts/${accountId}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export function deleteAccount(accountId: number) {
  return adminFetch<ActionResult>(`/api/v1/admin/accounts/${accountId}`, { method: 'DELETE' });
}

export function duplicateAccount(accountId: number) {
  return adminFetch<AdminAccount>(
    `/api/v1/admin/accounts/${accountId}/duplicate`,
    { method: 'POST' },
    { idempotencyKey: `account-duplicate-${accountId}-${Date.now()}` }
  );
}

export function clearAccountError(accountId: number) {
  return adminFetch<AdminAccount>(`/api/v1/admin/accounts/${accountId}/clear-error`, { method: 'POST' });
}

export function clearAccountRateLimit(accountId: number) {
  return adminFetch<AdminAccount>(`/api/v1/admin/accounts/${accountId}/clear-rate-limit`, { method: 'POST' });
}

export function recoverAccountState(accountId: number) {
  return adminFetch<AdminAccount>(`/api/v1/admin/accounts/${accountId}/recover-state`, { method: 'POST' });
}

export function resetAccountQuota(accountId: number) {
  return adminFetch<AdminAccount>(`/api/v1/admin/accounts/${accountId}/reset-quota`, { method: 'POST' });
}

export function clearAccountTempUnschedulable(accountId: number) {
  return adminFetch<ActionResult>(`/api/v1/admin/accounts/${accountId}/temp-unschedulable`, { method: 'DELETE' });
}

export function getAccountTodayStats(accountId: number) {
  return adminFetch<AccountTodayStats>(`/api/v1/admin/accounts/${accountId}/today-stats`);
}

export async function getAvailableAccountModels(accountId: number) {
  const response = await adminFetch<AccountModel[] | string[] | { models?: Array<AccountModel | string> }>(`/api/v1/admin/accounts/${accountId}/models`);
  const models = Array.isArray(response) ? response : response.models ?? [];
  return models
    .map((model) => typeof model === 'string' ? { id: model, display_name: model } : model)
    .filter((model): model is AccountModel => Boolean(model?.id));
}

export function getAccountUsage(accountId: number, source?: 'passive' | 'active', force = false) {
  return adminFetch<AccountUsageInfo>(
    `/api/v1/admin/accounts/${accountId}/usage${buildQuery({ source, force: force || undefined })}`
  );
}

export function queryOpenAIQuota(accountId: number) {
  return adminFetch<OpenAIQuotaUsage>(`/api/v1/admin/openai/accounts/${accountId}/quota`);
}

export function refreshOpenAIQuota(accountId: number) {
  return adminFetch<OpenAIQuotaRefreshResult>(`/api/v1/admin/openai/accounts/${accountId}/quota/refresh`, { method: 'POST' });
}

export function resetOpenAIQuota(accountId: number) {
  return adminFetch<OpenAIQuotaResetResult>(`/api/v1/admin/openai/accounts/${accountId}/reset-quota`, { method: 'POST' });
}

export function listPaymentOrders(params: { page?: number; page_size?: number; status?: string; keyword?: string } = {}) {
  return adminFetch<PaginatedData<PaymentOrder>>(`/api/v1/admin/payment/orders${buildQuery({ page: params.page ?? 1, page_size: params.page_size ?? 20, status: params.status, keyword: params.keyword })}`);
}

export function refundPaymentOrder(orderId: number, body: { amount: number; reason: string; deduct_balance?: boolean; force?: boolean }) {
  return adminFetch<RefundResult>(`/api/v1/admin/payment/orders/${orderId}/refund`, { method: 'POST', body: JSON.stringify(body) });
}

export function queryPaymentRefund(orderId: number) {
  return adminFetch<RefundResult>(`/api/v1/admin/payment/orders/${orderId}/refund/query`, { method: 'POST' });
}

export async function testAccount(accountId: number, body: AccountTestRequest) {
  const response = await adminRawFetch(`/api/v1/admin/accounts/${accountId}/test`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

  type TestEvent = { type?: string; text?: string; output?: string; message?: string; model?: string; success?: boolean; error?: string };
  const events = response.body
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as TestEvent];
      } catch {
        return [];
      }
    });

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const error = JSON.parse(response.body) as { reason?: string; message?: string; error?: string };
      message = error.reason || error.message || error.error || message;
    } catch {
      const eventError = events.find((event) => event.error)?.error;
      if (eventError) message = eventError;
    }
    throw new Error(message);
  }

  if (events.length === 0) {
    let parsed: unknown;
    try {
      parsed = response.body ? JSON.parse(response.body) : undefined;
    } catch {
      throw new Error(`测试接口返回了无法识别的内容（${response.contentType || '未知类型'}）。请检查服务地址、反向代理和 Sub2API 版本。`);
    }
    const envelope = parsed as { code?: number; message?: string; reason?: string; data?: TestEvent } | undefined;
    if (envelope?.code !== undefined && envelope.code !== 0) throw new Error(envelope.reason || envelope.message || '模型连接测试失败');
    const payload = (envelope?.data ?? parsed) as TestEvent | undefined;
    if (!payload || typeof payload !== 'object') throw new Error('测试接口没有返回测试结果');
    const result: AccountTestResult = {
      success: payload.success !== false && !payload.error,
      model: payload.model || body.model_id,
      message: payload.error || payload.message || (payload.success === false ? '模型连接测试失败' : '模型连接测试成功'),
      output: payload.output || payload.text || undefined,
    };
    if (!result.success) throw new Error(result.message);
    return result;
  }

  const output = events.filter((event) => event.type === 'content' && event.text).map((event) => event.text).join('');
  const failure = events.find((event) => event.type === 'error' || event.error);
  const completed = [...events].reverse().find((event) => event.type === 'test_complete');
  const success = completed?.success ?? !failure;
  const result: AccountTestResult = {
    success,
    model: events.find((event) => event.model)?.model || body.model_id,
    message: failure?.error || (success ? '模型连接测试成功' : '模型连接测试失败'),
    output: output || undefined,
  };
  if (!result.success) throw new Error(result.message);
  return result;
}

export function refreshAccount(accountId: number) {
  return adminFetch(`/api/v1/admin/accounts/${accountId}/refresh`, {
    method: 'POST',
  });
}

export function setAccountSchedulable(accountId: number, schedulable: boolean) {
  return adminFetch<AdminAccount>(`/api/v1/admin/accounts/${accountId}/schedulable`, {
    method: 'POST',
    body: JSON.stringify({ schedulable }),
  });
}

export function batchRefreshAccounts(accountIds: number[]) {
  return adminFetch<{ total: number; success: number; failed: number; errors?: Array<{ account_id: number; error: string }> }>('/api/v1/admin/accounts/batch-refresh', {
    method: 'POST',
    body: JSON.stringify({ account_ids: accountIds }),
  });
}

export function batchDeleteAccounts(accountIds: number[]) {
  return adminFetch<{ total: number; success: number; failed: number; errors?: Array<{ account_id: number; error: string }> }>('/api/v1/admin/accounts/batch-delete', {
    method: 'POST',
    body: JSON.stringify({ account_ids: accountIds }),
  });
}

export function listProxies(search = '', page = 1, pageSize = 20) {
  return adminFetch<PaginatedData<AdminProxy>>(
    `/api/v1/admin/proxies${buildQuery({ page, page_size: pageSize, search: search.trim() })}`
  );
}

export function getProxy(proxyId: number) {
  return adminFetch<AdminProxy>(`/api/v1/admin/proxies/${proxyId}`);
}

export function createProxy(body: CreateProxyRequest) {
  return adminFetch<AdminProxy>('/api/v1/admin/proxies', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateProxy(proxyId: number, body: UpdateProxyRequest) {
  return adminFetch<AdminProxy>(`/api/v1/admin/proxies/${proxyId}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export function deleteProxy(proxyId: number) {
  return adminFetch<ActionResult>(`/api/v1/admin/proxies/${proxyId}`, { method: 'DELETE' });
}

export function testProxy(proxyId: number) {
  return adminFetch<ProxyTestResult>(`/api/v1/admin/proxies/${proxyId}/test`, { method: 'POST' });
}

export function checkProxyQuality(proxyId: number) {
  return adminFetch<ProxyQualityCheckResult>(`/api/v1/admin/proxies/${proxyId}/quality-check`, { method: 'POST' });
}

export function listRedeemCodes(search = '', status?: string, page = 1, pageSize = 20) {
  return adminFetch<PaginatedData<AdminRedeemCode>>(
    `/api/v1/admin/redeem-codes${buildQuery({ page, page_size: pageSize, search: search.trim(), status })}`
  );
}

export function getRedeemCodeStats() {
  return adminFetch<RedeemCodeStats>('/api/v1/admin/redeem-codes/stats');
}

export function generateRedeemCodes(body: GenerateRedeemCodesRequest) {
  return adminFetch<AdminRedeemCode[]>('/api/v1/admin/redeem-codes/generate', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function expireRedeemCode(codeId: number) {
  return adminFetch<AdminRedeemCode>(`/api/v1/admin/redeem-codes/${codeId}/expire`, { method: 'POST' });
}

export function deleteRedeemCode(codeId: number) {
  return adminFetch<ActionResult>(`/api/v1/admin/redeem-codes/${codeId}`, { method: 'DELETE' });
}

export function listOpsErrors(kind: OpsErrorKind, resolved?: boolean, search = '', page = 1, pageSize = 20) {
  const endpoint = kind === 'request' ? 'request-errors' : 'upstream-errors';
  return adminFetch<PaginatedData<OpsErrorLog>>(
    `/api/v1/admin/ops/${endpoint}${buildQuery({
      page,
      page_size: pageSize,
      time_range: '24h',
      resolved: resolved === undefined ? undefined : String(resolved),
      q: search.trim(),
    })}`
  );
}

export function resolveOpsError(kind: OpsErrorKind, errorId: number, resolved: boolean) {
  const endpoint = kind === 'request' ? 'request-errors' : 'upstream-errors';
  return adminFetch<ActionResult>(`/api/v1/admin/ops/${endpoint}/${errorId}/resolve`, {
    method: 'PUT',
    body: JSON.stringify({ resolved }),
  });
}

export function listSubscriptions(status?: string, page = 1, pageSize = 20) {
  return adminFetch<PaginatedData<UserSubscription>>(
    `/api/v1/admin/subscriptions${buildQuery({ page, page_size: pageSize, status })}`
  );
}

export function assignSubscription(body: AssignSubscriptionRequest) {
  return adminFetch<UserSubscription>('/api/v1/admin/subscriptions/assign', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function extendSubscription(subscriptionId: number, days: number) {
  return adminFetch<UserSubscription>(`/api/v1/admin/subscriptions/${subscriptionId}/extend`, {
    method: 'POST',
    body: JSON.stringify({ days }),
  });
}

export function resetSubscriptionQuota(subscriptionId: number) {
  return adminFetch<UserSubscription>(`/api/v1/admin/subscriptions/${subscriptionId}/reset-quota`, {
    method: 'POST',
    body: JSON.stringify({ daily: true, weekly: true, monthly: true }),
  });
}

export function revokeSubscription(subscriptionId: number) {
  return adminFetch<ActionResult>(`/api/v1/admin/subscriptions/${subscriptionId}/revoke`, { method: 'POST' });
}

export function restoreSubscription(subscriptionId: number) {
  return adminFetch<UserSubscription>(`/api/v1/admin/subscriptions/${subscriptionId}/restore`, { method: 'POST' });
}

export function listChannels(search = '', page = 1, pageSize = 20) {
  return adminFetch<PaginatedData<AdminChannel>>(
    `/api/v1/admin/channels${buildQuery({ page, page_size: pageSize, search: search.trim() })}`
  );
}

export function getChannel(channelId: number) {
  return adminFetch<AdminChannel>(`/api/v1/admin/channels/${channelId}`);
}

export function createChannel(body: CreateChannelRequest) {
  return adminFetch<AdminChannel>('/api/v1/admin/channels', { method: 'POST', body: JSON.stringify(body) });
}

export function updateChannel(channelId: number, body: UpdateChannelRequest) {
  return adminFetch<AdminChannel>(`/api/v1/admin/channels/${channelId}`, { method: 'PUT', body: JSON.stringify(body) });
}

export function deleteChannel(channelId: number) {
  return adminFetch<ActionResult>(`/api/v1/admin/channels/${channelId}`, { method: 'DELETE' });
}

export function getRiskControlConfig() {
  return adminFetch<ContentModerationConfig>('/api/v1/admin/risk-control/config');
}

export function updateRiskControlConfig(body: Partial<ContentModerationConfig>) {
  return adminFetch<ContentModerationConfig>('/api/v1/admin/risk-control/config', {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export function getRiskControlStatus() {
  return adminFetch<ContentModerationStatus>('/api/v1/admin/risk-control/status');
}

export function listRiskControlLogs(search = '', page = 1, pageSize = 20) {
  return adminFetch<PaginatedData<ContentModerationLog>>(
    `/api/v1/admin/risk-control/logs${buildQuery({ page, page_size: pageSize, search: search.trim() })}`
  );
}

export function unbanRiskControlUser(userId: number) {
  return adminFetch<{ user_id: number; status: string }>(`/api/v1/admin/risk-control/users/${userId}/unban`, { method: 'POST' });
}

export function listAuditLogs(search = '', page = 1, pageSize = 20, success?: boolean) {
  return adminFetch<PaginatedData<AuditLog>>(
    `/api/v1/admin/audit-logs${buildQuery({ page, page_size: pageSize, q: search.trim(), success: success === undefined ? undefined : String(success) })}`
  );
}

export function getAuditLog(logId: number) {
  return adminFetch<AuditLog>(`/api/v1/admin/audit-logs/${logId}`);
}

export function listUsageLogs(search = '', page = 1, pageSize = 20) {
  const prefix = isAdminSession() ? '/api/v1/admin/usage' : '/api/v1/usage';
  return adminFetch<PaginatedData<AdminUsageLog>>(
    `${prefix}${buildQuery({ page, page_size: pageSize, model: search.trim(), sort_by: 'created_at', sort_order: 'desc' })}`
  );
}

export function listAnnouncements(search = '', page = 1, pageSize = 20) {
  return adminFetch<PaginatedData<AdminAnnouncement>>(
    `/api/v1/admin/announcements${buildQuery({ page, page_size: pageSize, search: search.trim() })}`
  );
}

export function createAnnouncement(body: AnnouncementRequest) {
  return adminFetch<AdminAnnouncement>('/api/v1/admin/announcements', { method: 'POST', body: JSON.stringify(body) });
}

export function updateAnnouncement(id: number, body: Partial<AnnouncementRequest>) {
  return adminFetch<AdminAnnouncement>(`/api/v1/admin/announcements/${id}`, { method: 'PUT', body: JSON.stringify(body) });
}

export function deleteAnnouncement(id: number) {
  return adminFetch<ActionResult>(`/api/v1/admin/announcements/${id}`, { method: 'DELETE' });
}

export function listPromoCodes(search = '', page = 1, pageSize = 20) {
  return adminFetch<PaginatedData<PromoCode>>(
    `/api/v1/admin/promo-codes${buildQuery({ page, page_size: pageSize, search: search.trim() })}`
  );
}

export function createPromoCode(body: PromoCodeRequest) {
  return adminFetch<PromoCode>('/api/v1/admin/promo-codes', { method: 'POST', body: JSON.stringify(body) });
}

export function updatePromoCode(id: number, body: Partial<PromoCodeRequest>) {
  return adminFetch<PromoCode>(`/api/v1/admin/promo-codes/${id}`, { method: 'PUT', body: JSON.stringify(body) });
}

export function deletePromoCode(id: number) {
  return adminFetch<ActionResult>(`/api/v1/admin/promo-codes/${id}`, { method: 'DELETE' });
}

export function getPromptAuditConfig() {
  return adminFetch<PromptAuditConfig>('/api/v1/admin/prompt-audit/config');
}

export function updatePromptAuditConfig(config: PromptAuditConfig) {
  return adminFetch<PromptAuditConfig>('/api/v1/admin/prompt-audit/config', {
    method: 'PUT',
    body: JSON.stringify({
      expected_config_version: config.config_version,
      enabled: config.enabled,
      blocking_enabled: config.blocking_enabled,
      store_pass_events: config.store_pass_events,
      strategy: 'priority',
      worker_count: config.worker_count,
      queue_capacity: config.queue_capacity,
      scanners: config.scanners,
      all_groups: config.all_groups,
      group_ids: config.group_ids,
      endpoints: config.endpoints.map((endpoint) => ({ ...endpoint, clear_token: false })),
    }),
  });
}

export function getPromptAuditRuntime() {
  return adminFetch<PromptAuditRuntime>('/api/v1/admin/prompt-audit/runtime');
}

export function listPromptAuditEvents(page = 1, pageSize = 20) {
  return adminFetch<PaginatedData<PromptAuditEvent>>(`/api/v1/admin/prompt-audit/events${buildQuery({ page, page_size: pageSize })}`);
}

export function deletePromptAuditEvent(id: number) {
  return adminFetch<{ deleted_events: number; deleted_jobs: number }>(`/api/v1/admin/prompt-audit/events/${id}`, { method: 'DELETE' });
}

export function listBackups() {
  return adminFetch<{ items: BackupRecord[] }>('/api/v1/admin/backups');
}

export function createBackup(expireDays = 30) {
  return adminFetch<BackupRecord>('/api/v1/admin/backups', { method: 'POST', body: JSON.stringify({ expire_days: expireDays }) });
}

export function deleteBackup(id: string) {
  return adminFetch<ActionResult>(`/api/v1/admin/backups/${id}`, { method: 'DELETE' });
}

export function restoreBackup(id: string, password: string) {
  return adminFetch<ActionResult>(`/api/v1/admin/backups/${id}/restore`, { method: 'POST', body: JSON.stringify({ password }) });
}

export function getBackupSchedule() {
  return adminFetch<BackupSchedule>('/api/v1/admin/backups/schedule');
}

export function updateBackupSchedule(body: BackupSchedule) {
  return adminFetch<BackupSchedule>('/api/v1/admin/backups/schedule', { method: 'PUT', body: JSON.stringify(body) });
}

export function getBackupAgentHealth() {
  return adminFetch<BackupAgentHealth>('/api/v1/admin/data-management/agent/health');
}

export function listBackupJobs() {
  return adminFetch<{ items: BackupJob[]; next_page_token?: string }>('/api/v1/admin/data-management/backups?page_size=50');
}

export function createBackupJob(backupType: 'postgres' | 'redis' | 'full', uploadToS3 = false) {
  const key = `mobile-backup-${Date.now()}`;
  return adminFetch<{ job_id: string; status: string }>('/api/v1/admin/data-management/backups', {
    method: 'POST', body: JSON.stringify({ backup_type: backupType, upload_to_s3: uploadToS3, idempotency_key: key }),
  }, { idempotencyKey: key });
}

export function checkSystemUpdates(force = false) {
  return adminFetch<SystemVersionInfo>(`/api/v1/admin/system/check-updates${buildQuery({ force })}`);
}

export function getRollbackVersions() {
  return adminFetch<{ versions: Array<{ version: string; published_at: string; html_url: string }> }>('/api/v1/admin/system/rollback-versions');
}

export function performSystemUpdate() {
  return adminFetch<{ message: string; need_restart: boolean }>('/api/v1/admin/system/update', { method: 'POST' });
}

export function rollbackSystem(version?: string) {
  return adminFetch<{ message: string; need_restart: boolean }>('/api/v1/admin/system/rollback', {
    method: 'POST', body: version ? JSON.stringify({ version }) : undefined,
  });
}

export function restartSystem() {
  return adminFetch<{ message: string }>('/api/v1/admin/system/restart', { method: 'POST' });
}

export function listUserAttributes() {
  return adminFetch<UserAttributeDefinition[]>('/api/v1/admin/user-attributes');
}

export function createUserAttribute(body: UserAttributeRequest) {
  return adminFetch<UserAttributeDefinition>('/api/v1/admin/user-attributes', { method: 'POST', body: JSON.stringify(body) });
}

export function updateUserAttribute(id: number, body: Partial<UserAttributeRequest>) {
  return adminFetch<UserAttributeDefinition>(`/api/v1/admin/user-attributes/${id}`, { method: 'PUT', body: JSON.stringify(body) });
}

export function deleteUserAttribute(id: number) {
  return adminFetch<ActionResult>(`/api/v1/admin/user-attributes/${id}`, { method: 'DELETE' });
}

export function reorderUserAttributes(ids: number[]) {
  return adminFetch<ActionResult>('/api/v1/admin/user-attributes/reorder', { method: 'PUT', body: JSON.stringify({ ids }) });
}

export function listErrorPassthroughRules() {
  return adminFetch<ErrorPassthroughRule[]>('/api/v1/admin/error-passthrough-rules');
}

export function createErrorPassthroughRule(body: Partial<ErrorPassthroughRule> & { name: string }) {
  return adminFetch<ErrorPassthroughRule>('/api/v1/admin/error-passthrough-rules', { method: 'POST', body: JSON.stringify(body) });
}

export function updateErrorPassthroughRule(id: number, body: Partial<ErrorPassthroughRule>) {
  return adminFetch<ErrorPassthroughRule>(`/api/v1/admin/error-passthrough-rules/${id}`, { method: 'PUT', body: JSON.stringify(body) });
}

export function deleteErrorPassthroughRule(id: number) {
  return adminFetch<ActionResult>(`/api/v1/admin/error-passthrough-rules/${id}`, { method: 'DELETE' });
}

export function listTLSFingerprintProfiles() {
  return adminFetch<TLSFingerprintProfile[]>('/api/v1/admin/tls-fingerprint-profiles');
}

export function createTLSFingerprintProfile(body: Partial<TLSFingerprintProfile> & { name: string }) {
  return adminFetch<TLSFingerprintProfile>('/api/v1/admin/tls-fingerprint-profiles', { method: 'POST', body: JSON.stringify(body) });
}

export function updateTLSFingerprintProfile(id: number, body: Partial<TLSFingerprintProfile>) {
  return adminFetch<TLSFingerprintProfile>(`/api/v1/admin/tls-fingerprint-profiles/${id}`, { method: 'PUT', body: JSON.stringify(body) });
}

export function deleteTLSFingerprintProfile(id: number) {
  return adminFetch<ActionResult>(`/api/v1/admin/tls-fingerprint-profiles/${id}`, { method: 'DELETE' });
}

export function listScheduledTests(accountId: number) {
  return adminFetch<ScheduledTestPlan[]>(`/api/v1/admin/accounts/${accountId}/scheduled-test-plans`);
}

export function createScheduledTest(body: { account_id: number; model_id: string; cron_expression: string; enabled?: boolean; max_results?: number; auto_recover?: boolean }) {
  return adminFetch<ScheduledTestPlan>('/api/v1/admin/scheduled-test-plans', { method: 'POST', body: JSON.stringify(body) });
}

export function updateScheduledTest(id: number, body: Partial<ScheduledTestPlan>) {
  return adminFetch<ScheduledTestPlan>(`/api/v1/admin/scheduled-test-plans/${id}`, { method: 'PUT', body: JSON.stringify(body) });
}

export function deleteScheduledTest(id: number) {
  return adminFetch<ActionResult>(`/api/v1/admin/scheduled-test-plans/${id}`, { method: 'DELETE' });
}

export function listChannelMonitors(search = '', page = 1, pageSize = 20) {
  return adminFetch<PaginatedData<ChannelMonitor>>(`/api/v1/admin/channel-monitors${buildQuery({ page, page_size: pageSize, search: search.trim() })}`);
}

export function createChannelMonitor(body: ChannelMonitorRequest) {
  return adminFetch<ChannelMonitor>('/api/v1/admin/channel-monitors', { method: 'POST', body: JSON.stringify(body) });
}

export function updateChannelMonitor(id: number, body: Partial<ChannelMonitorRequest>) {
  return adminFetch<ChannelMonitor>(`/api/v1/admin/channel-monitors/${id}`, { method: 'PUT', body: JSON.stringify(body) });
}

export function duplicateChannelMonitor(id: number) {
  return adminFetch<ChannelMonitor>(`/api/v1/admin/channel-monitors/${id}/duplicate`, { method: 'POST' }, { idempotencyKey: `monitor-duplicate-${id}-${Date.now()}` });
}

export function deleteChannelMonitor(id: number) {
  return adminFetch<ActionResult>(`/api/v1/admin/channel-monitors/${id}`, { method: 'DELETE' });
}

export function runChannelMonitor(id: number) {
  return adminFetch<{ results: Array<{ model: string; status: string; latency_ms: number | null; message: string }> }>(`/api/v1/admin/channel-monitors/${id}/run`, { method: 'POST' });
}

export function listAffiliateUsers(search = '', page = 1, pageSize = 20) {
  return adminFetch<PaginatedData<AffiliateAdminEntry>>(`/api/v1/admin/affiliates/users${buildQuery({ page, page_size: pageSize, search: search.trim() })}`);
}

export function updateAffiliateUser(userId: number, body: { aff_code?: string; aff_rebate_rate_percent?: number | null; clear_rebate_rate?: boolean }) {
  return adminFetch<{ user_id: number }>(`/api/v1/admin/affiliates/users/${userId}`, { method: 'PUT', body: JSON.stringify(body) });
}

export function listAffiliateRecords(kind: 'invites' | 'rebates' | 'transfers', page = 1, pageSize = 20) {
  return adminFetch<PaginatedData<AffiliateRecord>>(`/api/v1/admin/affiliates/${kind}${buildQuery({ page, page_size: pageSize })}`);
}

export function listOpsAlertEvents() {
  return adminFetch<OpsAlertEvent[]>('/api/v1/admin/ops/alert-events?limit=100&time_range=24h');
}

export function resolveOpsAlertEvent(id: number) {
  return adminFetch<ActionResult>(`/api/v1/admin/ops/alert-events/${id}/status`, { method: 'PUT', body: JSON.stringify({ status: 'manual_resolved' }) });
}

export function listOpsSystemLogs(search = '', page = 1, pageSize = 20) {
  return adminFetch<PaginatedData<OpsSystemLog>>(`/api/v1/admin/ops/system-logs${buildQuery({ page, page_size: pageSize, time_range: '24h', q: search.trim() })}`);
}

const oauthPaths = {
  claude: { generate: '/api/v1/admin/accounts/generate-auth-url', exchange: '/api/v1/admin/accounts/exchange-code' },
  openai: { generate: '/api/v1/admin/openai/generate-auth-url', exchange: '/api/v1/admin/openai/exchange-code' },
  gemini: { generate: '/api/v1/admin/gemini/oauth/auth-url', exchange: '/api/v1/admin/gemini/oauth/exchange-code' },
  antigravity: { generate: '/api/v1/admin/antigravity/oauth/auth-url', exchange: '/api/v1/admin/antigravity/oauth/exchange-code' },
  grok: { generate: '/api/v1/admin/grok/oauth/auth-url', exchange: '/api/v1/admin/grok/oauth/exchange-code' },
} as const;

export type OAuthPlatform = keyof typeof oauthPaths;

export function generateOAuthURL(platform: OAuthPlatform, proxyId?: number) {
  return adminFetch<OAuthSession>(oauthPaths[platform].generate, { method: 'POST', body: JSON.stringify(proxyId ? { proxy_id: proxyId } : {}) });
}

export function exchangeOAuthCode(platform: OAuthPlatform, body: { session_id: string; code: string; state?: string; proxy_id?: number }) {
  return adminFetch<Record<string, unknown>>(oauthPaths[platform].exchange, { method: 'POST', body: JSON.stringify(body) });
}

export function generateAccountAuthURL(
  platform: AccountPlatform,
  type: 'oauth' | 'setup-token',
  body: { proxy_id?: number; project_id?: string } = {}
) {
  if (platform !== 'anthropic' && !(platform in oauthPaths)) throw new Error('此平台使用 API Key 配置，不支持 OAuth');
  const path = platform === 'anthropic'
    ? type === 'setup-token'
      ? '/api/v1/admin/accounts/generate-setup-token-url'
      : '/api/v1/admin/accounts/generate-auth-url'
    : oauthPaths[platform as OAuthPlatform].generate;

  return adminFetch<OAuthSession>(path, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function exchangeAccountAuthCode(
  platform: AccountPlatform,
  type: 'oauth' | 'setup-token',
  body: { session_id: string; code: string; state?: string; proxy_id?: number }
) {
  if (platform !== 'anthropic' && !(platform in oauthPaths)) throw new Error('此平台使用 API Key 配置，不支持 OAuth');
  const path = platform === 'anthropic'
    ? type === 'setup-token'
      ? '/api/v1/admin/accounts/exchange-setup-token-code'
      : '/api/v1/admin/accounts/exchange-code'
    : oauthPaths[platform as OAuthPlatform].exchange;

  return adminFetch<Record<string, unknown>>(path, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
