import { Command } from "commander";
import { loginCmd } from "./login.js";
import { logoutCmd } from "./logout.js";
import { statusCmd } from "./status.js";
import { migrateCmd } from "./migrate.js";

export const authCmd = new Command("auth")
  .description("Authenticate with Bitbucket Server")
  .addCommand(loginCmd)
  .addCommand(logoutCmd)
  .addCommand(statusCmd)
  .addCommand(migrateCmd);
