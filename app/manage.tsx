import { router } from 'expo-router';
import { Activity, AlertTriangle, BadgeDollarSign, BadgePercent, Blocks, Braces, ChevronRight, ClipboardCheck, DatabaseBackup, FileJson, Github, KeyRound, Languages, ListPlus, LogOut, Megaphone, MessageCircle, Network, RadioTower, Route, ScanSearch, ScrollText, Server, Settings2, Share2, ShieldCheck, Siren, Ticket, Timer, UsersRound, Waypoints, Wrench } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { ScreenShell } from '@/src/components/screen-shell';
import { Text, localizedAlert } from '@/src/components/localized-text';
import { LocalizedStackScreen } from '@/src/components/localized-navigation';
import { queryClient } from '@/src/lib/query-client';
import { adminConfigState, isAdminSession, logoutAdminAccount } from '@/src/store/admin-config';
import { languageState, setAppLanguage } from '@/src/store/ui-preferences';

const { useSnapshot } = require('valtio/react');

const modules = [
  { title: '功能中心', detail: '完整管理模块、个人资料、安全、用量和支付入口', route: '/feature-center', icon: Blocks },
  { title: '账号操作', detail: '导入和导出官方兼容的账号 JSON 数据', route: '/account-data', icon: FileJson, admin: true },
  { title: '代理管理', detail: '维护出口代理，执行连通性与质量检测', route: '/proxies', icon: Network, admin: true },
  { title: '兑换码', detail: '批量生成余额、并发、订阅和邀请码', route: '/redeem', icon: Ticket, admin: true },
  { title: '错误中心', detail: '查看请求错误与上游错误并标记处理状态', route: '/ops-errors', icon: AlertTriangle, admin: true },
  { title: '订阅管理', detail: '分配、延期、重置额度和撤销用户订阅', route: '/subscriptions', icon: UsersRound, admin: true },
  { title: '支付订单', detail: '检索支付订单、退款并处理强制退款确认', route: '/payment-orders', icon: BadgeDollarSign, admin: true },
  { title: '渠道管理', detail: '维护可用渠道与分组绑定', route: '/channels', icon: Waypoints, admin: true },
  { title: '风控中心', detail: '配置内容审核并查看命中记录', route: '/risk-control', icon: ShieldCheck, admin: true },
  { title: '系统设置', detail: '管理注册、默认额度和业务功能开关', route: '/system-settings', icon: Settings2, admin: true },
  { title: '合规确认', detail: '查看当前部署合规状态并完成确认', route: '/compliance', icon: ClipboardCheck, admin: true },
  { title: '操作审计', detail: '追踪管理端变更、操作者和请求结果', route: '/audit-logs', icon: ScrollText, admin: true },
  { title: '使用记录', detail: '查看模型调用、Token、费用与响应耗时', route: '/usage-logs', icon: Activity },
  { title: '公告管理', detail: '创建、发布、归档和删除用户公告', route: '/announcements', icon: Megaphone, admin: true },
  { title: '优惠码', detail: '创建奖励码并管理使用次数与启停状态', route: '/promo-codes', icon: BadgePercent, admin: true },
  { title: '提示词审计', detail: '管理审计策略、运行状态和风险事件', route: '/prompt-audit', icon: ScanSearch, admin: true },
  { title: '备份与数据', detail: '数据库快照、恢复、计划任务和备份代理', route: '/backups', icon: DatabaseBackup, admin: true },
  { title: '系统维护', detail: '检查更新、升级、回滚和重启服务', route: '/system-maintenance', icon: Wrench, admin: true },
  { title: '用户属性', detail: '维护自定义用户字段、启停与显示顺序', route: '/user-attributes', icon: ListPlus, admin: true },
  { title: '流量策略', detail: '错误透传规则与 TLS 指纹配置', route: '/traffic-policies', icon: Route, admin: true },
  { title: '定时测试', detail: '为账号创建定时连通性测试计划', route: '/scheduled-tests', icon: Timer, admin: true },
  { title: '渠道监控', detail: '定时探测外部渠道并查看可用率', route: '/channel-monitors', icon: RadioTower, admin: true },
  { title: '推广返利', detail: '管理推广用户、邀请、返利与划转记录', route: '/affiliates', icon: Share2, admin: true },
  { title: '运维中心', detail: '处理告警事件并检索结构化系统日志', route: '/ops-center', icon: Siren, admin: true },
  { title: 'OAuth 授权', detail: '完成各平台账号授权码与 Token 交换', route: '/oauth-center', icon: KeyRound, admin: true },
  { title: '构建与同步', detail: '手机触发 EAS 构建、下载 APK 和同步上游', route: '/build-center', icon: Blocks, admin: true },
  { title: 'AI 助手', detail: '独立对话、接口诊断并生成受控修复 PR', route: '/ai-assistant', icon: MessageCircle },
  { title: 'GitHub 配置', detail: '保存目标仓库、基础分支和 GitHub Token', route: '/github-settings', icon: Github, admin: true },
  { title: '全部 API', detail: '检索并调用全部 Sub2API 管理端接口', route: '/api-console', icon: Braces, admin: true },
] as const;

export default function ManageScreen() {
  const config = useSnapshot(adminConfigState);
  const admin = isAdminSession();
  const language = useSnapshot(languageState).value as 'zh' | 'en';
  const identity = config.user?.email || (config.authMode === 'admin_key' ? 'Admin Key 管理员' : '已登录用户');
  const role = admin ? '管理员' : '普通用户';
  const availableModules = modules.filter((module) => !('admin' in module) || !module.admin || admin);

  const requestLogout = () => {
    localizedAlert('退出当前账号？', '退出后可在登录页选择已记住的账号，或输入新的账号信息。', [
      { text: '取消', style: 'cancel' },
      {
        text: '退出',
        style: 'destructive',
        onPress: async () => {
          await logoutAdminAccount();
          queryClient.clear();
          router.replace('/login');
        },
      },
    ]);
  };

  return (
    <>
      <LocalizedStackScreen options={{ title: '更多管理', headerShown: true }} />
      <ScreenShell title="更多管理" subtitle="当前登录、语言与 Sub2API 高级管理功能" bottomInsetClassName="pb-8" safeAreaEdges={['bottom']}>
        <View className="rounded-[18px] border border-[#E2E9F3] bg-white p-4 dark:border-[#273449] dark:bg-[#111827]">
          <View className="flex-row items-start gap-3">
            <View className="h-11 w-11 items-center justify-center rounded-2xl bg-[#EAF2FF] dark:bg-[#172C55]">
              <Server size={21} color="#2F6DF6" />
            </View>
            <View className="flex-1">
              <Text className="text-[10px] text-[#7B8798] dark:text-[#9EABC0]">当前登录</Text>
              <Text className="mt-1 text-sm font-bold text-[#172033] dark:text-[#F4F7FB]">{identity}</Text>
              <Text numberOfLines={2} className="mt-1 text-[11px] leading-4 text-[#6B778C] dark:text-[#9EABC0]">{config.baseUrl} · {role}</Text>
            </View>
          </View>
          <Text className="mt-3 text-[11px] leading-5 text-[#6B778C] dark:text-[#9EABC0]">这里只展示当前登录的服务器信息。如需新增或切换账号，请先退出，再到登录页选择或输入账号。</Text>
          <Pressable onPress={requestLogout} className="mt-3 flex-row items-center justify-center gap-2 rounded-2xl bg-[#FFF0F3] py-3 dark:bg-[#3A1720]">
            <LogOut size={16} color="#D9475C" />
            <Text className="text-xs font-bold text-[#D9475C]">退出账号 / 切换账号</Text>
          </Pressable>
        </View>

        <View className="rounded-[18px] border border-[#E2E9F3] bg-white p-4 dark:border-[#273449] dark:bg-[#111827]">
          <View className="flex-row items-center gap-3">
            <View className="h-11 w-11 items-center justify-center rounded-2xl bg-[#EAF2FF] dark:bg-[#172C55]">
              <Languages size={21} color="#2F6DF6" />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-bold text-[#172033] dark:text-[#F4F7FB]">语言</Text>
              <Text className="mt-1 text-[11px] text-[#6B778C] dark:text-[#9EABC0]">切换后立即生效，并在下次启动时保持。</Text>
            </View>
          </View>
          <View className="mt-3 flex-row gap-2">
            {([['zh', '中文'], ['en', 'English']] as const).map(([value, label]) => (
              <Pressable key={value} onPress={() => void setAppLanguage(value)} className={`flex-1 items-center rounded-2xl py-3 ${language === value ? 'bg-[#2F6DF6]' : 'bg-[#F1F5FA] dark:bg-[#182235]'}`}>
                <Text className={`text-xs font-bold ${language === value ? 'text-white' : 'text-[#344054] dark:text-[#D5DDEA]'}`}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {availableModules.map(({ title, detail, route, icon: Icon }) => (
          <Pressable
            key={route}
            onPress={() => router.push(route)}
            className="flex-row items-center gap-4 rounded-[18px] border border-[#E2E9F3] dark:border-[#273449] bg-[#FFFFFF] dark:bg-[#111827] p-4"
          >
            <View className="h-11 w-11 items-center justify-center rounded-2xl bg-[#EAF2FF] dark:bg-[#172C55]">
              <Icon size={21} color="#2F6DF6" />
            </View>
            <View className="flex-1">
              <Text className="text-base font-bold text-[#172033] dark:text-[#F4F7FB]">{title}</Text>
              <Text className="mt-1 text-xs leading-5 text-[#6B778C] dark:text-[#9EABC0]">{detail}</Text>
            </View>
            <ChevronRight size={19} color="#98A2B3" />
          </Pressable>
        ))}
      </ScreenShell>
    </>
  );
}
