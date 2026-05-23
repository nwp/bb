import { Command } from "commander";
import chalk from "chalk";
import { normalizeHostname, setHostConfig, type HostConfig } from "../../lib/config.js";
import { BitbucketAPI } from "../../lib/api.js";

export const loginCmd = new Command("login")
  .description("Authenticate with a Bitbucket Server instance")
  .option("-h, --hostname <hostname>", "Bitbucket Server hostname (e.g. bitbucket.example.com)")
  .option("-t, --token <token>", "HTTP access token")
  .option("--with-token", "Read HTTP access token from stdin (like gh auth login --with-token)")
  .option("--skip-verify", "Save token without making a verification API call")
  .option("--protocol <protocol>", "Protocol to use (https or http)", "https")
  .action(async (opts) => {
    let hostname = opts.hostname;
    let token = opts.token;
    const protocol = opts.protocol as "https" | "http";

    if (!hostname) {
      process.stdout.write("Bitbucket Server hostname: ");
      hostname = (await readLine()).trim();
      if (!hostname) {
        console.error(chalk.red("Hostname is required"));
        process.exit(1);
      }
    }

    hostname = normalizeHostname(hostname);

    if (!token && opts.withToken) {
      token = (await readLine()).trim();
      if (!token) {
        console.error(chalk.red("Token is required on stdin when using --with-token"));
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

    const hostConfig: HostConfig = { token, protocol };
    const api = new BitbucketAPI({ hostname, hostConfig });

    if (!opts.skipVerify) {
      try {
        process.stdout.write(`Verifying token with ${protocol}://${hostname}... `);
        await api.get("/rest/api/1.0/users", { limit: "1" });
        console.log(chalk.green("✓ Authenticated"));
      } catch (err: any) {
        console.log(chalk.red("✗ Failed"));
        console.error(chalk.red(`Could not connect to ${hostname}: ${err.message ?? err}`));
        process.exit(1);
      }
    } else {
      console.log(chalk.yellow("⚠ Skipping token verification (--skip-verify)"));
    }

    const store = await setHostConfig(hostname, hostConfig);
    console.log(chalk.green(`✓ Logged in to ${hostname}`));

    if (store === "keychain") {
      console.log(`  Token stored in ${chalk.cyan("system keychain")}`);
    } else {
      console.log(`  Token stored in ${chalk.dim("~/.config/bb/config.json")} ${chalk.yellow("(plaintext fallback)")}`);
      console.log(chalk.yellow("  ⚠ Install a keychain for secure storage:"));
      if (process.platform === "linux") {
        console.log(chalk.yellow("    sudo apt install libsecret-tools  # or equivalent"));
      }
    }
  });

function readLine(): Promise<string> {
  return new Promise((resolve) => {
    process.stdin.setEncoding("utf-8");
    process.stdin.once("data", (data) => {
      process.stdin.pause();
      resolve(String(data));
    });
    process.stdin.resume();
  });
}
