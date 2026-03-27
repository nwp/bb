import { Command } from "commander";
import chalk from "chalk";
import { resolveContext, resolvePRId } from "../../lib/context.js";

export const prReadyCmd = new Command("ready")
  .description("Mark a draft pull request as ready for review")
  .argument("[number]", "PR number (defaults to PR for current branch)")
  .option("-R, --repo <repo>", "Repository in PROJECT/repo format")
  .option("--json", "Output as JSON")
  .action(async (number, opts) => {
    const ctx = await resolveContext({ repo: opts.repo });
    const prId = await resolvePRId(ctx.api, ctx.project, ctx.repo, number);
    const pr = await ctx.api.getPR(ctx.project, ctx.repo, prId);
    const updated = await ctx.api.updatePR(ctx.project, ctx.repo, prId, {
      version: pr.version,
      draft: false,
    });

    if (opts.json) {
      console.log(JSON.stringify(updated, null, 2));
      return;
    }

    console.log(chalk.green(`✓ Pull request #${prId} is now ready for review`));
  });
