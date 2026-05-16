# Inoreader MCP

## Set up Inoreader MCP

This MCP server runs over stdio and is designed to be launched by an AI agent with `npx`.

### Codex

1. Open your Codex config file:

```bash
$EDITOR ~/.codex/config.toml
```

2. Add this MCP server entry:

```toml
[mcp_servers.inoreader]
command = "npx"
args = ["-y", "@caelaxie/inoreader-mcp"]
```

3. Save your Inoreader OAuth credentials once:

```bash
npx -y @caelaxie/inoreader-mcp auth save \
  --client-id "your-client-id" \
  --client-secret "your-client-secret" \
  --refresh-token "your-refresh-token"
```

4. Restart Codex.
5. Ask Codex to use the Inoreader MCP tools.

### OpenCode

1. Open your OpenCode config file:

```bash
$EDITOR ~/.config/opencode/opencode.json
```

2. Add this MCP server entry inside the top-level `mcp` object:

```json
{
  "mcp": {
    "inoreader": {
      "type": "local",
      "command": ["npx", "-y", "@caelaxie/inoreader-mcp"],
      "enabled": true
    }
  }
}
```

3. Save your Inoreader OAuth credentials once:

```bash
npx -y @caelaxie/inoreader-mcp auth save \
  --client-id "your-client-id" \
  --client-secret "your-client-secret" \
  --refresh-token "your-refresh-token"
```

4. Restart OpenCode.
5. Ask OpenCode to use the Inoreader MCP tools.

`auth save` writes OAuth secrets to the system keyring under the `inoreader-mcp` service and stores only non-secret URL overrides in `~/.config/inoreader-mcp/config.json`. After that, MCP clients can launch this server without environment variables. `INOREADER_CLIENT_ID`, `INOREADER_CLIENT_SECRET`, and `INOREADER_REFRESH_TOKEN` are still supported as automation overrides. The MCP server refreshes Inoreader OAuth access tokens in memory and does not accept a static access-token environment variable.

Use Inoreader's OAuth developer flow or OAuth Playground setup to obtain the refresh token for your registered Inoreader app.

`INOREADER_API_BASE_URL` is optional and defaults to `https://www.inoreader.com/reader/api/0`. `INOREADER_OAUTH_TOKEN_URL` is optional and defaults to `https://www.inoreader.com/oauth2/token`.

## Current Tools

- `inoreader_status`: reports the configured Inoreader API base URL and whether OAuth credentials are configured.
- `inoreader_get_user_info`: fetches authenticated account information.
- `inoreader_list_subscriptions`: lists feeds and subscriptions.
- `inoreader_get_unread_counts`: returns unread counters for feeds, folders, and tags.
- `inoreader_get_stream_contents`: fetches articles from a stream.
- `inoreader_mark_read`: marks one or more articles as read.
- `inoreader_mark_unread`: marks one or more articles as unread.
- `inoreader_star_article`: stars one or more articles.
- `inoreader_unstar_article`: removes stars from one or more articles.
- `inoreader_like_article`: likes one or more articles.
- `inoreader_unlike_article`: removes likes from one or more articles.
- `inoreader_broadcast_article`: broadcasts one or more articles.
- `inoreader_unbroadcast_article`: removes broadcasts from one or more articles.
- `inoreader_add_article_tag`: adds a custom tag to one or more articles.
- `inoreader_remove_article_tag`: removes a custom tag from one or more articles.
- `inoreader_edit_subscription`: renames a subscription or adds/removes it from folders.
- `inoreader_follow_subscription`: follows a feed and optionally renames or folders it.
- `inoreader_unfollow_subscription`: unfollows a feed.
- `inoreader_rename_tag`: renames a tag or folder.
- `inoreader_delete_tag`: deletes a tag or folder.

## Developers

Install dependencies and build the server:

```bash
pnpm install
pnpm build
```

Run the server locally:

```bash
pnpm dev
```

Save local credentials while developing:

```bash
pnpm dev auth save \
  --client-id "your-client-id" \
  --client-secret "your-client-secret" \
  --refresh-token "your-refresh-token"
```

On Linux, the system keyring must be available and unlocked for `auth save` and MCP startup to read saved credentials.

Run checks before changing release metadata or publishing:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```
