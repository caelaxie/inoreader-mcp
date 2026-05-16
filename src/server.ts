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

  return {
    metadata,
    server,
    toolNames: [
      statusToolName,
      getUserInfoToolName,
      listSubscriptionsToolName,
      getUnreadCountsToolName,
      getStreamContentsToolName
    ]
  };
};
