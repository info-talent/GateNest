import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AdminButton, AdminChip, AdminField, AdminMessage, AdminSection } from '@/src/components/admin-ui';
import { Text, localizedAlert } from '@/src/components/localized-text';
import { LocalizedStackScreen } from '@/src/components/localized-navigation';
import { getAdminSettings, updateAdminSettings } from '@/src/services/admin';
import type { AdminSettings } from '@/src/types/admin';

type CaptchaProvider = 'none' | 'turnstile' | 'tencent' | 'aliyun';

const switches: Array<{ key: keyof AdminSettings; label: string }> = [
  { key: 'registration_enabled', label: '开放注册' },
  { key: 'email_verify_enabled', label: '邮箱验证' },
  { key: 'password_reset_enabled', label: '密码重置' },
  { key: 'invitation_code_enabled', label: '邀请码' },
  { key: 'promo_code_enabled', label: '优惠码' },
  { key: 'payment_enabled', label: '在线支付' },
  { key: 'risk_control_enabled', label: '全局风控' },
  { key: 'available_channels_enabled', label: '可用渠道' },
  { key: 'allow_user_view_error_requests', label: '用户查看错误' },
];

const secretKeys: Array<keyof AdminSettings> = [
  'turnstile_secret_key',
  'tencent_captcha_app_secret_key',
  'tencent_captcha_cloud_secret_id',
  'tencent_captcha_cloud_secret_key',
  'aliyun_captcha_access_key_secret',
];

function configured(value?: boolean) {
  return value ? '（已配置，留空保持不变）' : '（尚未配置）';
}

export default function SystemSettingsScreen() {
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({ queryKey: ['admin-settings'], queryFn: getAdminSettings });
  const [form, setForm] = useState<Partial<AdminSettings>>({});

  useEffect(() => {
    const source = settingsQuery.data;
    if (!source) return;
    setForm({
      site_name: source.site_name ?? '',
      site_subtitle: source.site_subtitle ?? '',
      default_balance: source.default_balance ?? 0,
      default_concurrency: source.default_concurrency ?? 5,
      default_user_rpm_limit: source.default_user_rpm_limit ?? 0,
      ...Object.fromEntries(switches.map(({ key }) => [key, source[key] === true])),
      turnstile_enabled: source.turnstile_enabled === true,
      turnstile_site_key: source.turnstile_site_key ?? '',
      tencent_captcha_enabled: source.tencent_captcha_enabled === true,
      tencent_captcha_app_id: source.tencent_captcha_app_id ?? '',
      aliyun_captcha_enabled: source.aliyun_captcha_enabled === true,
      aliyun_captcha_access_key_id: source.aliyun_captcha_access_key_id ?? '',
      aliyun_captcha_scene_id: source.aliyun_captcha_scene_id ?? '',
      aliyun_captcha_prefix: source.aliyun_captcha_prefix ?? '',
      aliyun_captcha_region: source.aliyun_captcha_region || 'cn-shanghai',
      openai_codex_user_agent: source.openai_codex_user_agent ?? '',
      openai_codex_client_version: source.openai_codex_client_version ?? '',
      openai_codex_version_auto_sync_enabled: source.openai_codex_version_auto_sync_enabled !== false,
    });
  }, [settingsQuery.data]);

  const captchaProvider = useMemo<CaptchaProvider>(() => {
    if (form.tencent_captcha_enabled) return 'tencent';
    if (form.aliyun_captcha_enabled) return 'aliyun';
    if (form.turnstile_enabled) return 'turnstile';
    return 'none';
  }, [form.aliyun_captcha_enabled, form.tencent_captcha_enabled, form.turnstile_enabled]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = { ...form };
      secretKeys.forEach((key) => {
        if (!String(payload[key] ?? '').trim()) delete payload[key];
      });
      return updateAdminSettings(payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
      localizedAlert('保存成功', '系统设置已与服务端同步。');
    },
    onError: (error) => localizedAlert('保存失败', error instanceof Error ? error.message : '请稍后重试。'),
  });

  const toggle = (key: keyof AdminSettings) => setForm((current) => ({ ...current, [key]: current[key] !== true }));
  const setString = (key: keyof AdminSettings, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const numberField = (key: keyof AdminSettings, value: string) => setForm((current) => ({ ...current, [key]: Number(value) || 0 }));
  const selectCaptchaProvider = (provider: CaptchaProvider) => setForm((current) => ({
    ...current,
    turnstile_enabled: provider === 'turnstile',
    tencent_captcha_enabled: provider === 'tencent',
    aliyun_captcha_enabled: provider === 'aliyun',
  }));
  const source = settingsQuery.data;

  return (
    <SafeAreaView edges={['bottom']} className="flex-1 bg-[#F4F7FC] dark:bg-[#0B1220]">
      <LocalizedStackScreen options={{ title: '系统设置', headerShown: true }} />
      <ScrollView contentContainerClassName="gap-4 px-5 pb-10 pt-4" keyboardShouldPersistTaps="handled">
        <AdminButton label="完整系统配置字段" tone="muted" onPress={() => router.push({ pathname: '/feature-operation', params: { operation: 'PUT /api/v1/admin/settings' } })} />
        <AdminSection title="站点信息">
          <AdminField label="站点名称" value={String(form.site_name ?? '')} onChangeText={(value) => setString('site_name', value)} />
          <AdminField label="站点副标题" value={String(form.site_subtitle ?? '')} onChangeText={(value) => setString('site_subtitle', value)} />
        </AdminSection>

        <AdminSection title="新用户默认值">
          <AdminField label="默认余额" value={String(form.default_balance ?? '')} onChangeText={(value) => numberField('default_balance', value)} keyboardType="decimal-pad" />
          <AdminField label="默认并发" value={String(form.default_concurrency ?? '')} onChangeText={(value) => numberField('default_concurrency', value)} keyboardType="number-pad" />
          <AdminField label="默认 RPM（0 为无限）" value={String(form.default_user_rpm_limit ?? '')} onChangeText={(value) => numberField('default_user_rpm_limit', value)} keyboardType="number-pad" />
        </AdminSection>

        <AdminSection title="功能开关">
          <View className="flex-row flex-wrap gap-2">
            {switches.map(({ key, label }) => <AdminChip key={String(key)} label={label} selected={form[key] === true} onPress={() => toggle(key)} />)}
          </View>
        </AdminSection>

        <AdminSection title="人机验证" detail="与官方一致：Turnstile、腾讯天御和阿里云验证码三选一；关闭表示不启用验证码。">
          <View className="flex-row flex-wrap gap-2">
            {([['none', '关闭'], ['turnstile', 'Turnstile'], ['tencent', '腾讯天御'], ['aliyun', '阿里云 2.0']] as const).map(([value, label]) => (
              <AdminChip key={value} label={label} selected={captchaProvider === value} onPress={() => selectCaptchaProvider(value)} />
            ))}
          </View>
          {captchaProvider === 'turnstile' ? <>
            <AdminField label="Site Key" value={String(form.turnstile_site_key ?? '')} onChangeText={(value) => setString('turnstile_site_key', value)} />
            <AdminField secureTextEntry label={`Secret Key ${configured(source?.turnstile_secret_key_configured)}`} value={String(form.turnstile_secret_key ?? '')} onChangeText={(value) => setString('turnstile_secret_key', value)} />
          </> : null}
          {captchaProvider === 'tencent' ? <>
            <AdminField label="Captcha App ID" value={String(form.tencent_captcha_app_id ?? '')} onChangeText={(value) => setString('tencent_captcha_app_id', value)} keyboardType="number-pad" />
            <AdminField secureTextEntry label={`App Secret Key ${configured(source?.tencent_captcha_app_secret_key_configured)}`} value={String(form.tencent_captcha_app_secret_key ?? '')} onChangeText={(value) => setString('tencent_captcha_app_secret_key', value)} />
            <AdminField secureTextEntry label={`Cloud Secret ID ${configured(source?.tencent_captcha_cloud_secret_id_configured)}`} value={String(form.tencent_captcha_cloud_secret_id ?? '')} onChangeText={(value) => setString('tencent_captcha_cloud_secret_id', value)} />
            <AdminField secureTextEntry label={`Cloud Secret Key ${configured(source?.tencent_captcha_cloud_secret_key_configured)}`} value={String(form.tencent_captcha_cloud_secret_key ?? '')} onChangeText={(value) => setString('tencent_captcha_cloud_secret_key', value)} />
          </> : null}
          {captchaProvider === 'aliyun' ? <>
            <AdminField label="AccessKey ID" value={String(form.aliyun_captcha_access_key_id ?? '')} onChangeText={(value) => setString('aliyun_captcha_access_key_id', value)} />
            <AdminField secureTextEntry label={`AccessKey Secret ${configured(source?.aliyun_captcha_access_key_secret_configured)}`} value={String(form.aliyun_captcha_access_key_secret ?? '')} onChangeText={(value) => setString('aliyun_captcha_access_key_secret', value)} />
            <AdminField label="Scene ID" value={String(form.aliyun_captcha_scene_id ?? '')} onChangeText={(value) => setString('aliyun_captcha_scene_id', value)} />
            <AdminField label="Prefix" value={String(form.aliyun_captcha_prefix ?? '')} onChangeText={(value) => setString('aliyun_captcha_prefix', value)} />
            <Text className="text-xs font-medium text-[#667085] dark:text-[#9EABC0]">服务地域</Text>
            <View className="flex-row gap-2">
              <AdminChip label="中国内地" selected={form.aliyun_captcha_region !== 'ap-southeast-1'} onPress={() => setString('aliyun_captcha_region', 'cn-shanghai')} />
              <AdminChip label="新加坡" selected={form.aliyun_captcha_region === 'ap-southeast-1'} onPress={() => setString('aliyun_captcha_region', 'ap-southeast-1')} />
            </View>
          </> : null}
        </AdminSection>

        <AdminSection title="Codex 客户端身份" detail="自动跟随官方稳定版本；自定义 UA 只保留客户端和系统指纹，版本段由服务端重建。">
          <Pressable onPress={() => toggle('openai_codex_version_auto_sync_enabled')} className={`rounded-2xl px-4 py-3 ${form.openai_codex_version_auto_sync_enabled ? 'bg-[#EAF2FF] dark:bg-[#172C55]' : 'bg-[#E2E9F3] dark:bg-[#273449]'}`}>
            <Text className={`text-xs font-bold ${form.openai_codex_version_auto_sync_enabled ? 'text-[#2F6DF6]' : 'text-[#475467] dark:text-[#C2CCDB]'}`}>{form.openai_codex_version_auto_sync_enabled ? '✓ ' : ''}每 6 小时自动同步稳定版本</Text>
          </Pressable>
          <View className="rounded-2xl bg-[#F6F8FC] p-3 dark:bg-[#152033]">
            <Text className="text-xs text-[#667085] dark:text-[#9EABC0]">当前版本：{source?.openai_codex_client_version || '未设置'}</Text>
            <Text className="mt-1 text-xs text-[#667085] dark:text-[#9EABC0]">最近同步：{source?.openai_codex_client_version_synced || '暂无'}</Text>
          </View>
          <AdminField label="手动版本覆盖（可选）" value={String(form.openai_codex_client_version ?? '')} onChangeText={(value) => setString('openai_codex_client_version', value)} placeholder="例如 0.148.0" />
          <AdminField label="OpenAI Codex User-Agent（可选）" value={String(form.openai_codex_user_agent ?? '')} onChangeText={(value) => setString('openai_codex_user_agent', value)} multiline />
        </AdminSection>

        <AdminMessage error={settingsQuery.error || saveMutation.error} />
        <AdminButton label="保存系统设置" pending={saveMutation.isPending} disabled={!settingsQuery.data} onPress={() => saveMutation.mutate()} />
      </ScrollView>
    </SafeAreaView>
  );
}
