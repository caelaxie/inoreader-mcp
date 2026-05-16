import { AsyncEntry } from "@napi-rs/keyring";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export interface SavedCredentialConfig {
  readonly inoreaderClientId: string;
  readonly inoreaderClientSecret: string;
  readonly inoreaderRefreshToken: string;
  readonly inoreaderApiBaseUrl?: string;
  readonly inoreaderOAuthTokenUrl?: string;
}

export interface CredentialConfigStoreOptions {
  readonly configFilePath?: string;
  readonly secretStore?: SecretStore;
}

export interface SecretStore {
  readonly getPassword: (
    service: string,
    account: string
  ) => Promise<string | undefined | null>;
  readonly setPassword: (
    service: string,
    account: string,
    password: string
  ) => Promise<void>;
}

export const keyringService = "inoreader-mcp";
export const keyringAccount = "oauth";

export const defaultCredentialConfigFilePath = (
  env: NodeJS.ProcessEnv = process.env
): string =>
  join(
    env.XDG_CONFIG_HOME ?? join(homedir(), ".config"),
    "inoreader-mcp",
    "config.json"
  );

export const loadCredentialConfig = async (
  options: CredentialConfigStoreOptions = {}
): Promise<SavedCredentialConfig | undefined> => {
  const configFilePath =
    options.configFilePath ?? defaultCredentialConfigFilePath();
  const secretStore = options.secretStore ?? createKeyringSecretStore();
  const secretConfig = await loadSecretCredentialConfig(secretStore);
  const publicConfig = await loadPublicCredentialConfig(configFilePath);

  if (!secretConfig && !publicConfig) {
    return undefined;
  }

  return {
    inoreaderClientId: secretConfig?.inoreaderClientId ?? "",
    inoreaderClientSecret: secretConfig?.inoreaderClientSecret ?? "",
    inoreaderRefreshToken: secretConfig?.inoreaderRefreshToken ?? "",
    ...(publicConfig?.inoreaderApiBaseUrl
      ? { inoreaderApiBaseUrl: publicConfig.inoreaderApiBaseUrl }
      : {}),
    ...(publicConfig?.inoreaderOAuthTokenUrl
      ? { inoreaderOAuthTokenUrl: publicConfig.inoreaderOAuthTokenUrl }
      : {})
  };
};

export const saveCredentialConfig = async (
  config: SavedCredentialConfig,
  options: CredentialConfigStoreOptions = {}
): Promise<void> => {
  const configFilePath =
    options.configFilePath ?? defaultCredentialConfigFilePath();
  const secretStore = options.secretStore ?? createKeyringSecretStore();

  await secretStore.setPassword(
    keyringService,
    keyringAccount,
    JSON.stringify({
      inoreaderClientId: config.inoreaderClientId,
      inoreaderClientSecret: config.inoreaderClientSecret,
      inoreaderRefreshToken: config.inoreaderRefreshToken
    })
  );
  await mkdir(dirname(configFilePath), { recursive: true });
  await writeFile(
    `${configFilePath}.tmp`,
    JSON.stringify(
      {
        ...(config.inoreaderApiBaseUrl
          ? { inoreaderApiBaseUrl: config.inoreaderApiBaseUrl }
          : {}),
        ...(config.inoreaderOAuthTokenUrl
          ? { inoreaderOAuthTokenUrl: config.inoreaderOAuthTokenUrl }
          : {})
      },
      null,
      2
    ),
    {
      mode: 0o600
    }
  );
  await rename(`${configFilePath}.tmp`, configFilePath);
};

const loadPublicCredentialConfig = async (
  configFilePath: string
): Promise<Partial<SavedCredentialConfig> | undefined> => {
  try {
    const contents = await readFile(configFilePath, "utf8");
    const parsed = JSON.parse(contents) as unknown;

    if (typeof parsed !== "object" || parsed === null) {
      throw new Error("expected an object");
    }

    return compactPublicCredentialConfig(parsed as Record<string, unknown>);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return undefined;
    }

    throw error;
  }
};

const loadSecretCredentialConfig = async (
  secretStore: SecretStore
): Promise<SavedCredentialConfig | undefined> => {
  const password = await secretStore.getPassword(keyringService, keyringAccount);
  if (!password) {
    return undefined;
  }

  const parsed = JSON.parse(password) as unknown;
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("expected keyring credentials to be an object");
  }

  return compactSecretCredentialConfig(parsed as Record<string, unknown>);
};

const compactSecretCredentialConfig = (
  input: Record<string, unknown>
): SavedCredentialConfig => ({
  inoreaderClientId:
    typeof input.inoreaderClientId === "string"
      ? input.inoreaderClientId
      : "",
  inoreaderClientSecret:
    typeof input.inoreaderClientSecret === "string"
      ? input.inoreaderClientSecret
      : "",
  inoreaderRefreshToken:
    typeof input.inoreaderRefreshToken === "string"
      ? input.inoreaderRefreshToken
      : ""
});

const compactPublicCredentialConfig = (
  input: Record<string, unknown>
): Partial<SavedCredentialConfig> => ({
  ...(typeof input.inoreaderApiBaseUrl === "string"
    ? { inoreaderApiBaseUrl: input.inoreaderApiBaseUrl }
    : {}),
  ...(typeof input.inoreaderOAuthTokenUrl === "string"
    ? { inoreaderOAuthTokenUrl: input.inoreaderOAuthTokenUrl }
    : {})
});

const createKeyringSecretStore = (): SecretStore => ({
  getPassword: async (service, account) =>
    new AsyncEntry(service, account).getPassword(),
  setPassword: async (service, account, password) =>
    new AsyncEntry(service, account).setPassword(password)
});
