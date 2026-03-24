import { Command } from "commander";
import chalk from "chalk";
import { resolveContext, getCurrentBranch } from "../../lib/context.js";

export const prCloseCmd = new Command("close")
  .description("Decline (close) a pull request")
  .argument("[number]", "PR number")
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
    const declined = await ctx.api.declinePR(ctx.project, ctx.repo, prId, pr.version);

    if (opts.json) {
      console.log(JSON.stringify(declined, null, 2));
      return;
    }

    console.log(chalk.red(`✓ Declined pull request #${prId}`));
  });
