import { access, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const manifest = JSON.parse(await readFile(resolve('src/generated/sub2api-admin-routes.json'), 'utf8'));
const knowledge = JSON.parse(await readFile(resolve('src/generated/app-api-knowledge.json'), 'utf8'));
const consoleFile = resolve('app/api-console/[index].tsx');
const rawFetchFile = resolve('src/lib/admin-fetch.ts');
await access(consoleFile);
const [consoleSource, rawFetchSource] = await Promise.all([
  readFile(consoleFile, 'utf8'),
  readFile(rawFetchFile, 'utf8'),
]);

if (!consoleSource.includes('adminRawFetch') || !consoleSource.includes('createAdminWebSocket')) {
  throw new Error('API console must support both HTTP and WebSocket routes');
}
if (!rawFetchSource.includes('getAuthHeaders()') || !rawFetchSource.includes("'x-api-key'")) {
  throw new Error('Raw API transport must apply the configured administrator API key');
}

function canonical(path) {
  return path
    .replace(/:buildQuery[\s\S]*$/, '')
    .replace(/\?.*$/, '')
    .replace(/:[^/]+/g, ':*')
    .replace(/\/$/, '');
}

const services = knowledge.entries.filter((entry) => entry.kind === 'service' && entry.source_file !== 'src/services/official-admin.ts');
const upstreamServices = knowledge.entries.filter((entry) => entry.kind === 'upstream_service');
const dedicatedKeys = new Set(services.flatMap((service) => (
  service.endpoints.map((endpoint) => `${service.method} ${canonical(endpoint)}`)
)));
const routeKeys = new Set();
const upstreamKeys = new Set(upstreamServices.map((service) => `${service.method} ${canonical(service.endpoint)}`));
const routes = manifest.routes.map((route) => {
  const key = `${route.method} ${route.path}`;
  if (routeKeys.has(key)) throw new Error(`Duplicate route: ${key}`);
  routeKeys.add(key);
  if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(route.method)) throw new Error(`Unsupported method: ${key}`);
  if (!route.path.startsWith('/api/v1/admin/')) throw new Error(`Route is outside the admin API: ${key}`);
  return {
    ...route,
    dedicated: dedicatedKeys.has(`${route.method} ${canonical(route.path)}`),
    upstream_client: upstreamKeys.has(`${route.method} ${canonical(route.path)}`),
    transport: route.path.includes('/ws/') ? 'websocket' : 'http',
    console: true,
  };
});

const dedicated = routes.filter((route) => route.dedicated);
const consoleOnly = routes.filter((route) => !route.dedicated);
const websocket = routes.filter((route) => route.transport === 'websocket');
const upstreamClient = routes.filter((route) => route.upstream_client);
const uncovered = routes.filter((route) => !route.dedicated && !route.console);
const report = {
  source: manifest.source,
  routes_sha256: manifest.routes_sha256,
  counts: {
    total: routes.length,
    dedicated: dedicated.length,
    console_only: consoleOnly.length,
    websocket: websocket.length,
    upstream_client: upstreamClient.length,
    uncovered: uncovered.length,
  },
  uncovered: uncovered.map(({ method, path, handler }) => ({ method, path, handler })),
};

await writeFile(resolve('src/generated/api-coverage.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(report.counts));
if (uncovered.length) process.exitCode = 1;
