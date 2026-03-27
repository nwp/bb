import { Command } from "commander";
import chalk from "chalk";
import { resolveContext, resolvePRId } from "../../lib/context.js";

export const prCloseCmd = new Command("close")
  .description("Decline (close) a pull request")
  .argument("[number]", "PR number")
  .option("-R, --repo <repo>", "Repository in PROJECT/repo format")
  .option("--json", "Output as JSON")
  .action(async (number, opts) => {
    const ctx = await resolveContext({ repo: opts.repo });
    const prId = await resolvePRId(ctx.api, ctx.project, ctx.repo, number);
    const pr = await ctx.api.getPR(ctx.project, ctx.repo, prId);
    const declined = await ctx.api.declinePR(ctx.project, ctx.repo, prId, pr.version);

    if (opts.json) {
      console.log(JSON.stringify(declined, null, 2));
      return;
    }

    console.log(chalk.red(`✓ Declined pull request #${prId}`));
  });
