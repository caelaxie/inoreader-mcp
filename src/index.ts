#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Effect } from "effect";

import { loadConfig } from "./config.js";
import { createInoreaderMcpServer } from "./server.js";

const program = Effect.gen(function* () {
  const config = yield* loadConfig();
  const { server } = createInoreaderMcpServer(config);
  const transport = new StdioServerTransport();

  yield* Effect.tryPromise({
    try: () => server.connect(transport),
    catch: (error) =>
      error instanceof Error ? error : new Error(String(error))
  });

  process.on("SIGINT", () => {
    void server.close().finally(() => {
      process.exit(0);
    });
  });
});

Effect.runPromise(program).catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
