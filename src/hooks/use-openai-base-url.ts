import { useQuery } from '@tanstack/react-query';

import { getOpenAIBaseUrl, trimServerUrl } from '@/src/lib/server-url';
import { getPublicSettings } from '@/src/services/admin';

export function useOpenAIBaseUrl(serverUrl: string) {
  const loginUrl = trimServerUrl(serverUrl);
  const query = useQuery({
    queryKey: ['public-settings', loginUrl],
    queryFn: ({ signal }) => getPublicSettings(loginUrl, signal),
    enabled: Boolean(loginUrl),
  });

  return {
    ...query,
    // A failed settings request is not evidence that api_base_url is unset.
    baseUrl: loginUrl && query.isSuccess
      ? getOpenAIBaseUrl(loginUrl, query.data?.api_base_url)
      : '',
  };
}
