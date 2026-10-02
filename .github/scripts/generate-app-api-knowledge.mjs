import { readdir, readFile, writeFile } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';

const root = resolve('.');
const outputPath = resolve(process.argv[2] || 'src/generated/app-api-knowledge.json');
const routeManifest = JSON.parse(await readFile(resolve('src/generated/sub2api-admin-routes.json'), 'utf8'));
let upstreamMetadata = { counts: { services: 0, types: 0, backend_types: 0, handlers: 0 }, entries: [] };
try {
  upstreamMetadata = JSON.parse(await readFile(resolve('src/generated/sub2api-upstream-client.json'), 'utf8'));
} catch {
  // The route catalog remains usable when upstream client metadata has not been generated yet.
}

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  }));
  return files.flat();
}

function clean(value) {
  return value.replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim();
}

function unique(values) {
  return [...new Set(values.map(clean).filter(Boolean))];
}

function extractQuoted(source, pattern) {
  return unique([...source.matchAll(pattern)].map((match) => match[1]));
}

function appRoute(file) {
  const local = relative(resolve('app'), file).split(sep).join('/').replace(/\.tsx$/, '');
  const parts = local.split('/').filter((part) => !/^\(.+\)$/.test(part) && part !== 'index');
  return `/${parts.map((part) => part.replace(/^\[(.+)\]$/, ':$1')).join('/')}`.replace(/\/$/, '') || '/';
}

function findBalancedBlock(source, start) {
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === "'" || char === '"' || char === '`') {
      quote = char;
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  return source.slice(start);
}

const screens = [];
for (const file of (await listFiles(resolve('app'))).filter((path) => path.endsWith('.tsx') && !path.endsWith('_layout.tsx'))) {
  const source = await readFile(file, 'utf8');
  const title = source.match(/<ScreenShell[^>]*\btitle="([^"]+)"/)?.[1]
    || source.match(/<Stack\.Screen[^>]*\btitle:\s*['"]([^'"]+)['"]/)?.[1]
    || appRoute(file);
  const fields = extractQuoted(source, /<(?:AdminField|FormField)[^>]*\blabel="([^"]+)"[^>]*>/g);
  const sections = extractQuoted(source, /<AdminSection[^>]*\btitle="([^"]+)"[^>]*>/g);
  const placeholders = extractQuoted(source, /\bplaceholder="([^"]+)"/g);
  screens.push({
    kind: 'screen',
    title: clean(title),
    app_route: appRoute(file),
    fields,
    sections,
    placeholders,
  });
}

const services = [];
const functionPattern = /export function\s+(\w+)\s*\(([\s\S]*?)\)\s*\{/g;
for (const file of (await listFiles(resolve('src/services'))).filter((path) => path.endsWith('.ts'))) {
  const serviceSource = await readFile(file, 'utf8');
  for (const match of serviceSource.matchAll(functionPattern)) {
    const blockStart = match.index + match[0].lastIndexOf('{');
    const body = findBalancedBlock(serviceSource, blockStart);
    const endpointLiterals = [...body.matchAll(/([`'"])([^`'"]*\/api\/v1\/admin[^`'"]*)\1/g)].map((item) => (
      item[2].replace(/\$\{([^}]+)\}/g, ':$1').replace(/\$\{[^}]+\}/g, ':param')
    ));
    if (!endpointLiterals.length) continue;
    services.push({
      kind: 'service',
      source_file: relative(root, file).split(sep).join('/'),
      name: match[1],
      signature: clean(match[2]),
      method: body.match(/officialAdminRequest(?:<[^>]+>)?\(\s*['"]([A-Z]+)['"]/)?.[1]
        || body.match(/method:\s*['"]([A-Z]+)['"]/)?.[1]
        || 'GET',
      endpoints: unique(endpointLiterals),
    });
  }
}

const types = [];
const typePattern = /export\s+(?:type|interface)\s+(\w+)[^{=]*(?:=\s*)?\{/g;
for (const file of (await listFiles(resolve('src/types'))).filter((path) => path.endsWith('.ts'))) {
  const typeSource = await readFile(file, 'utf8');
  for (const match of typeSource.matchAll(typePattern)) {
    const blockStart = match.index + match[0].lastIndexOf('{');
    const body = findBalancedBlock(typeSource, blockStart);
    const fields = unique([...body.matchAll(/^\s*([A-Za-z_][A-Za-z0-9_]*\??)\s*:/gm)].map((item) => item[1]));
    if (fields.length) types.push({ kind: 'type', name: match[1], fields });
  }
}

const routes = routeManifest.routes.map((route) => ({
  kind: 'route',
  method: route.method,
  path: route.path,
  handler: route.handler,
}));

const knowledge = {
  source: routeManifest.source,
  routes_sha256: routeManifest.routes_sha256,
  counts: {
    routes: routes.length,
    services: services.length,
    types: types.length,
    screens: screens.length,
    upstream_services: upstreamMetadata.counts.services,
    upstream_types: upstreamMetadata.counts.types,
    upstream_backend_types: upstreamMetadata.counts.backend_types,
    upstream_handlers: upstreamMetadata.counts.handlers,
  },
  entries: [...screens, ...services, ...types, ...upstreamMetadata.entries, ...routes],
};

await writeFile(outputPath, `${JSON.stringify(knowledge, null, 2)}\n`, 'utf8');
console.log(`Wrote ${knowledge.entries.length} searchable entries to ${outputPath}`);
