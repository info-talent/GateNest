import { useQuery } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { router, usePathname } from 'expo-router';
import {
  Activity,
  Bot,
  ChartNoAxesCombined,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  Clock3,
  FolderKanban,
  Globe2,
  GripVertical,
  Info,
  KeyRound,
  Languages,
  LogOut,
  Moon,
  Network,
  RadioTower,
  RefreshCw,
  Repeat2,
  ScrollText,
  Settings2,
  Shield,
  Siren,
  SlidersHorizontal,
  Sun,
  Users,
} from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Linking, Modal, Platform, Pressable, ScrollView, Vibration, View, type GestureResponderEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Uniwind } from 'uniwind';

import { queryClient } from '@/src/lib/query-client';
import { getServerRootUrl } from '@/src/lib/server-url';
import { getSub2APIReleaseUrl } from '@/src/lib/sub2api-release';
import { useModalActions } from '@/src/hooks/use-modal-actions';
import { ModalSafeAreaView } from '@/src/components/modal-safe-area-view';
import { checkSystemUpdates } from '@/src/services/admin';
import { APP_UPDATE_CHECK_INTERVAL_MS, getLatestAppRelease, isNewerAppVersion } from '@/src/services/app-release';
import { adminConfigState, isAdminSession, logoutAdminAccount } from '@/src/store/admin-config';
import { cliProxyConfigState, hydrateCLIProxyConfig } from '@/src/store/cliproxy-config';
import { applyAppLanguage, defaultUIPreferences, loadUIPreferences, normalizeUIPreferences, saveUIPreferences, type UIPreferences } from '@/src/store/ui-preferences';
import { setWorkspaceMode } from '@/src/store/workspace-mode';
import { Text, localizedAlert } from '@/src/components/localized-text';

const { useSnapshot } = require('valtio/react');
let startupDefaultApplied = false;

type MenuItem = { id: string; title: string; route: string; icon: any; admin?: boolean };

const RAIL_WIDTH = 50;
const MENU_ROW_HEIGHT = 50;
const DRAG_EDGE_SIZE = 28;
const DRAG_SCROLL_STEP = 14;

const items: MenuItem[] = [
  { id: 'feature-center', title: '功能中心', route: '/feature-center', icon: Globe2 },
  { id: 'dashboard', title: '仪表盘', route: '/monitor', icon: ChartNoAxesCombined },
  { id: 'ops', title: '运维监控', route: '/ops-center', icon: Siren, admin: true },
  { id: 'accounts', title: '账号管理', route: '/accounts', icon: CircleUserRound, admin: true },
  { id: 'api-keys', title: 'API 密钥', route: '/api-keys', icon: KeyRound },
  { id: 'proxies', title: '代理管理', route: '/proxies', icon: Network, admin: true },
  { id: 'usage', title: '使用记录', route: '/usage-logs', icon: Activity },
  { id: 'ai', title: 'AI 助手', route: '/ai-assistant', icon: Bot },
  { id: 'users', title: '用户管理', route: '/users', icon: Users, admin: true },
  { id: 'groups', title: '分组管理', route: '/groups', icon: FolderKanban, admin: true },
  { id: 'account-refresh', title: '账号定时刷新', route: '/account-refresh', icon: Clock3, admin: true },
  { id: 'ip', title: 'IP 管理', route: '/ip-management', icon: Shield },
  { id: 'errors', title: '错误中心', route: '/ops-errors', icon: RadioTower, admin: true },
  { id: 'audit', title: '审计日志', route: '/audit-logs', icon: ScrollText, admin: true },
  { id: 'about', title: '关于应用', route: '/about', icon: Info },
  { id: 'manage', title: '更多管理', route: '/manage', icon: SlidersHorizontal },
];

export function AppSidebar() {
  const path = usePathname();
  const config = useSnapshot(adminConfigState);
  useSnapshot(cliProxyConfigState);
  const { visible: expanded, setVisible: setExpanded, runAfterClose, onDismiss } = useModalActions();
  const [customizing, setCustomizing] = useState(false);
  const [selectedId, setSelectedId] = useState<string>();
  const [draggingId, setDraggingId] = useState<string>();
  const draggingIdRef = useRef<string | undefined>(undefined);
  const dragResponderIdRef = useRef<string | undefined>(undefined);
  const [prefs, setPrefs] = useState<UIPreferences>(defaultUIPreferences);
  const [serverVersionRefreshing, setServerVersionRefreshing] = useState(false);
  const prefsRef = useRef<UIPreferences>(defaultUIPreferences);
  const orderRef = useRef<string[]>([]);
  const suppressNavigationRef = useRef<string | undefined>(undefined);
  const menuScrollRef = useRef<ScrollView>(null);
  const menuViewportRef = useRef<View>(null);
  const menuTopRef = useRef(0);
  const menuHeightRef = useRef(0);
  const scrollOffsetRef = useRef(0);
  const dragTranslation = useRef(new Animated.Value(0)).current;
  const rowShiftAnimationsRef = useRef<Record<string, Animated.Value>>({});
  const dragStartPageYRef = useRef(0);
  const dragStartScrollOffsetRef = useRef(0);
  const dragSourceIndexRef = useRef(-1);
  const dragTargetIndexRef = useRef(-1);
  const [dragTargetIndex, setDragTargetIndex] = useState(-1);

  const serverVersionQuery = useQuery({
    queryKey: ['system-version', config.activeAccountId],
    queryFn: () => checkSystemUpdates(false),
    enabled: isAdminSession() && Boolean(config.baseUrl),
    staleTime: 15 * 60_000,
  });
  const appReleaseQuery = useQuery({
    queryKey: ['app-release', 'latest'],
    queryFn: getLatestAppRelease,
    staleTime: APP_UPDATE_CHECK_INTERVAL_MS,
    refetchInterval: APP_UPDATE_CHECK_INTERVAL_MS,
    refetchIntervalInBackground: false,
  });

  useEffect(() => {
    loadUIPreferences().then((next) => {
      prefsRef.current = next;
      setPrefs(next);
      Uniwind.setTheme(next.colorMode);
      if (!startupDefaultApplied && config.baseUrl) {
        startupDefaultApplied = true;
        const target = items.find((item) => item.id === next.defaultMenuId && (!item.admin || isAdminSession()));
        if (target && path !== target.route) router.replace(target.route as never);
      }
    });
  }, [config.baseUrl]);

  useEffect(() => {
    if (!expanded) {
      setCustomizing(false);
      setSelectedId(undefined);
      setDraggingId(undefined);
      draggingIdRef.current = undefined;
      dragResponderIdRef.current = undefined;
      dragSourceIndexRef.current = -1;
      dragTargetIndexRef.current = -1;
      setDragTargetIndex(-1);
      dragTranslation.setValue(0);
      Object.values(rowShiftAnimationsRef.current).forEach((value) => {
        value.stopAnimation();
        value.setValue(0);
      });
    }
  }, [expanded]);

  const allowed = useMemo(
    () => items
      .filter((item) => !item.admin || isAdminSession())
      .sort((left, right) => {
        if (left.id === 'manage') return 1;
        if (right.id === 'manage') return -1;
        if (left.id === prefs.defaultMenuId) return -1;
        if (right.id === prefs.defaultMenuId) return 1;
        const leftIndex = prefs.menuOrder.indexOf(left.id);
        const rightIndex = prefs.menuOrder.indexOf(right.id);
        return (leftIndex < 0 ? 999 : leftIndex) - (rightIndex < 0 ? 999 : rightIndex);
      }),
    [prefs, config.authMode, config.user?.role],
  );
  const visibleItems = allowed.filter((item) => !prefs.hiddenMenuIds.includes(item.id));
  const dark = prefs.colorMode === 'dark';
  const language = prefs.language;
  const currentServerVersion = serverVersionQuery.data?.current_version || '-';
  const latestServerVersion = serverVersionQuery.data?.latest_version;
  const hasServerUpdate = Boolean(serverVersionQuery.data?.has_update && latestServerVersion);
  const serverUpdateWarningVisible = Boolean(
    hasServerUpdate
    && !prefs.serverUpdatePromptsDisabled
    && latestServerVersion
    && !prefs.dismissedServerUpdateVersions.includes(latestServerVersion),
  );
  const latestAppVersion = appReleaseQuery.data?.tag_name;
  const hasAppUpdate = Boolean(latestAppVersion && isNewerAppVersion(latestAppVersion, Constants.expoConfig?.version ?? '1.8.3'));
  const appUpdateWarningVisible = Boolean(
    hasAppUpdate
    && !prefs.appUpdatePromptsDisabled
    && latestAppVersion
    && !prefs.dismissedAppUpdateVersions.includes(latestAppVersion),
  );

  if (path === '/login' || !config.baseUrl) return null;

  const update = (next: UIPreferences) => {
    const normalized = normalizeUIPreferences(next);
    prefsRef.current = normalized;
    setPrefs(normalized);
    saveUIPreferences(normalized).catch(() => undefined);
  };

  const toggleColorMode = () => {
    const colorMode = dark ? 'light' : 'dark';
    Uniwind.setTheme(colorMode);
    update({ ...prefsRef.current, colorMode });
  };

  const selectLanguage = (nextLanguage: 'zh' | 'en') => {
    if (nextLanguage === prefsRef.current.language) return;
    applyAppLanguage(nextLanguage);
    update({ ...prefsRef.current, language: nextLanguage });
  };

  const openServerVersionDetails = () => runAfterClose(() => {
    const latest = latestServerVersion || currentServerVersion;
    const releaseUrl = getSub2APIReleaseUrl(serverVersionQuery.data);
    const releaseButtons = releaseUrl ? [{
      text: '查看更新内容',
      onPress: () => void Linking.openURL(releaseUrl).catch(() => localizedAlert('无法打开链接', releaseUrl)),
    }] : [];
    const message = `当前版本：${currentServerVersion}\n最新版本：${latest}\n更新状态：${hasServerUpdate ? '发现新版本' : '当前已是最新版本'}`;
    if (!hasServerUpdate) {
      localizedAlert('服务端版本', message, [{ text: '确定' }, ...releaseButtons]);
      return;
    }
    if (prefs.serverUpdatePromptsDisabled) {
      localizedAlert('服务端版本', `${message}\n\n所有版本的升级提示已关闭。`, [
        { text: '取消', style: 'cancel' },
        ...releaseButtons,
        { text: '重新开启提示', onPress: () => update({ ...prefsRef.current, serverUpdatePromptsDisabled: false, dismissedServerUpdateVersions: [] }) },
      ]);
      return;
    }
    if (latestServerVersion && prefs.dismissedServerUpdateVersions.includes(latestServerVersion)) {
      localizedAlert('服务端版本', `${message}\n\n此版本的升级提示已忽略。`, [
        { text: '取消', style: 'cancel' },
        ...releaseButtons,
        { text: '恢复此版本提示', onPress: () => update({ ...prefsRef.current, dismissedServerUpdateVersions: prefsRef.current.dismissedServerUpdateVersions.filter((version) => version !== latestServerVersion) }) },
      ]);
      return;
    }
    localizedAlert('服务端版本', message, [
      { text: '取消', style: 'cancel' },
      ...releaseButtons,
      { text: '忽略此版本', onPress: () => update({ ...prefsRef.current, dismissedServerUpdateVersions: [...prefsRef.current.dismissedServerUpdateVersions, latest] }) },
      { text: '关闭全部提示', onPress: () => update({ ...prefsRef.current, serverUpdatePromptsDisabled: true }) },
    ]);
  });

  const refreshServerVersion = async () => {
    if (serverVersionRefreshing) return;
    setServerVersionRefreshing(true);
    try {
      const data = await checkSystemUpdates(true);
      queryClient.setQueryData(['system-version', config.activeAccountId], data);
    } catch (error) {
      runAfterClose(() => localizedAlert('刷新失败', error instanceof Error ? error.message : '暂时无法刷新服务端版本'));
    } finally {
      setServerVersionRefreshing(false);
    }
  };

  const openWebsite = async () => {
    const url = getServerRootUrl(config.baseUrl);
    setExpanded(false);
    try {
      await Linking.openURL(url);
    } catch {
      localizedAlert('无法打开网站', `请检查服务器地址：${url}`);
    }
  };

  const requestLogout = () => runAfterClose(() => {
    localizedAlert('退出当前账号？', '退出后将返回登录页；已记住的账号仍可在登录页快速选择，未记住的信息会被清除。', [
      { text: '取消', style: 'cancel' },
      {
        text: '退出',
        style: 'destructive',
        onPress: async () => {
          setExpanded(false);
          await logoutAdminAccount();
          queryClient.clear();
          router.replace('/login');
        },
      },
    ]);
  });

  const confirmSwitchToCLIProxy = () => runAfterClose(() => localizedAlert(
    '切换到 CLIProxyAPI？',
    '将离开当前 Sub2API 工作区并只显示 CLIProxyAPI 页面。两边的连接信息和数据都会保留。',
    [
      { text: '取消', style: 'cancel' },
      { text: '确认切换', onPress: () => void switchToCLIProxy().catch((error) => localizedAlert('切换失败', error instanceof Error ? error.message : '无法保存工作区设置')) },
    ],
  ));

  const switchToCLIProxy = async () => {
    await hydrateCLIProxyConfig();
    await setWorkspaceMode('cliproxy');
    setExpanded(false);
    if (cliProxyConfigState.baseUrl && cliProxyConfigState.managementKey) {
      router.replace('/cliproxy');
      return;
    }
    router.replace('/login');
  };

  const navigateTo = (item: MenuItem) => {
    if (suppressNavigationRef.current === item.id) {
      suppressNavigationRef.current = undefined;
      if (draggingIdRef.current === item.id) finishDrag(item.id);
      return;
    }
    if (customizing) {
      setSelectedId(item.id);
      return;
    }
    setExpanded(false);
    if (path !== item.route) router.replace(item.route as never);
  };

  const getRowShift = (id: string) => {
    if (!rowShiftAnimationsRef.current[id]) rowShiftAnimationsRef.current[id] = new Animated.Value(0);
    return rowShiftAnimationsRef.current[id];
  };

  const createRowShiftAnimations = (draggedId: string, target: number, duration: number) => {
    const source = dragSourceIndexRef.current;
    return orderRef.current
      .filter((id) => id !== draggedId)
      .map((id, index) => {
        const originalIndex = index >= source ? index + 1 : index;
        const shift = source < target && originalIndex > source && originalIndex <= target
          ? -MENU_ROW_HEIGHT
          : source > target && originalIndex >= target && originalIndex < source
            ? MENU_ROW_HEIGHT
            : 0;
        const value = getRowShift(id);
        value.stopAnimation();
        return Animated.timing(value, {
          toValue: shift,
          duration,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        });
      });
  };

  const startDrag = (id: string, event?: GestureResponderEvent) => {
    const pageY = event?.nativeEvent.pageY ?? 0;
    setCustomizing(true);
    setSelectedId(id);
    setDraggingId(id);
    draggingIdRef.current = id;
    suppressNavigationRef.current = id;
    orderRef.current = allowed.map((item) => item.id);
    dragSourceIndexRef.current = orderRef.current.indexOf(id);
    dragTargetIndexRef.current = dragSourceIndexRef.current;
    setDragTargetIndex(dragSourceIndexRef.current);
    dragStartPageYRef.current = pageY;
    dragStartScrollOffsetRef.current = scrollOffsetRef.current;
    dragTranslation.setValue(0);
    orderRef.current.forEach((itemId) => {
      const value = getRowShift(itemId);
      value.stopAnimation();
      value.setValue(0);
    });
    Vibration.vibrate(20);
    requestAnimationFrame(() => {
      menuViewportRef.current?.measureInWindow((_x, y, _width, height) => {
        menuTopRef.current = y;
        menuHeightRef.current = height;
      });
    });
  };

  const dragMenu = (id: string, event: GestureResponderEvent) => {
    if (draggingIdRef.current !== id) return;
    const pageY = event.nativeEvent.pageY;
    let offset = scrollOffsetRef.current;
    const maxOffset = Math.max(0, orderRef.current.length * MENU_ROW_HEIGHT - menuHeightRef.current);
    if (pageY < menuTopRef.current + DRAG_EDGE_SIZE) offset = Math.max(0, offset - DRAG_SCROLL_STEP);
    else if (pageY > menuTopRef.current + menuHeightRef.current - DRAG_EDGE_SIZE) offset = Math.min(maxOffset, offset + DRAG_SCROLL_STEP);
    if (offset !== scrollOffsetRef.current) {
      scrollOffsetRef.current = offset;
      menuScrollRef.current?.scrollTo({ y: offset, animated: false });
    }
    const source = dragSourceIndexRef.current;
    if (source < 0) return;
    const rawTranslation = pageY - dragStartPageYRef.current + offset - dragStartScrollOffsetRef.current;
    const translation = Math.max(-source * MENU_ROW_HEIGHT, Math.min((orderRef.current.length - 1 - source) * MENU_ROW_HEIGHT, rawTranslation));
    dragTranslation.setValue(translation);
    const target = Math.max(0, Math.min(orderRef.current.length - 1, source + Math.round(translation / MENU_ROW_HEIGHT)));
    if (dragTargetIndexRef.current === target) return;
    dragTargetIndexRef.current = target;
    setDragTargetIndex(target);
    Animated.parallel(createRowShiftAnimations(id, target, 130)).start();
  };

  const finishDrag = (id: string) => {
    if (draggingIdRef.current !== id) return;
    draggingIdRef.current = undefined;
    setTimeout(() => {
      if (suppressNavigationRef.current === id) suppressNavigationRef.current = undefined;
    }, 0);
    const source = dragSourceIndexRef.current;
    const target = dragTargetIndexRef.current;
    const nextOrder = [...orderRef.current];
    if (source >= 0 && target >= 0 && source !== target) {
      nextOrder.splice(source, 1);
      nextOrder.splice(target, 0, id);
    }
    Animated.parallel([
      Animated.timing(dragTranslation, {
        toValue: source >= 0 && target >= 0 ? (target - source) * MENU_ROW_HEIGHT : 0,
        duration: 130,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      ...createRowShiftAnimations(id, target, 130),
    ]).start(() => {
      Object.values(rowShiftAnimationsRef.current).forEach((value) => {
        value.stopAnimation();
        value.setValue(0);
      });
      dragSourceIndexRef.current = -1;
      dragTargetIndexRef.current = -1;
      setDragTargetIndex(-1);
      setDraggingId(undefined);
      dragTranslation.setValue(0);
      update({ ...prefsRef.current, menuOrder: nextOrder });
    });
  };

  const menuRows = (showText: boolean) => allowed.map((item, index) => {
    const hidden = prefs.hiddenMenuIds.includes(item.id);
    if (hidden && !customizing) return null;
    const Icon = item.icon;
    const selected = selectedId === item.id;
    const active = path === item.route || selected;
    const showActiveBackground = active && prefs.defaultMenuId !== item.id;
    const showAppUpdate = item.id === 'about' && appUpdateWarningVisible;
    const dragging = draggingId === item.id;
    const dropTarget = Boolean(draggingId) && dragTargetIndex === index && !dragging;
    const rowShift = getRowShift(item.id);
    return (
      <Animated.View
        key={item.id}
        onMoveShouldSetResponderCapture={() => draggingIdRef.current === item.id}
        onResponderGrant={() => { dragResponderIdRef.current = item.id; }}
        onResponderMove={(event) => dragMenu(item.id, event)}
        onResponderRelease={() => { dragResponderIdRef.current = undefined; finishDrag(item.id); }}
        onResponderTerminate={() => { dragResponderIdRef.current = undefined; finishDrag(item.id); }}
        onResponderTerminationRequest={() => draggingIdRef.current !== item.id}
        style={{ height: MENU_ROW_HEIGHT, flexDirection: 'row', alignItems: 'center', opacity: hidden ? 0.42 : 1, zIndex: dragging ? 20 : 0, transform: [{ translateY: dragging ? dragTranslation : rowShift }] }}
      >
        <Pressable
          accessibilityLabel={item.title}
          delayLongPress={400}
          pressRetentionOffset={{ top: 1000, bottom: 1000, left: 80, right: 80 }}
          onLongPress={(event) => startDrag(item.id, event)}
          onPressOut={() => requestAnimationFrame(() => {
            if (draggingIdRef.current === item.id && dragResponderIdRef.current !== item.id) finishDrag(item.id);
          })}
          onPress={() => navigateTo(item)}
          style={{
            flex: 1,
            height: 44,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: showText ? 'flex-start' : 'center',
            gap: 11,
            borderRadius: 14,
            paddingHorizontal: showText ? 12 : 0,
            borderWidth: dragging || dropTarget ? 1 : 0,
            borderColor: '#2F6DF6',
            backgroundColor: dragging ? (dark ? '#1D386A' : '#DCE9FF') : dropTarget ? (dark ? '#172C55' : '#EEF4FF') : showActiveBackground ? (dark ? '#172C55' : '#E8F0FF') : 'transparent',
            opacity: dragging ? 0.9 : 1,
            transform: [{ scale: dragging ? 1.02 : 1 }],
            zIndex: dragging ? 2 : 0,
          }}
        >
          {showText && customizing ? <GripVertical size={15} color={dark ? '#718096' : '#98A2B3'} /> : null}
          <Icon size={19} color={showAppUpdate ? '#D88A18' : showActiveBackground ? (dark ? '#69A0FF' : '#2F6DF6') : dark ? '#9EABC0' : '#607086'} />
          {showText ? <Text numberOfLines={1} style={{ flex: 1, color: showActiveBackground ? (dark ? '#8BB4FF' : '#2F6DF6') : dark ? '#D5DDEA' : '#263247', fontSize: 13, fontWeight: showActiveBackground ? '800' : '600' }}>{item.title}</Text> : null}
          {showText && showAppUpdate ? <Text style={{ borderRadius: 999, backgroundColor: dark ? '#4A3513' : '#FFF0C2', paddingHorizontal: 7, paddingVertical: 3, fontSize: 8, fontWeight: '800', color: dark ? '#FFD66B' : '#946321' }}>NEW</Text> : null}
          {showText && prefs.defaultMenuId === item.id ? <Text style={{ borderRadius: 999, backgroundColor: dark ? '#24416F' : '#DCE9FF', paddingHorizontal: 7, paddingVertical: 3, fontSize: 8, fontWeight: '800', color: dark ? '#9CC0FF' : '#2F6DF6' }}>DEFAULT</Text> : null}
        </Pressable>
        {showText && customizing ? <Pressable onPress={() => update({ ...prefsRef.current, hiddenMenuIds: hidden ? prefs.hiddenMenuIds.filter((id) => id !== item.id) : [...prefs.hiddenMenuIds, item.id], defaultMenuId: !hidden && prefs.defaultMenuId === item.id ? null : prefs.defaultMenuId })} style={{ minWidth: 44, padding: 8 }}><Text style={{ textAlign: 'center', color: hidden ? '#69A0FF' : '#D9475C', fontSize: 10, fontWeight: '700' }}>{hidden ? '显示' : '隐藏'}</Text></Pressable> : null}
      </Animated.View>
    );
  });

  return (
    <>
      <View style={{ width: RAIL_WIDTH, backgroundColor: dark ? '#0F1726' : '#F7F9FD', borderRightWidth: 1, borderRightColor: dark ? '#273449' : '#E1E8F2' }}>
        <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="展开侧边菜单" hitSlop={6} onPress={() => setExpanded(true)} style={{ height: 48, alignItems: 'center', justifyContent: 'center' }}><View style={{ width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#2F6DF6' }}><Text style={{ color: '#fff', fontSize: 12, fontWeight: '900' }}>S2</Text></View></Pressable>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 5, paddingVertical: 4 }} showsVerticalScrollIndicator={false}>{visibleItems.map((item) => {
            const Icon = item.icon;
            const active = path === item.route;
            const showActiveBackground = active;
            const showAppUpdate = item.id === 'about' && appUpdateWarningVisible;
            return <Pressable key={item.id} accessibilityLabel={item.title} onPress={() => navigateTo(item)} onLongPress={() => { setExpanded(true); setCustomizing(true); setSelectedId(item.id); }} style={{ height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 13, marginBottom: 4, backgroundColor: showActiveBackground ? (dark ? '#172C55' : '#E8F0FF') : 'transparent' }}><Icon size={19} color={showAppUpdate ? '#D88A18' : showActiveBackground ? (dark ? '#69A0FF' : '#2F6DF6') : dark ? '#9EABC0' : '#607086'} />{showAppUpdate ? <Text style={{ position: 'absolute', right: 2, top: 2, borderRadius: 999, backgroundColor: dark ? '#4A3513' : '#FFF0C2', paddingHorizontal: 3, paddingVertical: 1, fontSize: 6, fontWeight: '900', color: dark ? '#FFD66B' : '#946321' }}>NEW</Text> : prefs.defaultMenuId === item.id ? <View style={{ position: 'absolute', right: 5, top: 6, width: 5, height: 5, borderRadius: 3, backgroundColor: '#2F6DF6' }} /> : null}</Pressable>;
          })}</ScrollView>
          <View style={{ borderTopWidth: 1, borderTopColor: dark ? '#273449' : '#E1E8F2', paddingHorizontal: 5, paddingTop: 7 }}>
            <Pressable accessibilityLabel="切换到 CLIProxyAPI" onPress={confirmSwitchToCLIProxy} style={{ height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 13 }}><Repeat2 size={19} color="#2F6DF6" /></Pressable>
            <Pressable accessibilityLabel="退出账号" onPress={requestLogout} style={{ height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 13 }}><LogOut size={19} color="#D9475C" /></Pressable>
            <Pressable accessibilityLabel="展开侧边菜单" onPress={() => setExpanded(true)} style={{ height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: dark ? '#172C55' : '#EAF2FF' }}><ChevronRight size={22} color={dark ? '#8BB4FF' : '#2F6DF6'} /></Pressable>
          </View>
        </SafeAreaView>
      </View>

      <Modal visible={expanded} transparent animationType="fade" onDismiss={onDismiss} onRequestClose={() => setExpanded(false)}>
        <Pressable onPress={() => setExpanded(false)} style={{ flex: 1, backgroundColor: 'rgba(5,10,20,.52)' }}>
          <Pressable onPress={(event) => event.stopPropagation()} style={{ width: '76%', maxWidth: 310, height: '100%', backgroundColor: dark ? '#0F1726' : '#F7F9FD' }}>
            <ModalSafeAreaView>
              <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: dark ? '#273449' : '#E1E8F2' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ flex: 1, fontSize: 18, fontWeight: '800', color: dark ? '#F4F7FB' : '#172033' }}>GateNest · Sub2API</Text>
                  <Pressable accessibilityRole="link" accessibilityLabel="在浏览器打开当前服务器" onPress={() => void openWebsite()} style={{ marginRight: 2, flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 10, backgroundColor: dark ? '#172C55' : '#EAF2FF', paddingHorizontal: 8, paddingVertical: 7 }}><Globe2 size={13} color={dark ? '#8BB4FF' : '#2F6DF6'} /><Text style={{ fontSize: 9, fontWeight: '800', color: dark ? '#8BB4FF' : '#2F6DF6' }}>WEBSITE</Text></Pressable>
                  <Pressable accessibilityLabel="自定义菜单" onPress={() => { setCustomizing((value) => !value); setSelectedId(undefined); }} style={{ padding: 9 }}><Settings2 size={19} color={customizing ? '#69A0FF' : dark ? '#9EABC0' : '#738095'} /></Pressable>
                </View>
                <View style={{ marginTop: 7, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 10, color: dark ? '#9EABC0' : '#738095' }}>{isAdminSession() ? '管理员' : '普通用户'}</Text>
                  {isAdminSession() ? (
                    <View style={{ flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Text style={{ fontSize: 9, color: dark ? '#9EABC0' : '#738095' }}>· Version:</Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="查看服务端版本"
                        onPress={openServerVersionDetails}
                        style={{ maxWidth: 104, flexShrink: 1, borderRadius: 999, backgroundColor: serverUpdateWarningVisible ? (dark ? '#4A3513' : '#FFF0C2') : (dark ? '#1A2638' : '#EEF3F9'), paddingHorizontal: 9, paddingVertical: 4 }}
                      >
                        <Text numberOfLines={1} style={{ fontSize: 9, fontWeight: '800', color: serverUpdateWarningVisible ? (dark ? '#FFD66B' : '#946321') : (dark ? '#D5DDEA' : '#4B5A70') }}>{currentServerVersion}</Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="刷新服务端版本"
                        accessibilityState={{ disabled: serverVersionRefreshing, busy: serverVersionRefreshing }}
                        disabled={serverVersionRefreshing}
                        hitSlop={6}
                        onPress={() => void refreshServerVersion()}
                        style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: dark ? '#1A2638' : '#EEF3F9', opacity: serverVersionRefreshing ? 0.55 : 1 }}
                      >
                        <RefreshCw size={12} color={dark ? '#8BB4FF' : '#2F6DF6'} />
                      </Pressable>
                    </View>
                  ) : null}
                </View>
                <Pressable accessibilityRole="switch" accessibilityState={{ checked: dark }} onPress={toggleColorMode} style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', borderRadius: 14, backgroundColor: dark ? '#1A2638' : '#EEF3F9', paddingHorizontal: 12, paddingVertical: 9 }}><View style={{ width: 26 }}>{dark ? <Moon size={17} color="#69A0FF" /> : <Sun size={17} color="#2F6DF6" />}</View><Text style={{ flex: 1, fontSize: 11, fontWeight: '700', color: dark ? '#F4F7FB' : '#344054' }}>深色模式</Text><View style={{ width: 42, height: 24, borderRadius: 12, padding: 3, backgroundColor: dark ? '#2F6DF6' : '#CBD5E1' }}><View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff', alignSelf: dark ? 'flex-end' : 'flex-start' }} /></View></Pressable>
                <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', borderRadius: 14, backgroundColor: dark ? '#1A2638' : '#EEF3F9', paddingHorizontal: 12, paddingVertical: 7 }}>
                  <View style={{ width: 26 }}><Languages size={17} color={dark ? '#69A0FF' : '#2F6DF6'} /></View>
                  <Text style={{ flex: 1, fontSize: 11, fontWeight: '700', color: dark ? '#F4F7FB' : '#344054' }}>语言</Text>
                  <View style={{ flexDirection: 'row', borderRadius: 10, backgroundColor: dark ? '#111B2B' : '#DDE5EF', padding: 2 }}>
                    {([['zh', '中文'], ['en', 'English']] as const).map(([value, label]) => {
                      const selected = language === value;
                      return <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={value === 'zh' ? '切换为中文' : 'Switch to English'} onPress={() => selectLanguage(value)} style={{ minWidth: 48, alignItems: 'center', borderRadius: 8, backgroundColor: selected ? '#2F6DF6' : 'transparent', paddingHorizontal: 7, paddingVertical: 5 }}><Text style={{ fontSize: 9, fontWeight: '800', color: selected ? '#FFFFFF' : dark ? '#9EABC0' : '#607086' }}>{label}</Text></Pressable>;
                    })}
                  </View>
                </View>
              </View>

              <View ref={menuViewportRef} style={{ flex: 1 }}>
                <ScrollView ref={menuScrollRef} scrollEnabled={!customizing} onScroll={(event) => { scrollOffsetRef.current = event.nativeEvent.contentOffset.y; }} scrollEventThrottle={16} contentContainerStyle={{ paddingHorizontal: 10, paddingVertical: 6 }} showsVerticalScrollIndicator={false}>
                  {menuRows(true)}
                </ScrollView>
              </View>

              <View style={{ borderTopWidth: 1, borderTopColor: dark ? '#273449' : '#E1E8F2', paddingHorizontal: 12, paddingTop: 10 }}>
                {customizing ? <View style={{ marginBottom: 8 }}>
                  {selectedId ? <Pressable onPress={() => update({ ...prefsRef.current, defaultMenuId: prefs.defaultMenuId === selectedId ? null : selectedId })} style={{ alignItems: 'center', borderRadius: 13, backgroundColor: prefs.defaultMenuId === selectedId ? '#FFF0F3' : dark ? '#172C55' : '#EAF2FF', paddingVertical: 9 }}><Text style={{ fontSize: 11, fontWeight: '800', color: prefs.defaultMenuId === selectedId ? '#D9475C' : dark ? '#8BB4FF' : '#2F6DF6' }}>{prefs.defaultMenuId === selectedId ? '取消默认启动页面' : '设为默认启动页面'}</Text></Pressable> : null}
                  <Text style={{ marginTop: 7, textAlign: 'center', fontSize: 10, lineHeight: 15, color: dark ? '#9EABC0' : '#7B8798' }}>长按菜单并拖到目标位置，松手后自动保存。</Text>
                </View> : null}
                <Pressable onPress={confirmSwitchToCLIProxy} style={{ height: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 13, backgroundColor: dark ? '#172C55' : '#EAF2FF' }}><Repeat2 size={17} color="#2F6DF6" /><Text style={{ color: '#2F6DF6', fontSize: 12, fontWeight: '800' }}>切换到 CLIProxyAPI</Text></Pressable>
                <Pressable onPress={requestLogout} style={{ height: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 13 }}><LogOut size={17} color="#D9475C" /><Text style={{ color: '#D9475C', fontSize: 12, fontWeight: '800' }}>退出账号</Text></Pressable>
                <Pressable accessibilityLabel="收起侧边菜单" onPress={() => setExpanded(false)} style={{ height: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 13, backgroundColor: dark ? '#172C55' : '#EAF2FF' }}><ChevronLeft size={22} color={dark ? '#8BB4FF' : '#2F6DF6'} /><Text style={{ color: dark ? '#8BB4FF' : '#2F6DF6', fontSize: 12, fontWeight: '800' }}>收起菜单</Text></Pressable>
              </View>
            </ModalSafeAreaView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
