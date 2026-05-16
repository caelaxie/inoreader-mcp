interface InoreaderAuthorizeUrlOptions {
  readonly appId: string;
  readonly redirectUri: string;
  readonly scope: string;
  readonly state: string;
}

export const createInoreaderAuthorizeUrl = ({
  appId,
  redirectUri,
  scope,
  state
}: InoreaderAuthorizeUrlOptions): URL => {
  const authorizeUrl = new URL("https://www.inoreader.com/oauth2/auth");
  authorizeUrl.searchParams.set("client_id", appId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", scope);
  authorizeUrl.searchParams.set("state", state);

  return authorizeUrl;
};

export const getInoreaderOAuthCallbackError = (
  callbackUrl: URL
): string | undefined => {
  const error = callbackUrl.searchParams.get("error");
  if (!error) {
    return undefined;
  }

  const description = callbackUrl.searchParams.get("error_description");
  return `Inoreader OAuth failed: ${error}${description ? ` - ${description}` : ""}`;
};
