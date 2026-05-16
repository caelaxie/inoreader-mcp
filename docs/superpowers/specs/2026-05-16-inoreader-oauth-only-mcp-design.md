# Inoreader OAuth-Only MCP Design

## Goal

Turn the local stdio Inoreader MCP server into an OAuth-only client for Inoreader API access. The server must no longer accept a static `INOREADER_ACCESS_TOKEN`; it must derive access tokens from Inoreader OAuth client credentials and a refresh token.

## Scope

In scope:

- Keep the current stdio MCP package and existing tool names.
- Replace static bearer-token configuration with OAuth refresh-token configuration.
- Let normal MCP launches run without environment variables after one local setup command.
- Refresh Inoreader access tokens through the Inoreader OAuth token endpoint.
- Cache refreshed access tokens in memory until shortly before expiry.
- Keep API errors mapped to the existing tagged Inoreader client errors.
- Update README setup examples for Codex and OpenCode.
- Add regression tests for config, token refresh, client auth headers, and server status.

Out of scope:

- Converting the MCP server to remote HTTP transport.
- Protecting MCP protocol requests with MCP-level OAuth resource-server auth.
- Persisting refreshed tokens to disk.
- Interactive OAuth browser authorization or PKCE setup.

## Architecture

`src/config.ts` owns runtime configuration. It will read saved OAuth credentials from the system keyring, allow `INOREADER_CLIENT_ID`, `INOREADER_CLIENT_SECRET`, and `INOREADER_REFRESH_TOKEN` to override saved values for automation, keep `INOREADER_API_BASE_URL` optional, and add `INOREADER_OAUTH_TOKEN_URL` as an optional override for tests or non-default deployments.

`src/config-store.ts` will own the system-keyring secret entry, local non-secret config file path, JSON read/write behavior for URL overrides, and private file permissions for that non-secret file. `src/cli.ts` will expose a one-time `auth save` command so users can save client id, client secret, and refresh token without adding secrets to MCP client environment blocks.

`src/inoreader/oauth.ts` will provide a focused token provider. It exchanges the configured refresh token at the OAuth token endpoint using `application/x-www-form-urlencoded`, validates the token response, and returns an access token. The provider caches the token with an expiry timestamp and refreshes when there is no cached token or when the token is within a small expiry skew.

`src/inoreader/client.ts` will accept an `InoreaderAccessTokenProvider` instead of reading a token directly from config. Every authenticated API request asks the provider for a token and sends it as `Authorization: Bearer <token>`.

`src/server.ts` keeps the current MCP tool registration. The status tool will report OAuth credential presence as a boolean and no longer mention raw access-token configuration.

## Error Handling

Missing OAuth configuration from both env and keyring fails during `loadConfig` with `ConfigError`. Invalid keyring secret JSON or local non-secret config JSON also fails as `ConfigError`. Token endpoint HTTP failures, malformed token responses, and missing access tokens fail as `InoreaderAuthError` so MCP tool calls return a concise auth error. Existing Inoreader API `401`, `403`, `429`, non-2xx, and decode behavior remains unchanged.

## Testing

Regression coverage will verify:

- `loadConfig` requires OAuth client id, client secret, and refresh token.
- `loadConfig` can read OAuth credentials from the system keyring when env is empty.
- The `auth save` CLI writes OAuth secrets to keyring and only non-secret URL overrides to JSON for future env-free MCP starts.
- `loadConfig` rejects malformed API and token URLs.
- The OAuth provider sends the correct refresh-token request and caches access tokens.
- The Inoreader client sends the OAuth-derived bearer token.
- The client fails authenticated methods when token retrieval fails.
- The server status output reports OAuth configuration rather than static token configuration.

## Dependency Graph

- T1: Write spec and implementation plan -> depends_on: []
- T2: Add failing OAuth config/client/server tests -> depends_on: [T1]
- T3: Implement keyring credential loading, non-secret config file loading, and setup CLI -> depends_on: [T2]
- T4: Implement OAuth config and token provider -> depends_on: [T3]
- T5: Wire OAuth provider through client and server -> depends_on: [T4]
- T6: Update README setup docs -> depends_on: [T5]
- T7: Run lint/typecheck/test/build -> depends_on: [T6]
