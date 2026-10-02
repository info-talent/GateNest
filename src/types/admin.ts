export type ApiEnvelope<T> = {
  code: number;
  message: string;
  reason?: string;
  metadata?: Record<string, string>;
  data?: T;
};

export type PaginatedData<T> = {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
};

export type DashboardStats = {
  total_users: number;
  today_new_users: number;
  active_users: number;
  total_api_keys: number;
  active_api_keys: number;
  total_accounts: number;
  normal_accounts: number;
  error_accounts: number;
  total_requests: number;
  total_cost: number;
  total_tokens: number;
  today_requests: number;
  today_cost: number;
  today_tokens: number;
  today_input_tokens?: number;
  today_output_tokens?: number;
  today_cache_read_tokens?: number;
  rpm: number;
  tpm: number;
};

export type TrendPoint = {
  date: string;
  requests: number;
  input_tokens: number;
  output_tokens: number;
  cache_creation_tokens: number;
  cache_read_tokens: number;
  total_tokens: number;
  cost: number;
  actual_cost: number;
};

export type DashboardTrend = {
  start_date: string;
  end_date: string;
  granularity: 'day' | 'hour' | string;
  trend: TrendPoint[];
};

export type ModelStat = {
  model: string;
  requests: number;
  input_tokens: number;
  output_tokens: number;
  cache_creation_tokens: number;
  cache_read_tokens: number;
  total_tokens: number;
  cost: number;
  actual_cost: number;
};

export type DashboardModelStats = {
  start_date: string;
  end_date: string;
  models: ModelStat[];
};

export type UsageStats = {
  total_requests?: number;
  total_tokens?: number;
  total_input_tokens?: number;
  total_output_tokens?: number;
  total_cost?: number;
  total_actual_cost?: number;
  total_account_cost?: number;
  average_duration_ms?: number;
};

export type DashboardSnapshot = {
  trend?: TrendPoint[];
  models?: ModelStat[];
  groups?: Array<{
    group_id?: number;
    group_name?: string;
    requests?: number;
    total_tokens?: number;
    total_cost?: number;
    total_actual_cost?: number;
  }>;
};

export type AdminSettings = {
  site_name?: string;
  site_subtitle?: string;
  registration_enabled?: boolean;
  email_verify_enabled?: boolean;
  password_reset_enabled?: boolean;
  invitation_code_enabled?: boolean;
  promo_code_enabled?: boolean;
  default_balance?: number;
  default_concurrency?: number;
  default_user_rpm_limit?: number;
  payment_enabled?: boolean;
  risk_control_enabled?: boolean;
  available_channels_enabled?: boolean;
  allow_user_view_error_requests?: boolean;
  turnstile_enabled?: boolean;
  turnstile_site_key?: string;
  turnstile_secret_key_configured?: boolean;
  turnstile_secret_key?: string;
  tencent_captcha_enabled?: boolean;
  tencent_captcha_app_id?: string;
  tencent_captcha_app_secret_key_configured?: boolean;
  tencent_captcha_cloud_secret_id_configured?: boolean;
  tencent_captcha_cloud_secret_key_configured?: boolean;
  tencent_captcha_app_secret_key?: string;
  tencent_captcha_cloud_secret_id?: string;
  tencent_captcha_cloud_secret_key?: string;
  aliyun_captcha_enabled?: boolean;
  aliyun_captcha_access_key_id?: string;
  aliyun_captcha_access_key_secret_configured?: boolean;
  aliyun_captcha_access_key_secret?: string;
  aliyun_captcha_scene_id?: string;
  aliyun_captcha_prefix?: string;
  aliyun_captcha_region?: string;
  openai_codex_user_agent?: string;
  openai_codex_client_version?: string;
  openai_codex_client_version_synced?: string;
  openai_codex_version_auto_sync_enabled?: boolean;
  [key: string]: string | number | boolean | null | string[] | undefined;
};

export type AdminUser = {
  id: number;
  email: string;
  username?: string | null;
  balance?: number;
  concurrency?: number;
  rpm_limit?: number;
  status?: string;
  role?: string;
  current_concurrency?: number;
  notes?: string | null;
  last_used_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type UserUsageSummary = {
  total_requests?: number;
  total_tokens?: number;
  total_cost?: number;
  requests?: number;
  tokens?: number;
  cost?: number;
  [key: string]: string | number | boolean | null | undefined;
};

export type AdminApiKey = {
  id: number;
  user_id: number;
  key: string;
  name: string;
  group_id?: number | null;
  status: string;
  quota: number;
  quota_used: number;
  last_used_at?: string | null;
  expires_at?: string | null;
  created_at?: string;
  updated_at?: string;
  usage_5h?: number;
  usage_1d?: number;
  usage_7d?: number;
  ip_whitelist?: string[];
  ip_blacklist?: string[];
  rate_limit_5h?: number;
  rate_limit_1d?: number;
  rate_limit_7d?: number;
  group?: AdminGroup;
  user?: {
    id: number;
    email?: string;
    username?: string | null;
  };
};

export type BalanceOperation = 'set' | 'add' | 'subtract';

export type AdminGroup = {
  id: number;
  name: string;
  description?: string | null;
  platform: string;
  rate_multiplier?: number;
  rpm_limit?: number;
  max_reasoning_effort?: string;
  reasoning_effort_mappings?: ReasoningEffortMapping[];
  is_exclusive?: boolean;
  status?: string;
  subscription_type?: string;
  daily_limit_usd?: number | null;
  weekly_limit_usd?: number | null;
  monthly_limit_usd?: number | null;
  account_count?: number;
  sort_order?: number;
  created_at?: string;
  updated_at?: string;
};

export type AccountTodayStats = {
  requests: number;
  tokens: number;
  cost: number;
  standard_cost?: number;
  user_cost?: number;
};

export type AuthUser = {
  id: number;
  email: string;
  username?: string;
  role: 'admin' | 'user';
  status?: string;
  balance?: number;
};

export type AuthResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  user: AuthUser;
};

export type ApiKeyWriteRequest = {
  name: string;
  group_id?: number | null;
  custom_key?: string;
  status?: 'active' | 'inactive';
  quota?: number;
  expires_in_days?: number;
  ip_whitelist?: string[];
  ip_blacklist?: string[];
  rate_limit_5h?: number;
  rate_limit_1d?: number;
  rate_limit_7d?: number;
};

export type AccountModel = {
  id: string;
  type?: string;
  display_name: string;
  created_at?: string;
};

export type AccountTestRequest = {
  model_id: string;
  prompt?: string;
  mode?: 'default' | 'compact';
};

export type AccountTestResult = {
  success: boolean;
  model: string;
  message: string;
  output?: string;
};

export type AccountUsageProgress = {
  utilization: number;
  resets_at: string | null;
  remaining_seconds: number;
  window_stats?: AccountTodayStats | null;
  used_requests?: number;
  limit_requests?: number;
};

export type AccountUsageInfo = {
  source?: 'passive' | 'active';
  updated_at: string | null;
  five_hour: AccountUsageProgress | null;
  seven_day: AccountUsageProgress | null;
  seven_day_sonnet?: AccountUsageProgress | null;
  seven_day_fable?: AccountUsageProgress | null;
  error?: string;
};

export type OpenAIQuotaUsage = {
  user_id?: string;
  account_id?: string;
  email?: string;
  plan_type?: string;
  rate_limit_reset_credits?: {
    available_count: number;
    credits?: Array<{ expires_at?: string }>;
  } | null;
  fetched_at: number;
};

export type OpenAIQuotaResetResult = {
  code: string;
  credit?: {
    id?: string;
    reset_type?: string;
    status?: string;
    expires_at?: string;
  } | null;
  windows_reset: number;
  quota?: OpenAIQuotaUsage | null;
  account?: AdminAccount | null;
  cache_refreshed: boolean;
  account_state_recovered: boolean;
  warning_code?: 'reset_credit_cache_refresh_failed' | 'account_state_recovery_failed' | 'account_state_refresh_failed';
};

export type OpenAIQuotaRefreshResult = OpenAIQuotaUsage & {
  cache_persisted: boolean;
};

export type AdminAccount = {
  id: number;
  name: string;
  platform: string;
  type: string;
  status?: string;
  schedulable?: boolean;
  rate_limited_at?: string | null;
  rate_limit_reset_at?: string | null;
  overload_until?: string | null;
  temp_unschedulable_until?: string | null;
  temp_unschedulable_reason?: string | null;
  priority?: number;
  concurrency?: number;
  current_concurrency?: number;
  rate_multiplier?: number;
  notes?: string | null;
  error_message?: string;
  quota_limit?: number | null;
  quota_used?: number | null;
  quota_daily_limit?: number | null;
  quota_daily_used?: number | null;
  quota_daily_reset_at?: string | null;
  quota_weekly_limit?: number | null;
  quota_weekly_used?: number | null;
  quota_weekly_reset_at?: string | null;
  updated_at?: string;
  last_used_at?: string | null;
  group_ids?: number[];
  groups?: AdminGroup[];
  parent_account_id?: number | null;
  extra?: Record<string, string | number | boolean | null>;
};

export type AccountPlatform = 'anthropic' | 'openai' | 'gemini' | 'antigravity' | 'grok' | 'kimi' | 'zhipu' | 'deepseek' | 'minimax' | 'opencode_go' | 'typesafe';

export type AccountType = 'oauth' | 'setup-token' | 'apikey' | 'upstream' | 'bedrock' | 'service_account';

export type AdminDataProxy = {
  proxy_key: string;
  name: string;
  protocol: ProxyProtocol;
  host: string;
  port: number;
  username?: string | null;
  password?: string | null;
  status: 'active' | 'inactive';
};

export type AdminDataAccount = {
  name: string;
  notes?: string | null;
  platform: AccountPlatform;
  type: AccountType;
  credentials: Record<string, unknown>;
  extra?: Record<string, unknown>;
  proxy_key?: string | null;
  concurrency: number;
  priority: number;
  rate_multiplier?: number | null;
  expires_at?: number | null;
  auto_pause_on_expired?: boolean;
};

export type AdminDataPayload = {
  type?: string;
  version?: number;
  exported_at: string;
  proxies: AdminDataProxy[];
  accounts: AdminDataAccount[];
  skipped_shadows?: number;
};

export type AdminDataImportError = {
  kind: 'proxy' | 'account';
  name?: string;
  proxy_key?: string;
  message: string;
};

export type AdminDataImportResult = {
  proxy_created: number;
  proxy_reused: number;
  proxy_failed: number;
  account_created: number;
  account_failed: number;
  errors?: AdminDataImportError[];
};

export type CreateAccountRequest = {
  name: string;
  platform: AccountPlatform;
  type: AccountType;
  credentials: Record<string, unknown>;
  extra?: Record<string, unknown>;
  notes?: string | null;
  proxy_id?: number | null;
  concurrency?: number;
  load_factor?: number | null;
  priority?: number;
  rate_multiplier?: number;
  group_ids?: number[];
  expires_at?: number | null;
  auto_pause_on_expired?: boolean;
  upstream_billing_probe_enabled?: boolean;
  confirm_mixed_channel_risk?: boolean;
};

export type CreateUserRequest = {
  email: string;
  password: string;
  username?: string;
  notes?: string;
  role?: 'user' | 'admin';
  status?: 'active' | 'disabled';
  balance?: number;
  concurrency?: number;
  [key: string]: string | number | boolean | null | undefined;
};

export type UpdateUserRequest = {
  email?: string;
  password?: string;
  username?: string;
  notes?: string;
  role?: 'user' | 'admin';
  status?: 'active' | 'disabled';
  concurrency?: number;
  rpm_limit?: number;
  allowed_groups?: number[] | null;
};

export type GroupPlatform = AccountPlatform | 'composite';

export type ReasoningEffortMapping = { from: string; to: string };

export type CreateGroupRequest = {
  name: string;
  description?: string | null;
  platform?: GroupPlatform;
  rate_multiplier?: number;
  is_exclusive?: boolean;
  subscription_type?: 'standard' | 'subscription';
  daily_limit_usd?: number | null;
  weekly_limit_usd?: number | null;
  monthly_limit_usd?: number | null;
  rpm_limit?: number;
  max_reasoning_effort?: string;
  reasoning_effort_mappings?: ReasoningEffortMapping[];
};

export type UpdateGroupRequest = Partial<CreateGroupRequest> & { status?: 'active' | 'inactive' };

export type PaymentOrder = {
  id: number;
  user_id: number;
  amount: number;
  pay_amount: number;
  currency?: string;
  fee_rate: number;
  payment_type: string;
  out_trade_no: string;
  status: 'PENDING' | 'PAID' | 'RECHARGING' | 'COMPLETED' | 'EXPIRED' | 'CANCELLED' | 'FAILED' | 'REFUND_REQUESTED' | 'REFUNDING' | 'REFUND_PENDING' | 'PARTIALLY_REFUNDED' | 'REFUNDED' | 'REFUND_FAILED';
  order_type: 'balance' | 'subscription';
  created_at: string;
  expires_at: string;
  paid_at?: string;
  completed_at?: string;
  refund_amount: number;
  refund_reason?: string;
  refund_requested_at?: string;
  refund_requested_by?: number;
  refund_request_reason?: string;
  plan_id?: number;
  provider_instance_id?: string;
};

export type RefundResult = {
  success: boolean;
  warning?: string;
  require_force?: boolean;
  balance_deducted?: number;
  subscription_days_deducted?: number;
};

export type UpdateAccountRequest = {
  name?: string;
  status?: 'active' | 'inactive';
  notes?: string;
  proxy_id?: number | null;
  concurrency?: number;
  priority?: number;
  rate_multiplier?: number;
  group_ids?: number[];
  credentials?: Record<string, string | number | boolean | null | undefined>;
  extra?: Record<string, string | number | boolean | null | undefined>;
};

export type ActionResult = { message: string };

export type ProxyProtocol = 'http' | 'https' | 'socks5' | 'socks5h';

export type AdminProxy = {
  id: number;
  name: string;
  protocol: ProxyProtocol;
  host: string;
  port: number;
  username: string | null;
  password?: string | null;
  status: 'active' | 'inactive' | 'expired';
  account_count?: number;
  latency_ms?: number;
  latency_status?: 'success' | 'failed';
  latency_message?: string;
  ip_address?: string;
  country?: string;
  country_code?: string;
  region?: string;
  city?: string;
  quality_status?: 'healthy' | 'warn' | 'challenge' | 'failed';
  quality_score?: number;
  quality_grade?: string;
  quality_summary?: string;
  quality_checked?: number;
  expires_at: string | null;
  fallback_mode: 'none' | 'proxy' | 'direct';
  backup_proxy_id?: number | null;
  expiry_warn_days: number;
  created_at: string;
  updated_at: string;
};

export type CreateProxyRequest = {
  name: string;
  protocol: ProxyProtocol;
  host: string;
  port: number;
  username?: string | null;
  password?: string | null;
  expires_at?: number | null;
  fallback_mode?: 'none' | 'proxy' | 'direct';
  backup_proxy_id?: number | null;
  expiry_warn_days?: number;
};

export type UpdateProxyRequest = Partial<CreateProxyRequest> & {
  status?: 'active' | 'inactive';
};

export type ProxyTestResult = {
  success: boolean;
  message: string;
  latency_ms?: number;
  ip_address?: string;
  city?: string;
  region?: string;
  country?: string;
  country_code?: string;
};

export type ProxyQualityCheckResult = {
  proxy_id: number;
  score: number;
  grade: string;
  summary: string;
  exit_ip?: string;
  country?: string;
  country_code?: string;
  base_latency_ms?: number;
  passed_count: number;
  warn_count: number;
  failed_count: number;
  challenge_count: number;
  checked_at: number;
  items: Array<{
    target: string;
    status: 'pass' | 'warn' | 'fail' | 'challenge';
    http_status?: number;
    latency_ms?: number;
    message?: string;
  }>;
};

export type RedeemCodeType = 'balance' | 'concurrency' | 'subscription' | 'invitation';

export type AdminRedeemCode = {
  id: number;
  code: string;
  type: RedeemCodeType;
  value: number;
  status: 'active' | 'used' | 'expired' | 'unused' | 'disabled';
  used_by: number | null;
  used_at: string | null;
  created_at: string;
  expires_at?: string | null;
  updated_at?: string;
  notes?: string;
  group_id?: number | null;
  validity_days?: number;
  user?: AdminUser;
  group?: AdminGroup;
};

export type GenerateRedeemCodesRequest = {
  count: number;
  type: RedeemCodeType;
  value: number;
  group_id?: number | null;
  validity_days?: number;
  expires_at?: string | null;
  expires_in_days?: number;
};

export type RedeemCodeStats = {
  total_codes: number;
  active_codes: number;
  used_codes: number;
  expired_codes: number;
  total_value_distributed: number;
  by_type: Record<RedeemCodeType, number>;
};

export type OpsErrorKind = 'request' | 'upstream';

export type OpsErrorLog = {
  id: number;
  created_at: string;
  phase: string;
  type: string;
  error_owner: string;
  error_source: string;
  severity: string;
  status_code: number;
  platform: string;
  model: string;
  resolved: boolean;
  resolved_at?: string | null;
  client_request_id: string;
  request_id: string;
  message: string;
  user_id?: number | null;
  user_email: string;
  api_key_id?: number | null;
  api_key_name?: string;
  api_key_deleted?: boolean;
  account_id?: number | null;
  account_name: string;
  group_id?: number | null;
  group_name: string;
  client_ip?: string | null;
  request_path?: string;
  stream?: boolean;
  inbound_endpoint?: string;
  upstream_endpoint?: string;
  requested_model?: string;
  upstream_model?: string;
};

export type UserSubscription = {
  id: number;
  user_id: number;
  group_id: number;
  status: 'active' | 'expired' | 'revoked' | 'suspended';
  starts_at: string;
  daily_usage_usd: number;
  weekly_usage_usd: number;
  monthly_usage_usd: number;
  daily_window_start: string | null;
  weekly_window_start: string | null;
  monthly_window_start: string | null;
  created_at: string;
  updated_at: string;
  revoked_at?: string | null;
  expires_at: string | null;
  user?: AdminUser;
  group?: AdminGroup;
};

export type AssignSubscriptionRequest = {
  user_id: number;
  group_id: number;
  validity_days?: number;
};

export type AdminChannel = {
  id: number;
  name: string;
  description: string;
  status: 'active' | 'disabled';
  billing_model_source: 'requested' | 'upstream' | 'channel_mapped';
  restrict_models: boolean;
  features_config?: Record<string, unknown>;
  group_ids: number[];
  model_pricing: unknown[];
  model_mapping: Record<string, Record<string, string>>;
  apply_pricing_to_account_stats: boolean;
  account_stats_pricing_rules: unknown[];
  created_at: string;
  updated_at: string;
};

export type CreateChannelRequest = {
  name: string;
  description?: string;
  group_ids?: number[];
  billing_model_source?: 'requested' | 'upstream' | 'channel_mapped';
  restrict_models?: boolean;
};

export type UpdateChannelRequest = Partial<CreateChannelRequest> & {
  status?: 'active' | 'disabled';
};

export type ModerationMode = 'off' | 'observe' | 'pre_block';

export type ContentModerationConfig = {
  enabled: boolean;
  mode: ModerationMode;
  base_url: string;
  model: string;
  api_key_configured: boolean;
  api_key_masked: string;
  timeout_ms: number;
  sample_rate: number;
  all_groups: boolean;
  group_ids: number[];
  record_non_hits: boolean;
  worker_count: number;
  queue_size: number;
  block_status: number;
  block_message: string;
  email_on_hit: boolean;
  auto_ban_enabled: boolean;
  ban_threshold: number;
  violation_window_hours: number;
  blocked_keywords: string[];
  [key: string]: unknown;
};

export type ContentModerationStatus = {
  enabled: boolean;
  risk_control_enabled: boolean;
  mode: ModerationMode;
  worker_count: number;
  active_workers: number;
  idle_workers: number;
  queue_size: number;
  queue_length: number;
  processed: number;
  errors: number;
  flagged_hash_count: number;
  [key: string]: unknown;
};

export type ContentModerationLog = {
  id: number;
  request_id: string;
  user_id: number | null;
  user_email: string;
  api_key_name: string;
  group_name: string;
  endpoint: string;
  provider: string;
  model: string;
  mode: string;
  action: string;
  flagged: boolean;
  highest_category: string;
  highest_score: number;
  matched_keyword: string;
  input_excerpt: string;
  error: string;
  violation_count: number;
  auto_banned: boolean;
  user_status: string;
  created_at: string;
};

export type AdminComplianceStatus = {
  required: boolean;
  version: string;
  document_path_zh: string;
  document_path_en: string;
  document_url_zh: string;
  document_url_en: string;
  ack_phrase_zh: string;
  ack_phrase_en: string;
  acknowledgement?: {
    version: string;
    document_zh: string;
    document_en: string;
    admin_user_id: number;
    accepted_at: string;
  };
};

export type AuditLog = {
  id: number;
  created_at: string;
  actor_user_id?: number;
  actor_email: string;
  actor_role: string;
  auth_method: string;
  credential_masked: string;
  action: string;
  method: string;
  path: string;
  request_id: string;
  client_ip: string;
  user_agent: string;
  request_body?: string;
  status_code: number;
  latency_ms: number;
  extra?: Record<string, unknown>;
};

export type AdminUsageLog = {
  id: number;
  user_id: number;
  api_key_id: number;
  account_id: number | null;
  request_id: string;
  model: string;
  upstream_model?: string | null;
  service_tier?: string | null;
  reasoning_effort?: string | null;
  inbound_endpoint?: string | null;
  upstream_endpoint?: string | null;
  request_path?: string | null;
  client_ip?: string | null;
  group_id: number | null;
  input_tokens: number;
  output_tokens: number;
  cache_creation_tokens: number;
  cache_read_tokens: number;
  total_cost: number;
  actual_cost: number;
  request_type?: string;
  stream: boolean;
  duration_ms: number | null;
  first_token_ms: number | null;
  billing_mode?: string | null;
  status_code?: number | null;
  platform?: string | null;
  error_message?: string | null;
  created_at: string;
  user?: AdminUser;
  api_key?: AdminApiKey;
  group?: AdminGroup;
  account?: { id: number; name: string };
};

export type AnnouncementStatus = 'draft' | 'active' | 'archived';
export type AnnouncementNotifyMode = 'silent' | 'popup';

export type AdminAnnouncement = {
  id: number;
  title: string;
  content: string;
  status: AnnouncementStatus;
  notify_mode: AnnouncementNotifyMode;
  targeting: { any_of?: Array<{ all_of?: unknown[] }> };
  starts_at?: string | null;
  ends_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type AnnouncementRequest = {
  title: string;
  content: string;
  status?: AnnouncementStatus;
  notify_mode?: AnnouncementNotifyMode;
  targeting: { any_of?: Array<{ all_of?: unknown[] }> };
};

export type PromoCode = {
  id: number;
  code: string;
  bonus_amount: number;
  max_uses: number;
  used_count: number;
  status: 'active' | 'disabled';
  expires_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type PromoCodeRequest = {
  code?: string;
  bonus_amount: number;
  max_uses?: number;
  expires_at?: number | null;
  notes?: string;
  status?: 'active' | 'disabled';
};

export type PromptAuditConfig = {
  enabled: boolean;
  blocking_enabled: boolean;
  store_pass_events: boolean;
  effective_mode: 'off' | 'async_audit' | 'blocking';
  worker_count: number;
  queue_capacity: number;
  scanners: string[];
  all_groups: boolean;
  group_ids: number[];
  endpoints: Array<{
    id: string;
    name: string;
    protocol: 'openai_compatible';
    base_url: string;
    model: string;
    timeout_ms: number;
    input_limit: number;
    enabled: boolean;
    has_token: boolean;
    token_status: string;
  }>;
  config_version: number;
  updated_at: string;
  change_summary: string;
};

export type PromptAuditRuntime = {
  process_status: string;
  effective_mode: string;
  worker_total: number;
  worker_active: number;
  queue_capacity: number;
  queue: Record<string, number>;
  processed_total: number;
  failed_total: number;
  dropped_total: number;
  database_status: string;
  redis_status: string;
  last_error_message?: string;
};

export type PromptAuditEvent = {
  id: number;
  decision: 'pass' | 'flag' | 'critical';
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  action: string;
  categories: string[];
  latency_ms: number;
  created_at: string;
  snapshot: {
    request_id: string;
    user_email: string;
    group_name: string;
    provider: string;
    model: string;
    redacted_preview: string;
  };
};

export type BackupRecord = {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  backup_type: string;
  file_name: string;
  size_bytes: number;
  triggered_by: string;
  error_message?: string;
  started_at: string;
  finished_at?: string;
  restore_status?: string;
};

export type BackupSchedule = {
  enabled: boolean;
  cron_expr: string;
  retain_days: number;
  retain_count: number;
};

export type BackupAgentHealth = {
  enabled: boolean;
  reason: string;
  socket_path: string;
  agent?: { status: string; version: string; uptime_seconds: number };
};

export type BackupJob = {
  job_id: string;
  backup_type: 'postgres' | 'redis' | 'full';
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'partial_succeeded';
  triggered_by: string;
  started_at?: string;
  finished_at?: string;
  error_message?: string;
  artifact?: { local_path: string; size_bytes: number; sha256: string };
};

export type SystemVersionInfo = {
  current_version: string;
  latest_version: string;
  has_update: boolean;
  cached: boolean;
  warning?: string;
  build_type: string;
  release_info?: { name: string; body: string; published_at: string; html_url: string };
};

export type UserAttributeDefinition = {
  id: number;
  key: string;
  name: string;
  description: string;
  type: 'text' | 'number' | 'select' | 'boolean' | string;
  required: boolean;
  placeholder: string;
  display_order: number;
  enabled: boolean;
  options: Array<{ label: string; value: string }>;
  validation: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type UserAttributeRequest = {
  key: string;
  name: string;
  description?: string;
  type: string;
  required?: boolean;
  placeholder?: string;
  display_order?: number;
  enabled?: boolean;
  options?: Array<{ label: string; value: string }>;
};

export type ErrorPassthroughRule = {
  id: number;
  name: string;
  enabled: boolean;
  priority: number;
  error_codes: number[];
  keywords: string[];
  match_mode: 'any' | 'all';
  platforms: string[];
  passthrough_code: boolean;
  response_code: number | null;
  passthrough_body: boolean;
  custom_message: string | null;
  skip_monitoring: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type TLSFingerprintProfile = {
  id: number;
  name: string;
  description: string | null;
  enable_grease: boolean;
  cipher_suites: number[];
  curves: number[];
  point_formats: number[];
  signature_algorithms: number[];
  alpn_protocols: string[];
  supported_versions: number[];
  key_share_groups: number[];
  psk_modes: number[];
  extensions: number[];
  created_at: string;
  updated_at: string;
};

export type ScheduledTestPlan = {
  id: number;
  account_id: number;
  model_id: string;
  cron_expression: string;
  enabled: boolean;
  max_results: number;
  auto_recover: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ChannelMonitor = {
  id: number;
  name: string;
  provider: 'openai' | 'anthropic' | 'gemini' | 'grok';
  api_mode: 'chat_completions' | 'responses';
  endpoint: string;
  primary_model: string;
  extra_models: string[];
  group_name: string;
  enabled: boolean;
  interval_seconds: number;
  jitter_seconds: number;
  last_checked_at: string | null;
  primary_status: string;
  primary_latency_ms: number | null;
  availability_7d: number;
  created_at: string;
  updated_at: string;
};

export type ChannelMonitorRequest = {
  name: string;
  provider: 'openai' | 'anthropic' | 'gemini' | 'grok';
  api_mode?: 'chat_completions' | 'responses';
  endpoint: string;
  api_key: string;
  primary_model: string;
  extra_models?: string[];
  group_name?: string;
  enabled?: boolean;
  interval_seconds: number;
  jitter_seconds?: number;
};

export type AffiliateAdminEntry = {
  user_id: number;
  email: string;
  username: string;
  aff_code: string;
  aff_code_custom: boolean;
  aff_rebate_rate_percent?: number | null;
  aff_count: number;
};

export type AffiliateRecord = {
  inviter_id?: number;
  inviter_email?: string;
  invitee_id?: number;
  invitee_email?: string;
  user_id?: number;
  user_email?: string;
  order_id?: number;
  amount?: number;
  rebate_amount?: number;
  total_rebate?: number;
  created_at: string;
};

export type OpsAlertEvent = {
  id: number;
  rule_id: number;
  severity: string;
  status: string;
  title?: string;
  description?: string;
  metric_value?: number;
  threshold_value?: number;
  fired_at: string;
  resolved_at?: string | null;
  email_sent: boolean;
  created_at: string;
};

export type OpsSystemLog = {
  id: number;
  created_at: string;
  host: string;
  level: string;
  component: string;
  message: string;
  request_id?: string;
  client_request_id?: string;
  user_id?: number | null;
  api_key_id?: number | null;
  account_id?: number | null;
  platform?: string;
  model?: string;
  extra?: Record<string, unknown>;
};

export type OAuthSession = {
  auth_url: string;
  session_id: string;
  state?: string;
};
