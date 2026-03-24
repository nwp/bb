import { homedir } from "os";
import { join } from "path";
import { mkdir, readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";

export interface BBConfig {
  hosts: Record<string, HostConfig>;
  defaults?: {
    project?: string;
  };
}

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
}

export async function getHostConfig(hostname: string): Promise<HostConfig | null> {
  const config = await loadConfig();
  return config.hosts[hostname] ?? null;
}

export async function setHostConfig(hostname: string, host: HostConfig): Promise<void> {
  const config = await loadConfig();
  config.hosts[hostname] = host;
  await saveConfig(config);
}

export async function removeHostConfig(hostname: string): Promise<void> {
  const config = await loadConfig();
  delete config.hosts[hostname];
  await saveConfig(config);
}

/** Get the first configured host, or null */
export async function getDefaultHost(): Promise<{ hostname: string; config: HostConfig } | null> {
  const config = await loadConfig();
  const entries = Object.entries(config.hosts);
  if (entries.length === 0) return null;
  const [hostname, hostConfig] = entries[0];
  return { hostname, config: hostConfig };
}
