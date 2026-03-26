import { Command } from "commander";
import { resolve } from "path";
import chalk from "chalk";
import { deleteCacheEntry } from "../../lib/repo-cache.js";

export const cacheDeleteCmd = new Command("delete")
  .description("Delete a cached entry (defaults to current directory)")
  .argument("[dir]", "Directory path to remove from cache (defaults to CWD)")
  .action(async (dir: string | undefined) => {
    const target = dir ? resolve(dir) : process.cwd();
    const existed = await deleteCacheEntry(target);

    if (existed) {
      console.log(chalk.green(`✓ Removed cache entry for ${target}`));
    } else {
      console.log(`No cache entry found for ${target}`);
    }
  });
