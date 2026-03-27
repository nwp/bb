import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, readFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

describe("repo-cache", () => {
  let tempDir: string;
  let cacheFile: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "bb-cache-test-"));
    cacheFile = join(tempDir, ".bb.json");
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test("loadCache returns {} when file does not exist", async () => {
    const { loadCacheFrom } = getHelpers(cacheFile);
    const cache = await loadCacheFrom();
    expect(cache).toEqual({});
  });

  test("loadCache returns {} on malformed JSON", async () => {
    const { loadCacheFrom } = getHelpers(cacheFile);
    await Bun.write(cacheFile, "not valid json{{");
    const cache = await loadCacheFrom();
    expect(cache).toEqual({});
  });

  test("setCacheEntry + getCacheEntry round-trip", async () => {
    const { setCacheEntry, getCacheEntry } = getHelpers(cacheFile);

    await setCacheEntry("/home/alice/project", {
      hostname: "bitbucket.example.com:7999",
      project: "PROJ",
      repo: "my-repo",
    });

    const entry = await getCacheEntry("/home/alice/project");
    expect(entry).not.toBeNull();
    expect(entry!.hostname).toBe("bitbucket.example.com:7999");
    expect(entry!.project).toBe("PROJ");
    expect(entry!.repo).toBe("my-repo");
    expect(entry!.cachedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test("getCacheEntry returns null for unknown path", async () => {
    const { getCacheEntry } = getHelpers(cacheFile);
    const entry = await getCacheEntry("/nonexistent/path");
    expect(entry).toBeNull();
  });

  test("setCacheEntry overwrites existing entry and updates cachedAt", async () => {
    const { setCacheEntry, getCacheEntry } = getHelpers(cacheFile);

    await setCacheEntry("/home/alice/project", {
      hostname: "bitbucket.example.com",
      project: "OLD",
      repo: "old-repo",
    });
    const first = await getCacheEntry("/home/alice/project");

    // Small delay to ensure cachedAt differs
    await new Promise((r) => setTimeout(r, 5));

    await setCacheEntry("/home/alice/project", {
      hostname: "bitbucket.example.com",
      project: "NEW",
      repo: "new-repo",
    });
    const second = await getCacheEntry("/home/alice/project");

    expect(second!.project).toBe("NEW");
    expect(second!.repo).toBe("new-repo");
    expect(second!.cachedAt >= first!.cachedAt).toBe(true);
  });

  test("deleteCacheEntry returns true when entry existed", async () => {
    const { setCacheEntry, deleteCacheEntry, getCacheEntry } = getHelpers(cacheFile);

    await setCacheEntry("/home/alice/project", {
      hostname: "bitbucket.example.com",
      project: "PROJ",
      repo: "my-repo",
    });

    const existed = await deleteCacheEntry("/home/alice/project");
    expect(existed).toBe(true);
    expect(await getCacheEntry("/home/alice/project")).toBeNull();
  });

  test("deleteCacheEntry returns false when entry absent", async () => {
    const { deleteCacheEntry } = getHelpers(cacheFile);
    const existed = await deleteCacheEntry("/nonexistent/path");
    expect(existed).toBe(false);
  });

  test("listCacheEntries returns entries sorted by cachedAt descending", async () => {
    const { setCacheEntry, listCacheEntries } = getHelpers(cacheFile);

    await setCacheEntry("/home/alice/oldest", {
      hostname: "bitbucket.example.com",
      project: "A",
      repo: "oldest",
    });
    await new Promise((r) => setTimeout(r, 5));
    await setCacheEntry("/home/alice/newest", {
      hostname: "bitbucket.example.com",
      project: "B",
      repo: "newest",
    });

    const entries = await listCacheEntries();
    expect(entries).toHaveLength(2);
    expect(entries[0].repo).toBe("newest");
    expect(entries[1].repo).toBe("oldest");
    expect(entries[0].dir).toBe("/home/alice/newest");
  });

  test("listCacheEntries returns empty array when cache is empty", async () => {
    const { listCacheEntries } = getHelpers(cacheFile);
    const entries = await listCacheEntries();
    expect(entries).toEqual([]);
  });

  test("cache file is valid JSON with trailing newline", async () => {
    const { setCacheEntry } = getHelpers(cacheFile);
    await setCacheEntry("/home/alice/project", {
      hostname: "bb.example.com",
      project: "P",
      repo: "r",
    });
    const raw = await readFile(cacheFile, "utf-8");
    expect(() => JSON.parse(raw)).not.toThrow();
    expect(raw.endsWith("\n")).toBe(true);
  });

  test("multiple entries are stored independently", async () => {
    const { setCacheEntry, getCacheEntry } = getHelpers(cacheFile);

    await setCacheEntry("/path/one", { hostname: "bb1.example.com", project: "A", repo: "repo1" });
    await setCacheEntry("/path/two", { hostname: "bb2.example.com", project: "B", repo: "repo2" });

    const one = await getCacheEntry("/path/one");
    const two = await getCacheEntry("/path/two");

    expect(one!.hostname).toBe("bb1.example.com");
    expect(two!.hostname).toBe("bb2.example.com");
  });
});

/**
 * Returns helpers that operate on an arbitrary file path (so we don't touch the
 * real ~/.bb.json during test runs).
 */
function getHelpers(filePath: string) {
  const { readFile: rf, writeFile: wf } = require("fs/promises");

  type Entry = { hostname: string; project: string; repo: string; cachedAt?: string };
  type Cache = Record<string, Entry>;

  async function loadCacheFrom(): Promise<Cache> {
    try {
      const raw = await rf(filePath, "utf-8");
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  async function saveCacheTo(cache: Cache): Promise<void> {
    await wf(filePath, JSON.stringify(cache, null, 2) + "\n", "utf-8");
  }

  async function getCacheEntry(dir: string): Promise<(Entry & { cachedAt: string }) | null> {
    const cache = await loadCacheFrom();
    return (cache[dir] as Entry & { cachedAt: string }) ?? null;
  }

  async function setCacheEntry(dir: string, entry: Omit<Entry, "cachedAt">): Promise<void> {
    const cache = await loadCacheFrom();
    cache[dir] = { ...entry, cachedAt: new Date().toISOString() };
    await saveCacheTo(cache);
  }

  async function deleteCacheEntry(dir: string): Promise<boolean> {
    const cache = await loadCacheFrom();
    if (!(dir in cache)) return false;
    delete cache[dir];
    await saveCacheTo(cache);
    return true;
  }

  async function listCacheEntries(): Promise<Array<{ dir: string } & Entry & { cachedAt: string }>> {
    const cache = await loadCacheFrom();
    return Object.entries(cache)
      .map(([dir, e]) => ({ dir, ...(e as Entry & { cachedAt: string }) }))
      .sort((a, b) => b.cachedAt.localeCompare(a.cachedAt));
  }

  return { loadCacheFrom, getCacheEntry, setCacheEntry, deleteCacheEntry, listCacheEntries };
}
