import { Command } from "commander";
import chalk from "chalk";
import { resolveContext } from "../../lib/context.js";
import { printTable, formatDate, stateColor, truncate } from "../../lib/format.js";

export const prListCmd = new Command("list")
  .description("List pull requests")
  .option("-s, --state <state>", "Filter by state (OPEN, MERGED, DECLINED, ALL)", "OPEN")
  .option("-L, --limit <limit>", "Maximum number of PRs to list", "30")
  .option("-R, --repo <repo>", "Repository in PROJECT/repo format")
  .option("--json", "Output as JSON")
  .action(async (opts) => {
    const ctx = await resolveContext({ repo: opts.repo });
    const limit = parseInt(opts.limit, 10);

    const prs = await ctx.api.listPRs(ctx.project, ctx.repo, opts.state);
    const limited = prs.slice(0, limit);

    if (opts.json) {
      console.log(JSON.stringify(limited, null, 2));
      return;
    }

    if (limited.length === 0) {
      console.log(`No ${opts.state.toLowerCase()} pull requests in ${ctx.project}/${ctx.repo}`);
      return;
    }

    const rows = limited.map((pr) => [
      chalk.cyan(`#${pr.id}`),
      truncate(pr.title, 60),
      `${pr.fromRef.displayId} → ${pr.toRef.displayId}`,
      stateColor(pr.state),
      chalk.dim(formatDate(pr.createdDate)),
      chalk.dim(pr.author.user.displayName),
    ]);
    printTable(rows);
  });
