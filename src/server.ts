import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import type {
  CallToolResult,
  ToolAnnotations
} from "@modelcontextprotocol/sdk/types.js";
import { Effect } from "effect";
import { z } from "zod/v4";

import type { InoreaderMcpConfig } from "./config.js";
import {
  createInoreaderClient,
  createLiveInoreaderHttpTransport,
  type InoreaderClient
} from "./inoreader/client.js";
import { InoreaderAuthError } from "./inoreader/errors.js";

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

const okOutputSchema = z.object({
  ok: z.literal(true)
});

const statusOutputSchema = z.object({
  ok: z.literal(true),
  service: z.string(),
  inoreaderApiBaseUrl: z.string(),
  inoreaderOAuthConfigured: z.boolean()
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

export interface InoreaderMcpToolMetadata {
  readonly name: string;
  readonly outputSchema: unknown;
  readonly annotations: unknown;
}

export interface RegisteredInoreaderTool {
  readonly name: string;
  readonly handler: (
    args: Record<string, unknown>
  ) => Promise<CallToolResult> | CallToolResult;
}

export interface InoreaderMcpServer {
  readonly metadata: {
    readonly name: string;
    readonly version: string;
  };
  readonly server: McpServer;
  readonly toolNames: readonly string[];
  readonly toolMetadata: readonly InoreaderMcpToolMetadata[];
  readonly registeredTools: readonly RegisteredInoreaderTool[];
}

export interface InoreaderMcpServerOptions {
  readonly client?: InoreaderClient;
  readonly oauthConfigured?: boolean;
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
      () =>
        Effect.fail(
          new InoreaderAuthError({
            message:
              "Inoreader OAuth credentials are missing. Visit the remote MCP setup URL first."
          })
        ),
      createLiveInoreaderHttpTransport(config.inoreaderApiBaseUrl)
    );
  const server = new McpServer(metadata, {
    instructions:
      "Use this remote MCP server to interact with Inoreader. Configure Inoreader OAuth through the Cloudflare Worker setup route before calling account tools."
  });

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

  const toStructuredPayload = (payload: unknown): Record<string, unknown> =>
    typeof payload === "object" && payload !== null
      ? (payload as Record<string, unknown>)
      : { value: payload };

  const runTool = async (
    effect: Effect.Effect<unknown, unknown>,
    message: string
  ): Promise<CallToolResult> =>
    Effect.runPromise(
      effect.pipe(
        Effect.match({
          onFailure: errorResult,
          onSuccess: (payload) =>
            successResult(message, toStructuredPayload(payload))
        })
      )
    );
  const toolMetadata: InoreaderMcpToolMetadata[] = [];
  const registeredTools: RegisteredInoreaderTool[] = [];
  const registerTool = <
    InputSchema extends z.ZodType,
    OutputSchema extends z.ZodType
  >(
    name: string,
    definition: {
      readonly description: string;
      readonly inputSchema: InputSchema;
      readonly outputSchema: OutputSchema;
      readonly annotations: ToolAnnotations;
    },
    handler: ToolCallback<InputSchema>
  ) => {
    toolMetadata.push({
      name,
      outputSchema: definition.outputSchema,
      annotations: definition.annotations
    });
    registeredTools.push({
      name,
      handler: handler as unknown as RegisteredInoreaderTool["handler"]
    });
    server.registerTool(name, definition, handler);
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

  registerTool(
    statusToolName,
    {
      description:
        "Report whether the remote Inoreader MCP server is configured and reachable.",
      inputSchema: z.object({}),
      outputSchema: statusOutputSchema,
      annotations: readToolAnnotations
    },
    () =>
      successResult("Inoreader MCP server configuration loaded.", {
        ok: true,
        service: config.appName,
        inoreaderApiBaseUrl: config.inoreaderApiBaseUrl,
        inoreaderOAuthConfigured: options.oauthConfigured ?? false
      })
  );

  registerTool(
    getUserInfoToolName,
    {
      description: "Fetch basic information for the authenticated Inoreader user.",
      inputSchema: z.object({}),
      outputSchema: userInfoOutputSchema,
      annotations: readToolAnnotations
    },
    async () =>
      runTool(client.getUserInfo(), "Fetched authenticated Inoreader user info.")
  );

  registerTool(
    listSubscriptionsToolName,
    {
      description: "List subscriptions for the authenticated Inoreader user.",
      inputSchema: z.object({
        teamAssets: z.boolean().optional()
      }),
      outputSchema: subscriptionListOutputSchema,
      annotations: readToolAnnotations
    },
    async ({ teamAssets }) =>
      runTool(
        client.listSubscriptions(
          teamAssets === undefined ? {} : { teamAssets }
        ),
        "Listed Inoreader subscriptions."
      )
  );

  registerTool(
    getUnreadCountsToolName,
    {
      description: "Fetch unread counts for feeds, folders, and tags.",
      inputSchema: z.object({}),
      outputSchema: unreadCountsOutputSchema,
      annotations: readToolAnnotations
    },
    async () =>
      runTool(client.getUnreadCounts(), "Fetched Inoreader unread counts.")
  );

  registerTool(
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
      }),
      outputSchema: streamContentsOutputSchema,
      annotations: readToolAnnotations
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
        }),
        "Fetched Inoreader stream contents."
      )
  );

  registerTool(
    markReadToolName,
    {
      description: "Mark Inoreader article items as read.",
      inputSchema: itemIdsSchema,
      outputSchema: okOutputSchema,
      annotations: destructiveWriteAnnotations
    },
    async ({ itemIds }) =>
      runTool(client.markRead(itemIds), "Marked Inoreader article items as read.")
  );

  registerTool(
    markUnreadToolName,
    {
      description: "Mark Inoreader article items as unread.",
      inputSchema: itemIdsSchema,
      outputSchema: okOutputSchema,
      annotations: destructiveWriteAnnotations
    },
    async ({ itemIds }) =>
      runTool(
        client.markUnread(itemIds),
        "Marked Inoreader article items as unread."
      )
  );

  registerTool(
    starArticleToolName,
    {
      description: "Star Inoreader article items.",
      inputSchema: itemIdsSchema,
      outputSchema: okOutputSchema,
      annotations: nonDestructiveWriteAnnotations
    },
    async ({ itemIds }) =>
      runTool(client.star(itemIds), "Starred Inoreader article items.")
  );

  registerTool(
    unstarArticleToolName,
    {
      description: "Remove stars from Inoreader article items.",
      inputSchema: itemIdsSchema,
      outputSchema: okOutputSchema,
      annotations: destructiveWriteAnnotations
    },
    async ({ itemIds }) =>
      runTool(client.unstar(itemIds), "Removed stars from Inoreader article items.")
  );

  registerTool(
    likeArticleToolName,
    {
      description: "Like Inoreader article items.",
      inputSchema: itemIdsSchema,
      outputSchema: okOutputSchema,
      annotations: nonDestructiveWriteAnnotations
    },
    async ({ itemIds }) =>
      runTool(client.like(itemIds), "Liked Inoreader article items.")
  );

  registerTool(
    unlikeArticleToolName,
    {
      description: "Remove likes from Inoreader article items.",
      inputSchema: itemIdsSchema,
      outputSchema: okOutputSchema,
      annotations: destructiveWriteAnnotations
    },
    async ({ itemIds }) =>
      runTool(client.unlike(itemIds), "Removed likes from Inoreader article items.")
  );

  registerTool(
    broadcastArticleToolName,
    {
      description: "Broadcast Inoreader article items.",
      inputSchema: itemIdsSchema,
      outputSchema: okOutputSchema,
      annotations: nonDestructiveWriteAnnotations
    },
    async ({ itemIds }) =>
      runTool(client.broadcast(itemIds), "Broadcast Inoreader article items.")
  );

  registerTool(
    unbroadcastArticleToolName,
    {
      description: "Remove broadcasts from Inoreader article items.",
      inputSchema: itemIdsSchema,
      outputSchema: okOutputSchema,
      annotations: destructiveWriteAnnotations
    },
    async ({ itemIds }) =>
      runTool(
        client.unbroadcast(itemIds),
        "Removed broadcasts from Inoreader article items."
      )
  );

  registerTool(
    addArticleTagToolName,
    {
      description: "Add a custom Inoreader tag to article items.",
      inputSchema: z.object({
        itemIds: z.array(z.string().min(1)).min(1),
        tagName: z.string().min(1)
      }),
      outputSchema: okOutputSchema,
      annotations: nonDestructiveWriteAnnotations
    },
    async ({ itemIds, tagName }) =>
      runTool(
        client.addArticleTag(itemIds, tagName),
        "Added an Inoreader tag to article items."
      )
  );

  registerTool(
    removeArticleTagToolName,
    {
      description: "Remove a custom Inoreader tag from article items.",
      inputSchema: z.object({
        itemIds: z.array(z.string().min(1)).min(1),
        tagName: z.string().min(1)
      }),
      outputSchema: okOutputSchema,
      annotations: destructiveWriteAnnotations
    },
    async ({ itemIds, tagName }) =>
      runTool(
        client.removeArticleTag(itemIds, tagName),
        "Removed an Inoreader tag from article items."
      )
  );

  registerTool(
    editSubscriptionToolName,
    {
      description: "Rename a subscription or add/remove it from folders.",
      inputSchema: subscriptionEditSchema,
      outputSchema: okOutputSchema,
      annotations: destructiveWriteAnnotations
    },
    async (input) =>
      runTool(
        client.editSubscription(compactSubscriptionOptions(input)),
        "Edited an Inoreader subscription."
      )
  );

  registerTool(
    followSubscriptionToolName,
    {
      description: "Follow a feed and optionally rename it or add it to a folder.",
      inputSchema: subscriptionEditSchema,
      outputSchema: okOutputSchema,
      annotations: destructiveWriteAnnotations
    },
    async (input) =>
      runTool(
        client.followSubscription(compactSubscriptionOptions(input)),
        "Followed an Inoreader subscription."
      )
  );

  registerTool(
    unfollowSubscriptionToolName,
    {
      description: "Unfollow an Inoreader feed.",
      inputSchema: z.object({
        streamId: z.string().min(1)
      }),
      outputSchema: okOutputSchema,
      annotations: destructiveWriteAnnotations
    },
    async ({ streamId }) =>
      runTool(
        client.unfollowSubscription(streamId),
        "Unfollowed an Inoreader subscription."
      )
  );

  registerTool(
    renameTagToolName,
    {
      description: "Rename an Inoreader tag or folder.",
      inputSchema: z.object({
        sourceTagId: z.string().min(1),
        destinationName: z.string().min(1)
      }),
      outputSchema: okOutputSchema,
      annotations: nonDestructiveWriteAnnotations
    },
    async ({ sourceTagId, destinationName }) =>
      runTool(
        client.renameTag(sourceTagId, destinationName),
        "Renamed an Inoreader tag."
      )
  );

  registerTool(
    deleteTagToolName,
    {
      description: "Delete an Inoreader tag or folder.",
      inputSchema: z.object({
        tagId: z.string().min(1)
      }),
      outputSchema: okOutputSchema,
      annotations: destructiveWriteAnnotations
    },
    async ({ tagId }) =>
      runTool(client.deleteTag(tagId), "Deleted an Inoreader tag.")
  );

  return {
    metadata,
    server,
    toolMetadata,
    registeredTools,
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
