import { Command } from "commander";
import chalk from "chalk";
import { resolveContext, resolvePRId } from "../../lib/context.js";
import { stateColor } from "../../lib/format.js";
import type { BBPullRequest } from "../../lib/api.js";

export const prWatchCmd = new Command("watch")
  .description("Watch a pull request for activity and status changes")
  .argument("[number]", "PR number")
  .option("-R, --repo <repo>", "Repository in PROJECT/repo format")
  .option("-i, --interval <seconds>", "Poll interval in seconds", "10")
  .action(async (number, opts) => {
    const ctx = await resolveContext({ repo: opts.repo });
    const prId = await resolvePRId(ctx.api, ctx.project, ctx.repo, number);
    const interval = parseInt(opts.interval, 10) * 1000;
    let lastState: string | null = null;
    let lastActivityCount = 0;
    let lastReviewerStatus: Record<string, string> = {};

    console.log(`Watching PR #${prId} (polling every ${opts.interval}s, Ctrl+C to stop)...`);
    console.log();

    const poll = async () => {
      try {
        const pr = await ctx.api.getPR(ctx.project, ctx.repo, prId!);
        const activities = await ctx.api.listPRActivities(ctx.project, ctx.repo, prId!);

        // Check state changes
        if (lastState !== null && pr.state !== lastState) {
          const ts = chalk.dim(new Date().toLocaleTimeString());
          console.log(`${ts}  State changed: ${stateColor(lastState)} → ${stateColor(pr.state)}`);

          if (pr.state === "MERGED") {
            console.log(chalk.green("\n✓ Pull request was merged!"));
            process.exit(0);
          }
          if (pr.state === "DECLINED") {
            console.log(chalk.red("\n✗ Pull request was declined."));
            process.exit(0);
          }
        }
        lastState = pr.state;

        // Check reviewer status changes
        const currentReviewerStatus: Record<string, string> = {};
        for (const r of pr.reviewers) {
          currentReviewerStatus[r.user.name] = r.status;
          const prev = lastReviewerStatus[r.user.name];
          if (prev && prev !== r.status) {
            const ts = chalk.dim(new Date().toLocaleTimeString());
            const statusStr =
              r.status === "APPROVED" ? chalk.green("approved") :
              r.status === "NEEDS_WORK" ? chalk.red("requested changes") :
              "updated review";
            console.log(`${ts}  ${r.user.displayName} ${statusStr}`);
          }
        }
        lastReviewerStatus = currentReviewerStatus;

        // Check new activities (comments, etc.)
        if (lastActivityCount > 0 && activities.length > lastActivityCount) {
          const newActivities = activities.slice(0, activities.length - lastActivityCount);
          for (const a of newActivities.reverse()) {
            const ts = chalk.dim(new Date().toLocaleTimeString());
            if (a.action === "COMMENTED" && a.comment) {
              const preview = a.comment.text.length > 80
                ? a.comment.text.slice(0, 77) + "..."
                : a.comment.text;
              console.log(`${ts}  ${a.user.displayName} commented: ${chalk.dim(preview)}`);
            } else if (a.action === "RESCOPED") {
              console.log(`${ts}  ${a.user.displayName} pushed new commits`);
            } else {
              console.log(`${ts}  ${a.user.displayName} ${a.action.toLowerCase()}`);
            }
          }
        }
        lastActivityCount = activities.length;

        // Print status line
        printStatus(pr);
      } catch (err: any) {
        console.error(chalk.yellow(`Poll error: ${err.message}`));
      }
    };

    // Initial fetch
    await poll();

    // Poll loop
    setInterval(poll, interval);
  });

function printStatus(pr: BBPullRequest) {
  const approvals = pr.reviewers.filter((r) => r.status === "APPROVED").length;
  const total = pr.reviewers.length;
  const needsWork = pr.reviewers.filter((r) => r.status === "NEEDS_WORK").length;

  const parts = [
    stateColor(pr.state),
    `${approvals}/${total} approved`,
  ];
  if (needsWork > 0) parts.push(chalk.red(`${needsWork} changes requested`));

  // Overwrite current line
  process.stdout.write(`\r${chalk.dim("Status:")} ${parts.join(" • ")}  `);
}
