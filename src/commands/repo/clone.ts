import { Command } from "commander";
import { $ } from "bun";
import chalk from "chalk";
import { apiForDefaultHost } from "../../lib/context.js";

export const repoCloneCmd = new Command("clone")
  .description("Clone a repository")
  .argument("<repo>", "Repository in PROJECT/repo format")
  .option("--protocol <protocol>", "Clone protocol (ssh or https)", "ssh")
  .action(async (repoArg: string, opts) => {
    const parts = repoArg.split("/");
    if (parts.length !== 2) {
      console.error(chalk.red("Repository must be in PROJECT/repo format"));
      process.exit(1);
    }

    const [project, repoSlug] = parts;
    const { hostname, api } = await apiForDefaultHost();
    const repo = await api.getRepo(project, repoSlug);

    const cloneUrls = repo.links?.clone ?? [];
    const preferred = cloneUrls.find((u) => u.name === opts.protocol) ?? cloneUrls[0];

    if (!preferred) {
      console.error(chalk.red("No clone URL found for this repository"));
      process.exit(1);
    }

    console.log(`Cloning ${chalk.bold(`${project}/${repoSlug}`)} from ${preferred.href}...`);
    const result = await $`git clone ${preferred.href}`.text();
    console.log(result);
  });
