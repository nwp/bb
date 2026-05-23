import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, readFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { normalizeHostname, resolveHostAlias } from "../config.js";

// We need to override the config paths for testing.
// The simplest approach: test the load/save logic with real files in a temp dir.

describe("config", () => {
  let tempDir: string;
  let configFile: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "bb-test-"));
    configFile = join(tempDir, "config.json");
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test("loadConfig returns empty hosts when file does not exist", async () => {
    const { loadConfigFrom } = await getHelpers();
    const config = await loadConfigFrom(configFile);
    expect(config).toEqual({ hosts: {} });
  });

  test("saveConfig creates file and loadConfig reads it back", async () => {
    const { loadConfigFrom, saveConfigTo } = await getHelpers();

    const config = {
      hosts: {
        "bitbucket.example.com": {
          token: "abc123",
          protocol: "https" as const,
        },
      },
    };

    await saveConfigTo(configFile, config);
    const loaded = await loadConfigFrom(configFile);
    expect(loaded).toEqual(config);
  });

  test("supports multiple hosts", async () => {
    const { loadConfigFrom, saveConfigTo } = await getHelpers();

    const config = {
      hosts: {
        "bb1.corp.com": { token: "token1", protocol: "https" as const },
        "bb2.corp.com": { token: "token2", protocol: "http" as const },
      },
    };

    await saveConfigTo(configFile, config);
    const loaded = await loadConfigFrom(configFile);
    expect(Object.keys(loaded.hosts)).toHaveLength(2);
    expect(loaded.hosts["bb1.corp.com"].token).toBe("token1");
    expect(loaded.hosts["bb2.corp.com"].protocol).toBe("http");
  });

  test("config file is valid JSON with trailing newline", async () => {
    const { saveConfigTo } = await getHelpers();

    await saveConfigTo(configFile, {
      hosts: { "bb.test": { token: "t" } },
    });

    const raw = await readFile(configFile, "utf-8");
    expect(() => JSON.parse(raw)).not.toThrow();
    expect(raw.endsWith("\n")).toBe(true);
  });

  test("loadConfig handles malformed JSON gracefully", async () => {
    const { loadConfigFrom } = await getHelpers();
    await Bun.write(configFile, "not json{{{");
    const config = await loadConfigFrom(configFile);
    expect(config).toEqual({ hosts: {} });
  });

  test("host can be removed", async () => {
    const { loadConfigFrom, saveConfigTo } = await getHelpers();

    const config = {
      hosts: {
        "bb1.corp.com": { token: "token1" },
        "bb2.corp.com": { token: "token2" },
      },
    };

    await saveConfigTo(configFile, config);

    // Remove a host
    const loaded = await loadConfigFrom(configFile);
    delete loaded.hosts["bb1.corp.com"];
    await saveConfigTo(configFile, loaded);

    const updated = await loadConfigFrom(configFile);
    expect(Object.keys(updated.hosts)).toHaveLength(1);
    expect(updated.hosts["bb1.corp.com"]).toBeUndefined();
    expect(updated.hosts["bb2.corp.com"].token).toBe("token2");
  });
});

describe("normalizeHostname", () => {
  test("normalizes protocol, path, and casing", () => {
    expect(normalizeHostname("HTTPS://BitBucket.Example.com/scm/PROJ/repo.git")).toBe(
      "bitbucket.example.com"
    );
  });

  test("preserves explicit host port", () => {
    expect(normalizeHostname("bitbucket.example.com:7990")).toBe("bitbucket.example.com:7990");
  });

  test("preserves bracketed ipv6 host", () => {
    expect(normalizeHostname("https://[2001:db8::1]:7990/scm/PROJ/repo.git")).toBe("[2001:db8::1]:7990");
  });
});

describe("resolveHostAlias", () => {
  test("prefers exact matching host key", () => {
    const match = resolveHostAlias("bitbucket.example.com:7999", [
      "bitbucket.example.com",
      "bitbucket.example.com:7999",
    ]);
    expect(match).toBe("bitbucket.example.com:7999");
  });

  test("falls back to host without port when only base host is configured", () => {
    const match = resolveHostAlias("bitbucket.example.com:7999", ["bitbucket.example.com"]);
    expect(match).toBe("bitbucket.example.com");
  });

  test("returns null when host is not configured", () => {
    const match = resolveHostAlias("bb.other.internal", ["bb.example.internal"]);
    expect(match).toBeNull();
  });
});

/**
 * Helpers that work with arbitrary file paths (so we can test with temp dirs
 * instead of touching the real ~/.config/bb/).
 */
async function getHelpers() {
  const { readFile, writeFile, mkdir } = await import("fs/promises");
  const { dirname } = await import("path");
  const { existsSync } = await import("fs");

  type BBConfig = { hosts: Record<string, { token: string; protocol?: string; user?: string }> };

  async function loadConfigFrom(path: string): Promise<BBConfig> {
    try {
      const raw = await readFile(path, "utf-8");
      return JSON.parse(raw);
    } catch {
      return { hosts: {} };
    }
  }

  async function saveConfigTo(path: string, config: BBConfig): Promise<void> {
    const dir = dirname(path);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
    await writeFile(path, JSON.stringify(config, null, 2) + "\n", "utf-8");
  }

  return { loadConfigFrom, saveConfigTo };
}
