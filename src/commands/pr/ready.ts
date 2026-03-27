import { Command } from "commander";
import chalk from "chalk";
import { resolveContext, getCurrentBranch } from "../../lib/context.js";

export const prReadyCmd = new Command("ready")
  .description("Mark a draft pull request as ready for review")
  .argument("[number]", "PR number (defaults to PR for current branch)")
  .option("-R, --repo <repo>", "Repository in PROJECT/repo format")
  .option("--json", "Output as JSON")
  .action(async (number, opts) => {
    const ctx = await resolveContext({ repo: opts.repo });
    let prId = number ? parseInt(number, 10) : null;

    if (!prId) {
      const branch = await getCurrentBranch();
      if (branch) {
        const prs = await ctx.api.listPRs(ctx.project, ctx.repo, "OPEN");
        const match = prs.find((pr) => pr.fromRef.displayId === branch);
        if (match) prId = match.id;
      }
      if (!prId) {
        console.error(chalk.red("No PR number specified and no PR found for current branch"));
        process.exit(1);
      }
    }

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
