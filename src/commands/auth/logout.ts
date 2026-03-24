import { Command } from "commander";
import chalk from "chalk";
import { removeHostConfig, loadConfig } from "../../lib/config.js";

export const logoutCmd = new Command("logout")
  .description("Remove authentication for a Bitbucket Server instance")
  .option("-h, --hostname <hostname>", "Hostname to remove")
  .action(async (opts) => {
    let hostname = opts.hostname;

    if (!hostname) {
      const config = await loadConfig();
      const hosts = Object.keys(config.hosts);
      if (hosts.length === 0) {
        console.log("Not logged in to any Bitbucket Server instances.");
        return;
      }
      if (hosts.length === 1) {
        hostname = hosts[0];
      } else {
        console.log("Multiple hosts configured. Specify one with --hostname:");
        for (const h of hosts) {
          console.log(`  ${h}`);
        }
        process.exit(1);
      }
    }

    await removeHostConfig(hostname);
    console.log(chalk.green(`✓ Logged out of ${hostname}`));
  });
