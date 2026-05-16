import { describe, expect, it } from "vitest";

import {
  createInoreaderAuthorizeUrl,
  getInoreaderOAuthCallbackError
} from "../src/remote/oauth.js";

describe("remote OAuth helpers", () => {
  it("builds Inoreader authorization URLs with the configured scope", () => {
    const authorizeUrl = createInoreaderAuthorizeUrl({
      appId: "app-id",
      redirectUri: "https://worker.example/callback",
      scope: "read write",
      state: "state-1"
    });

    expect(authorizeUrl.toString()).toContain(
      "https://www.inoreader.com/oauth2/auth?"
    );
    expect(authorizeUrl.searchParams.get("client_id")).toBe("app-id");
    expect(authorizeUrl.searchParams.get("redirect_uri")).toBe(
      "https://worker.example/callback"
    );
    expect(authorizeUrl.searchParams.get("response_type")).toBe("code");
    expect(authorizeUrl.searchParams.get("scope")).toBe("read write");
    expect(authorizeUrl.searchParams.get("state")).toBe("state-1");
  });

  it("formats Inoreader callback errors without hiding the cause", () => {
    const message = getInoreaderOAuthCallbackError(
      new URL(
        "https://worker.example/callback?error=invalid_scope&error_description=An+unsupported+scope+was+requested"
      )
    );

    expect(message).toBe(
      "Inoreader OAuth failed: invalid_scope - An unsupported scope was requested"
    );
  });
});
