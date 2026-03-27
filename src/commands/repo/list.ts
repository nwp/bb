import { Command } from "commander";
import chalk from "chalk";
import { printTable, truncate } from "../../lib/format.js";
import { apiForDefaultHost } from "../../lib/context.js";

export const repoListCmd = new Command("list")
  .description("List repositories")
  .option("-p, --project <project>", "Filter by project key")
  .option("-L, --limit <limit>", "Maximum number of repos to list", "30")
  .option("--json", "Output as JSON")
  .action(async (opts) => {
    const { hostname, api } = await apiForDefaultHost();
    const limit = parseInt(opts.limit, 10);

    let repos;
    if (opts.project) {
      repos = await api.listRepos(opts.project);
    } else {
      repos = await api.paginate<any>("/rest/api/1.0/repos");
    }

    repos = repos.slice(0, limit);

    if (opts.json) {
      console.log(JSON.stringify(repos, null, 2));
      return;
    }

    if (repos.length === 0) {
      console.log("No repositories found.");
      return;
    }

    const rows = repos.map((r: any) => [
      chalk.bold(`${r.project?.key ?? "?"}/${r.slug}`),
      truncate(r.description ?? "", 50),
      r.public ? "public" : chalk.dim("private"),
    ]);
    printTable(rows);
  });
