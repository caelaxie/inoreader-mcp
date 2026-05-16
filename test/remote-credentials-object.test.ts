import { afterEach, describe, expect, it, vi } from "vitest";

import { InoreaderCredentials } from "../src/remote/credentials-object.js";

class MemoryStorage {
  readonly values = new Map<string, unknown>();

  get<T>(key: string): Promise<T | undefined> {
    return Promise.resolve(this.values.get(key) as T | undefined);
  }

  put<T>(key: string, value: T): Promise<void> {
    this.values.set(key, value);
    return Promise.resolve();
  }

  delete(key: string): Promise<boolean> {
    return Promise.resolve(this.values.delete(key));
  }
}

const makeObject = () => {
  const storage = new MemoryStorage();
  const durableObject = new InoreaderCredentials({
    storage
  } as unknown as DurableObjectState);

  return { durableObject, storage };
};

describe("InoreaderCredentials", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stores refresh tokens after validating OAuth state", async () => {
    const { durableObject } = makeObject();
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Response.json({
          access_token: "access-token",
          refresh_token: "refresh-token",
          expires_in: 3600
        })
      )
    );

    await durableObject.fetch(
      new Request("https://credentials/begin", {
        method: "POST",
        body: JSON.stringify({ state: "state-1" })
      })
    );
    const response = await durableObject.fetch(
      new Request("https://credentials/exchange", {
        method: "POST",
        body: JSON.stringify({
          code: "code-1",
          state: "state-1",
          appId: "app-id",
          appKey: "app-key",
          redirectUri: "https://worker.example/callback",
          tokenUrl: "https://www.inoreader.com/oauth2/token"
        })
      })
    );

    expect(response.ok).toBe(true);
    await expect(
      durableObject
        .fetch(new Request("https://credentials/status"))
        .then((result) => result.json())
    ).resolves.toEqual({ configured: true });
  });

  it("refreshes and caches access tokens from the stored refresh token", async () => {
    const { durableObject } = makeObject();
    let tokenRequests = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(() => {
        tokenRequests += 1;
        return Response.json({
          access_token: `access-token-${tokenRequests}`,
          refresh_token: "refresh-token",
          expires_in: 3600
        });
      })
    );

    await durableObject.fetch(
      new Request("https://credentials/begin", {
        method: "POST",
        body: JSON.stringify({ state: "state-1" })
      })
    );
    await durableObject.fetch(
      new Request("https://credentials/exchange", {
        method: "POST",
        body: JSON.stringify({
          code: "code-1",
          state: "state-1",
          appId: "app-id",
          appKey: "app-key",
          redirectUri: "https://worker.example/callback",
          tokenUrl: "https://www.inoreader.com/oauth2/token"
        })
      })
    );

    const first = await durableObject
      .fetch(
        new Request("https://credentials/access-token", {
          method: "POST",
          body: JSON.stringify({
            appId: "app-id",
            appKey: "app-key",
            tokenUrl: "https://www.inoreader.com/oauth2/token"
          })
        })
      )
      .then((result) => result.json());
    const second = await durableObject
      .fetch(
        new Request("https://credentials/access-token", {
          method: "POST",
          body: JSON.stringify({
            appId: "app-id",
            appKey: "app-key",
            tokenUrl: "https://www.inoreader.com/oauth2/token"
          })
        })
      )
      .then((result) => result.json());

    expect(first).toEqual({ accessToken: "access-token-1" });
    expect(second).toEqual({ accessToken: "access-token-1" });
    expect(tokenRequests).toBe(1);
  });
});
