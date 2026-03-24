/**
 * Registry of supported coding agents and how they consume skill files.
 *
 * Each entry describes:
 *   - detect: glob patterns or files whose presence means this agent is in use
 *   - skillPath: where to write the skill file (relative to repo root)
 *   - mkdir: whether we need to create parent directories
 */

export interface AgentDef {
  /** Display name */
  name: string;
  /** Short id used with --agent flag */
  id: string;
  /** Files/dirs to look for to detect this agent (relative to repo root) */
  detect: string[];
  /** Path to write the skill file (relative to repo root) */
  skillPath: string;
  /** Description shown to user */
  description: string;
}

export const AGENTS: AgentDef[] = [
  {
    name: "Claude Code",
    id: "claude",
    detect: [".claude"],
    skillPath: ".claude/skills/bb/SKILL.md",
    description: "Claude Code skill in .claude/skills/bb/",
  },
  {
    name: "GitHub Copilot",
    id: "copilot",
    detect: [".github"],
    skillPath: ".github/instructions/bb.instructions.md",
    description: "Copilot instruction in .github/instructions/",
  },
  {
    name: "Cursor",
    id: "cursor",
    detect: [".cursor", ".cursorrules"],
    skillPath: ".cursor/rules/bb.md",
    description: "Cursor rule in .cursor/rules/",
  },
  {
    name: "Windsurf",
    id: "windsurf",
    detect: [".windsurfrules", ".codeium"],
    skillPath: ".windsurf/rules/bb.md",
    description: "Windsurf rule in .windsurf/rules/",
  },
  {
    name: "OpenAI Codex",
    id: "codex",
    detect: [".codex", "AGENTS.md"],
    skillPath: ".codex/skills/bb.md",
    description: "Codex skill in .codex/skills/",
  },
  {
    name: "Amazon Q Developer",
    id: "amazonq",
    detect: [".amazonq"],
    skillPath: ".amazonq/rules/bb.md",
    description: "Amazon Q rule in .amazonq/rules/",
  },
  {
    name: "Augment Code",
    id: "augment",
    detect: [".augment", ".augment-guidelines"],
    skillPath: ".augment/rules/bb.md",
    description: "Augment rule in .augment/rules/",
  },
  {
    name: "Roo Code / Cline",
    id: "roo",
    detect: [".roo", ".clinerules"],
    skillPath: ".roo/rules/bb.md",
    description: "Roo Code rule in .roo/rules/",
  },
];
