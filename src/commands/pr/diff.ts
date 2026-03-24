import { Command } from "commander";
import chalk from "chalk";
import { resolveContext, getCurrentBranch } from "../../lib/context.js";

export const prDiffCmd = new Command("diff")
  .description("View the diff of a pull request")
  .argument("[number]", "PR number")
  .option("-R, --repo <repo>", "Repository in PROJECT/repo format")
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

    const diff = await ctx.api.getPRDiff(ctx.project, ctx.repo, prId);
    process.stdout.write(diff);
  });
