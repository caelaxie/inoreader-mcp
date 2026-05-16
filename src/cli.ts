import { Effect } from "effect";

import {
  defaultCredentialConfigFilePath,
  saveCredentialConfig,
  type SecretStore
} from "./config-store.js";

export interface CliIo {
  readonly stdout: Pick<typeof process.stdout, "write">;
  readonly secretStore?: SecretStore;
}

export const runCliCommand = (
  argv: readonly string[],
  io: CliIo = { stdout: process.stdout }
): Effect.Effect<boolean, Error> =>
  Effect.tryPromise({
    try: async () => {
      const args = argv.slice(2);
      if (args[0] !== "auth" || args[1] !== "save") {
        return false;
      }

      const configFilePath =
        optionValue(args, "--config-file") ?? defaultCredentialConfigFilePath();
      const inoreaderClientId = requiredOption(args, "--client-id");
      const inoreaderClientSecret = requiredOption(args, "--client-secret");
      const inoreaderRefreshToken = requiredOption(args, "--refresh-token");
      const inoreaderApiBaseUrl = optionValue(args, "--api-base-url");
      const inoreaderOAuthTokenUrl = optionValue(args, "--oauth-token-url");

      await saveCredentialConfig(
        {
          inoreaderClientId,
          inoreaderClientSecret,
          inoreaderRefreshToken,
          ...(inoreaderApiBaseUrl ? { inoreaderApiBaseUrl } : {}),
          ...(inoreaderOAuthTokenUrl ? { inoreaderOAuthTokenUrl } : {})
        },
        {
          configFilePath,
          ...(io.secretStore ? { secretStore: io.secretStore } : {})
        }
      );
      io.stdout.write(
        `Saved Inoreader OAuth credentials to the system keyring and non-secret settings to ${configFilePath}\n`
      );

      return true;
    },
    catch: (error) => (error instanceof Error ? error : new Error(String(error)))
  });

const requiredOption = (args: readonly string[], name: string): string => {
  const value = optionValue(args, name)?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
};

const optionValue = (
  args: readonly string[],
  name: string
): string | undefined => {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
};
