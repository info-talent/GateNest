export function trimServerUrl(value: string) {
  return value.trim().replace(/\/+$/, '');
}

export function getServerRootUrl(value: string) {
  return trimServerUrl(value).replace(/(?:\/api\/v1|\/v1|\/api)$/i, '');
}

export function getOpenAIBaseUrl(serverUrl: string, apiBaseUrl?: string | null) {
  // Settings describe the public API root, which may differ from the login host.
  // Preserve its path; only login URLs need management API prefixes removed.
  const base = trimServerUrl(apiBaseUrl ?? '') || getServerRootUrl(serverUrl);
  if (!base) return '';
  return base.endsWith('/v1') ? base : `${base}/v1`;
}
