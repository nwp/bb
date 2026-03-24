import { Command } from "commander";
import chalk from "chalk";
import { migrateTokensToKeychain, getKeychainName } from "../../lib/config.js";

export const migrateCmd = new Command("migrate")
  .description("Migrate plaintext tokens to the system keychain")
  .action(async () => {
    const keychainName = await getKeychainName();

    if (!keychainName) {
      console.error(chalk.red("No system keychain available."));
      console.log("Install one of the following:");
      if (process.platform === "linux") {
        console.log("  sudo apt install libsecret-tools   # Debian/Ubuntu");
        console.log("  sudo dnf install libsecret          # Fedora");
      } else if (process.platform === "darwin") {
        console.log("  macOS Keychain should be available by default.");
      }
      process.exit(1);
    }

    console.log(`Using keychain: ${chalk.cyan(keychainName)}`);
    const count = await migrateTokensToKeychain();

    if (count === 0) {
      console.log("No tokens to migrate — all tokens are already in the keychain.");
    } else {
      console.log(chalk.green(`✓ Migrated ${count} token${count > 1 ? "s" : ""} to the system keychain.`));
      console.log("  Plaintext tokens have been removed from the config file.");
    }
  });
