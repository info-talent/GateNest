# API Base URL

GateNest uses the login server URL for authentication, management requests, and
`GET /api/v1/settings/public`. The public settings request does not require an
admin key or a password session.

The API keys page and the AI provider's **Load current account configuration**
section resolve the OpenAI Base URL from that server's `api_base_url` setting.
This can point to a different host or contain a deployment path. Following
Sub2API's OpenAI client configuration, GateNest appends `/v1` only when it is not
already present, and preserves the configured path.

For example, logging in at `https://console.example.com` with
`api_base_url = https://api.example.com/gateway` produces
`https://api.example.com/gateway/v1`. A setting ending in `/gateway/v1` produces
the same address.

An empty or absent `api_base_url` falls back to the login server root plus `/v1`.
A failed settings request does not trigger that fallback: retry from the API
keys page or refresh the current account configuration. Until settings load,
copying the endpoint and loading an account key into the AI provider are disabled.
Settings are cached separately for each login URL; refreshing either page also
refreshes settings. After a settings change, select an account key again and save
to update an already saved AI provider configuration.
