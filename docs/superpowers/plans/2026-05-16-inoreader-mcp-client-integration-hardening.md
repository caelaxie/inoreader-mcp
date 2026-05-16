# Inoreader MCP Client Integration Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Harden the existing MCP-to-Inoreader-client bridge with MCP-standard structured success output, tool-level error results, annotations, output schemas, and regression coverage.

**Architecture:** Keep the existing `InoreaderClient` interface and dependency injection boundary. Add small MCP result/metadata helpers inside `src/server.ts` so tool handlers consistently return concise text plus `structuredContent` on success and `isError: true` plus text on API/client failures. Strengthen tests with fake clients and fake transports so no real Inoreader network calls are needed.

**Tech Stack:** TypeScript, Effect, MCP TypeScript SDK, Zod v4, Vitest, pnpm.

---

## Dependency Graph

```text
T1: Add API-client hardening tests -> depends_on: []
T2: Normalize MCP result helpers -> depends_on: []
T3: Add output schemas and annotations -> depends_on: [T2]
T4: Add MCP wrapper regression tests -> depends_on: [T2, T3]
T5: Update README docs -> depends_on: [T2, T3]
T6: Run full verification and commit implementation -> depends_on: [T1, T2, T3, T4, T5]
```

## File Structure

- Modify `src/server.ts`: add reusable MCP success/error formatting, tool metadata constants, output schemas, annotations, and test-visible tool metadata.
- Modify `test/inoreader-client.test.ts`: add missing client error and request-encoding regression tests.
- Modify `test/server.test.ts`: add fake-client tests for structured success, `isError` failure, and representative metadata.
- Modify `README.md`: document structured output, tool-level errors, and annotations.

## Task T1: Add API-Client Hardening Tests

**Files:**
- Modify: `test/inoreader-client.test.ts`

- [x] **Step 1: Add auth and HTTP failure tests**

Append these tests inside `describe("createInoreaderClient", ...)`:

```ts
  it("maps HTTP 401 and 403 responses to auth errors", async () => {
    for (const status of [401, 403]) {
      const client = createInoreaderClient(
        {
          appName: "inoreader-mcp",
          appVersion: "1.0.0",
          inoreaderApiBaseUrl: "https://www.inoreader.com/reader/api/0",
          inoreaderAccessToken: "secret-token"
        },
        () => Effect.succeed({ status, body: "Unauthorized" })
      );

      await expect(
        Effect.runPromise(Effect.flip(client.getUserInfo()))
      ).resolves.toMatchObject({
        _tag: "InoreaderAuthError",
        status
      });
    }
  });

  it("maps invalid response bodies to decode errors", async () => {
    const client = createInoreaderClient(
      {
        appName: "inoreader-mcp",
        appVersion: "1.0.0",
        inoreaderApiBaseUrl: "https://www.inoreader.com/reader/api/0",
        inoreaderAccessToken: "secret-token"
      },
      () => Effect.succeed({ status: 200, body: { unexpected: true } })
    );

    await expect(
      Effect.runPromise(Effect.flip(client.getUnreadCounts()))
    ).resolves.toMatchObject({
      _tag: "InoreaderDecodeError"
    });
  });

  it("maps non-auth HTTP failures to HTTP errors with status and body", async () => {
    const client = createInoreaderClient(
      {
        appName: "inoreader-mcp",
        appVersion: "1.0.0",
        inoreaderApiBaseUrl: "https://www.inoreader.com/reader/api/0",
        inoreaderAccessToken: "secret-token"
      },
      () => Effect.succeed({ status: 500, body: { error: "upstream" } })
    );

    await expect(
      Effect.runPromise(Effect.flip(client.getUnreadCounts()))
    ).resolves.toMatchObject({
      _tag: "InoreaderHttpError",
      status: 500,
      body: "{\"error\":\"upstream\"}"
    });
  });
```

- [x] **Step 2: Add subscription and tag request encoding tests**

Append these tests inside the same `describe("createInoreaderClient", ...)` block:

```ts
  it("encodes subscription edit actions with descriptive client options", async () => {
    const requests: Parameters<InoreaderHttpTransport>[0][] = [];
    const transport: InoreaderHttpTransport = (request) =>
      Effect.sync(() => {
        requests.push(request);
        return { status: 200, body: "OK" };
      });

    const client = createInoreaderClient(
      {
        appName: "inoreader-mcp",
        appVersion: "1.0.0",
        inoreaderApiBaseUrl: "https://www.inoreader.com/reader/api/0",
        inoreaderAccessToken: "secret-token"
      },
      transport
    );

    await Effect.runPromise(
      client.editSubscription({
        streamId: "feed/https://example.test/feed.xml",
        title: "Example Feed",
        addFolderId: "user/-/label/Tech",
        removeFolderId: "user/-/label/Old"
      })
    );

    expect(requests[0]).toMatchObject({
      method: "POST",
      path: "/subscription/edit"
    });
    expect(requests[0]?.query).toEqual([
      ["ac", "edit"],
      ["s", "feed/https://example.test/feed.xml"],
      ["t", "Example Feed"],
      ["a", "user/-/label/Tech"],
      ["r", "user/-/label/Old"]
    ]);
  });

  it("encodes tag rename and delete requests", async () => {
    const requests: Parameters<InoreaderHttpTransport>[0][] = [];
    const transport: InoreaderHttpTransport = (request) =>
      Effect.sync(() => {
        requests.push(request);
        return { status: 200, body: "OK" };
      });

    const client = createInoreaderClient(
      {
        appName: "inoreader-mcp",
        appVersion: "1.0.0",
        inoreaderApiBaseUrl: "https://www.inoreader.com/reader/api/0",
        inoreaderAccessToken: "secret-token"
      },
      transport
    );

    await Effect.runPromise(
      client.renameTag("user/-/label/Old", "New Label")
    );
    await Effect.runPromise(client.deleteTag("user/-/label/New Label"));

    expect(requests[0]).toMatchObject({
      method: "POST",
      path: "/rename-tag",
      query: [
        ["s", "user/-/label/Old"],
        ["dest", "New Label"]
      ]
    });
    expect(requests[1]).toMatchObject({
      method: "POST",
      path: "/disable-tag",
      query: [["s", "user/-/label/New Label"]]
    });
  });
```

- [x] **Step 3: Run focused client tests**

Run:

```bash
pnpm test test/inoreader-client.test.ts
```

Expected: tests pass because the existing client already implements these behaviors. If a test fails, fix the client implementation rather than weakening the assertion.

## Task T2: Normalize MCP Result Helpers

**Files:**
- Modify: `src/server.ts`

- [x] **Step 1: Import MCP result type**

Update the imports at the top of `src/server.ts`:

```ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
```

- [x] **Step 2: Replace JSON-only helpers with MCP-standard result helpers**

Inside `createInoreaderMcpServer`, replace the existing `jsonText` and `runTool` helpers with:

```ts
  const successResult = (
    message: string,
    payload: Record<string, unknown>
  ): CallToolResult => ({
    content: [
      {
        type: "text" as const,
        text: message
      }
    ],
    structuredContent: payload
  });

  const errorMessage = (error: unknown): string =>
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error
        ? String(error.message)
        : typeof error === "object" && error !== null && "_tag" in error
          ? String(error._tag)
          : String(error);

  const errorResult = (error: unknown): CallToolResult => ({
    isError: true,
    content: [
      {
        type: "text" as const,
        text: errorMessage(error)
      }
    ]
  });

  const runTool = async <A extends Record<string, unknown>>(
    effect: Effect.Effect<A, unknown>,
    message: string
  ): Promise<CallToolResult> =>
    Effect.runPromise(
      effect.pipe(
        Effect.match({
          onFailure: errorResult,
          onSuccess: (payload) => successResult(message, payload)
        })
      )
    );
```

- [x] **Step 3: Update status tool result**

Replace the status tool callback body with:

```ts
    async () =>
      successResult("Inoreader MCP server configuration loaded.", {
        ok: true,
        service: config.appName,
        inoreaderApiBaseUrl: config.inoreaderApiBaseUrl,
        inoreaderAccessTokenConfigured: Boolean(config.inoreaderAccessToken)
      })
```

- [x] **Step 4: Update all client-backed tool callbacks to pass messages**

Update each `runTool(...)` call with a concise success message:

```ts
    async () =>
      runTool(client.getUserInfo(), "Fetched authenticated Inoreader user info.")
```

Use these messages:

```text
inoreader_list_subscriptions -> Listed Inoreader subscriptions.
inoreader_get_unread_counts -> Fetched Inoreader unread counts.
inoreader_get_stream_contents -> Fetched Inoreader stream contents.
inoreader_mark_read -> Marked Inoreader article items as read.
inoreader_mark_unread -> Marked Inoreader article items as unread.
inoreader_star_article -> Starred Inoreader article items.
inoreader_unstar_article -> Removed stars from Inoreader article items.
inoreader_like_article -> Liked Inoreader article items.
inoreader_unlike_article -> Removed likes from Inoreader article items.
inoreader_broadcast_article -> Broadcast Inoreader article items.
inoreader_unbroadcast_article -> Removed broadcasts from Inoreader article items.
inoreader_add_article_tag -> Added an Inoreader tag to article items.
inoreader_remove_article_tag -> Removed an Inoreader tag from article items.
inoreader_edit_subscription -> Edited an Inoreader subscription.
inoreader_follow_subscription -> Followed an Inoreader subscription.
inoreader_unfollow_subscription -> Unfollowed an Inoreader subscription.
inoreader_rename_tag -> Renamed an Inoreader tag.
inoreader_delete_tag -> Deleted an Inoreader tag.
```

- [x] **Step 5: Run typecheck**

Run:

```bash
pnpm typecheck
```

Expected: typecheck passes. If TypeScript rejects specific client result types as not assignable to `Record<string, unknown>`, widen `runTool` to accept `Effect.Effect<unknown, unknown>` and cast only inside `successResult` after checking `typeof payload === "object" && payload !== null`.

## Task T3: Add Output Schemas And Annotations

**Files:**
- Modify: `src/server.ts`

- [x] **Step 1: Add common output schemas near the existing tool-name constants**

Add:

```ts
const okOutputSchema = z.object({
  ok: z.literal(true)
});

const statusOutputSchema = z.object({
  ok: z.literal(true),
  service: z.string(),
  inoreaderApiBaseUrl: z.string(),
  inoreaderAccessTokenConfigured: z.boolean()
});

const userInfoOutputSchema = z.object({
  userId: z.string(),
  userName: z.string(),
  userProfileId: z.string(),
  userEmail: z.string(),
  isBloggerUser: z.boolean(),
  signupTimeSec: z.number(),
  isMultiLoginEnabled: z.boolean()
});

const subscriptionListOutputSchema = z.object({
  subscriptions: z.array(z.record(z.string(), z.unknown()))
});

const unreadCountsOutputSchema = z.object({
  max: z.string(),
  unreadcounts: z.array(z.record(z.string(), z.unknown()))
});

const streamContentsOutputSchema = z.object({
  direction: z.string(),
  id: z.string(),
  title: z.string(),
  description: z.string(),
  updated: z.number(),
  updatedUsec: z.string(),
  continuation: z.string().optional(),
  items: z.array(z.record(z.string(), z.unknown()))
});
```

- [x] **Step 2: Add common annotations near the schemas**

Add:

```ts
const readToolAnnotations = {
  readOnlyHint: true,
  idempotentHint: true,
  openWorldHint: true
} as const;

const nonDestructiveWriteAnnotations = {
  readOnlyHint: false,
  idempotentHint: true,
  destructiveHint: false,
  openWorldHint: true
} as const;

const destructiveWriteAnnotations = {
  readOnlyHint: false,
  idempotentHint: true,
  destructiveHint: true,
  openWorldHint: true
} as const;
```

- [x] **Step 3: Add output schemas and annotations to representative read tools**

For `inoreader_status`, set:

```ts
      outputSchema: statusOutputSchema,
      annotations: readToolAnnotations
```

For `inoreader_get_user_info`, set:

```ts
      outputSchema: userInfoOutputSchema,
      annotations: readToolAnnotations
```

For the other read tools, use `subscriptionListOutputSchema`, `unreadCountsOutputSchema`, and `streamContentsOutputSchema` respectively with `readToolAnnotations`.

- [x] **Step 4: Add annotations and OK output schema to write tools**

For additive or non-removal writes, use:

```ts
      outputSchema: okOutputSchema,
      annotations: nonDestructiveWriteAnnotations
```

Apply this to:

```text
inoreader_star_article
inoreader_like_article
inoreader_broadcast_article
inoreader_add_article_tag
inoreader_follow_subscription
inoreader_edit_subscription
inoreader_rename_tag
```

For removal or user-visible state-clearing writes, use:

```ts
      outputSchema: okOutputSchema,
      annotations: destructiveWriteAnnotations
```

Apply this to:

```text
inoreader_mark_read
inoreader_mark_unread
inoreader_unstar_article
inoreader_unlike_article
inoreader_unbroadcast_article
inoreader_remove_article_tag
inoreader_unfollow_subscription
inoreader_delete_tag
```

- [x] **Step 5: Expose test-visible tool metadata**

Add this interface:

```ts
export interface InoreaderMcpToolMetadata {
  readonly name: string;
  readonly outputSchema: unknown;
  readonly annotations: unknown;
}
```

Add this property to `InoreaderMcpServer`:

```ts
  readonly toolMetadata: readonly InoreaderMcpToolMetadata[];
```

Build `toolMetadata` from the same names, schemas, and annotations used during registration, then return it with `metadata`, `server`, and `toolNames`.

- [x] **Step 6: Run typecheck**

Run:

```bash
pnpm typecheck
```

Expected: typecheck passes.

## Task T4: Add MCP Wrapper Regression Tests

**Files:**
- Modify: `test/server.test.ts`

- [x] **Step 1: Import Effect and error type**

Update imports:

```ts
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { InoreaderAuthError } from "../src/inoreader/errors.js";
import { createInoreaderMcpServer } from "../src/server.js";
import type { InoreaderClient } from "../src/inoreader/client.js";
```

- [x] **Step 2: Add fake client factory**

Add this helper above the `describe` block:

```ts
const makeFakeClient = (
  overrides: Partial<InoreaderClient> = {}
): InoreaderClient => ({
  getUserInfo: () =>
    Effect.succeed({
      userId: "1001921515",
      userName: "reader",
      userProfileId: "1001921515",
      userEmail: "reader@example.test",
      isBloggerUser: false,
      signupTimeSec: 1163850013,
      isMultiLoginEnabled: false
    }),
  listSubscriptions: () => Effect.succeed({ subscriptions: [] }),
  getUnreadCounts: () => Effect.succeed({ max: "1000", unreadcounts: [] }),
  getStreamContents: () =>
    Effect.succeed({
      direction: "ltr",
      id: "feed/https://example.test/feed.xml",
      title: "Example",
      description: "",
      updated: 1618212570,
      updatedUsec: "1618212570146918",
      items: []
    }),
  markRead: () => Effect.succeed({ ok: true as const }),
  markUnread: () => Effect.succeed({ ok: true as const }),
  star: () => Effect.succeed({ ok: true as const }),
  unstar: () => Effect.succeed({ ok: true as const }),
  like: () => Effect.succeed({ ok: true as const }),
  unlike: () => Effect.succeed({ ok: true as const }),
  broadcast: () => Effect.succeed({ ok: true as const }),
  unbroadcast: () => Effect.succeed({ ok: true as const }),
  addArticleTag: () => Effect.succeed({ ok: true as const }),
  removeArticleTag: () => Effect.succeed({ ok: true as const }),
  editSubscription: () => Effect.succeed({ ok: true as const }),
  followSubscription: () => Effect.succeed({ ok: true as const }),
  unfollowSubscription: () => Effect.succeed({ ok: true as const }),
  renameTag: () => Effect.succeed({ ok: true as const }),
  deleteTag: () => Effect.succeed({ ok: true as const }),
  ...overrides
});
```

- [x] **Step 3: Add metadata assertions**

Extend the existing server creation test with:

```ts
    expect(server.toolMetadata).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "inoreader_get_user_info",
          annotations: expect.objectContaining({
            readOnlyHint: true,
            idempotentHint: true,
            openWorldHint: true
          })
        }),
        expect.objectContaining({
          name: "inoreader_delete_tag",
          annotations: expect.objectContaining({
            readOnlyHint: false,
            destructiveHint: true,
            idempotentHint: true,
            openWorldHint: true
          })
        }),
        expect.objectContaining({
          name: "inoreader_star_article",
          annotations: expect.objectContaining({
            readOnlyHint: false,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: true
          })
        })
      ])
    );
```

- [x] **Step 4: Add handler-facing regression seam if needed**

If direct MCP handler invocation is not practical through the SDK public API, add this test seam to `src/server.ts`:

```ts
export interface RegisteredInoreaderTool {
  readonly name: string;
  readonly handler: (input: never) => Promise<CallToolResult>;
}
```

Add `readonly registeredTools: readonly RegisteredInoreaderTool[];` to `InoreaderMcpServer`, populate it alongside `server.registerTool`, and return it. Keep this as a test-visible mirror of public tool behavior; do not use private SDK internals.

- [x] **Step 5: Add structured success result test**

Add:

```ts
  it("returns concise text and structured content for successful tool calls", async () => {
    const server = createInoreaderMcpServer(
      {
        appName: "inoreader-mcp",
        appVersion: "1.0.0",
        inoreaderApiBaseUrl: "https://www.inoreader.com/reader/api/0",
        inoreaderAccessToken: "secret-token"
      },
      { client: makeFakeClient() }
    );

    const tool = server.registeredTools.find(
      ({ name }) => name === "inoreader_get_user_info"
    );

    const result = await tool?.handler(undefined as never);

    expect(result).toMatchObject({
      content: [
        {
          type: "text",
          text: "Fetched authenticated Inoreader user info."
        }
      ],
      structuredContent: {
        userName: "reader",
        userEmail: "reader@example.test"
      }
    });
  });
```

- [x] **Step 6: Add tool-level error result test**

Add:

```ts
  it("returns isError for API client failures", async () => {
    const server = createInoreaderMcpServer(
      {
        appName: "inoreader-mcp",
        appVersion: "1.0.0",
        inoreaderApiBaseUrl: "https://www.inoreader.com/reader/api/0"
      },
      {
        client: makeFakeClient({
          getUserInfo: () =>
            Effect.fail(
              new InoreaderAuthError({
                message: "INOREADER_ACCESS_TOKEN is required for this tool"
              })
            )
        })
      }
    );

    const tool = server.registeredTools.find(
      ({ name }) => name === "inoreader_get_user_info"
    );

    const result = await tool?.handler(undefined as never);

    expect(result).toEqual({
      isError: true,
      content: [
        {
          type: "text",
          text: "INOREADER_ACCESS_TOKEN is required for this tool"
        }
      ]
    });
  });
```

- [x] **Step 7: Run focused server tests**

Run:

```bash
pnpm test test/server.test.ts
```

Expected: tests pass.

## Task T5: Update README Docs

**Files:**
- Modify: `README.md`

- [x] **Step 1: Add MCP response behavior section**

Insert after the environment section:

```md
## MCP Responses

Successful API-backed tools return concise text for the model and `structuredContent` for MCP clients that consume JSON output programmatically.

API and client failures are returned as MCP tool-level errors with `isError: true` and a readable message. They are not thrown as protocol errors unless the MCP server itself cannot handle the request.

Read tools are annotated as read-only and idempotent. Write tools are annotated as state-changing, and operations that remove or hide user-visible Inoreader state are marked destructive.
```

- [x] **Step 2: Run README-adjacent checks**

Run:

```bash
pnpm lint
```

Expected: lint passes. This project has no markdown linter configured, so lint verifies the TypeScript files affected by the code tasks.

## Task T6: Run Full Verification And Commit Implementation

**Files:**
- Modify: all files touched by previous tasks

- [x] **Step 1: Run full verification**

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Expected: all commands pass.

- [x] **Step 2: Review final diff**

Run:

```bash
git diff --check
git diff --stat
```

Expected: no whitespace errors, and the diff is limited to `src/server.ts`, `test/inoreader-client.test.ts`, `test/server.test.ts`, and `README.md`.

- [x] **Step 3: Commit implementation**

Run:

```bash
git add src/server.ts test/inoreader-client.test.ts test/server.test.ts README.md docs/superpowers/plans/2026-05-16-inoreader-mcp-client-integration-hardening.md
git commit -m "feat: harden inoreader mcp tool responses"
```

Expected: commit succeeds with the implementation and plan.
