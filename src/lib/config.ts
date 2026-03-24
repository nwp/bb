import { homedir } from "os";
import { join } from "path";
import { mkdir, readFile, writeFile, chmod } from "fs/promises";
import { existsSync } from "fs";
import { setToken, getToken, deleteToken, getKeychainName } from "./keychain.js";

export interface BBConfig {
  hosts: Record<string, HostEntry>;
  defaults?: {
    project?: string;
  };
}

/** What gets stored on disk. Token is only here as fallback when no keychain. */
export interface HostEntry {
  /** Only present when keychain is unavailable (insecure fallback). */
  token?: string;
  /** "keychain" if the token is stored in the OS keychain. */
  token_store?: "keychain" | "file";
  user?: string;
  protocol?: "https" | "http";
}

/** What consumers of the config actually use. Token is always resolved. */
export interface HostConfig {
  token: string;
  user?: string;
  protocol?: "https" | "http";
}

const CONFIG_DIR = join(homedir(), ".config", "bb");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

export function configDir(): string {
  return CONFIG_DIR;
}

export function configFile(): string {
  return CONFIG_FILE;
}

export async function ensureConfigDir(): Promise<void> {
  if (!existsSync(CONFIG_DIR)) {
    await mkdir(CONFIG_DIR, { recursive: true });
  }
}

export async function loadConfig(): Promise<BBConfig> {
  try {
    const raw = await readFile(CONFIG_FILE, "utf-8");
    return JSON.parse(raw) as BBConfig;
  } catch {
    return { hosts: {} };
  }
}

export async function saveConfig(config: BBConfig): Promise<void> {
  await ensureConfigDir();
  await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2) + "\n", "utf-8");
  // Restrict file permissions — config may contain fallback tokens
  await chmod(CONFIG_FILE, 0o600);
}

/**
 * Resolve a HostEntry (from disk) into a HostConfig (with token).
 * Retrieves the token from keychain if that's where it was stored.
 */
async function resolveHostConfig(hostname: string, entry: HostEntry): Promise<HostConfig | null> {
  let token: string | null = null;

  if (entry.token_store === "keychain") {
    token = await getToken(hostname);
  }

  // Fall back to file-stored token
  if (!token && entry.token) {
    token = entry.token;
  }

  if (!token) return null;

  return {
    token,
    user: entry.user,
    protocol: entry.protocol,
  };
}

export async function getHostConfig(hostname: string): Promise<HostConfig | null> {
  const config = await loadConfig();
  const entry = config.hosts[hostname];
  if (!entry) return null;
  return resolveHostConfig(hostname, entry);
}

/**
 * Store host credentials. Tries keychain first; falls back to file.
 * Returns "keychain" or "file" to indicate where the token was stored.
 */
export async function setHostConfig(
  hostname: string,
  host: HostConfig
): Promise<"keychain" | "file"> {
  const config = await loadConfig();

  const keychainStored = await setToken(hostname, host.token);

  const entry: HostEntry = {
    user: host.user,
    protocol: host.protocol,
  };

  if (keychainStored) {
    entry.token_store = "keychain";
    // Don't write the token to disk
  } else {
    entry.token_store = "file";
    entry.token = host.token;
  }

  config.hosts[hostname] = entry;
  await saveConfig(config);

  return keychainStored ? "keychain" : "file";
}

export async function removeHostConfig(hostname: string): Promise<void> {
  const config = await loadConfig();
  const entry = config.hosts[hostname];

  // Remove from keychain if it was stored there
  if (entry?.token_store === "keychain") {
    await deleteToken(hostname);
  }

  delete config.hosts[hostname];
  await saveConfig(config);
}

/** Get the first configured host, or null */
export async function getDefaultHost(): Promise<{ hostname: string; config: HostConfig } | null> {
  const config = await loadConfig();
  const entries = Object.entries(config.hosts);
  if (entries.length === 0) return null;

  for (const [hostname, entry] of entries) {
    const resolved = await resolveHostConfig(hostname, entry);
    if (resolved) return { hostname, config: resolved };
  }

  return null;
}

/** Migrate plain-text tokens to keychain if one is now available. */
export async function migrateTokensToKeychain(): Promise<number> {
  const keychainName = await getKeychainName();
  if (!keychainName) return 0;

  const config = await loadConfig();
  let migrated = 0;

  for (const [hostname, entry] of Object.entries(config.hosts)) {
    if (entry.token && entry.token_store !== "keychain") {
      const stored = await setToken(hostname, entry.token);
      if (stored) {
        delete entry.token;
        entry.token_store = "keychain";
        migrated++;
      }
    }
  }

  if (migrated > 0) {
    await saveConfig(config);
  }

  return migrated;
}

export { getKeychainName };
