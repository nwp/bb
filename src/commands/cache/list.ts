import { Command } from "commander";
import chalk from "chalk";
import { listCacheEntries, cacheFilePath } from "../../lib/repo-cache.js";
import { printTable, formatDate, truncate } from "../../lib/format.js";

export const cacheListCmd = new Command("list")
  .description("List all cached project/repo entries")
  .option("--json", "Output as JSON")
  .action(async (opts) => {
    const entries = await listCacheEntries();

    if (opts.json) {
      console.log(JSON.stringify(entries, null, 2));
      return;
    }

    if (entries.length === 0) {
      console.log("No cached entries.");
      console.log(`Cache file: ${chalk.dim(cacheFilePath())}`);
      return;
    }

    const rows = entries.map((e) => [
      chalk.bold(truncate(e.dir, 60)),
      chalk.dim(e.hostname),
      chalk.cyan(`${e.project}/${e.repo}`),
      chalk.dim(formatDate(new Date(e.cachedAt).getTime())),
    ]);
    printTable(rows);
  });
