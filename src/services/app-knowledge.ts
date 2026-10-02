import knowledgeJson from '@/src/generated/app-api-knowledge.json';

type ScreenEntry = {
  kind: 'screen';
  title: string;
  app_route: string;
  fields: string[];
  sections: string[];
  placeholders: string[];
};

type ServiceEntry = {
  kind: 'service';
  source_file?: string;
  name: string;
  signature: string;
  method: string;
  endpoints: string[];
};

type TypeEntry = {
  kind: 'type';
  name: string;
  fields: string[];
};

type RouteEntry = {
  kind: 'route';
  method: string;
  path: string;
  handler: string;
};

type UpstreamServiceEntry = {
  kind: 'upstream_service';
  source: string;
  name: string;
  signature: string;
  method: string;
  endpoint: string;
};

type UpstreamTypeEntry = {
  kind: 'upstream_type';
  source: string;
  name: string;
  fields: string[];
};

type UpstreamBackendTypeEntry = {
  kind: 'upstream_backend_type';
  source: string;
  name: string;
  fields: string[];
};

type UpstreamHandlerEntry = {
  kind: 'upstream_handler';
  source: string;
  name: string;
  path_parameters: string[];
  query_parameters: string[];
  request_types: string[];
};

export type AppKnowledgeEntry = ScreenEntry | ServiceEntry | TypeEntry | RouteEntry | UpstreamServiceEntry | UpstreamTypeEntry | UpstreamBackendTypeEntry | UpstreamHandlerEntry;

type KnowledgeIndex = {
  source: string;
  routes_sha256: string;
  counts: { routes: number; services: number; types: number; screens: number; upstream_services?: number; upstream_types?: number; upstream_backend_types?: number; upstream_handlers?: number };
  entries: AppKnowledgeEntry[];
};

export type AppKnowledgeResult = { entry: AppKnowledgeEntry; score: number };

const knowledge = knowledgeJson as KnowledgeIndex;
const routeEntries = knowledge.entries.filter((entry): entry is RouteEntry => entry.kind === 'route');
const serviceEntries = knowledge.entries.filter((entry): entry is ServiceEntry => entry.kind === 'service' && entry.source_file !== 'src/services/official-admin.ts');
const latestRoutesUrl = 'https://raw.githubusercontent.com/Wei-Shaw/sub2api/main/backend/internal/server/routes/admin.go';
const latestRoutesMaxAgeMs = 6 * 60 * 60 * 1000;
let remoteRouteEntries: RouteEntry[] | undefined;
let lastRouteSyncAt = 0;
let lastRouteSyncChanged = false;
const synonyms: Record<string, string[]> = {
  地址: ['url', 'uri', 'endpoint', 'host', 'base_url', 'baseurl'],
  密钥: ['key', 'token', 'secret', 'api_key', 'apikey'],
  额度: ['quota', 'balance', 'limit'],
  余额: ['balance', 'quota'],
  倍率: ['rate', 'ratio', 'multiplier'],
  模型: ['model', 'models'],
  分组: ['group', 'groups'],
  用户: ['user', 'users'],
  账号: ['account', 'accounts'],
  代理: ['proxy', 'proxies'],
  渠道: ['channel', 'channels'],
  订阅: ['subscription', 'subscriptions'],
  日志: ['log', 'logs', 'audit'],
  公告: ['announcement', 'announcements'],
  兑换码: ['redeem', 'redeem-codes'],
  推广: ['affiliate', 'promo'],
  风控: ['risk', 'risk-control'],
  构建: ['build', 'eas', 'apk'],
};

function entryText(entry: AppKnowledgeEntry) {
  if (entry.kind === 'screen') return [entry.title, entry.app_route, ...entry.fields, ...entry.sections, ...entry.placeholders].join(' ');
  if (entry.kind === 'service') return [entry.name, entry.signature, entry.method, ...entry.endpoints].join(' ');
  if (entry.kind === 'type') return [entry.name, ...entry.fields].join(' ');
  if (entry.kind === 'upstream_service') return [entry.source, entry.name, entry.signature, entry.method, entry.endpoint].join(' ');
  if (entry.kind === 'upstream_type') return [entry.source, entry.name, ...entry.fields].join(' ');
  if (entry.kind === 'upstream_backend_type') return [entry.source, entry.name, ...entry.fields].join(' ');
  if (entry.kind === 'upstream_handler') return [entry.source, entry.name, ...entry.path_parameters, ...entry.query_parameters, ...entry.request_types].join(' ');
  return [entry.method, entry.path, entry.handler].join(' ');
}

function searchTokens(query: string) {
  const normalized = query.toLowerCase().replace(/[？?，,。！!：:；;（）()]/g, ' ');
  const tokens = new Set(normalized.split(/\s+/).filter((token) => token.length > 1));
  const compactChinese = normalized.replace(/哪里|在哪|怎么|如何|什么|帮我|查找|找到|这个|那个|是否|可以|参数/g, '');
  for (const phrase of compactChinese.match(/[\u3400-\u9fff]{2,}/g) ?? []) {
    tokens.add(phrase);
    for (let index = 0; index < phrase.length - 1; index += 1) tokens.add(phrase.slice(index, index + 2));
  }
  for (const [term, values] of Object.entries(synonyms)) {
    if (normalized.includes(term)) values.forEach((value) => tokens.add(value));
  }
  return [...tokens];
}

export function searchAppKnowledge(query: string, limit = 12): AppKnowledgeResult[] {
  const normalizedQuery = query.toLowerCase().trim();
  const tokens = searchTokens(query);
  const entries = remoteRouteEntries
    ? [...knowledge.entries.filter((entry) => entry.kind !== 'route'), ...remoteRouteEntries]
    : knowledge.entries;
  return entries
    .map((entry) => {
      const haystack = entryText(entry).toLowerCase();
      let score = normalizedQuery.length > 2 && haystack.includes(normalizedQuery) ? 30 : 0;
      for (const token of tokens) {
        if (!haystack.includes(token)) continue;
        score += Math.min(token.length, 12) * 2;
        if (entry.kind === 'screen' && entry.fields.some((field) => field.toLowerCase().includes(token))) score += 8;
        if (entry.kind === 'type' && entry.fields.some((field) => field.toLowerCase().includes(token))) score += 7;
        if (entry.kind === 'route' && entry.path.toLowerCase().includes(token)) score += 5;
      }
      if (entry.kind === 'screen') score += score ? 3 : 0;
      if (entry.kind === 'service') score += score ? 2 : 0;
      return { entry, score };
    })
    .filter((result) => result.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}

export function formatKnowledgeEntry(entry: AppKnowledgeEntry) {
  if (entry.kind === 'screen') {
    const details = [
      entry.fields.length ? `字段：${entry.fields.join('、')}` : '',
      entry.sections.length ? `栏目：${entry.sections.join('、')}` : '',
    ].filter(Boolean).join('；');
    return `[页面] ${entry.title} | App 路径 ${entry.app_route}${details ? ` | ${details}` : ''}`;
  }
  if (entry.kind === 'service') return `[前端服务] ${entry.name}(${entry.signature}) | ${entry.method} ${entry.endpoints.join('；')}`;
  if (entry.kind === 'type') return `[数据类型] ${entry.name} | 字段：${entry.fields.join('、')}`;
  if (entry.kind === 'upstream_service') return `[上游官方客户端] ${entry.name}(${entry.signature}) | ${entry.method} ${entry.endpoint} | 模块 ${entry.source}`;
  if (entry.kind === 'upstream_type') return `[上游参数类型] ${entry.name} | 字段：${entry.fields.join('、')} | 模块 ${entry.source}`;
  if (entry.kind === 'upstream_backend_type') return `[上游后端请求类型] ${entry.name} | JSON 字段：${entry.fields.join('、')} | 文件 ${entry.source}`;
  if (entry.kind === 'upstream_handler') return `[上游处理器参数] ${entry.name} | 路径：${entry.path_parameters.join('、') || '-'} | 查询：${entry.query_parameters.join('、') || '-'} | 请求类型：${entry.request_types.join('、') || '-'} | 文件 ${entry.source}`;
  return `[后端 API] ${entry.method} ${entry.path} | 处理器 ${entry.handler}`;
}

export function getAppKnowledgeContext(query: string) {
  const results = searchAppKnowledge(query);
  const summary = `当前知识索引包含 ${(remoteRouteEntries ?? routeEntries).length} 条后端路由、${knowledge.counts.services} 个移动端服务、${knowledge.counts.types} 个移动端数据类型、${knowledge.counts.screens} 个页面、${knowledge.counts.upstream_services ?? 0} 个上游官方客户端函数、${knowledge.counts.upstream_types ?? 0} 个上游前端参数类型、${knowledge.counts.upstream_backend_types ?? 0} 个上游后端 JSON 类型、${knowledge.counts.upstream_handlers ?? 0} 个处理器参数映射。`;
  return {
    results,
    text: [
      summary,
      '以下是本地检索结果，只能把这些结果视为 App/API 事实；没有命中时必须明确说本地索引未找到：',
      ...(results.length ? results.map(({ entry }) => formatKnowledgeEntry(entry)) : ['[无匹配结果]']),
    ].join('\n'),
  };
}

export function formatLocalKnowledgeAnswer(query: string) {
  const { results } = getAppKnowledgeContext(query);
  if (!results.length) return '本地 API/页面索引没有找到明确匹配项。配置 AI 后可让模型帮助改写关键词继续检索。';
  return ['我在 App 本地索引中找到：', ...results.slice(0, 6).map(({ entry }) => `• ${formatKnowledgeEntry(entry)}`)].join('\n');
}

export function getAppKnowledgeCounts() {
  return { ...knowledge.counts, routes: (remoteRouteEntries ?? routeEntries).length };
}

function parseLatestAdminRoutes(source: string): RouteEntry[] {
  const groups = new Map([['admin', '/api/v1/admin'], ['v1', '/api/v1']]);
  const routes: RouteEntry[] = [];
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    const group = line.match(/^(\w+)\s*:=\s*(\w+)\.Group\("([^"]*)"\)/);
    if (group) {
      const parentPath = groups.get(group[2]);
      if (parentPath) groups.set(group[1], `${parentPath}${group[3]}`);
      continue;
    }
    const route = line.match(/^(\w+)\.(GET|POST|PUT|PATCH|DELETE)\("([^"]*)"\s*,\s*(.+)\)$/);
    if (!route) continue;
    const prefix = groups.get(route[1]);
    if (!prefix || !`${prefix}${route[3]}`.startsWith('/api/v1/admin/')) continue;
    routes.push({
      kind: 'route',
      method: route[2],
      path: `${prefix}${route[3]}`,
      handler: route[4].split(',').at(-1)?.trim().replace(/\)+$/, '') || '',
    });
  }
  routes.sort((left, right) => left.path.localeCompare(right.path) || left.method.localeCompare(right.method));
  if (routes.length < 100) throw new Error(`上游路由解析结果异常：仅找到 ${routes.length} 条`);
  const unique = new Set(routes.map((route) => `${route.method} ${route.path}`));
  if (unique.size !== routes.length) throw new Error('上游路由包含重复的 Method/Path');
  return routes;
}

export async function syncLatestAdminRoutes(force = false) {
  if (!force && remoteRouteEntries && Date.now() - lastRouteSyncAt < latestRoutesMaxAgeMs) {
    return { routes: remoteRouteEntries, fetchedAt: lastRouteSyncAt, changed: lastRouteSyncChanged, cached: true };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const sources = await Promise.all([latestRoutesUrl, latestRoutesUrl.replace('/admin.go', '/payment.go')].map(async (url) => {
      const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'text/plain' } });
      if (!response.ok) throw new Error(`获取上游 API 失败（HTTP ${response.status}）`);
      return response.text();
    }));
    const routes = parseLatestAdminRoutes(sources.join('\n'));
    remoteRouteEntries = routes;
    lastRouteSyncAt = Date.now();
    const bundledKeys = new Set(routeEntries.map((route) => `${route.method} ${route.path}`));
    const remoteKeys = new Set(routes.map((route) => `${route.method} ${route.path}`));
    const changed = bundledKeys.size !== remoteKeys.size || [...remoteKeys].some((key) => !bundledKeys.has(key));
    lastRouteSyncChanged = changed;
    return { routes, fetchedAt: lastRouteSyncAt, changed, cached: false };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw new Error('获取最新 API 超时（20 秒）');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function canonicalRoute(path: string) {
  return path
    .replace(/:buildQuery[\s\S]*$/, '')
    .replace(/\?.*$/, '')
    .replace(/:[^/]+/g, ':*')
    .replace(/\/$/, '');
}

const dedicatedRoutes = new Set(serviceEntries.flatMap((service) => (
  service.endpoints.map((endpoint) => `${service.method} ${canonicalRoute(endpoint)}`)
)));

export function getAllAdminRoutes() {
  return (remoteRouteEntries ?? routeEntries).map((route, index) => ({
    ...route,
    index,
    dedicated: dedicatedRoutes.has(`${route.method} ${canonicalRoute(route.path)}`),
    transport: route.path.includes('/ws/') ? 'websocket' as const : 'http' as const,
  }));
}

export function getAdminRoute(index: number) {
  return getAllAdminRoutes()[index];
}

export function getAdminRouteCoverage() {
  const routes = getAllAdminRoutes();
  const dedicated = routes.filter((route) => route.dedicated).length;
  return { total: routes.length, dedicated, console: routes.length - dedicated, uncovered: 0 };
}
