import { Command } from "commander";
import chalk from "chalk";
import { resolveContext, getCurrentBranch } from "../../lib/context.js";
import type { UpdatePRBody } from "../../lib/api.js";

export const prEditCmd = new Command("edit")
  .description("Edit a pull request's title, description, base branch, or reviewers")
  .argument("[number]", "PR number (defaults to PR for current branch)")
  .option("-t, --title <title>", "New title")
  .option("-b, --body <body>", "New description")
  .option("-B, --base <branch>", "New base branch (target)")
  .option("--add-reviewer <users...>", "Add reviewers")
  .option("--remove-reviewer <users...>", "Remove reviewers")
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

    if (!opts.title && !opts.body && !opts.base && !opts.addReviewer && !opts.removeReviewer) {
      console.error(chalk.red("Nothing to edit. Use --title, --body, --base, --add-reviewer, or --remove-reviewer"));
      process.exit(1);
    }

    const pr = await ctx.api.getPR(ctx.project, ctx.repo, prId);

    const update: UpdatePRBody = { version: pr.version };

    if (opts.title) update.title = opts.title;
    if (opts.body) update.description = opts.body;

    if (opts.base) {
      update.toRef = {
        id: `refs/heads/${opts.base}`,
        repository: { slug: ctx.repo, project: { key: ctx.project } },
      };
    }

    if (opts.addReviewer || opts.removeReviewer) {
      const existing = pr.reviewers.map((r) => r.user.name);
      const toRemove = new Set(opts.removeReviewer ?? []);
      const kept = existing.filter((name) => !toRemove.has(name));
      const added = (opts.addReviewer ?? []) as string[];
      const all = [...new Set([...kept, ...added])];
      update.reviewers = all.map((name) => ({ user: { name } }));
    }

    const updated = await ctx.api.updatePR(ctx.project, ctx.repo, prId, update);

    if (opts.json) {
      console.log(JSON.stringify(updated, null, 2));
      return;
    }

    console.log(chalk.green(`✓ Updated pull request #${prId}`));
    if (opts.title) console.log(`  Title: ${updated.title}`);
    if (opts.base) console.log(`  Base: ${updated.toRef.displayId}`);
    if (opts.addReviewer || opts.removeReviewer) {
      const names = updated.reviewers.map((r) => r.user.displayName).join(", ");
      console.log(`  Reviewers: ${names || chalk.dim("none")}`);
    }
  });
