import { Command } from "commander";
import { existsSync } from "fs";
import { mkdir, writeFile, readFile } from "fs/promises";
import { dirname, join, resolve } from "path";
import { $ } from "bun";
import chalk from "chalk";
import { AGENTS, type AgentDef } from "./agents.js";
import { generateSkillContent } from "./content.js";

export const skillInstallCmd = new Command("install")
  .description("Install bb skill/instruction file for coding agents in this repo")
  .option(
    "-a, --agent <agent>",
    `Target agent: ${AGENTS.map((a) => a.id).join(", ")}, or "all" for all detected`
  )
  .option("--list", "List supported agents and detection status")
  .option("--force", "Overwrite existing skill files")
  .option("--dry-run", "Show what would be installed without writing files")
  .action(async (opts) => {
    const repoRoot = await getRepoRoot();
    if (!repoRoot) {
      console.error(chalk.red("Not inside a git repository."));
      process.exit(1);
    }

    // --list: show all agents and detection status
    if (opts.list) {
      console.log(chalk.bold("Supported coding agents:\n"));
      for (const agent of AGENTS) {
        const detected = detectAgent(repoRoot, agent);
        const status = detected
          ? chalk.green("✓ detected")
          : chalk.dim("not detected");
        console.log(`  ${agent.id.padEnd(12)} ${agent.name.padEnd(22)} ${status}`);
        console.log(`  ${"".padEnd(12)} ${chalk.dim(agent.skillPath)}`);
        if (detected) {
          console.log(`  ${"".padEnd(12)} ${chalk.dim(`matched: ${detected}`)}`);
        }
        console.log();
      }
      return;
    }

    // Determine which agents to install for
    let targets: AgentDef[];

    if (opts.agent === "all") {
      targets = AGENTS.filter((a) => detectAgent(repoRoot, a));
      if (targets.length === 0) {
        console.log("No coding agent configurations detected in this repo.");
        console.log("Use --agent <name> to install for a specific agent, or run --list to see options.");
        return;
      }
    } else if (opts.agent) {
      const agent = AGENTS.find((a) => a.id === opts.agent);
      if (!agent) {
        console.error(chalk.red(`Unknown agent: ${opts.agent}`));
        console.log(`Supported agents: ${AGENTS.map((a) => a.id).join(", ")}`);
        process.exit(1);
      }
      targets = [agent];
    } else {
      // Auto-detect
      targets = AGENTS.filter((a) => detectAgent(repoRoot, a));
      if (targets.length === 0) {
        console.log("No coding agent configurations detected in this repo.\n");
        console.log("To install for a specific agent, use:");
        console.log(`  ${chalk.cyan("bb skill install --agent <name>")}\n`);
        console.log("Supported agents:");
        for (const a of AGENTS) {
          console.log(`  ${chalk.cyan(a.id.padEnd(12))} ${a.name}`);
        }
        return;
      }

      if (targets.length > 1) {
        console.log(`Detected ${targets.length} coding agents:\n`);
        for (const t of targets) {
          console.log(`  ${chalk.cyan(t.id.padEnd(12))} → ${t.skillPath}`);
        }
        console.log();
      }
    }

    // Install skill files
    for (const agent of targets) {
      const fullPath = join(repoRoot, agent.skillPath);
      const exists = existsSync(fullPath);

      if (exists && !opts.force) {
        console.log(
          chalk.yellow(`⚠ Skipped ${agent.name}: ${agent.skillPath} already exists (use --force to overwrite)`)
        );
        continue;
      }

      const content = generateSkillContent(agent);

      if (opts.dryRun) {
        console.log(chalk.dim(`[dry-run] Would write: ${agent.skillPath} (${content.length} bytes)`));
        continue;
      }

      // Create parent directories
      await mkdir(dirname(fullPath), { recursive: true });
      await writeFile(fullPath, content, "utf-8");

      const verb = exists ? "Updated" : "Installed";
      console.log(chalk.green(`✓ ${verb} ${agent.name} skill → ${agent.skillPath}`));
    }
  });

/** Find the git repo root */
async function getRepoRoot(): Promise<string | null> {
  try {
    const result = await $`git rev-parse --show-toplevel`.text();
    return result.trim() || null;
  } catch {
    return null;
  }
}

/** Check if an agent's marker files/dirs exist, return the first match */
function detectAgent(repoRoot: string, agent: AgentDef): string | null {
  for (const marker of agent.detect) {
    if (existsSync(join(repoRoot, marker))) {
      return marker;
    }
  }
  return null;
}
