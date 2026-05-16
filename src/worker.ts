import { createMcpHandler } from "agents/mcp";
import { Effect } from "effect";

import { loadConfig } from "./config.js";
import {
  createInoreaderClient,
  createLiveInoreaderHttpTransport
} from "./inoreader/client.js";
import { InoreaderAuthError } from "./inoreader/errors.js";
import { createInoreaderMcpServer } from "./server.js";
import {
  credentialStub,
  InoreaderCredentials
} from "./remote/credentials-object.js";
import type { InoreaderRemoteEnv } from "./remote/env.js";
import {
  createInoreaderAuthorizeUrl,
  getInoreaderOAuthCallbackError
} from "./remote/oauth.js";

export { InoreaderCredentials };

const setupPath = "/setup";
const authorizePath = "/authorize";
const callbackPath = "/callback";
const mcpPath = "/mcp";

export default {
  async fetch(
    request: Request,
    env: InoreaderRemoteEnv,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/" || url.pathname === setupPath) {
      return setupPage(request, env);
    }

    if (url.pathname === authorizePath) {
      return beginInoreaderOAuth(request, env);
    }

    if (url.pathname === callbackPath) {
      return completeInoreaderOAuth(request, env);
    }

    if (url.pathname === "/status") {
      return credentialStub(env).fetch("https://credentials/status");
    }

    if (url.pathname === mcpPath) {
      return mcpHandler(request, env, ctx);
    }

    return new Response("Not found", { status: 404 });
  }
};

const mcpHandler = async (
  request: Request,
  env: InoreaderRemoteEnv,
  ctx: ExecutionContext
): Promise<Response> => {
  const config = await Effect.runPromise(loadConfig(remoteEnvSource(env)));
  const status = await credentialStub(env).fetch("https://credentials/status");
  const configured = status.ok
    ? Boolean((await status.json<{ configured?: boolean }>()).configured)
    : false;
  const client = createInoreaderClient(
    () =>
      Effect.tryPromise({
        try: async () => {
          const response = await credentialStub(env).fetch(
            "https://credentials/access-token",
            {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                appId: env.INOREADER_APP_ID,
                appKey: env.INOREADER_APP_KEY,
                tokenUrl: config.inoreaderOAuthTokenUrl
              })
            }
          );
          const payload = await response.json<{ accessToken?: string }>();
          if (!response.ok || !payload.accessToken) {
            throw new Error("Inoreader OAuth credentials are not configured");
          }

          return payload.accessToken;
        },
        catch: (error) =>
          new InoreaderAuthError({
            message:
              error instanceof Error
                ? error.message
                : "Inoreader OAuth credentials are not configured"
          })
      }),
    createLiveInoreaderHttpTransport(config.inoreaderApiBaseUrl)
  );
  const { server } = createInoreaderMcpServer(config, {
    client,
    oauthConfigured: configured
  });

  return createMcpHandler(server, { route: mcpPath })(request, env, ctx);
};

const setupPage = async (
  request: Request,
  env: InoreaderRemoteEnv
): Promise<Response> => {
  const status = await credentialStub(env).fetch("https://credentials/status");
  const configured = status.ok
    ? Boolean((await status.json<{ configured?: boolean }>()).configured)
    : false;
  const authorizeUrl = new URL(authorizePath, request.url);

  return html(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Inoreader MCP Setup</title>
    <style>
      body { font-family: system-ui, sans-serif; margin: 2rem; max-width: 48rem; }
      code { background: #f3f4f6; padding: 0.15rem 0.3rem; border-radius: 0.25rem; }
      .status { margin: 1rem 0; font-weight: 600; }
      a.button { display: inline-block; padding: 0.65rem 0.9rem; border-radius: 0.4rem; background: #2563eb; color: white; text-decoration: none; }
    </style>
  </head>
  <body>
    <h1>Inoreader MCP Setup</h1>
    <p>Configure your Inoreader app with this redirect URI:</p>
    <p><code>${escapeHtml(new URL(callbackPath, request.url).toString())}</code></p>
    <p>Set Cloudflare Worker secrets <code>INOREADER_APP_ID</code> and <code>INOREADER_APP_KEY</code> from the Inoreader developer portal before starting OAuth.</p>
    <p class="status">Inoreader account status: ${configured ? "connected" : "not connected"}</p>
    <p><a class="button" href="${escapeHtml(authorizeUrl.toString())}">Connect Inoreader</a></p>
  </body>
</html>`);
};

const beginInoreaderOAuth = async (
  request: Request,
  env: InoreaderRemoteEnv
): Promise<Response> => {
  const appId = requiredEnv(env.INOREADER_APP_ID, "INOREADER_APP_ID");
  requiredEnv(env.INOREADER_APP_KEY, "INOREADER_APP_KEY");
  const config = await Effect.runPromise(loadConfig(remoteEnvSource(env)));
  const state = crypto.randomUUID();
  const redirectUri = new URL(callbackPath, request.url).toString();

  await credentialStub(env).fetch("https://credentials/begin", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ state })
  });

  const authorizeUrl = createInoreaderAuthorizeUrl({
    appId,
    redirectUri,
    scope: config.inoreaderOAuthScope,
    state
  });

  return Response.redirect(authorizeUrl.toString(), 302);
};

const completeInoreaderOAuth = async (
  request: Request,
  env: InoreaderRemoteEnv
): Promise<Response> => {
  const url = new URL(request.url);
  const callbackError = getInoreaderOAuthCallbackError(url);
  if (callbackError) {
    return new Response(callbackError, { status: 400 });
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) {
    return new Response("Missing Inoreader OAuth code or state", { status: 400 });
  }

  const config = await Effect.runPromise(loadConfig(remoteEnvSource(env)));
  const response = await credentialStub(env).fetch("https://credentials/exchange", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      code,
      state,
      appId: requiredEnv(env.INOREADER_APP_ID, "INOREADER_APP_ID"),
      appKey: requiredEnv(env.INOREADER_APP_KEY, "INOREADER_APP_KEY"),
      redirectUri: new URL(callbackPath, request.url).toString(),
      tokenUrl: config.inoreaderOAuthTokenUrl
    })
  });
  if (!response.ok) {
    return new Response(await response.text(), { status: response.status });
  }

  return html(`<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><title>Inoreader Connected</title></head>
  <body>
    <h1>Inoreader connected</h1>
    <p>You can close this tab and use the remote MCP server.</p>
  </body>
</html>`);
};

const requiredEnv = (value: string | undefined, name: string): string => {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new Error(`${name} Cloudflare secret is required`);
  }

  return trimmed;
};

const remoteEnvSource = (
  env: InoreaderRemoteEnv
): Record<string, string | undefined> => ({
  INOREADER_API_BASE_URL: env.INOREADER_API_BASE_URL,
  INOREADER_OAUTH_TOKEN_URL: env.INOREADER_OAUTH_TOKEN_URL,
  INOREADER_OAUTH_SCOPE: env.INOREADER_OAUTH_SCOPE
});

const html = (body: string): Response =>
  new Response(body, {
    headers: {
      "content-type": "text/html; charset=utf-8"
    }
  });

const escapeHtml = (value: string): string =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
