import { Command } from "commander";
import { resolveContext, resolvePRId } from "../../lib/context.js";

export const prDiffCmd = new Command("diff")
  .description("View the diff of a pull request")
  .argument("[number]", "PR number")
  .option("-R, --repo <repo>", "Repository in PROJECT/repo format")
  .action(async (number, opts) => {
    const ctx = await resolveContext({ repo: opts.repo });
    const prId = await resolvePRId(ctx.api, ctx.project, ctx.repo, number);
    const diff = await ctx.api.getPRDiff(ctx.project, ctx.repo, prId);
    process.stdout.write(diff);
  });
