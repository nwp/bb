import { Command } from "commander";
import { $ } from "bun";
import chalk from "chalk";
import { resolveContext } from "../../lib/context.js";

export const prCheckoutCmd = new Command("checkout")
  .description("Check out a pull request branch locally")
  .argument("<number>", "PR number")
  .option("-R, --repo <repo>", "Repository in PROJECT/repo format")
  .action(async (number, opts) => {
    const ctx = await resolveContext({ repo: opts.repo });
    const prId = parseInt(number, 10);

    const pr = await ctx.api.getPR(ctx.project, ctx.repo, prId);
    const branch = pr.fromRef.displayId;

    console.log(`Checking out PR #${prId} (${chalk.cyan(branch)})...`);

    try {
      await $`git checkout ${branch}`.quiet();
    } catch {
      await $`git fetch origin ${branch}`.quiet();
      await $`git checkout -b ${branch} origin/${branch}`.quiet();
    }

    console.log(chalk.green(`✓ Switched to branch '${branch}'`));
  });
