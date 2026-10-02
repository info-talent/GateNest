import { adminConfigState, saveAdminConfig } from '@/src/store/admin-config';
import type { ApiEnvelope } from '@/src/types/admin';
import { trimServerUrl } from '@/src/lib/server-url';
import { Platform } from 'react-native';

export function buildRequestUrl(baseUrl: string, path: string) {
  const normalizedBase = trimServerUrl(baseUrl);
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const basePrefix = ['/api/v1', '/v1', '/api'].find((prefix) => normalizedBase.toLowerCase().endsWith(prefix));
  const pathHasApiPrefix = ['/api/v1/', '/v1/', '/api/'].some((prefix) => normalizedPath.toLowerCase().startsWith(prefix));
  if (basePrefix && pathHasApiPrefix) {
    return `${normalizedBase.slice(0, -basePrefix.length)}${normalizedPath}`;
  }
  return `${normalizedBase}${normalizedPath}`;
}

function prepareRequest(targetUrl: string, init: RequestInit) {
  const configuredProxyUrl = process.env.EXPO_PUBLIC_SUB2API_WEB_PROXY_URL?.trim();
  const shouldProxy = Platform.OS === 'web' && (Boolean(configuredProxyUrl) || __DEV__);
  if (!shouldProxy) return { url: targetUrl, init };
  const headers = new Headers(init.headers);
  headers.set('x-sub2api-target-url', targetUrl);
  return {
    url: configuredProxyUrl || '/__sub2api_proxy__',
    init: { ...init, headers },
  };
}

export async function fetchWithWebProxy(targetUrl: string, init: RequestInit = {}) {
  const request = prepareRequest(targetUrl, init);
  try {
    return await fetch(request.url, request.init);
  } catch (error) {
    if (Platform.OS === 'web' && error instanceof TypeError) {
      throw new Error('WEB_NETWORK_OR_CORS_ERROR');
    }
    throw error;
  }
}

function getAuthHeaders(): Record<string, string> {
  const adminApiKey = adminConfigState.adminApiKey.trim();
  const accessToken = adminConfigState.accessToken.trim();
  if (!adminApiKey && !accessToken) throw new Error('AUTH_REQUIRED');
  if (adminConfigState.authMode === 'password' && accessToken) return { Authorization: `Bearer ${accessToken}` };
  return { 'x-api-key': adminApiKey };
}

export async function publicFetch<T>(baseUrl: string, path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  const response = await fetchWithWebProxy(buildRequestUrl(baseUrl, path), { ...init, headers });
  const rawText = await response.text();
  let json: unknown;
  try { json = rawText ? JSON.parse(rawText) : undefined; } catch { throw new Error('INVALID_SERVER_RESPONSE'); }
  if (typeof json === 'object' && json !== null && 'code' in json) {
    const envelope = json as ApiEnvelope<T>;
    if (!response.ok || envelope.code !== 0) throw new Error(envelope.reason || envelope.message || 'REQUEST_FAILED');
    return envelope.data as T;
  }
  if (!response.ok) {
    const rawError = json as { reason?: string; message?: string; error?: string } | undefined;
    throw new Error(rawError?.reason || rawError?.message || rawError?.error || 'REQUEST_FAILED');
  }
  return json as T;
}

export async function adminResponseFetch(path: string, init: RequestInit = {}, options?: { idempotencyKey?: string; skipRefresh?: boolean }): Promise<Response> {
  const baseUrl = adminConfigState.baseUrl.trim().replace(/\/$/, '');
  if (!baseUrl) throw new Error('BASE_URL_REQUIRED');
  const accountId = adminConfigState.activeAccountId;
  const refreshToken = adminConfigState.refreshToken;
  const user = adminConfigState.user;
  const headers = new Headers(init.headers);
  if (!(typeof FormData !== 'undefined' && init.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  Object.entries(getAuthHeaders()).forEach(([name, value]) => headers.set(name, value));
  if (options?.idempotencyKey) headers.set('Idempotency-Key', options.idempotencyKey);
  const response = await fetchWithWebProxy(buildRequestUrl(baseUrl, path), { ...init, headers });
  if (init.signal?.aborted || accountId !== adminConfigState.activeAccountId || baseUrl !== adminConfigState.baseUrl.trim().replace(/\/$/, '')) throw new Error('SESSION_CHANGED');
  if (response.status === 401 && !options?.skipRefresh && adminConfigState.authMode === 'password' && adminConfigState.refreshToken.trim()) {
    const refreshed = await publicFetch<{ access_token: string; refresh_token?: string }>(baseUrl, '/api/v1/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
      signal: init.signal,
    });
    if (init.signal?.aborted || accountId !== adminConfigState.activeAccountId || refreshToken !== adminConfigState.refreshToken) throw new Error('SESSION_CHANGED');
    await saveAdminConfig({
      baseUrl,
      authMode: 'password',
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token || refreshToken,
      user,
    });
    return adminResponseFetch(path, init, { ...options, skipRefresh: true });
  }
  return response;
}

export async function adminFetch<T>(path: string, init: RequestInit = {}, options?: { idempotencyKey?: string; skipRefresh?: boolean }): Promise<T> {
  const response = await adminResponseFetch(path, init, options);
  const rawText = await response.text();
  let json: unknown;
  try { json = rawText ? JSON.parse(rawText) : undefined; } catch { throw new Error('INVALID_SERVER_RESPONSE'); }
  if (typeof json === 'object' && json !== null && 'code' in json) {
    const envelope = json as ApiEnvelope<T>;
    if (!response.ok || envelope.code !== 0) throw new Error(envelope.reason || envelope.message || 'REQUEST_FAILED');
    return envelope.data as T;
  }
  if (!response.ok) {
    const rawError = json as { reason?: string; message?: string; error?: string } | undefined;
    throw new Error(rawError?.reason || rawError?.message || rawError?.error || 'REQUEST_FAILED');
  }
  return json as T;
}

export type AdminRawResponse = { status: number; ok: boolean; contentType: string; contentDisposition: string; body: string; durationMs: number };

export async function adminRawFetch(path: string, init: RequestInit = {}): Promise<AdminRawResponse> {
  const startedAt = Date.now();
  const response = await adminResponseFetch(path, init);
  const body = await response.text();
  return { status: response.status, ok: response.ok, contentType: response.headers.get('content-type') || '', contentDisposition: response.headers.get('content-disposition') || '', body, durationMs: Date.now() - startedAt };
}

export function createAdminWebSocket(path: string) {
  const baseUrl = adminConfigState.baseUrl.trim().replace(/\/$/, '');
  if (!baseUrl) throw new Error('BASE_URL_REQUIRED');
  const websocketUrl = buildRequestUrl(baseUrl, path).replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
  const NativeWebSocket = WebSocket as unknown as new (url: string, protocols?: string[], options?: { headers?: Record<string, string> }) => WebSocket;
  return new NativeWebSocket(websocketUrl, [], { headers: getAuthHeaders() });
}
