import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Effect } from "effect";
import { z } from "zod/v4";

import type { InoreaderMcpConfig } from "./config.js";
import {
  createInoreaderClient,
  createLiveInoreaderHttpTransport,
  type InoreaderClient
} from "./inoreader/client.js";

const statusToolName = "inoreader_status";
const getUserInfoToolName = "inoreader_get_user_info";
const listSubscriptionsToolName = "inoreader_list_subscriptions";
const getUnreadCountsToolName = "inoreader_get_unread_counts";
const getStreamContentsToolName = "inoreader_get_stream_contents";
const markReadToolName = "inoreader_mark_read";
const markUnreadToolName = "inoreader_mark_unread";
const starArticleToolName = "inoreader_star_article";
const unstarArticleToolName = "inoreader_unstar_article";
const likeArticleToolName = "inoreader_like_article";
const unlikeArticleToolName = "inoreader_unlike_article";
const broadcastArticleToolName = "inoreader_broadcast_article";
const unbroadcastArticleToolName = "inoreader_unbroadcast_article";
const addArticleTagToolName = "inoreader_add_article_tag";
const removeArticleTagToolName = "inoreader_remove_article_tag";
const editSubscriptionToolName = "inoreader_edit_subscription";
const followSubscriptionToolName = "inoreader_follow_subscription";
const unfollowSubscriptionToolName = "inoreader_unfollow_subscription";
const renameTagToolName = "inoreader_rename_tag";
const deleteTagToolName = "inoreader_delete_tag";

export interface InoreaderMcpServer {
  readonly metadata: {
    readonly name: string;
    readonly version: string;
  };
  readonly server: McpServer;
  readonly toolNames: readonly string[];
}

export interface InoreaderMcpServerOptions {
  readonly client?: InoreaderClient;
}

export const createInoreaderMcpServer = (
  config: InoreaderMcpConfig,
  options: InoreaderMcpServerOptions = {}
): InoreaderMcpServer => {
  const metadata = {
    name: config.appName,
    version: config.appVersion
  };
  const client =
    options.client ??
    createInoreaderClient(
      config,
      createLiveInoreaderHttpTransport(config.inoreaderApiBaseUrl)
    );
  const server = new McpServer(metadata, {
    instructions:
      "Use this local MCP server to interact with Inoreader. Configure credentials before calling tools that require account access."
  });
  const jsonText = (payload: unknown) => ({
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(payload, null, 2)
      }
    ]
  });
  const runTool = async <A>(effect: Effect.Effect<A, unknown>) => {
    const payload = await Effect.runPromise(
      effect.pipe(
        Effect.catchAll((error) =>
          Effect.succeed({
            ok: false,
            error:
              error instanceof Error
                ? error.message
                : typeof error === "object" && error !== null && "_tag" in error
                  ? String(error._tag)
                  : String(error)
          })
        )
      )
    );

    return jsonText(payload);
  };
  const itemIdsSchema = z.object({
    itemIds: z.array(z.string().min(1)).min(1)
  });
  const subscriptionEditSchema = z.object({
    streamId: z.string().min(1),
    title: z.string().min(1).optional(),
    addFolderId: z.string().min(1).optional(),
    removeFolderId: z.string().min(1).optional()
  });
  const compactSubscriptionOptions = (
    input: z.infer<typeof subscriptionEditSchema>
  ) => ({
    streamId: input.streamId,
    ...(input.title === undefined ? {} : { title: input.title }),
    ...(input.addFolderId === undefined
      ? {}
      : { addFolderId: input.addFolderId }),
    ...(input.removeFolderId === undefined
      ? {}
      : { removeFolderId: input.removeFolderId })
  });

  server.registerTool(
    statusToolName,
    {
      description:
        "Report whether the local Inoreader MCP server is configured and reachable.",
      inputSchema: z.object({})
    },
    async () => {
      const payload = await Effect.runPromise(
        Effect.succeed({
          ok: true,
          service: config.appName,
          inoreaderApiBaseUrl: config.inoreaderApiBaseUrl,
          inoreaderAccessTokenConfigured: Boolean(config.inoreaderAccessToken)
        })
      );

      return jsonText(payload);
    }
  );

  server.registerTool(
    getUserInfoToolName,
    {
      description: "Fetch basic information for the authenticated Inoreader user.",
      inputSchema: z.object({})
    },
    async () => runTool(client.getUserInfo())
  );

  server.registerTool(
    listSubscriptionsToolName,
    {
      description: "List subscriptions for the authenticated Inoreader user.",
      inputSchema: z.object({
        teamAssets: z.boolean().optional()
      })
    },
    async ({ teamAssets }) =>
      runTool(
        client.listSubscriptions(
          teamAssets === undefined ? {} : { teamAssets }
        )
      )
  );

  server.registerTool(
    getUnreadCountsToolName,
    {
      description: "Fetch unread counts for feeds, folders, and tags.",
      inputSchema: z.object({})
    },
    async () => runTool(client.getUnreadCounts())
  );

  server.registerTool(
    getStreamContentsToolName,
    {
      description: "Fetch articles from an Inoreader stream.",
      inputSchema: z.object({
        streamId: z.string().min(1),
        count: z.number().int().min(1).max(100).optional(),
        order: z.enum(["newest", "oldest"]).optional(),
        olderThanUnixTime: z.number().int().positive().optional(),
        excludeRead: z.boolean().optional(),
        continuation: z.string().min(1).optional()
      })
    },
    async (input) =>
      runTool(
        client.getStreamContents({
          streamId: input.streamId,
          ...(input.count === undefined ? {} : { count: input.count }),
          ...(input.order === undefined ? {} : { order: input.order }),
          ...(input.olderThanUnixTime === undefined
            ? {}
            : { olderThanUnixTime: input.olderThanUnixTime }),
          ...(input.excludeRead === undefined
            ? {}
            : { excludeRead: input.excludeRead }),
          ...(input.continuation === undefined
            ? {}
            : { continuation: input.continuation })
        })
      )
  );

  server.registerTool(
    markReadToolName,
    {
      description: "Mark Inoreader article items as read.",
      inputSchema: itemIdsSchema
    },
    async ({ itemIds }) => runTool(client.markRead(itemIds))
  );

  server.registerTool(
    markUnreadToolName,
    {
      description: "Mark Inoreader article items as unread.",
      inputSchema: itemIdsSchema
    },
    async ({ itemIds }) => runTool(client.markUnread(itemIds))
  );

  server.registerTool(
    starArticleToolName,
    {
      description: "Star Inoreader article items.",
      inputSchema: itemIdsSchema
    },
    async ({ itemIds }) => runTool(client.star(itemIds))
  );

  server.registerTool(
    unstarArticleToolName,
    {
      description: "Remove stars from Inoreader article items.",
      inputSchema: itemIdsSchema
    },
    async ({ itemIds }) => runTool(client.unstar(itemIds))
  );

  server.registerTool(
    likeArticleToolName,
    {
      description: "Like Inoreader article items.",
      inputSchema: itemIdsSchema
    },
    async ({ itemIds }) => runTool(client.like(itemIds))
  );

  server.registerTool(
    unlikeArticleToolName,
    {
      description: "Remove likes from Inoreader article items.",
      inputSchema: itemIdsSchema
    },
    async ({ itemIds }) => runTool(client.unlike(itemIds))
  );

  server.registerTool(
    broadcastArticleToolName,
    {
      description: "Broadcast Inoreader article items.",
      inputSchema: itemIdsSchema
    },
    async ({ itemIds }) => runTool(client.broadcast(itemIds))
  );

  server.registerTool(
    unbroadcastArticleToolName,
    {
      description: "Remove broadcasts from Inoreader article items.",
      inputSchema: itemIdsSchema
    },
    async ({ itemIds }) => runTool(client.unbroadcast(itemIds))
  );

  server.registerTool(
    addArticleTagToolName,
    {
      description: "Add a custom Inoreader tag to article items.",
      inputSchema: z.object({
        itemIds: z.array(z.string().min(1)).min(1),
        tagName: z.string().min(1)
      })
    },
    async ({ itemIds, tagName }) =>
      runTool(client.addArticleTag(itemIds, tagName))
  );

  server.registerTool(
    removeArticleTagToolName,
    {
      description: "Remove a custom Inoreader tag from article items.",
      inputSchema: z.object({
        itemIds: z.array(z.string().min(1)).min(1),
        tagName: z.string().min(1)
      })
    },
    async ({ itemIds, tagName }) =>
      runTool(client.removeArticleTag(itemIds, tagName))
  );

  server.registerTool(
    editSubscriptionToolName,
    {
      description: "Rename a subscription or add/remove it from folders.",
      inputSchema: subscriptionEditSchema
    },
    async (input) =>
      runTool(client.editSubscription(compactSubscriptionOptions(input)))
  );

  server.registerTool(
    followSubscriptionToolName,
    {
      description: "Follow a feed and optionally rename it or add it to a folder.",
      inputSchema: subscriptionEditSchema
    },
    async (input) =>
      runTool(client.followSubscription(compactSubscriptionOptions(input)))
  );

  server.registerTool(
    unfollowSubscriptionToolName,
    {
      description: "Unfollow an Inoreader feed.",
      inputSchema: z.object({
        streamId: z.string().min(1)
      })
    },
    async ({ streamId }) => runTool(client.unfollowSubscription(streamId))
  );

  server.registerTool(
    renameTagToolName,
    {
      description: "Rename an Inoreader tag or folder.",
      inputSchema: z.object({
        sourceTagId: z.string().min(1),
        destinationName: z.string().min(1)
      })
    },
    async ({ sourceTagId, destinationName }) =>
      runTool(client.renameTag(sourceTagId, destinationName))
  );

  server.registerTool(
    deleteTagToolName,
    {
      description: "Delete an Inoreader tag or folder.",
      inputSchema: z.object({
        tagId: z.string().min(1)
      })
    },
    async ({ tagId }) => runTool(client.deleteTag(tagId))
  );

  return {
    metadata,
    server,
    toolNames: [
      statusToolName,
      getUserInfoToolName,
      listSubscriptionsToolName,
      getUnreadCountsToolName,
      getStreamContentsToolName,
      markReadToolName,
      markUnreadToolName,
      starArticleToolName,
      unstarArticleToolName,
      likeArticleToolName,
      unlikeArticleToolName,
      broadcastArticleToolName,
      unbroadcastArticleToolName,
      addArticleTagToolName,
      removeArticleTagToolName,
      editSubscriptionToolName,
      followSubscriptionToolName,
      unfollowSubscriptionToolName,
      renameTagToolName,
      deleteTagToolName
    ]
  };
};
