import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  const oauthEnv = {
    INOREADER_CLIENT_ID: "client-id",
    INOREADER_CLIENT_SECRET: "client-secret",
    INOREADER_REFRESH_TOKEN: "refresh-token"
  };

  it("accepts an explicit Inoreader API base URL", async () => {
    const config = await Effect.runPromise(
      loadConfig({
        ...oauthEnv,
        INOREADER_API_BASE_URL: "https://example.test/api"
      })
    );

    expect(config.inoreaderApiBaseUrl).toBe("https://example.test/api");
  });

  it("loads required Inoreader OAuth credentials", async () => {
    const config = await Effect.runPromise(loadConfig(oauthEnv));

    expect(config).toEqual({
      appName: "inoreader-mcp",
      appVersion: "1.0.0",
      inoreaderApiBaseUrl: "https://www.inoreader.com/reader/api/0",
      inoreaderOAuthTokenUrl: "https://www.inoreader.com/oauth2/token",
      inoreaderOAuthScope: "read write"
    });
  });

  it("loads remote MCP defaults without local OAuth credentials", async () => {
    const config = await Effect.runPromise(loadConfig({}));

    expect(config).toMatchObject({
      appName: "inoreader-mcp",
      appVersion: "1.0.0",
      inoreaderApiBaseUrl: "https://www.inoreader.com/reader/api/0",
      inoreaderOAuthTokenUrl: "https://www.inoreader.com/oauth2/token",
      inoreaderOAuthScope: "read write"
    });
  });

  it("accepts read-only Inoreader OAuth scope", async () => {
    const config = await Effect.runPromise(
      loadConfig({ ...oauthEnv, INOREADER_OAUTH_SCOPE: "read" })
    );

    expect(config.inoreaderOAuthScope).toBe("read");
  });

  it("accepts an explicit Inoreader OAuth token URL", async () => {
    const config = await Effect.runPromise(
      loadConfig({
        ...oauthEnv,
        INOREADER_OAUTH_TOKEN_URL: "https://example.test/oauth2/token"
      })
    );

    expect(config.inoreaderOAuthTokenUrl).toBe(
      "https://example.test/oauth2/token"
    );
  });

  it("rejects malformed Inoreader API base URLs", async () => {
    await expect(
      Effect.runPromise(
        loadConfig({ ...oauthEnv, INOREADER_API_BASE_URL: "not a url" })
      )
    ).rejects.toMatchObject({
      message: "INOREADER_API_BASE_URL must be an absolute URL"
    });
  });

  it("rejects malformed Inoreader OAuth token URLs", async () => {
    await expect(
      Effect.runPromise(
        loadConfig({ ...oauthEnv, INOREADER_OAUTH_TOKEN_URL: "not a url" })
      )
    ).rejects.toMatchObject({
      message: "INOREADER_OAUTH_TOKEN_URL must be an absolute URL"
    });
  });

  it("rejects unsupported Inoreader OAuth scopes", async () => {
    await expect(
      Effect.runPromise(
        loadConfig({ ...oauthEnv, INOREADER_OAUTH_SCOPE: "profile" })
      )
    ).rejects.toMatchObject({
      message: "INOREADER_OAUTH_SCOPE must be read or read write"
    });
  });
});
