import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import type { InoreaderMcpConfig } from "../src/config.js";
import {
  createInoreaderOAuthTokenProvider,
  type InoreaderOAuthTokenTransport
} from "../src/inoreader/oauth.js";

const config: InoreaderMcpConfig = {
  appName: "inoreader-mcp",
  appVersion: "1.0.0",
  inoreaderApiBaseUrl: "https://www.inoreader.com/reader/api/0",
  inoreaderOAuthTokenUrl: "https://www.inoreader.com/oauth2/token",
  inoreaderClientId: "client-id",
  inoreaderClientSecret: "client-secret",
  inoreaderRefreshToken: "refresh-token"
};

describe("createInoreaderOAuthTokenProvider", () => {
  it("refreshes an access token with the configured OAuth credentials", async () => {
    const requests: Parameters<InoreaderOAuthTokenTransport>[0][] = [];
    const transport: InoreaderOAuthTokenTransport = (request) =>
      Effect.sync(() => {
        requests.push(request);
        return {
          status: 200,
          body: {
            access_token: "oauth-access-token",
            token_type: "Bearer",
            expires_in: 3600
          }
        };
      });

    const provider = createInoreaderOAuthTokenProvider(config, transport);

    await expect(Effect.runPromise(provider())).resolves.toBe(
      "oauth-access-token"
    );

    expect(requests).toEqual([
      {
        url: "https://www.inoreader.com/oauth2/token",
        headers: {
          "content-type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          client_id: "client-id",
          client_secret: "client-secret",
          refresh_token: "refresh-token"
        }).toString()
      }
    ]);
  });

  it("reuses a cached access token before it expires", async () => {
    let refreshes = 0;
    const transport: InoreaderOAuthTokenTransport = () =>
      Effect.sync(() => {
        refreshes += 1;
        return {
          status: 200,
          body: {
            access_token: `oauth-access-token-${refreshes}`,
            token_type: "Bearer",
            expires_in: 3600
          }
        };
      });

    const provider = createInoreaderOAuthTokenProvider(config, transport);

    await expect(Effect.runPromise(provider())).resolves.toBe(
      "oauth-access-token-1"
    );
    await expect(Effect.runPromise(provider())).resolves.toBe(
      "oauth-access-token-1"
    );
    expect(refreshes).toBe(1);
  });

  it("maps token endpoint failures to auth errors", async () => {
    const provider = createInoreaderOAuthTokenProvider(config, () =>
      Effect.succeed({
        status: 400,
        body: { error: "invalid_grant" }
      })
    );

    await expect(Effect.runPromise(Effect.flip(provider()))).resolves.toMatchObject(
      {
        _tag: "InoreaderAuthError",
        status: 400
      }
    );
  });

  it("maps malformed token endpoint responses to auth errors", async () => {
    const provider = createInoreaderOAuthTokenProvider(config, () =>
      Effect.succeed({
        status: 200,
        body: { token_type: "Bearer" }
      })
    );

    await expect(Effect.runPromise(Effect.flip(provider()))).resolves.toMatchObject(
      {
        _tag: "InoreaderAuthError",
        message: "Inoreader OAuth token response did not include access_token"
      }
    );
  });
});
