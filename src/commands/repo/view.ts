import { Command } from "commander";
import chalk from "chalk";
import { resolveContext } from "../../lib/context.js";

export const repoViewCmd = new Command("view")
  .description("View a repository")
  .argument("[repo]", "Repository in PROJECT/repo format")
  .option("--json", "Output as JSON")
  .action(async (repoArg, opts) => {
    const ctx = await resolveContext({ repo: repoArg });
    const repo = await ctx.api.getRepo(ctx.project, ctx.repo);

    if (opts.json) {
      console.log(JSON.stringify(repo, null, 2));
      return;
    }

    console.log(chalk.bold(`${repo.project.key}/${repo.slug}`));
    if (repo.description) console.log(repo.description);
    console.log();

    const cloneUrls = repo.links?.clone ?? [];
    if (cloneUrls.length > 0) {
      console.log(chalk.dim("Clone URLs:"));
      for (const u of cloneUrls) {
        console.log(`  ${u.name}: ${u.href}`);
      }
    }

    console.log();
    console.log(`State:    ${repo.state}`);
    console.log(`Forkable: ${repo.forkable ? "yes" : "no"}`);
    console.log(`Public:   ${repo.public ? "yes" : "no"}`);
  });
