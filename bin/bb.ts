#!/usr/bin/env bun

import { Command } from "commander";
import { authCmd } from "../src/commands/auth/index.js";
import { repoCmd } from "../src/commands/repo/index.js";
import { prCmd } from "../src/commands/pr/index.js";
import { apiCmd } from "../src/commands/api/index.js";

const program = new Command()
  .name("bb")
  .description("A CLI for Bitbucket Server — like gh, but for Bitbucket")
  .version("0.1.0")
  .addCommand(authCmd)
  .addCommand(repoCmd)
  .addCommand(prCmd)
  .addCommand(apiCmd);

program.parseAsync(process.argv).catch((err) => {
  console.error(err.message);
  process.exit(1);
});
