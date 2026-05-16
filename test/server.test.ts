import { describe, expect, it } from "vitest";

import { createInoreaderMcpServer } from "../src/server.js";

describe("createInoreaderMcpServer", () => {
  it("creates a named MCP server without connecting a transport", () => {
    const server = createInoreaderMcpServer({
      appName: "inoreader-mcp",
      appVersion: "1.0.0",
      inoreaderApiBaseUrl: "https://www.inoreader.com/reader/api/0"
    });

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
  });
});
