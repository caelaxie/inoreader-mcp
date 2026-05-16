import { Data, Effect } from "effect";

const defaultInoreaderApiBaseUrl = "https://www.inoreader.com/reader/api/0";

export interface InoreaderMcpConfig {
  readonly appName: string;
  readonly appVersion: string;
  readonly inoreaderApiBaseUrl: string;
  readonly inoreaderAccessToken?: string;
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
    const inoreaderAccessToken = env.INOREADER_ACCESS_TOKEN?.trim();

    yield* validateAbsoluteUrl(
      "INOREADER_API_BASE_URL",
      inoreaderApiBaseUrl
    );

    return {
      appName: "inoreader-mcp",
      appVersion: "1.0.0",
      inoreaderApiBaseUrl,
      ...(inoreaderAccessToken ? { inoreaderAccessToken } : {})
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
