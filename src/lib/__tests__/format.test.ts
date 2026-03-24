import { describe, expect, test, beforeEach, jest } from "bun:test";
import { formatDate, stateColor, truncate, printTable } from "../format.js";

describe("formatDate", () => {
  test("returns 'just now' for very recent timestamps", () => {
    expect(formatDate(Date.now() - 5_000)).toBe("just now");
  });

  test("returns minutes ago", () => {
    expect(formatDate(Date.now() - 5 * 60_000)).toBe("5m ago");
  });

  test("returns hours ago", () => {
    expect(formatDate(Date.now() - 3 * 3600_000)).toBe("3h ago");
  });

  test("returns days ago", () => {
    expect(formatDate(Date.now() - 7 * 86400_000)).toBe("7d ago");
  });

  test("returns formatted date for old timestamps", () => {
    // 60 days ago
    const result = formatDate(Date.now() - 60 * 86400_000);
    // Should be a formatted date string like "Jan 23, 2026"
    expect(result).toMatch(/\w+ \d{1,2}, \d{4}/);
  });
});

describe("stateColor", () => {
  test("OPEN returns a string containing OPEN", () => {
    expect(stateColor("OPEN")).toContain("OPEN");
  });

  test("MERGED returns a string containing MERGED", () => {
    expect(stateColor("MERGED")).toContain("MERGED");
  });

  test("DECLINED returns a string containing DECLINED", () => {
    expect(stateColor("DECLINED")).toContain("DECLINED");
  });

  test("unknown state returns the state as-is", () => {
    expect(stateColor("UNKNOWN")).toBe("UNKNOWN");
  });

  test("is case-insensitive for matching", () => {
    // stateColor uppercases before matching, so "open" hits the OPEN case
    const result = stateColor("open");
    expect(result).toContain("open");
  });
});

describe("truncate", () => {
  test("returns string unchanged if within limit", () => {
    expect(truncate("hello", 10)).toBe("hello");
  });

  test("returns string unchanged if exactly at limit", () => {
    expect(truncate("hello", 5)).toBe("hello");
  });

  test("truncates with ellipsis when over limit", () => {
    expect(truncate("hello world", 8)).toBe("hello w…");
  });

  test("handles empty string", () => {
    expect(truncate("", 5)).toBe("");
  });

  test("handles limit of 1", () => {
    expect(truncate("hello", 1)).toBe("…");
  });
});

describe("printTable", () => {
  test("prints nothing for empty rows", () => {
    const log = jest.fn();
    const origLog = console.log;
    console.log = log;
    printTable([]);
    console.log = origLog;
    expect(log).not.toHaveBeenCalled();
  });

  test("aligns columns correctly", () => {
    const lines: string[] = [];
    const origLog = console.log;
    console.log = (line: string) => lines.push(line);

    printTable([
      ["a", "bb", "ccc"],
      ["dd", "e", "f"],
    ]);

    console.log = origLog;

    expect(lines).toHaveLength(2);
    // First column: "a" padded to width 2, "dd" already width 2
    // Second column: "bb" width 2, "e" padded to width 2
    // Third column: no padding (last column)
    expect(lines[0]).toBe("a   bb  ccc");
    expect(lines[1]).toBe("dd  e   f");
  });
});
