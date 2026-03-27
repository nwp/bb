import { Command } from "commander";
import chalk from "chalk";
import type { BitbucketAPI } from "../../lib/api.js";
import { resolveContext, resolvePRId } from "../../lib/context.js";
import { formatDate, printTable } from "../../lib/format.js";

export const prChecksCmd = new Command("checks")
  .description("View CI/build status for a pull request")
  .argument("[number]", "PR number (defaults to PR for current branch)")
  .option("-R, --repo <repo>", "Repository in PROJECT/repo format")
  .option("--json", "Output as JSON")
  .option("-w, --watch", "Poll until all checks complete")
  .action(async (number, opts) => {
    const ctx = await resolveContext({ repo: opts.repo });
    const prId = await resolvePRId(ctx.api, ctx.project, ctx.repo, number);
    const pr = await ctx.api.getPR(ctx.project, ctx.repo, prId);
    const commitHash = pr.fromRef.latestCommit;

    if (opts.watch) {
      await pollChecks(ctx, commitHash, prId, opts.json);
    } else {
      await showChecks(ctx, commitHash, prId, opts.json);
    }
  });

async function showChecks(
  ctx: { api: BitbucketAPI },
  commitHash: string,
  prId: number,
  json: boolean
): Promise<boolean> {
  const statuses = await ctx.api.getBuildStatus(commitHash);

  if (json) {
    console.log(JSON.stringify(statuses, null, 2));
    return statuses.length > 0 && statuses.every((s) => s.state === "SUCCESSFUL");
  }

  if (statuses.length === 0) {
    console.log(chalk.dim(`No build statuses reported for PR #${prId}`));
    return true;
  }

  const rows = statuses.map((s) => [
    stateIcon(s.state),
    s.name || s.key,
    formatDate(s.dateAdded),
    s.description || "",
  ]);

  printTable(rows);

  const failed = statuses.filter((s) => s.state === "FAILED").length;
  const inProgress = statuses.filter((s) => s.state === "INPROGRESS").length;

  console.log();
  if (failed > 0) {
    console.log(chalk.red(`${failed} failed`));
  }
  if (inProgress > 0) {
    console.log(chalk.yellow(`${inProgress} in progress`));
  }
  if (failed === 0 && inProgress === 0) {
    console.log(chalk.green("All checks passed"));
  }

  return failed === 0 && inProgress === 0;
}

async function pollChecks(
  ctx: { api: BitbucketAPI },
  commitHash: string,
  prId: number,
  json: boolean
): Promise<void> {
  const INTERVAL = 10_000;
  while (true) {
    const done = await showChecks(ctx, commitHash, prId, json);
    if (done) {
      process.exit(0);
    }
    if (!json) {
      console.log(chalk.dim(`\nPolling again in ${INTERVAL / 1000}s...`));
    }
    await new Promise((r) => setTimeout(r, INTERVAL));
    if (!json) {
      console.clear();
    }
  }
}

function stateIcon(state: string): string {
  switch (state.toUpperCase()) {
    case "SUCCESSFUL":
      return chalk.green("✓ pass");
    case "FAILED":
      return chalk.red("✗ fail");
    case "INPROGRESS":
      return chalk.yellow("● running");
    default:
      return chalk.dim(`○ ${state.toLowerCase()}`);
  }
}
