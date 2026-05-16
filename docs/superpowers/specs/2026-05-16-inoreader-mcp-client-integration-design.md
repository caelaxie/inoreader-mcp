# Inoreader MCP Client Integration Hardening Design

## Summary

Harden the existing bridge between the MCP tools and the Inoreader API client. The current code already registers Inoreader tools and delegates to `createInoreaderClient`. This pass keeps that boundary, then improves the MCP-facing contract so tool calls return current MCP SDK response shapes, expose structured success payloads, mark tool-level failures with `isError`, and advertise tool behavior through annotations.

## Goals

- Keep `src/inoreader/client.ts` responsible for Inoreader HTTP behavior, authentication, endpoint parameters, response decoding, and tagged client errors.
- Keep `src/server.ts` responsible for MCP tool registration, input validation, result formatting, annotations, and output schemas.
- Return concise human-readable text plus `structuredContent` for successful tool calls.
- Return `isError: true` plus clear text for tool-level failures from the API client.
- Add MCP annotations that distinguish read-only tools, state-changing tools, destructive operations, idempotent operations, and open-world API calls.
- Add focused regression tests that prove both client hardening and MCP result formatting.

## Non-Goals

- Redesigning the client interface.
- Adding OAuth or token refresh.
- Adding persistence, caching, background sync, or pagination loops.
- Replacing the existing Effect client with raw promise-based code.
- Adding MCP resources before real usage shows a need.

## Current State

`src/server.ts` constructs an `McpServer`, registers the status/read/write tools, and delegates authenticated operations to an injected `InoreaderClient`. The tests already cover tool-name registration and several client request behaviors. The remaining gap is that MCP tool results are JSON text wrappers without structured output, formal output schemas, or explicit tool annotations.

## Architecture

```text
src/inoreader/client.ts
  owns Inoreader endpoint details, auth, request encoding, response decoding,
  and typed errors

src/server.ts
  owns MCP registration, Zod input schemas, Zod output schemas, annotations,
  success formatting, and tool-error formatting

test/inoreader-client.test.ts
  proves client request, response, and error behavior without network calls

test/server.test.ts
  proves MCP tool metadata and result wrappers with an injected fake client
```

The API client remains dependency-injected into the server so MCP result tests do not perform real Inoreader calls.

## MCP Result Contract

Successful API-backed tools should return a human-readable text summary and a machine-readable structured payload:

```ts
{
  content: [{ type: "text", text: "Fetched authenticated Inoreader user info." }],
  structuredContent: payload
}
```

For tools with stable output shapes, register an `outputSchema` that matches `structuredContent`. This should cover:

- `inoreader_status`
- `inoreader_get_user_info`
- `inoreader_list_subscriptions`
- `inoreader_get_unread_counts`
- article write tools returning `{ ok: true }`
- subscription/tag write tools returning `{ ok: true }`

`inoreader_get_stream_contents` should also return `structuredContent`, but its output schema should be loose enough to tolerate variable article payloads from Inoreader. The local Effect schema can stay stricter for decoded fields the client needs, while the MCP schema should avoid blocking valid extra fields.

Tool-level failures should return `isError: true` and clear text:

```ts
{
  isError: true,
  content: [{ type: "text", text: "INOREADER_ACCESS_TOKEN is required for this tool." }]
}
```

These failures should not be thrown as MCP protocol errors. Protocol errors are reserved for exceptional server or SDK conditions such as unknown tools, unsupported capabilities, or server misconfiguration. The design follows the MCP SDK guidance that ordinary tool execution failures belong in `CallToolResult` so the model can see and recover from them.

Structured error payloads are out of scope for this pass. They can be added later if a concrete MCP client requires machine-readable error metadata.

## Tool Annotations

Read tools:

```ts
annotations: {
  readOnlyHint: true,
  idempotentHint: true,
  openWorldHint: true
}
```

Write tools:

```ts
annotations: {
  readOnlyHint: false,
  idempotentHint: true,
  destructiveHint: true | false,
  openWorldHint: true
}
```

Use `destructiveHint: true` where repeated or accidental use can remove, hide, or materially change user-visible Inoreader state. That includes deleting tags, unfollowing subscriptions, removing article tags, marking items read or unread, un-starring, unliking, and unbroadcasting. Additive state changes such as starring, liking, broadcasting, adding tags, following subscriptions, and renaming or editing subscriptions are not read-only, but they should not be marked destructive unless the operation removes or overwrites existing user-visible organization.

Use `idempotentHint: true` only when repeated calls with the same input are reasonably safe from the caller perspective. If an Inoreader endpoint is discovered to have non-idempotent side effects, omit the hint for that tool.

## Testing

Add regression coverage for:

- MCP success results include concise text and matching `structuredContent`.
- MCP client errors become `isError: true` results instead of thrown protocol errors.
- Tool metadata includes output schemas and annotations for representative read and write tools.
- Status still works without `INOREADER_ACCESS_TOKEN`.
- Client maps `401` and `403` to `InoreaderAuthError`.
- Client maps non-JSON or invalid JSON response bodies to `InoreaderDecodeError`.
- Client maps non-auth, non-rate-limit HTTP failures to `InoreaderHttpError` with status and body.
- Client encodes representative subscription and tag write operations correctly.

Tests must avoid real network calls by injecting a fake client or fake HTTP transport.

## Documentation

Update `README.md` to describe:

- Successful tools return concise text plus structured output.
- API/client failures return MCP tool errors with `isError: true`.
- Read tools are annotated as read-only.
- Write tools are annotated as state-changing, and destructive operations are marked accordingly.

## Dependency Graph

```text
T1: Normalize MCP success and error result helpers -> depends_on: []
T2: Add output schemas and tool annotations -> depends_on: [T1]
T3: Add MCP wrapper regression tests with a fake client -> depends_on: [T1, T2]
T4: Add missing API-client hardening tests -> depends_on: []
T5: Update README for structured output and tool-error behavior -> depends_on: [T1, T2]
T6: Run lint, typecheck, test, and build -> depends_on: [T1, T2, T3, T4, T5]
```

## Acceptance Criteria

- Existing MCP tool names remain stable.
- Successful tools return `structuredContent` for programmatic clients.
- Tool-level API/client failures return `isError: true` and readable text.
- Output schemas are present for stable tool outputs.
- Annotations accurately communicate read-only, state-changing, destructive, idempotent, and open-world behavior.
- Regression tests cover representative read success, write success, auth failure, decode failure, HTTP failure, and MCP metadata.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` pass.
