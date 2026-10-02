import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { createHash } from 'node:crypto';
import ts from 'typescript';

// The caller supplies a local snapshot fetched through its authorized GitHub connection.
const root = resolve(process.argv[2] || '.upstream-sub2api');
const commit = process.argv[3];
if (!/^[a-f0-9]{40}$/.test(commit || '')) throw new Error('Supply the pinned upstream commit SHA');

export function block(source, start, opening = '{', closing = '}') {
  let depth = 0, quote = '', comment = '', escape = false;
  for (let i = start; i < source.length; i++) {
    const c = source[i], next = source[i + 1];
    if (comment === '//') { if (c === '\n') comment = ''; continue; }
    if (comment === '/*') { if (c === '*' && next === '/') { comment = ''; i++; } continue; }
    if (quote) {
      if (escape) escape = false;
      else if (c === '\\' && quote !== '`') escape = true;
      else if (c === quote) quote = '';
      continue;
    }
    if (c === '/' && (next === '/' || next === '*')) { comment = c + next; i++; continue; }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === opening) depth++;
    if (c === closing && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error('Unbalanced source block');
}

async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(e => e.isDirectory() ? files(resolve(directory, e.name)) : [resolve(directory, e.name)]))).flat();
}

const sources = new Map();
for (const directory of ['backend/internal/server/routes', 'backend/internal/handler']) {
  for (const path of await files(resolve(root, directory))) {
    if (!path.endsWith('.go') || path.endsWith('_test.go')) continue;
    sources.set(relative(root, path).replaceAll('\\', '/'), await readFile(path, 'utf8'));
  }
}
const paymentTypes = 'backend/internal/service/payment_config_service.go';
sources.set(paymentTypes, await readFile(resolve(root, paymentTypes), 'utf8'));
for (const name of ['prompt_handler.go', 'prompt_types.go', 'prompt_config.go', 'prompt_service.go', 'prompt_event_repository.go']) {
  const file = `backend/internal/securityaudit/${name}`;
  try { sources.set(file, await readFile(resolve(root, file), 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
const structs = new Map(), handlers = new Map();
const handlerBindings = new Map();
const handlerRoot = sources.get('backend/internal/handler/handler.go') || '';
for (const match of handlerRoot.matchAll(/type\s+(AdminHandlers|Handlers)\s+struct\s*\{/g)) {
  for (const field of block(handlerRoot, match.index + match[0].length - 1).matchAll(/^\s*(\w+)\s+\*([\w.]+)/gm)) {
    handlerBindings.set(`${match[1] === 'AdminHandlers' ? 'h.Admin' : 'h'}.${field[1]}`, field[2].includes('.') ? field[2] : `handler.${field[2]}`);
  }
}
const tsTypes = new Map(), clientBodies = new Map();
const clientFiles = [...await files(resolve(root, 'frontend/src/api')), ...await files(resolve(root, 'frontend/src/types'))].filter(f => f.endsWith('.ts') && !f.includes('__tests__'));
try { clientFiles.push(...(await files(resolve(root, 'frontend/src/features/prompt-audit'))).filter(f => /(?:api|types)\.ts$/.test(f))); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const syntax = clientFiles.map(path => ({ path, source: ts.createSourceFile(path, '', ts.ScriptTarget.Latest, true) }));
for (const entry of syntax) {
  entry.source = ts.createSourceFile(entry.path, await readFile(entry.path, 'utf8'), ts.ScriptTarget.Latest, true);
  for (const node of entry.source.statements) if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) {
    tsTypes.set(entry.path + ':' + node.name.text, node);
    if (!tsTypes.has(node.name.text)) tsTypes.set(node.name.text, node);
  }
}
function tsFields(type, file, seen = new Set()) {
  if (!type || seen.has(type)) return [];
  seen = new Set([...seen, type]);
  if (ts.isTypeReferenceNode(type)) {
    const name = type.typeName.getText();
    if (name === 'Partial' || name === 'Required') return tsFields(type.typeArguments?.[0], file, seen).map(f => ({ ...f, required: name === 'Required' }));
    const declaration = tsTypes.get(file + ':' + name) || tsTypes.get(name);
    if (declaration) return tsFields(declaration, file, seen);
  }
  if (ts.isTypeAliasDeclaration(type)) return tsFields(type.type, file, seen);
  if (ts.isIntersectionTypeNode(type)) return type.types.flatMap(t => tsFields(t, file, seen));
  if (ts.isTypeLiteralNode(type) || ts.isInterfaceDeclaration(type)) {
    return type.members.filter(ts.isPropertySignature).map(p => {
      const text = p.type?.getText() || 'unknown';
      const core = text.replace(/\s*\|\s*(null|undefined)/g, '');
      return { name: p.name.getText().replace(/^['"]|['"]$/g, ''), type: core === 'boolean' ? 'boolean' : core === 'number' ? 'number' : core === 'string' || /^['"]/.test(core) ? 'string' : 'json', required: !p.questionToken, nullable: text.includes('null'), goType: text };
    });
  }
  return [];
}
const canonical = path => path.replace(/\$\{[^}]+\}/g, ':param').replace(/:[^/]+/g, ':param').replace(/\?.*$/, '');
for (const { path: file, source } of syntax) {
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.expression.getText() === 'apiClient' && ['post', 'put', 'patch'].includes(node.expression.name.text)) {
      const endpoint = node.arguments[0]?.getText().replace(/^[`'"]|[`'"]$/g, '');
      if (endpoint?.startsWith('/')) {
        let fn = node.parent;
        while (fn && !ts.isFunctionDeclaration(fn) && !ts.isMethodDeclaration(fn) && !ts.isArrowFunction(fn)) fn = fn.parent;
        const value = node.arguments[1];
        let schema = [];
        if (fn && value && ts.isIdentifier(value)) {
          const param = fn.parameters.find(p => p.name.getText() === value.text);
          schema = tsFields(param?.type, file);
          if (!schema.length) {
            const findVariable = n => { if (ts.isVariableDeclaration(n) && n.name.getText() === value.text) schema = tsFields(n.type, file); ts.forEachChild(n, findVariable); };
            ts.forEachChild(fn, findVariable);
          }
        }
        if (fn && value && ts.isObjectLiteralExpression(value)) {
          schema = value.properties.filter(p => ts.isShorthandPropertyAssignment(p)).map(p => {
            const parameter = fn.parameters.find(param => param.name.getText() === p.name.text);
            const kind = parameter?.type?.getText() || 'unknown';
            return { name: p.name.text, type: ['string', 'number', 'boolean'].includes(kind) ? kind : 'json', required: parameter ? !parameter.questionToken && !parameter.initializer : false, nullable: kind.includes('null'), goType: kind };
          });
        }
        if (schema.length) clientBodies.set(`${node.expression.name.text.toUpperCase()} ${canonical('/api/v1' + endpoint)}`, schema);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}
function fields(source) {
  return [...source.matchAll(/^\s*(\w+)\s+([^`\n]+)\s*`([^`]+)`/gm)].flatMap(m => {
    const json = m[3].match(/json:"([^",]+)([^"]*)"/);
    if (!json || json[1] === '-') return [];
    const goType = m[2].trim();
    const type = /^\*?bool$/.test(goType) ? 'boolean' : /^\*?(?:u?int\d*|float\d*)$/.test(goType) ? 'number' : /^\*?string$/.test(goType) ? 'string' : 'json';
    return [{ name: json[1], type, required: /binding:"[^"]*\brequired\b/.test(m[3]), nullable: goType.startsWith('*'), goType }];
  });
}
for (const [path, source] of sources) {
  if (!path.includes('/handler/') && !path.includes('/service/') && !path.includes('/securityaudit/')) continue;
  const pkg = path.includes('/securityaudit/') ? 'securityaudit' : path.includes('/service/') ? 'service' : path.includes('/handler/admin/') ? 'admin' : path.includes('/handler/dto/') ? 'dto' : 'handler';
  for (const m of source.matchAll(/type\s+(\w+)\s+struct\s*\{/g)) {
    structs.set(`${pkg}.${m[1]}`, fields(block(source, m.index + m[0].length - 1)));
  }
  for (const m of source.matchAll(/func\s+\(\w+\s+\*(\w+)\)\s+(\w+)\s*\(\w+\s+\*gin\.Context\)\s*\{/g)) {
    handlers.set(`${pkg}.${m[1]}.${m[2]}`, { source: path, body: block(source, m.index + m[0].length - 1) });
  }
}

const routes = new Map();
for (const [file, source] of sources) {
  if (!file.includes('/server/routes/') || file.endsWith('/gateway.go')) continue;
  // Each registration function has its own group variables. Empty suffixes are valid.
  const functionPattern = /func\s+(\w+)\s*\([\s\S]*?\)\s*(?:[\w.*]+\s*)?\{/g;
  for (const fn of source.matchAll(functionPattern)) {
    const body = block(source, fn.index + fn[0].length - 1);
    const groups = new Map([['v1', '/api/v1'], ['admin', '/api/v1/admin']]);
    const calls = /\b(\w+)\s*:=\s*(\w+)\.Group\("([^"]*)"\)|\b(\w+)\.(GET|POST|PUT|PATCH|DELETE)\("([^"]*)"\s*,/g;
    for (const m of body.matchAll(calls)) {
      if (m[1]) { if (groups.has(m[2])) groups.set(m[1], groups.get(m[2]) + m[3]); continue; }
      if (!groups.has(m[4])) continue;
      const path = groups.get(m[4]) + m[6];
      if (/\/webhook\//.test(path) || path.startsWith('/api/v1/plugin-ui/')) continue;
      const call = block(body, m.index + m[0].indexOf('('), '(', ')');
      const handler = call.match(/([\w.]+)\s*,?\s*\)$/)?.[1] || '';
      const parts = handler.split('.');
      const methodName = parts.at(-1);
      let owner = parts.at(-2), pkg = path.startsWith('/api/v1/admin/') ? 'admin' : 'handler';
      if (owner === 'adminPaymentHandler') owner = 'Payment';
      if (owner === 'paymentHandler') owner = 'Payment';
      const bound = handlerBindings.get(parts.slice(0, -1).join('.'));
      if (bound) pkg = bound.split('.')[0];
      const detail = handlers.get(`${bound || `${pkg}.${owner}Handler`}.${methodName}`);
      const code = detail?.body || '';
      const query = [...new Set([...code.matchAll(/\w+\.(?:Query|DefaultQuery|GetQuery|QueryArray)\("([^"]+)"/g)].map(q => q[1]))];
      if (/GetPagination/.test(code)) query.unshift('page', 'page_size');
      const reqName = [...code.matchAll(/(?:ShouldBindJSON|BindJSON|ShouldBindBodyWith)\(&([\w]+)[,)]/g)].at(-1)?.[1];
      let bodyFields = [], bodySchema = 'none';
      if (reqName) {
        const declaration = new RegExp(`(?:var\\s+${reqName}\\s+|${reqName}\\s*:=\\s*)([\\w.]+)(?:\\s*\\{)?`).exec(code);
        if (declaration?.[1] === 'struct') {
          bodyFields = fields(block(code, code.indexOf('{', declaration.index)));
        } else if (declaration) {
          bodyFields = structs.get(declaration[1].includes('.') ? declaration[1] : `${pkg}.${declaration[1]}`) || [];
        }
        bodySchema = bodyFields.length ? 'fields' : 'json';
      }
      if (!bodyFields.length && clientBodies.has(`${m[5]} ${canonical(path)}`)) {
        bodyFields = clientBodies.get(`${m[5]} ${canonical(path)}`);
        bodySchema = 'fields';
      }
      if (/\.Decode\(&|json\.Unmarshal\(/.test(code) && bodySchema === 'none' && ['POST', 'PUT', 'PATCH'].includes(m[5])) bodySchema = 'json';
      const fileField = code.match(/\.FormFile\("([^"]+)"\)/)?.[1];
      const route = { id: `${m[5]} ${path}`, method: m[5], path, handler, source: file, handlerSource: detail?.source,
        audience: path.startsWith('/api/v1/admin/') ? 'admin' : /\/api\/v1\/(?:auth|settings|model-plaza|legal)/.test(path) ? 'public' : 'user',
        module: path.split('/')[path.startsWith('/api/v1/admin/') ? 4 : 3],
        action: methodName, pathParams: [...path.matchAll(/[:*](\w+)/g)].map(p => p[1]), query: [...new Set(query)],
        bodyFields, bodySchema, fileField, transport: path.includes('/ws/') ? 'websocket' : /\.File\(|Content-Disposition|\.FileAttachment\(/.test(code) ? 'download' : 'http',
      };
      routes.set(route.id, route);
    }
  }
}
const operations = [...routes.values()].sort((a,b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
const sourceInputs = [...sources, ...syntax.map(({ path, source }) => [relative(root, path).replaceAll('\\', '/'), source.text])].sort(([a], [b]) => a.localeCompare(b));
const metadata = { repository: 'Wei-Shaw/sub2api', commit, source_sha256: createHash('sha256').update(sourceInputs.map(([path, source]) => path + '\n' + source).join('\n')).digest('hex'), operations };
await writeFile('src/generated/sub2api-features.json', JSON.stringify(metadata, null, 2) + '\n');
const adminRoutes = operations.filter(r => r.audience === 'admin').map(({ method, path, handler }) => ({ method, path, handler }));
await writeFile('src/generated/sub2api-admin-routes.json', JSON.stringify({ source: `https://github.com/Wei-Shaw/sub2api/tree/${commit}/backend/internal/server/routes`, commit, routes_sha256: createHash('sha256').update(JSON.stringify(adminRoutes)).digest('hex'), route_count: adminRoutes.length, routes: adminRoutes }, null, 2) + '\n');
console.log(JSON.stringify({ operations: operations.length, admin: adminRoutes.length, user: operations.filter(r => r.audience === 'user').length, public: operations.filter(r => r.audience === 'public').length, forms: operations.filter(r => r.bodySchema === 'fields').length, unresolved_json: operations.filter(r => r.bodySchema === 'json').map(r=>r.id) }));
