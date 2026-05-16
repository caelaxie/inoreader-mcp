import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { runCliCommand } from "../src/cli.js";
import { keyringAccount, keyringService, type SecretStore } from "../src/config-store.js";

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

describe("runCliCommand", () => {
  it("saves OAuth credentials for env-free MCP startup", async () => {
    const directory = await mkdtemp(join(tmpdir(), "inoreader-mcp-"));
    const configFilePath = join(directory, "config.json");
    const secretStore = makeSecretStore();
    let output = "";

    const handled = await Effect.runPromise(
      runCliCommand(
        [
          "node",
          "inoreader-mcp",
          "auth",
          "save",
          "--client-id",
          "client-id",
          "--client-secret",
          "client-secret",
          "--refresh-token",
          "refresh-token",
          "--config-file",
          configFilePath
        ],
        {
          secretStore,
          stdout: {
            write: (chunk: string | Uint8Array) => {
              output += chunk.toString();
              return true;
            }
          }
        }
      )
    );

    expect(handled).toBe(true);
    await expect(readFile(configFilePath, "utf8")).resolves.not.toContain(
      "client-secret"
    );
    expect(secretStore.values.get(`${keyringService}:${keyringAccount}`)).toBe(
      JSON.stringify({
        inoreaderClientId: "client-id",
        inoreaderClientSecret: "client-secret",
        inoreaderRefreshToken: "refresh-token"
      })
    );
    expect(output).toContain("Saved Inoreader OAuth credentials to the system keyring");
  });

  it("ignores non-setup commands so the MCP server can start", async () => {
    await expect(
      Effect.runPromise(runCliCommand(["node", "inoreader-mcp"]))
    ).resolves.toBe(false);
  });
});
