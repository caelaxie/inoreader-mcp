import { Data, Effect } from "effect";

const defaultInoreaderApiBaseUrl = "https://www.inoreader.com/reader/api/0";
const defaultInoreaderOAuthTokenUrl = "https://www.inoreader.com/oauth2/token";
const defaultInoreaderOAuthScope = "read write";

export interface InoreaderMcpConfig {
  readonly appName: string;
  readonly appVersion: string;
  readonly inoreaderApiBaseUrl: string;
  readonly inoreaderOAuthTokenUrl: string;
  readonly inoreaderOAuthScope: string;
}

export class ConfigError extends Data.TaggedError("ConfigError")<{
  readonly message: string;
}> {}

export type EnvSource = Record<string, string | undefined>;

export const loadConfig = (
  env: EnvSource = process.env
): Effect.Effect<InoreaderMcpConfig, ConfigError> =>
  Effect.gen(function* () {
    const inoreaderApiBaseUrl =
      env.INOREADER_API_BASE_URL ?? defaultInoreaderApiBaseUrl;
    const inoreaderOAuthTokenUrl =
      env.INOREADER_OAUTH_TOKEN_URL ?? defaultInoreaderOAuthTokenUrl;
    const inoreaderOAuthScope =
      env.INOREADER_OAUTH_SCOPE ?? defaultInoreaderOAuthScope;

    yield* validateAbsoluteUrl(
      "INOREADER_API_BASE_URL",
      inoreaderApiBaseUrl
    );
    yield* validateAbsoluteUrl(
      "INOREADER_OAUTH_TOKEN_URL",
      inoreaderOAuthTokenUrl
    );
    yield* validateOAuthScope(inoreaderOAuthScope);

    return {
      appName: "inoreader-mcp",
      appVersion: "1.0.0",
      inoreaderApiBaseUrl,
      inoreaderOAuthTokenUrl,
      inoreaderOAuthScope
    };
  });

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

const validateOAuthScope = (
  value: string
): Effect.Effect<void, ConfigError> =>
  Effect.sync(() => value.trim()).pipe(
    Effect.flatMap((scope) =>
      scope === "read" || scope === "read write"
        ? Effect.void
        : Effect.fail(
            new ConfigError({
              message: "INOREADER_OAUTH_SCOPE must be read or read write"
            })
          )
    )
  );
