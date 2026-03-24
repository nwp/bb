import { Command } from "commander";
import chalk from "chalk";
import { resolveContext } from "../../lib/context.js";
import { formatDate, stateColor } from "../../lib/format.js";

export const prViewCmd = new Command("view")
  .description("View a pull request")
  .argument("[number]", "PR number (defaults to PR for current branch)")
  .option("-R, --repo <repo>", "Repository in PROJECT/repo format")
  .option("--json", "Output as JSON")
  .action(async (number, opts) => {
    const ctx = await resolveContext({ repo: opts.repo });
    let prId = number ? parseInt(number, 10) : null;

    // If no PR number given, try to find PR for current branch
    if (!prId) {
      const { getCurrentBranch } = await import("../../lib/context.js");
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
