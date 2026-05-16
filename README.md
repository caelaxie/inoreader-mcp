# Inoreader MCP

Remote Cloudflare MCP server for Inoreader.

## Deploy

1. Install dependencies and sign in to Cloudflare:

```bash
pnpm install
pnpm wrangler login
```

2. Choose the deployed Worker URL.

By default this project deploys the Worker named `inoreader-mcp`. Use either a
`workers.dev` hostname or a custom hostname that belongs to a Cloudflare zone.

To enable the default `workers.dev` deployment URL, add `workers_dev` to
`wrangler.jsonc`:

```jsonc
{
  "name": "inoreader-mcp",
  "workers_dev": true
}
```

Then use the final Worker URL from your Cloudflare account, for example:

```text
https://inoreader-mcp.<your-workers-subdomain>.workers.dev
```

To use a custom domain where the Worker is the origin, add a `routes` entry with
`custom_domain: true`:

```jsonc
{
  "routes": [
    {
      "pattern": "reader.example.com",
      "custom_domain": true
    }
  ]
}
```

If you need the Worker to run in front of an existing origin instead, configure a
route for a proxied DNS record:

```jsonc
{
  "routes": [
    {
      "pattern": "reader.example.com/*",
      "zone_name": "example.com"
    }
  ]
}
```

After choosing the host, use it consistently for Inoreader OAuth, Cloudflare
Access, and MCP client configuration.

3. Register an app in Inoreader preferences:

```text
https://www.inoreader.com/preferences/other
```

Use your deployed Worker callback URL as the redirect URI:

```text
https://<your-worker-domain>/callback
```

Inoreader labels the OAuth credentials as `App ID` and `App key`.

4. Set Cloudflare Worker secrets from the Inoreader `App ID` and `App key`:

```bash
pnpm wrangler secret put INOREADER_APP_ID
pnpm wrangler secret put INOREADER_APP_KEY
```

5. Deploy the Worker:

```bash
pnpm run deploy
```

6. Protect the private Worker paths with Cloudflare Access.

In the Cloudflare dashboard, open Zero Trust, then Access, then Applications.
Add self-hosted applications for the private paths on the deployed Worker host:

```text
https://inoreader-mcp.<your-workers-subdomain>.workers.dev/setup
https://inoreader-mcp.<your-workers-subdomain>.workers.dev/authorize
https://inoreader-mcp.<your-workers-subdomain>.workers.dev/status
https://inoreader-mcp.<your-workers-subdomain>.workers.dev/mcp
```

Add an Allow policy for your email address on `/setup` and `/authorize`. For
non-browser MCP clients, create an Access service token and add it to an Allow
policy for `/mcp`.

Do not protect `/callback` with Cloudflare Access. Inoreader must be able to
redirect the browser back to that path after OAuth, and Inoreader cannot send
Cloudflare Access service-token headers.

7. Open the setup page in a browser and connect Inoreader:

```text
https://<your-worker-domain>/setup
```

The Worker redirects to Inoreader, receives the OAuth callback at `/callback`,
and stores the Inoreader refresh/access token state in the
`InoreaderCredentials` Durable Object.

## Connect MCP Clients

Use the remote MCP endpoint directly:

```text
https://<your-worker-domain>/mcp
```

MCP clients should send these Cloudflare Access headers when calling `/mcp`:

```http
CF-Access-Client-Id: <cloudflare-access-client-id>.access
CF-Access-Client-Secret: <cloudflare-access-client-secret>
```

Set them in your shell before starting Codex or OpenCode:

```bash
export CF_ACCESS_CLIENT_ID="<cloudflare-access-client-id>.access"
export CF_ACCESS_CLIENT_SECRET="<cloudflare-access-client-secret>"
```

### Codex

Add this to `~/.codex/config.toml`:

```toml
[mcp_servers.inoreader]
url = "https://<your-worker-domain>/mcp"

[mcp_servers.inoreader.env_http_headers]
"CF-Access-Client-Id" = "CF_ACCESS_CLIENT_ID"
"CF-Access-Client-Secret" = "CF_ACCESS_CLIENT_SECRET"
```

Restart Codex after changing the config.

### OpenCode

Add this to `~/.config/opencode/opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "inoreader": {
      "type": "remote",
      "url": "https://<your-worker-domain>/mcp",
      "enabled": true,
      "headers": {
        "CF-Access-Client-Id": "{env:CF_ACCESS_CLIENT_ID}",
        "CF-Access-Client-Secret": "{env:CF_ACCESS_CLIENT_SECRET}"
      }
    }
  }
}
```

Restart OpenCode after changing the config.

Browser access to `/setup` uses your email-based Access policy.

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

Install dependencies:

```bash
pnpm install
```

Run locally with Wrangler:

```bash
pnpm dev
```

Wrangler serves the local Worker at `http://localhost:8787` by default. If you
need a different local port, add a `dev` block to `wrangler.jsonc`:

```jsonc
{
  "dev": {
    "port": 8788,
    "local_protocol": "http"
  }
}
```

For a preview that runs on Cloudflare infrastructure and connects to remote
bindings, use Wrangler remote development:

```bash
pnpm wrangler dev --remote
```

Run checks:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```
