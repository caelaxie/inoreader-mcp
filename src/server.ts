import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Effect } from "effect";
import { z } from "zod/v4";

import type { InoreaderMcpConfig } from "./config.js";

const statusToolName = "inoreader_status";

export interface InoreaderMcpServer {
  readonly metadata: {
    readonly name: string;
    readonly version: string;
  };
  readonly server: McpServer;
  readonly toolNames: readonly [typeof statusToolName];
}

export const createInoreaderMcpServer = (
  config: InoreaderMcpConfig
): InoreaderMcpServer => {
  const metadata = {
    name: config.appName,
    version: config.appVersion
  };
  const server = new McpServer(metadata, {
    instructions:
      "Use this local MCP server to interact with Inoreader. Configure credentials before calling tools that require account access."
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
          inoreaderApiBaseUrl: config.inoreaderApiBaseUrl
        })
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(payload, null, 2)
          }
        ]
      };
    }
  );

  return {
    metadata,
    server,
    toolNames: [statusToolName]
  };
};
