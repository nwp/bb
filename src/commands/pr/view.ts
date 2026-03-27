import { Command } from "commander";
import chalk from "chalk";
import { resolveContext, resolvePRId } from "../../lib/context.js";
import { formatDate, stateColor } from "../../lib/format.js";

export const prViewCmd = new Command("view")
  .description("View a pull request")
  .argument("[number]", "PR number (defaults to PR for current branch)")
  .option("-R, --repo <repo>", "Repository in PROJECT/repo format")
  .option("--json", "Output as JSON")
  .action(async (number, opts) => {
    const ctx = await resolveContext({ repo: opts.repo });
    const prId = await resolvePRId(ctx.api, ctx.project, ctx.repo, number);
    const pr = await ctx.api.getPR(ctx.project, ctx.repo, prId);

    if (opts.json) {
      console.log(JSON.stringify(pr, null, 2));
      return;
    }

    console.log(`${chalk.bold(pr.title)} ${chalk.cyan(`#${pr.id}`)}`);
    console.log(`${stateColor(pr.state)} • ${pr.author.user.displayName} opened ${formatDate(pr.createdDate)}`);
    console.log(`${pr.fromRef.displayId} → ${pr.toRef.displayId}`);
    console.log();

    if (pr.description) {
      console.log(pr.description);
      console.log();
    }

    if (pr.reviewers.length > 0) {
      console.log(chalk.dim("Reviewers:"));
      for (const r of pr.reviewers) {
        const statusIcon =
          r.status === "APPROVED" ? chalk.green("✓") :
          r.status === "NEEDS_WORK" ? chalk.red("✗") :
          chalk.dim("○");
        console.log(`  ${statusIcon} ${r.user.displayName}`);
      }
    }

    // Show web URL if available
    const selfLink = pr.links?.self?.[0]?.href;
    if (selfLink) {
      console.log();
      console.log(chalk.dim(`View in browser: ${selfLink}`));
    }
  });
