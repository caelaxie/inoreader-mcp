# Visible Tool Output Contract Design

## Context

The Inoreader MCP server currently returns successful tool calls as a short human message in `content` and the actual payload in `structuredContent`. That is valid MCP, but it is not reliably useful in every client.

OpenCode showed only the visible text for `inoreader_get_user_info`, so the user saw `Fetched authenticated Inoreader user info.` without the account fields. Codex and other MCP clients can also prioritize visible text, even when they accept structured output.

The desired behavior is that every successful tool response is self-sufficient in `content`, while preserving the existing machine-readable `structuredContent` and `outputSchema` contracts.

## Compatibility Findings

The accepted response shape is standard MCP `CallToolResult`:

```ts
{
  content: [{ type: "text", text: "message\n\n<readable data>" }],
  structuredContent: payload,
  isError?: boolean
}
```

OpenCode accepts this shape. Its MCP integration converts tools by calling `client.callTool(..., CallToolResultSchema, ...)`, so standard MCP `content` plus optional `structuredContent` is valid.

Codex accepts this shape. Codex's own MCP interface documents tool responses using both `content` and `structuredContent`, and mirrors content into `structuredContent` for compatibility with clients that prefer structured output.

The MCP TypeScript SDK also accepts this shape: `content` is required unstructured output, `structuredContent` is optional machine-readable JSON, and `isError` is optional. When a tool declares an `outputSchema`, `structuredContent` must match that schema. This design keeps `structuredContent` unchanged, so the current schemas remain valid.

## Goal

Make all successful Inoreader MCP tool calls readable in clients that only show `content`, while preserving typed structured output for clients that consume `structuredContent`.

## Non-Goals

- Do not remove `structuredContent`.
- Do not wrap `structuredContent` in a new envelope such as `{ message, data }`.
- Do not change any existing tool `outputSchema`.
- Do not change Inoreader API request paths, query parameters, authentication, or decoded payload shapes.
- Do not add richer aggregate tools such as account summary in this change.

## Response Contract

Every successful tool call will return:

- `content`: one text block containing the success message, a blank line, and a readable representation of the payload.
- `structuredContent`: the same payload object returned today.

The generic shape is:

```ts
{
  content: [
    {
      type: "text",
      text: `${message}\n\n${formatPayload(payload)}`
    }
  ],
  structuredContent: payload
}
```

Error responses stay unchanged:

```ts
{
  isError: true,
  content: [{ type: "text", text: "<error message>" }]
}
```

## Payload Formatting

Use deterministic JSON formatting for successful payloads:

```ts
JSON.stringify(payload, null, 2)
```

This applies uniformly to object payloads such as user info, subscription lists, unread counts, stream contents, and write acknowledgements like `{ ok: true }`.

Example:

```text
Fetched authenticated Inoreader user info.

{
  "userId": "1001921515",
  "userName": "reader",
  "userProfileId": "1001921515",
  "userEmail": "reader@example.test",
  "isBloggerUser": false,
  "signupTimeSec": 1163850013,
  "isMultiLoginEnabled": false
}
```

The implementation should not truncate payloads in this change. The user's stated goal is to see the actual tool output in clients that currently hide `structuredContent`.

## Architecture

The server already centralizes successful tool responses through `successResult(message, payload)`. Update that helper so every registered tool receives the new visible output behavior automatically.

No per-tool registration changes are needed unless tests expose a tool-specific edge case. Keeping the change central avoids response drift between read tools and write tools.

## Data Flow

1. MCP client calls any Inoreader tool.
2. Server executes the existing Effect for that tool.
3. On success, the decoded payload is passed to `successResult`.
4. `successResult` formats visible text from the message and payload.
5. MCP server returns the visible text in `content` and the unchanged payload in `structuredContent`.

## Error Handling

Authentication, rate limit, HTTP, decode, and validation failures keep the existing `isError: true` response path. The error response only needs human-readable `content`; it does not need `structuredContent`.

If payload formatting itself unexpectedly fails, the implementation should still return the success message and a stringified fallback such as `String(payload)`. In practice all current successful payloads are JSON-compatible plain objects.

## Testing

Update server tests to assert the repo-wide contract:

- Successful read tools include actual JSON payload data in `content[0].text`.
- Successful write tools include `{ "ok": true }` in `content[0].text`.
- `structuredContent` remains exactly the current payload shape.
- Error responses remain unchanged and do not gain successful payload formatting.

Existing client and schema tests should remain valid because Inoreader request behavior and decoded schemas are unchanged.

## Dependency Graph

- `T1`: Update the central `successResult` helper to append deterministic JSON payload text to successful `content`. `depends_on: []`
- `T2`: Update successful read-tool regression tests for visible JSON payload text and unchanged `structuredContent`. `depends_on: [T1]`
- `T3`: Update successful write-tool regression tests for visible `{ "ok": true }` payload text and unchanged `structuredContent`. `depends_on: [T1]`
- `T4`: Verify error-response tests still assert unchanged error behavior. `depends_on: [T1]`
- `T5`: Run focused and full verification. `depends_on: [T2, T3, T4]`
