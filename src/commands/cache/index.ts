import { Command } from "commander";
import { cacheListCmd } from "./list.js";
import { cacheDeleteCmd } from "./delete.js";

export const cacheCmd = new Command("cache")
  .description("Manage the repository context cache (~/.bb-cli.json)")
  .addCommand(cacheListCmd)
  .addCommand(cacheDeleteCmd);
