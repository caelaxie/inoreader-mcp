import { credentialObjectName } from "./env.js";

interface StoredInoreaderTokens {
  readonly refreshToken: string;
  readonly accessToken?: string;
  readonly expiresAtMs?: number;
}

interface PendingOAuthState {
  readonly state: string;
  readonly createdAtMs: number;
}

interface BeginOAuthRequest {
  readonly state: string;
}

interface ExchangeOAuthRequest {
  readonly code: string;
  readonly state: string;
  readonly appId: string;
  readonly appKey: string;
  readonly redirectUri: string;
  readonly tokenUrl: string;
}

interface AccessTokenRequest {
  readonly appId: string;
  readonly appKey: string;
  readonly tokenUrl: string;
}

const tokensKey = "tokens";
const pendingKey = "pending-oauth-state";
const expirySkewMs = 60_000;
const defaultExpiresInSec = 3_600;

export class InoreaderCredentials implements DurableObject {
  constructor(private readonly state: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/status") {
      const tokens = await this.state.storage.get<StoredInoreaderTokens>(
        tokensKey
      );
      return Response.json({ configured: Boolean(tokens?.refreshToken) });
    }

    if (request.method === "POST" && url.pathname === "/begin") {
      const body = await request.json<BeginOAuthRequest>();
      await this.state.storage.put(pendingKey, {
        state: body.state,
        createdAtMs: Date.now()
      } satisfies PendingOAuthState);
      return Response.json({ ok: true });
    }

    if (request.method === "POST" && url.pathname === "/exchange") {
      const body = await request.json<ExchangeOAuthRequest>();
      await this.exchangeAuthorizationCode(body);
      return Response.json({ ok: true });
    }

    if (request.method === "POST" && url.pathname === "/access-token") {
      const body = await request.json<AccessTokenRequest>();
      const accessToken = await this.getAccessToken(body);
      return Response.json({ accessToken });
    }

    return new Response("Not found", { status: 404 });
  }

  private async exchangeAuthorizationCode(
    request: ExchangeOAuthRequest
  ): Promise<void> {
    const pending = await this.state.storage.get<PendingOAuthState>(pendingKey);
    if (!pending || pending.state !== request.state) {
      throw new Error("Inoreader OAuth state did not match");
    }

    const tokenResponse = await exchangeToken(request.tokenUrl, {
      grant_type: "authorization_code",
      code: request.code,
      redirect_uri: request.redirectUri,
      client_id: request.appId,
      client_secret: request.appKey
    });
    const refreshToken = requiredTokenString(
      tokenResponse.refresh_token,
      "refresh_token"
    );

    await this.state.storage.put(tokensKey, {
      refreshToken,
      ...(typeof tokenResponse.access_token === "string"
        ? { accessToken: tokenResponse.access_token }
        : {}),
      expiresAtMs: expiresAtMs(tokenResponse.expires_in)
    } satisfies StoredInoreaderTokens);
    await this.state.storage.delete(pendingKey);
  }

  private async getAccessToken(request: AccessTokenRequest): Promise<string> {
    const tokens = await this.state.storage.get<StoredInoreaderTokens>(tokensKey);
    if (!tokens?.refreshToken) {
      throw new Error(
        "Inoreader OAuth credentials are missing. Visit the remote MCP setup URL first."
      );
    }

    if (
      tokens.accessToken &&
      tokens.expiresAtMs &&
      tokens.expiresAtMs - expirySkewMs > Date.now()
    ) {
      return tokens.accessToken;
    }

    const tokenResponse = await exchangeToken(request.tokenUrl, {
      grant_type: "refresh_token",
      refresh_token: tokens.refreshToken,
      client_id: request.appId,
      client_secret: request.appKey
    });
    const accessToken = requiredTokenString(
      tokenResponse.access_token,
      "access_token"
    );

    await this.state.storage.put(tokensKey, {
      refreshToken:
        typeof tokenResponse.refresh_token === "string"
          ? tokenResponse.refresh_token
          : tokens.refreshToken,
      accessToken,
      expiresAtMs: expiresAtMs(tokenResponse.expires_in)
    } satisfies StoredInoreaderTokens);

    return accessToken;
  }
}

export const credentialStub = (
  env: { readonly INOREADER_CREDENTIALS: DurableObjectNamespace }
): DurableObjectStub => {
  const id = env.INOREADER_CREDENTIALS.idFromName(credentialObjectName);
  return env.INOREADER_CREDENTIALS.get(id);
};

const exchangeToken = async (
  tokenUrl: string,
  body: Record<string, string>
): Promise<Record<string, unknown>> => {
  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams(body).toString()
  });
  const payload = await response.json<Record<string, unknown>>();
  if (!response.ok) {
    throw new Error(
      `Inoreader OAuth token request failed with HTTP ${response.status}`
    );
  }

  return payload;
};

const requiredTokenString = (value: unknown, name: string): string => {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Inoreader OAuth response did not include ${name}`);
  }

  return value;
};

const expiresAtMs = (expiresIn: unknown): number =>
  Date.now() +
  (typeof expiresIn === "number" && Number.isFinite(expiresIn)
    ? expiresIn
    : defaultExpiresInSec) *
    1_000;
