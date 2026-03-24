import { Command } from "commander";
import { repoListCmd } from "./list.js";
import { repoViewCmd } from "./view.js";
import { repoCloneCmd } from "./clone.js";

export const repoCmd = new Command("repo")
  .description("Manage repositories")
  .addCommand(repoListCmd)
  .addCommand(repoViewCmd)
  .addCommand(repoCloneCmd);
