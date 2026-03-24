import { Command } from "commander";
import { skillInstallCmd } from "./install.js";

export const skillCmd = new Command("skill")
  .description("Manage bb skill files for coding agents")
  .addCommand(skillInstallCmd);
