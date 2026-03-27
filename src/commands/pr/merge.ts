import { Command } from "commander";
import chalk from "chalk";
import { resolveContext, resolvePRId } from "../../lib/context.js";

export const prMergeCmd = new Command("merge")
  .description("Merge a pull request")
  .argument("[number]", "PR number")
  .option("-R, --repo <repo>", "Repository in PROJECT/repo format")
  .option("--json", "Output as JSON")
  .action(async (number, opts) => {
    const ctx = await resolveContext({ repo: opts.repo });
    const prId = await resolvePRId(ctx.api, ctx.project, ctx.repo, number);
    const pr = await ctx.api.getPR(ctx.project, ctx.repo, prId);
    const merged = await ctx.api.mergePR(ctx.project, ctx.repo, prId, pr.version);

    if (opts.json) {
      console.log(JSON.stringify(merged, null, 2));
      return;
    }

    console.log(chalk.green(`✓ Merged pull request #${prId}`));
    console.log(`  ${pr.fromRef.displayId} → ${pr.toRef.displayId}`);
  });
