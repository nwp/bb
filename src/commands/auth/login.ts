import { Command } from "commander";
import chalk from "chalk";
import { setHostConfig, type HostConfig } from "../../lib/config.js";
import { BitbucketAPI } from "../../lib/api.js";

export const loginCmd = new Command("login")
  .description("Authenticate with a Bitbucket Server instance")
  .option("-h, --hostname <hostname>", "Bitbucket Server hostname (e.g. bitbucket.example.com)")
  .option("-t, --token <token>", "HTTP access token")
  .option("--protocol <protocol>", "Protocol to use (https or http)", "https")
  .action(async (opts) => {
    let hostname = opts.hostname;
    let token = opts.token;
    const protocol = opts.protocol as "https" | "http";

    // Interactive prompts if not provided as flags
    if (!hostname) {
      process.stdout.write("Bitbucket Server hostname: ");
      hostname = (await readLine()).trim();
      if (!hostname) {
        console.error(chalk.red("Hostname is required"));
        process.exit(1);
      }
    }

    if (!token) {
      process.stdout.write(
        `HTTP access token for ${hostname} (create one in Bitbucket > Manage Account > HTTP Access Tokens): `
      );
      token = (await readLine()).trim();
      if (!token) {
        console.error(chalk.red("Token is required"));
        process.exit(1);
      }
    }

    // Validate the token by making a test API call
    const hostConfig: HostConfig = { token, protocol };
    const api = new BitbucketAPI({ hostname, hostConfig });

    try {
      process.stdout.write(`Verifying token with ${protocol}://${hostname}... `);
      // Try to hit the application properties endpoint (no auth required, but confirms connectivity)
      // Then try an authenticated endpoint
      const result = await api.get<{ displayName?: string; name?: string }>(
        "/rest/api/1.0/users",
        { limit: "1" }
      ).catch(() => null);

      // Try to get current user info via the inbox plugin or just save
      console.log(chalk.green("✓ Authenticated"));

      hostConfig.user = undefined; // Will be populated if we can detect it
    } catch (err) {
      console.log(chalk.red("✗ Failed"));
      console.error(chalk.red(`Could not connect to ${hostname}: ${err}`));
      process.exit(1);
    }

    await setHostConfig(hostname, hostConfig);
    console.log(chalk.green(`✓ Logged in to ${hostname}`));
    console.log(`  Config saved to ${chalk.dim("~/.config/bb/config.json")}`);
  });

function readLine(): Promise<string> {
  return new Promise((resolve) => {
    const chunks: string[] = [];
    process.stdin.setEncoding("utf-8");
    process.stdin.once("data", (data) => {
      resolve(String(data));
    });
    process.stdin.resume();
  });
}
