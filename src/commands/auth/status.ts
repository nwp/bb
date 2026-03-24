import { Command } from "commander";
import chalk from "chalk";
import { loadConfig } from "../../lib/config.js";
import { BitbucketAPI } from "../../lib/api.js";

export const statusCmd = new Command("status")
  .description("Show authentication status")
  .action(async () => {
    const config = await loadConfig();
    const hosts = Object.entries(config.hosts);

    if (hosts.length === 0) {
      console.log("Not logged in to any Bitbucket Server instances.");
      console.log(`Run ${chalk.cyan("bb auth login")} to authenticate.`);
      return;
    }

    for (const [hostname, hostConfig] of hosts) {
      const proto = hostConfig.protocol ?? "https";
      process.stdout.write(`${chalk.bold(hostname)}\n`);
      process.stdout.write(`  Protocol: ${proto}\n`);
      process.stdout.write(`  Token: ${maskToken(hostConfig.token)}\n`);

      // Test connectivity
      const api = new BitbucketAPI({ hostname, hostConfig });
      try {
        await api.get("/rest/api/1.0/application-properties");
        process.stdout.write(`  Status: ${chalk.green("✓ Connected")}\n`);
      } catch {
        process.stdout.write(`  Status: ${chalk.red("✗ Connection failed")}\n`);
      }
    }
  });

function maskToken(token: string): string {
  if (token.length <= 8) return "****";
  return token.slice(0, 4) + "****" + token.slice(-4);
}
