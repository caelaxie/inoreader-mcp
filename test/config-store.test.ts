import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { loadConfig } from "../src/config.js";
import {
  keyringAccount,
  keyringService,
  saveCredentialConfig,
  type SecretStore
} from "../src/config-store.js";

const makeSecretStore = (): SecretStore & { readonly values: Map<string, string> } => {
  const values = new Map<string, string>();

  return {
    values,
    getPassword: (service, account) =>
      Promise.resolve(values.get(`${service}:${account}`)),
    setPassword: (service, account, password) => {
      values.set(`${service}:${account}`, password);
      return Promise.resolve();
    }
  };
};

describe("credential config store", () => {
  it("loads OAuth credentials from keyring without env vars", async () => {
    const directory = await mkdtemp(join(tmpdir(), "inoreader-mcp-"));
    const configFilePath = join(directory, "config.json");
    const secretStore = makeSecretStore();

    await saveCredentialConfig(
      {
        inoreaderClientId: "file-client-id",
        inoreaderClientSecret: "file-client-secret",
        inoreaderRefreshToken: "file-refresh-token"
      },
      { configFilePath, secretStore }
    );

    const config = await Effect.runPromise(
      loadConfig({}, { configFilePath, secretStore })
    );

    expect(config).toMatchObject({
      inoreaderClientId: "file-client-id",
      inoreaderClientSecret: "file-client-secret",
      inoreaderRefreshToken: "file-refresh-token"
    });
  });

  it("lets env vars override saved OAuth credentials", async () => {
    const directory = await mkdtemp(join(tmpdir(), "inoreader-mcp-"));
    const configFilePath = join(directory, "config.json");
    const secretStore = makeSecretStore();

    await saveCredentialConfig(
      {
        inoreaderClientId: "file-client-id",
        inoreaderClientSecret: "file-client-secret",
        inoreaderRefreshToken: "file-refresh-token"
      },
      { configFilePath, secretStore }
    );

    const config = await Effect.runPromise(
      loadConfig(
        {
          INOREADER_CLIENT_ID: "env-client-id",
          INOREADER_CLIENT_SECRET: "env-client-secret",
          INOREADER_REFRESH_TOKEN: "env-refresh-token"
        },
        { configFilePath, secretStore }
      )
    );

    expect(config).toMatchObject({
      inoreaderClientId: "env-client-id",
      inoreaderClientSecret: "env-client-secret",
      inoreaderRefreshToken: "env-refresh-token"
    });
  });

  it("writes secret credentials to keyring and public overrides to private JSON", async () => {
    const directory = await mkdtemp(join(tmpdir(), "inoreader-mcp-"));
    const configFilePath = join(directory, "config.json");
    const secretStore = makeSecretStore();

    await saveCredentialConfig(
      {
        inoreaderClientId: "client-id",
        inoreaderClientSecret: "client-secret",
        inoreaderRefreshToken: "refresh-token",
        inoreaderApiBaseUrl: "https://example.test/api",
        inoreaderOAuthTokenUrl: "https://example.test/oauth2/token"
      },
      { configFilePath, secretStore }
    );

    const fileContents = await readFile(configFilePath, "utf8");
    expect(fileContents).toContain(
      "\"inoreaderApiBaseUrl\": \"https://example.test/api\""
    );
    expect(fileContents).not.toContain("client-secret");
    expect(fileContents).not.toContain("refresh-token");
    expect((await stat(configFilePath)).mode & 0o777).toBe(0o600);
    expect(secretStore.values.get(`${keyringService}:${keyringAccount}`)).toBe(
      JSON.stringify({
        inoreaderClientId: "client-id",
        inoreaderClientSecret: "client-secret",
        inoreaderRefreshToken: "refresh-token"
      })
    );
  });
});
