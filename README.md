# inoreader-mcp

Local MCP server for Inoreader.

## Setup

```bash
pnpm install
pnpm build
```

## Run

```bash
pnpm dev
```

The server uses MCP stdio transport, so MCP clients should run the built binary:

```bash
pnpm build
node dist/index.js
```

Environment:

```bash
INOREADER_API_BASE_URL=https://www.inoreader.com/reader/api/0
INOREADER_ACCESS_TOKEN=your-token
```

`INOREADER_ACCESS_TOKEN` is required for authenticated Inoreader tools. The status tool can run without it and reports only whether the token is configured.

## Scripts

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Current Tools

- `inoreader_status`: reports the configured Inoreader API base URL and whether an access token is configured.
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
