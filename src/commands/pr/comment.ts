import { Command } from "commander";
import chalk from "chalk";
import { resolveContext } from "../../lib/context.js";

export const prCommentCmd = new Command("comment")
  .description("Add a comment to a pull request")
  .argument("<number>", "PR number")
  .option("-b, --body <body>", "Comment text")
  .option("-R, --repo <repo>", "Repository in PROJECT/repo format")
  .option("--json", "Output as JSON")
  .action(async (number, opts) => {
    const ctx = await resolveContext({ repo: opts.repo });
    const prId = parseInt(number, 10);

    if (!opts.body) {
      console.error(chalk.red("Comment body is required. Use --body or -b."));
      process.exit(1);
    }

    const comment = await ctx.api.addPRComment(ctx.project, ctx.repo, prId, opts.body);

    if (opts.json) {
      console.log(JSON.stringify(comment, null, 2));
      return;
    }

    console.log(chalk.green(`✓ Added comment to PR #${prId}`));
  });
