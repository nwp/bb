import { homedir } from "os";
import { join } from "path";
import { readFile, writeFile } from "fs/promises";

export interface CacheEntry {
  hostname: string;
  project: string;
  repo: string;
  cachedAt: string; // ISO 8601
}

export type RepoCache = Record<string, CacheEntry>;

const CACHE_FILE = join(homedir(), ".bb-cli.json");

export function cacheFilePath(): string {
  return CACHE_FILE;
}

export async function loadCache(): Promise<RepoCache> {
  try {
    const raw = await readFile(CACHE_FILE, "utf-8");
    return JSON.parse(raw) as RepoCache;
  } catch {
    return {};
  }
}

export async function saveCache(cache: RepoCache): Promise<void> {
  await writeFile(CACHE_FILE, JSON.stringify(cache, null, 2) + "\n", "utf-8");
}

export async function getCacheEntry(dir: string): Promise<CacheEntry | null> {
  const cache = await loadCache();
  return cache[dir] ?? null;
}

export async function setCacheEntry(
  dir: string,
  entry: Omit<CacheEntry, "cachedAt">
): Promise<void> {
  const cache = await loadCache();
  cache[dir] = { ...entry, cachedAt: new Date().toISOString() };
  await saveCache(cache);
}

export async function deleteCacheEntry(dir: string): Promise<boolean> {
  const cache = await loadCache();
  if (!(dir in cache)) return false;
  delete cache[dir];
  await saveCache(cache);
  return true;
}

export async function listCacheEntries(): Promise<Array<{ dir: string } & CacheEntry>> {
  const cache = await loadCache();
  return Object.entries(cache)
    .map(([dir, entry]) => ({ dir, ...entry }))
    .sort((a, b) => b.cachedAt.localeCompare(a.cachedAt));
}
