import { homedir } from "os";
import { join } from "path";
import { mkdir, readFile, writeFile, chmod } from "fs/promises";
import { existsSync } from "fs";
import { setToken, getToken, deleteToken, getKeychainName } from "./keychain.js";

export interface BBConfig {
  hosts: Record<string, HostEntry>;
  defaults?: {
    project?: string;
    hostname?: string;
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

export function normalizeHostname(input: string): string {
  let host = input.trim();

  host = host.replace(/^[a-z]+:\/\//i, "");
  host = host.split(/[/?#]/, 1)[0] ?? host;
  host = host.replace(/\/$/, "");

  return host.toLowerCase();
}

function stripNumericPort(hostname: string): string {
  const ipv6Match = hostname.match(/^(\[[^\]]+\])(?::\d+)?$/);
  if (ipv6Match) return ipv6Match[1];
  return hostname.replace(/:\d+$/, "");
}

function hostMatches(left: string, right: string): boolean {
  if (left === right) return true;
  return stripNumericPort(left) === stripNumericPort(right);
}

export function resolveHostAlias(requestedHostname: string, configuredHosts: string[]): string | null {
  const requested = normalizeHostname(requestedHostname);
  if (!requested) return null;

  // 1) Exact key match first
  if (configuredHosts.includes(requested)) {
    return requested;
  }

  // 2) Exact normalized match
  for (const host of configuredHosts) {
    if (normalizeHostname(host) === requested) {
      return host;
    }
  }

  // 3) Fallback: ignore numeric port differences (common SSH/API split)
  for (const host of configuredHosts) {
    if (hostMatches(normalizeHostname(host), requested)) {
      return host;
    }
  }

  return null;
}

function findHostEntry(config: BBConfig, hostname: string): { key: string; entry: HostEntry } | null {
  const alias = resolveHostAlias(hostname, Object.keys(config.hosts));
  if (!alias) return null;
  return { key: alias, entry: config.hosts[alias] };
}

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
  const resolved = await getResolvedHostConfig(hostname);
  return resolved?.config ?? null;
}

export async function getResolvedHostConfig(
  hostname: string
): Promise<{ hostname: string; config: HostConfig } | null> {
  const config = await loadConfig();
  const match = findHostEntry(config, hostname);
  if (!match) return null;

  const resolvedConfig = await resolveHostConfig(match.key, match.entry);
  if (!resolvedConfig) return null;

  return { hostname: match.key, config: resolvedConfig };
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
  const normalizedHostname = normalizeHostname(hostname);

  const keychainStored = await setToken(normalizedHostname, host.token);

  const entry: HostEntry = {
    user: host.user,
    protocol: host.protocol,
  };

  if (keychainStored) {
    entry.token_store = "keychain";
  } else {
    entry.token_store = "file";
    entry.token = host.token;
  }

  config.hosts[normalizedHostname] = entry;
  config.defaults = {
    ...(config.defaults ?? {}),
    hostname: normalizedHostname,
  };
  await saveConfig(config);

  return keychainStored ? "keychain" : "file";
}

export async function removeHostConfig(hostname: string): Promise<void> {
  const config = await loadConfig();
  const match = findHostEntry(config, hostname);
  if (!match) return;

  const { key, entry } = match;
  if (entry?.token_store === "keychain") {
    await deleteToken(key);
  }

  delete config.hosts[key];

  if (config.defaults?.hostname && hostMatches(normalizeHostname(config.defaults.hostname), normalizeHostname(key))) {
    const nextHost = Object.keys(config.hosts)[0];
    if (nextHost) {
      config.defaults.hostname = nextHost;
    } else {
      delete config.defaults.hostname;
    }
  }

  await saveConfig(config);
}

/** Get the first configured host, or null */
export async function getDefaultHost(): Promise<{ hostname: string; config: HostConfig } | null> {
  const config = await loadConfig();
  if (config.defaults?.hostname) {
    const preferred = findHostEntry(config, config.defaults.hostname);
    if (preferred) {
      const resolved = await resolveHostConfig(preferred.key, preferred.entry);
      if (resolved) {
        return { hostname: preferred.key, config: resolved };
      }
    }
  }

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
