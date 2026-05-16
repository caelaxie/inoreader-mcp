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
      inoreaderClientId: "client-id",
      inoreaderClientSecret: "client-secret",
      inoreaderRefreshToken: "refresh-token"
    });
  });

  it.each([
    ["INOREADER_CLIENT_ID"],
    ["INOREADER_CLIENT_SECRET"],
    ["INOREADER_REFRESH_TOKEN"]
  ])("requires %s", async (name) => {
    const env = { ...oauthEnv };
    delete env[name as keyof typeof env];

    await expect(Effect.runPromise(loadConfig(env))).rejects.toMatchObject({
      message: `${name} is required`
    });
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
});
