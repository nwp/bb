import { Command } from "commander";
import chalk from "chalk";
import { loadConfig, getKeychainName } from "../../lib/config.js";
import { BitbucketAPI } from "../../lib/api.js";
import { getToken } from "../../lib/keychain.js";

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

    const keychainName = await getKeychainName();
    if (keychainName) {
      console.log(`Keychain: ${chalk.green(keychainName)}\n`);
    } else {
      console.log(`Keychain: ${chalk.yellow("none (tokens stored in plaintext)")}\n`);
    }

    const defaultHost = config.defaults?.hostname;
    if (defaultHost) {
      console.log(`Default host: ${chalk.cyan(defaultHost)}\n`);
    }

    for (const [hostname, entry] of hosts) {
      const proto = entry.protocol ?? "https";
      const isDefault = defaultHost === hostname;
      const header = isDefault ? `${hostname} ${chalk.dim("(default)")}` : hostname;
      console.log(chalk.bold(header));
      console.log(`  Protocol: ${proto}`);

      let token: string | null = null;
      if (entry.token_store === "keychain") {
        token = await getToken(hostname);
        console.log(`  Token:    ${chalk.green("stored in keychain")}`);
      } else if (entry.token) {
        token = entry.token;
        console.log(`  Token:    ${maskToken(token)} ${chalk.yellow("(plaintext in config file)")}`);
      } else {
        console.log(`  Token:    ${chalk.red("missing")}`);
      }

      if (token) {
        const api = new BitbucketAPI({
          hostname,
          hostConfig: { token, protocol: entry.protocol },
        });
        try {
          await api.get("/rest/api/1.0/application-properties");
          console.log(`  Status:   ${chalk.green("✓ Connected")}`);
        } catch {
          console.log(`  Status:   ${chalk.red("✗ Connection failed")}`);
        }
      }

      console.log();
    }
  });

function maskToken(token: string): string {
  if (token.length <= 8) return "****";
  return token.slice(0, 4) + "****" + token.slice(-4);
}
