# Inoreader Effect API Client Design

## Summary

Build an Effect-based Inoreader API client for the local MCP server. The client will support both read and write operations while hiding Inoreader's raw endpoint parameter names behind domain-oriented TypeScript methods and MCP tools.

The first version will authenticate with a single bearer token from `INOREADER_ACCESS_TOKEN`. It will not persist tokens, perform OAuth, or store credentials in files.

## Goals

- Add a reusable Inoreader API client built with Effect.
- Use current Effect HTTP patterns through `@effect/platform`.
- Support read operations for account, subscription, unread count, and stream content data.
- Support write operations for article state, subscription edits, and tag or folder management.
- Expose common workflows as fine-grained MCP tools with validated input.
- Keep the existing `inoreader_status` tool usable without credentials.
- Add focused tests for authentication, request encoding, response decoding, and write-response handling.

## Non-Goals

- OAuth authorization or refresh-token management.
- Token persistence outside environment variables.
- Full coverage of every Inoreader endpoint.
- Automatic pagination across an entire stream.
- Background syncing, caching, or local storage.

## Architecture

Add a small Inoreader domain module under `src/inoreader/`.

```text
src/config.ts
  loads INOREADER_API_BASE_URL and optional INOREADER_ACCESS_TOKEN

src/inoreader/client.ts
  exposes the Effect service interface and live implementation

src/inoreader/errors.ts
  defines tagged client errors

src/inoreader/schemas.ts
  defines response schemas and inferred response types

src/server.ts
  registers MCP tools and runs client effects for authenticated tools
```

The API client will be an Effect service with intent-based methods. Callers should not need to know endpoint-specific names such as `a`, `r`, `i`, `s`, or `ac`.

## Dependency Graph

```text
T1: Add HTTP dependency and config shape -> depends_on: []
T2: Define schemas and typed errors -> depends_on: [T1]
T3: Implement Inoreader client service -> depends_on: [T1, T2]
T4: Register read MCP tools -> depends_on: [T3]
T5: Register write MCP tools -> depends_on: [T3]
T6: Add regression tests -> depends_on: [T2, T3, T4, T5]
T7: Update README and run verification -> depends_on: [T1, T2, T3, T4, T5, T6]
```

## Configuration

`loadConfig` will continue to accept `INOREADER_API_BASE_URL`, defaulting to `https://www.inoreader.com/reader/api/0`.

It will also read `INOREADER_ACCESS_TOKEN` as optional. The status tool can report whether a token is configured without revealing the token value. Authenticated client methods will fail with `InoreaderAuthError` if no token is available.

## Client Interface

The client will expose read methods:

- `getUserInfo()`
- `listSubscriptions(options)`
- `getUnreadCounts()`
- `getStreamContents(options)`

It will expose article write methods backed by `POST /edit-tag`:

- `markRead(itemIds)`
- `markUnread(itemIds)`
- `star(itemIds)`
- `unstar(itemIds)`
- `like(itemIds)`
- `unlike(itemIds)`
- `broadcast(itemIds)`
- `unbroadcast(itemIds)`
- `addArticleTag(itemIds, tagName)`
- `removeArticleTag(itemIds, tagName)`

It will expose subscription and tag write methods:

- `editSubscription(options)`
- `followSubscription(options)`
- `unfollowSubscription(streamId)`
- `renameTag(sourceTagId, destinationName)`
- `deleteTag(tagId)`

These methods will return decoded JSON for read operations and a small success object for endpoints that return plain `OK`.

## HTTP Behavior

The live implementation will use `@effect/platform` HTTP client APIs with a Node or fetch-based layer provided at the program boundary. Every authenticated request will send:

```text
Authorization: Bearer <INOREADER_ACCESS_TOKEN>
```

Query and form parameters will be encoded through standard URL APIs or Effect platform request helpers. Multi-item article writes will preserve repeated `i` parameters for each item ID.

## Error Handling

Use typed `Data.TaggedError`s:

- `InoreaderAuthError`: missing token, `401`, or `403`
- `InoreaderRateLimitError`: `429`
- `InoreaderHttpError`: other non-success HTTP responses
- `InoreaderDecodeError`: response body does not match the expected schema or `OK` contract

MCP tools will convert these errors into clear text responses without leaking credentials.

## MCP Tool Surface

Keep `inoreader_status`.

Add read tools:

- `inoreader_get_user_info`
- `inoreader_list_subscriptions`
- `inoreader_get_unread_counts`
- `inoreader_get_stream_contents`

Add write tools:

- `inoreader_mark_read`
- `inoreader_mark_unread`
- `inoreader_star_article`
- `inoreader_unstar_article`
- `inoreader_like_article`
- `inoreader_unlike_article`
- `inoreader_broadcast_article`
- `inoreader_unbroadcast_article`
- `inoreader_add_article_tag`
- `inoreader_remove_article_tag`
- `inoreader_edit_subscription`
- `inoreader_follow_subscription`
- `inoreader_unfollow_subscription`
- `inoreader_rename_tag`
- `inoreader_delete_tag`

Tool inputs will use descriptive names such as `itemIds`, `streamId`, `tagName`, `sourceTagId`, and `destinationName`.

## Testing

Add regression tests for:

- Config accepts and redacts `INOREADER_ACCESS_TOKEN`.
- Authenticated requests include the bearer token.
- Missing token fails only authenticated client methods.
- Read responses decode into typed domain values.
- Plain `OK` write responses return success.
- Article write requests encode repeated item IDs.
- Non-OK responses map to the expected tagged error.
- MCP tool registration includes the new tool names.

Tests should avoid real Inoreader network calls by using a fake or injectable HTTP boundary.

## Documentation

Update the README with:

- Required `INOREADER_ACCESS_TOKEN` for authenticated tools.
- Optional `INOREADER_API_BASE_URL`.
- The read and write MCP tool list.
- The verification commands.

## Acceptance Criteria

- The client and MCP tools compile under strict TypeScript settings.
- Existing status behavior still works without a token.
- Authenticated tools fail clearly when the token is missing.
- Tests cover representative read, write, and error behavior without network calls.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` pass.
