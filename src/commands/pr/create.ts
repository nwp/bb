import { Command } from "commander";
import chalk from "chalk";
import { resolveContext, getCurrentBranch } from "../../lib/context.js";
import type { CreatePRBody } from "../../lib/api.js";

export const prCreateCmd = new Command("create")
  .description("Create a pull request")
  .option("-t, --title <title>", "PR title")
  .option("-b, --body <body>", "PR description")
  .option("-B, --base <branch>", "Base branch (target)", "")
  .option("-H, --head <branch>", "Head branch (source)")
  .option("-r, --reviewer <users...>", "Reviewer usernames")
  .option("-R, --repo <repo>", "Repository in PROJECT/repo format")
  .option("--draft", "Create as a draft PR (if supported)")
  .option("--json", "Output as JSON")
  .action(async (opts) => {
    const ctx = await resolveContext({ repo: opts.repo });
    const head = opts.head ?? (await getCurrentBranch());

    if (!head) {
      console.error(chalk.red("Could not determine source branch. Use --head to specify."));
      process.exit(1);
    }

    // Determine base branch - default to repo's default branch
    let base = opts.base;
    if (!base) {
      const repo = await ctx.api.getRepo(ctx.project, ctx.repo);
      // BB Server doesn't expose defaultBranch directly in repo response in all versions
      // Try the branches endpoint
      try {
        const defaultBranch = await ctx.api.get<{ displayId: string }>(
          `/rest/api/1.0/projects/${ctx.project}/repos/${ctx.repo}/default-branch`
        );
        base = defaultBranch.displayId;
      } catch {
        base = "main"; // fallback
      }
    }

    // Title: use first commit message or prompt
    let title = opts.title;
    if (!title) {
      // Try to use head branch name as title
      title = head
        .replace(/^(feature|bugfix|hotfix)\//i, "")
        .replace(/[-_]/g, " ")
        .replace(/^\w/, (c: string) => c.toUpperCase());
    }

    const prBody: CreatePRBody = {
      title,
      description: opts.body,
      fromRef: {
        id: `refs/heads/${head}`,
        repository: { slug: ctx.repo, project: { key: ctx.project } },
      },
      toRef: {
        id: `refs/heads/${base}`,
        repository: { slug: ctx.repo, project: { key: ctx.project } },
      },
    };

    if (opts.reviewer) {
      prBody.reviewers = opts.reviewer.map((u: string) => ({ user: { name: u } }));
    }

    const pr = await ctx.api.createPR(ctx.project, ctx.repo, prBody);

    if (opts.json) {
      console.log(JSON.stringify(pr, null, 2));
      return;
    }

    console.log(chalk.green(`✓ Created pull request #${pr.id}`));
    console.log(`  ${chalk.bold(pr.title)}`);
    console.log(`  ${pr.fromRef.displayId} → ${pr.toRef.displayId}`);

    const selfLink = pr.links?.self?.[0]?.href;
    if (selfLink) {
      console.log(`  ${selfLink}`);
    }
  });
