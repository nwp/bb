import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { inferTitleFromBranch, parseCommitTitleAndBody, resolvePRDescription } from "./create.js";

describe("inferTitleFromBranch", () => {
  test("strips common prefix and title-cases first letter", () => {
    expect(inferTitleFromBranch("feature/add-user-endpoint")).toBe("Add user endpoint");
  });

  test("replaces underscores with spaces", () => {
    expect(inferTitleFromBranch("bugfix/fix_null_pointer")).toBe("Fix null pointer");
  });

  test("keeps branch text when prefix is absent", () => {
    expect(inferTitleFromBranch("chore/release-v1")).toBe("Chore/release v1");
  });
});

describe("parseCommitTitleAndBody", () => {
  test("parses title and multiline body", () => {
    const parsed = parseCommitTitleAndBody("Add retry logic\n\n- retry network errors\n- keep idempotency");
    expect(parsed.title).toBe("Add retry logic");
    expect(parsed.body).toBe("- retry network errors\n- keep idempotency");
  });

  test("returns only title for single-line commit", () => {
    const parsed = parseCommitTitleAndBody("Fix auth cache");
    expect(parsed.title).toBe("Fix auth cache");
    expect(parsed.body).toBeUndefined();
  });

  test("handles empty input", () => {
    const parsed = parseCommitTitleAndBody("   \n\n  ");
    expect(parsed.title).toBe("");
    expect(parsed.body).toBeUndefined();
  });
});

describe("resolvePRDescription", () => {
  test("returns --body value directly", async () => {
    const body = await resolvePRDescription("Direct body text", undefined, undefined);
    expect(body).toBe("Direct body text");
  });

  test("throws when --body and --body-file are both provided", async () => {
    await expect(resolvePRDescription("text", "body.md", undefined)).rejects.toThrow(
      "--body, --body-file, and --template are mutually exclusive"
    );
  });

  test("throws when --body and --template are both provided", async () => {
    await expect(resolvePRDescription("text", undefined, "template.md")).rejects.toThrow(
      "--body, --body-file, and --template are mutually exclusive"
    );
  });

  test("throws when --body-file and --template are both provided", async () => {
    await expect(resolvePRDescription(undefined, "body.md", "template.md")).rejects.toThrow(
      "--body, --body-file, and --template are mutually exclusive"
    );
  });

  test("reads body from file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "bb-pr-create-"));
    const file = join(dir, "body.md");

    try {
      await Bun.write(file, "Line one\nLine two\n");
      const body = await resolvePRDescription(undefined, file, undefined);
      expect(body).toBe("Line one\nLine two\n");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("reads body from template file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "bb-pr-template-"));
    const file = join(dir, "template.md");

    try {
      await Bun.write(file, "## Summary\n\n- change details\n");
      const body = await resolvePRDescription(undefined, undefined, file);
      expect(body).toBe("## Summary\n\n- change details\n");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
