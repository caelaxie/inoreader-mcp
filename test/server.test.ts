import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import type { InoreaderClient } from "../src/inoreader/client.js";
import { InoreaderAuthError } from "../src/inoreader/errors.js";
import { createInoreaderMcpServer } from "../src/server.js";

const config = {
  appName: "inoreader-mcp",
  appVersion: "1.0.0",
  inoreaderApiBaseUrl: "https://www.inoreader.com/reader/api/0",
  inoreaderOAuthTokenUrl: "https://www.inoreader.com/oauth2/token",
  inoreaderClientId: "client-id",
  inoreaderClientSecret: "client-secret",
  inoreaderRefreshToken: "refresh-token"
};

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

describe("createInoreaderMcpServer", () => {
  it("creates a named MCP server without connecting a transport", () => {
    const server = createInoreaderMcpServer(config);

    expect(server.metadata).toEqual({
      name: "inoreader-mcp",
      version: "1.0.0"
    });
    expect(server.toolNames).toEqual([
      "inoreader_status",
      "inoreader_get_user_info",
      "inoreader_list_subscriptions",
      "inoreader_get_unread_counts",
      "inoreader_get_stream_contents",
      "inoreader_mark_read",
      "inoreader_mark_unread",
      "inoreader_star_article",
      "inoreader_unstar_article",
      "inoreader_like_article",
      "inoreader_unlike_article",
      "inoreader_broadcast_article",
      "inoreader_unbroadcast_article",
      "inoreader_add_article_tag",
      "inoreader_remove_article_tag",
      "inoreader_edit_subscription",
      "inoreader_follow_subscription",
      "inoreader_unfollow_subscription",
      "inoreader_rename_tag",
      "inoreader_delete_tag"
    ]);
    const userInfoMetadata = server.toolMetadata.find(
      ({ name }) => name === "inoreader_get_user_info"
    );
    const deleteTagMetadata = server.toolMetadata.find(
      ({ name }) => name === "inoreader_delete_tag"
    );
    const starArticleMetadata = server.toolMetadata.find(
      ({ name }) => name === "inoreader_star_article"
    );

    expect(userInfoMetadata?.annotations).toEqual({
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true
    });
    expect(userInfoMetadata?.outputSchema).toBeDefined();
    expect(deleteTagMetadata?.annotations).toEqual({
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: true
    });
    expect(deleteTagMetadata?.outputSchema).toBeDefined();
    expect(starArticleMetadata?.annotations).toEqual({
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    });
    expect(starArticleMetadata?.outputSchema).toBeDefined();
  });

  it("returns concise text and structured content for successful write tool calls", async () => {
    const server = createInoreaderMcpServer(config, { client: makeFakeClient() });

    const tool = server.registeredTools.find(
      ({ name }) => name === "inoreader_star_article"
    );

    const result = await tool?.handler({ itemIds: ["item-1"] });

    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: "Starred Inoreader article items."
        }
      ],
      structuredContent: { ok: true }
    });
  });

  it("returns concise text and structured content for successful tool calls", async () => {
    const server = createInoreaderMcpServer(config, { client: makeFakeClient() });

    const tool = server.registeredTools.find(
      ({ name }) => name === "inoreader_get_user_info"
    );

    const result = await tool?.handler({});

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

  it("returns isError for API client failures", async () => {
    const server = createInoreaderMcpServer(
      config,
      {
        client: makeFakeClient({
          getUserInfo: () =>
            Effect.fail(
              new InoreaderAuthError({
                message: "Inoreader OAuth token refresh failed"
              })
            )
        })
      }
    );

    const tool = server.registeredTools.find(
      ({ name }) => name === "inoreader_get_user_info"
    );

    const result = await tool?.handler({});

    expect(result).toEqual({
      isError: true,
      content: [
        {
          type: "text",
          text: "Inoreader OAuth token refresh failed"
        }
      ]
    });
  });

  it("reports OAuth configuration in the status tool", async () => {
    const server = createInoreaderMcpServer(config, { client: makeFakeClient() });
    const tool = server.registeredTools.find(
      ({ name }) => name === "inoreader_status"
    );

    const result = await tool?.handler({});

    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: "Inoreader MCP server configuration loaded."
        }
      ],
      structuredContent: {
        ok: true,
        service: "inoreader-mcp",
        inoreaderApiBaseUrl: "https://www.inoreader.com/reader/api/0",
        inoreaderOAuthConfigured: true
      }
    });
  });
});
