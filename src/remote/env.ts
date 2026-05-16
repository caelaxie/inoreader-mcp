export interface InoreaderRemoteEnv {
  readonly INOREADER_CREDENTIALS: DurableObjectNamespace;
  readonly INOREADER_APP_ID: string;
  readonly INOREADER_APP_KEY: string;
  readonly INOREADER_API_BASE_URL?: string;
  readonly INOREADER_OAUTH_TOKEN_URL?: string;
  readonly INOREADER_OAUTH_SCOPE?: string;
}

export const defaultInoreaderApiBaseUrl =
  "https://www.inoreader.com/reader/api/0";
export const defaultInoreaderOAuthTokenUrl =
  "https://www.inoreader.com/oauth2/token";

export const credentialObjectName = "default";
