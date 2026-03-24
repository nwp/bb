import { describe, expect, test } from "bun:test";
import { parseRemoteUrl } from "../context.js";

describe("parseRemoteUrl", () => {
  // ── HTTPS ──────────────────────────────────────────────────────

  test("HTTPS with /scm/ path (standard Bitbucket Server)", () => {
    const result = parseRemoteUrl("https://bitbucket.example.com/scm/PROJ/my-repo.git");
    expect(result).toEqual({ hostname: "bitbucket.example.com", project: "PROJ", repo: "my-repo" });
  });

  test("HTTPS without /scm/ path", () => {
    const result = parseRemoteUrl("https://bitbucket.example.com/PROJ/my-repo.git");
    expect(result).toEqual({ hostname: "bitbucket.example.com", project: "PROJ", repo: "my-repo" });
  });

  test("HTTPS without .git suffix", () => {
    const result = parseRemoteUrl("https://bitbucket.example.com/scm/PROJ/my-repo");
    expect(result).toEqual({ hostname: "bitbucket.example.com", project: "PROJ", repo: "my-repo" });
  });

  test("HTTP (non-TLS)", () => {
    const result = parseRemoteUrl("http://bitbucket.internal/scm/TEAM/service.git");
    expect(result).toEqual({ hostname: "bitbucket.internal", project: "TEAM", repo: "service" });
  });

  test("HTTPS with port", () => {
    const result = parseRemoteUrl("https://bitbucket.example.com:7990/scm/PROJ/repo.git");
    expect(result).toEqual({ hostname: "bitbucket.example.com:7990", project: "PROJ", repo: "repo" });
  });

  // ── SSH ────────────────────────────────────────────────────────

  test("SSH with port preserves host:port", () => {
    const result = parseRemoteUrl("ssh://git@bitbucket.example.com:7999/PROJ/my-repo.git");
    expect(result).toEqual({ hostname: "bitbucket.example.com:7999", project: "PROJ", repo: "my-repo" });
  });

  test("SSH without port", () => {
    const result = parseRemoteUrl("ssh://git@bitbucket.example.com/PROJ/my-repo.git");
    expect(result).toEqual({ hostname: "bitbucket.example.com", project: "PROJ", repo: "my-repo" });
  });

  test("SSH without .git suffix preserves host:port", () => {
    const result = parseRemoteUrl("ssh://git@bitbucket.example.com:7999/PROJ/my-repo");
    expect(result).toEqual({ hostname: "bitbucket.example.com:7999", project: "PROJ", repo: "my-repo" });
  });

  // ── SCP-style ──────────────────────────────────────────────────

  test("SCP-style with port preserves host:port", () => {
    const result = parseRemoteUrl("git@bitbucket.example.com:7999/PROJ/my-repo.git");
    expect(result).toEqual({ hostname: "bitbucket.example.com:7999", project: "PROJ", repo: "my-repo" });
  });

  test("SCP-style without port", () => {
    const result = parseRemoteUrl("git@bitbucket.example.com:PROJ/my-repo.git");
    expect(result).toEqual({ hostname: "bitbucket.example.com", project: "PROJ", repo: "my-repo" });
  });

  // ── Edge cases ─────────────────────────────────────────────────

  test("returns null for unrecognized URL", () => {
    expect(parseRemoteUrl("not-a-url")).toBeNull();
  });

  test("returns null for empty string", () => {
    expect(parseRemoteUrl("")).toBeNull();
  });

  test("handles project keys with lowercase", () => {
    const result = parseRemoteUrl("https://bb.corp.com/scm/myproj/service-api.git");
    expect(result).toEqual({ hostname: "bb.corp.com", project: "myproj", repo: "service-api" });
  });

  test("handles repo names with dots", () => {
    const result = parseRemoteUrl("https://bb.corp.com/scm/PROJ/my.repo.name.git");
    expect(result).toEqual({ hostname: "bb.corp.com", project: "PROJ", repo: "my.repo.name" });
  });

  test("handles repo names with underscores", () => {
    const result = parseRemoteUrl("ssh://git@bb.corp.com:7999/PROJ/my_repo.git");
    expect(result).toEqual({ hostname: "bb.corp.com:7999", project: "PROJ", repo: "my_repo" });
  });
});
