import { Command } from "commander";
import chalk from "chalk";
import { resolveContext } from "../../lib/context.js";

export const prReopenCmd = new Command("reopen")
  .description("Reopen a declined pull request")
  .argument("<number>", "PR number")
  .option("-R, --repo <repo>", "Repository in PROJECT/repo format")
  .option("--json", "Output as JSON")
  .action(async (number, opts) => {
    const ctx = await resolveContext({ repo: opts.repo });
    const prId = parseInt(number, 10);

    const pr = await ctx.api.getPR(ctx.project, ctx.repo, prId);
    const reopened = await ctx.api.reopenPR(ctx.project, ctx.repo, prId, pr.version);

    if (opts.json) {
      console.log(JSON.stringify(reopened, null, 2));
      return;
    }

    console.log(chalk.green(`✓ Reopened pull request #${prId}`));
    console.log(`  ${reopened.fromRef.displayId} → ${reopened.toRef.displayId}`);
  });
