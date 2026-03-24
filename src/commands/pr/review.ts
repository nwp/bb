import { Command } from "commander";
import chalk from "chalk";
import { resolveContext, getCurrentBranch } from "../../lib/context.js";

export const prReviewCmd = new Command("review")
  .description("Review a pull request")
  .argument("[number]", "PR number")
  .option("--approve", "Approve the pull request")
  .option("--request-changes", "Request changes (unapprove)")
  .option("-b, --body <body>", "Review comment")
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

    if (opts.body) {
      await ctx.api.addPRComment(ctx.project, ctx.repo, prId, opts.body);
      console.log(chalk.green(`✓ Added review comment to PR #${prId}`));
    }

    if (opts.approve) {
      await ctx.api.approvePR(ctx.project, ctx.repo, prId);
      console.log(chalk.green(`✓ Approved PR #${prId}`));
    } else if (opts.requestChanges) {
      await ctx.api.unapprovePR(ctx.project, ctx.repo, prId);
      console.log(chalk.yellow(`✓ Requested changes on PR #${prId}`));
    }

    if (!opts.approve && !opts.requestChanges && !opts.body) {
      // Show review status
      const pr = await ctx.api.getPR(ctx.project, ctx.repo, prId);
      console.log(`${chalk.bold(pr.title)} ${chalk.cyan(`#${pr.id}`)}`);
      console.log();
      if (pr.reviewers.length === 0) {
        console.log("No reviewers assigned.");
      } else {
        for (const r of pr.reviewers) {
          const statusIcon =
            r.status === "APPROVED" ? chalk.green("✓ APPROVED") :
            r.status === "NEEDS_WORK" ? chalk.red("✗ CHANGES REQUESTED") :
            chalk.dim("○ PENDING");
          console.log(`  ${statusIcon}  ${r.user.displayName}`);
        }
      }
    }
  });
