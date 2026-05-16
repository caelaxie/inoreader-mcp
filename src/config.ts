import { Data, Effect } from "effect";

import {
  loadCredentialConfig,
  type CredentialConfigStoreOptions
} from "./config-store.js";

const defaultInoreaderApiBaseUrl = "https://www.inoreader.com/reader/api/0";
const defaultInoreaderOAuthTokenUrl = "https://www.inoreader.com/oauth2/token";

export interface InoreaderMcpConfig {
  readonly appName: string;
  readonly appVersion: string;
  readonly inoreaderApiBaseUrl: string;
  readonly inoreaderOAuthTokenUrl: string;
  readonly inoreaderClientId: string;
  readonly inoreaderClientSecret: string;
  readonly inoreaderRefreshToken: string;
}

export class ConfigError extends Data.TaggedError("ConfigError")<{
  readonly message: string;
}> {}

export type EnvSource = Record<string, string | undefined>;

export const loadConfig = (
  env: EnvSource = process.env,
  options: CredentialConfigStoreOptions = {}
): Effect.Effect<InoreaderMcpConfig, ConfigError> =>
  Effect.gen(function* () {
    const savedConfig = yield* Effect.tryPromise({
      try: () => loadCredentialConfig(options),
      catch: (error) =>
        new ConfigError({
          message: `Inoreader credential config could not be loaded: ${String(error)}`
        })
    });
    const inoreaderApiBaseUrl =
      env.INOREADER_API_BASE_URL ??
      savedConfig?.inoreaderApiBaseUrl ??
      defaultInoreaderApiBaseUrl;
    const inoreaderOAuthTokenUrl =
      env.INOREADER_OAUTH_TOKEN_URL ??
      savedConfig?.inoreaderOAuthTokenUrl ??
      defaultInoreaderOAuthTokenUrl;
    const inoreaderClientId = yield* requiredEnv(
      "INOREADER_CLIENT_ID",
      env.INOREADER_CLIENT_ID ?? savedConfig?.inoreaderClientId
    );
    const inoreaderClientSecret = yield* requiredEnv(
      "INOREADER_CLIENT_SECRET",
      env.INOREADER_CLIENT_SECRET ?? savedConfig?.inoreaderClientSecret
    );
    const inoreaderRefreshToken = yield* requiredEnv(
      "INOREADER_REFRESH_TOKEN",
      env.INOREADER_REFRESH_TOKEN ?? savedConfig?.inoreaderRefreshToken
    );

    yield* validateAbsoluteUrl(
      "INOREADER_API_BASE_URL",
      inoreaderApiBaseUrl
    );
    yield* validateAbsoluteUrl(
      "INOREADER_OAUTH_TOKEN_URL",
      inoreaderOAuthTokenUrl
    );

    return {
      appName: "inoreader-mcp",
      appVersion: "1.0.0",
      inoreaderApiBaseUrl,
      inoreaderOAuthTokenUrl,
      inoreaderClientId,
      inoreaderClientSecret,
      inoreaderRefreshToken
    };
  });

const requiredEnv = (
  name: string,
  value: string | undefined
): Effect.Effect<string, ConfigError> => {
  const trimmed = value?.trim();

  return trimmed
    ? Effect.succeed(trimmed)
    : Effect.fail(
        new ConfigError({
          message: `${name} is required`
        })
      );
};

const validateAbsoluteUrl = (
  name: string,
  value: string
): Effect.Effect<void, ConfigError> =>
  Effect.try({
    try: () => {
      const url = new URL(value);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new Error("URL must use http or https");
      }
    },
    catch: () =>
      new ConfigError({
        message: `${name} must be an absolute URL`
      })
  });
