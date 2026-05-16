import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  it("uses local defaults when optional Inoreader env vars are absent", async () => {
    const config = await Effect.runPromise(loadConfig({}));

    expect(config).toEqual({
      appName: "inoreader-mcp",
      appVersion: "1.0.0",
      inoreaderApiBaseUrl: "https://www.inoreader.com/reader/api/0"
    });
  });

  it("accepts an explicit Inoreader API base URL", async () => {
    const config = await Effect.runPromise(
      loadConfig({ INOREADER_API_BASE_URL: "https://example.test/api" })
    );

    expect(config.inoreaderApiBaseUrl).toBe("https://example.test/api");
  });

  it("rejects malformed Inoreader API base URLs", async () => {
    await expect(
      Effect.runPromise(loadConfig({ INOREADER_API_BASE_URL: "not a url" }))
    ).rejects.toMatchObject({
      message: "INOREADER_API_BASE_URL must be an absolute URL"
    });
  });
});
