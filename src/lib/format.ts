import chalk from "chalk";

/** Format a date timestamp (millis) to a relative or absolute string */
export function formatDate(ts: number): string {
  const now = Date.now();
  const diff = now - ts;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 30) {
    return new Date(ts).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "just now";
}

/** Color a PR/state string like gh does */
export function stateColor(state: string): string {
  switch (state.toUpperCase()) {
    case "OPEN":
    case "APPROVED":
      return chalk.green(state);
    case "MERGED":
      return chalk.magenta(state);
    case "DECLINED":
    case "CLOSED":
    case "NEEDS_WORK":
      return chalk.red(state);
    case "UNAPPROVED":
      return chalk.yellow(state);
    default:
      return state;
  }
}

/** Truncate a string to max length */
export function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max - 1) + "…";
}

/** Pad/align columns for table output (like gh's tabwriter) */
export function printTable(rows: string[][]): void {
  if (rows.length === 0) return;
  const colCount = rows[0].length;
  const widths: number[] = [];

  for (let c = 0; c < colCount; c++) {
    widths[c] = Math.max(...rows.map((r) => stripAnsi(r[c] ?? "").length));
  }

  for (const row of rows) {
    const parts = row.map((cell, i) => {
      if (i === colCount - 1) return cell; // don't pad last column
      const visible = stripAnsi(cell).length;
      return cell + " ".repeat(widths[i] - visible);
    });
    console.log(parts.join("  "));
  }
}

function stripAnsi(str: string): string {
  return str.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "");
}

