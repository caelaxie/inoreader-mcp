import { Effect } from "effect";

import { InoreaderAuthError } from "./errors.js";

const expirySkewMs = 60_000;
const defaultExpiresInSec = 3_600;

export interface InoreaderOAuthTokenRequest {
  readonly url: string;
  readonly headers: Record<string, string>;
  readonly body: string;
}

export interface InoreaderOAuthTokenResponse {
  readonly status: number;
  readonly body: unknown;
}

export type InoreaderOAuthTokenTransport = (
  request: InoreaderOAuthTokenRequest
) => Effect.Effect<InoreaderOAuthTokenResponse, InoreaderAuthError>;

export type InoreaderAccessTokenProvider = () => Effect.Effect<
  string,
  InoreaderAuthError
>;

export interface InoreaderOAuthCredentials {
  readonly inoreaderOAuthTokenUrl: string;
  readonly inoreaderClientId: string;
  readonly inoreaderClientSecret: string;
  readonly inoreaderRefreshToken: string;
}

interface CachedToken {
  readonly accessToken: string;
  readonly expiresAtMs: number;
}

export const createLiveInoreaderOAuthTokenTransport =
  (): InoreaderOAuthTokenTransport =>
  (request) =>
    Effect.tryPromise({
      try: async () => {
        const response = await fetch(request.url, {
          method: "POST",
          headers: request.headers,
          body: request.body
        });
        const contentType = response.headers.get("content-type") ?? "";
        const body = contentType.includes("application/json")
          ? await response.json()
          : await response.text();

        return {
          status: response.status,
          body
        };
      },
      catch: (error) =>
        new InoreaderAuthError({
          message: `Inoreader OAuth token refresh failed: ${String(error)}`
        })
    });

export const createInoreaderOAuthTokenProvider = (
  config: InoreaderOAuthCredentials,
  transport: InoreaderOAuthTokenTransport =
    createLiveInoreaderOAuthTokenTransport()
): InoreaderAccessTokenProvider => {
  let cachedToken: CachedToken | undefined;

  return () =>
    Effect.gen(function* () {
      if (
        !config.inoreaderClientId ||
        !config.inoreaderClientSecret ||
        !config.inoreaderRefreshToken
      ) {
        return yield* Effect.fail(
          new InoreaderAuthError({
            message:
              "Inoreader OAuth credentials are missing. Visit the remote MCP setup URL first."
          })
        );
      }

      const now = Date.now();
      if (cachedToken && cachedToken.expiresAtMs - expirySkewMs > now) {
        return cachedToken.accessToken;
      }

      const response = yield* transport({
        url: config.inoreaderOAuthTokenUrl,
        headers: {
          "content-type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          client_id: config.inoreaderClientId,
          client_secret: config.inoreaderClientSecret,
          refresh_token: config.inoreaderRefreshToken
        }).toString()
      });

      if (response.status < 200 || response.status >= 300) {
        return yield* Effect.fail(
          new InoreaderAuthError({
            message: `Inoreader OAuth token refresh failed with HTTP ${response.status}`,
            status: response.status
          })
        );
      }

      const tokenResponse = yield* Effect.try({
        try: () => parseTokenResponse(response.body),
        catch: (error) =>
          error instanceof InoreaderAuthError
            ? error
            : new InoreaderAuthError({
                message: `Inoreader OAuth token response was invalid: ${String(error)}`
              })
      });
      cachedToken = {
        accessToken: tokenResponse.accessToken,
        expiresAtMs:
          now + tokenResponse.expiresInSec * 1_000
      };

      return cachedToken.accessToken;
    });
};

const parseTokenResponse = (
  body: unknown
): { readonly accessToken: string; readonly expiresInSec: number } => {
  if (typeof body !== "object" || body === null) {
    throw new InoreaderAuthError({
      message: "Inoreader OAuth token response was not an object"
    });
  }

  const accessToken = "access_token" in body ? body.access_token : undefined;
  const expiresIn = "expires_in" in body ? body.expires_in : undefined;

  if (typeof accessToken !== "string" || accessToken.trim() === "") {
    throw new InoreaderAuthError({
      message: "Inoreader OAuth token response did not include access_token"
    });
  }

  return {
    accessToken,
    expiresInSec:
      typeof expiresIn === "number" && Number.isFinite(expiresIn)
        ? expiresIn
        : defaultExpiresInSec
  };
};
