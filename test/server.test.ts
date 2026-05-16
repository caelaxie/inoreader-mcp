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
    expect(server.toolNames).toEqual(["inoreader_status"]);
  });
});
