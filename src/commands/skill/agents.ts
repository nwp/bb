export interface AgentDef {
  name: string;
  id: string;
  detect: string[];
  skillPath: string;
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
    skillPath: ".github/skills/bb/SKILL.md",
    description: "GitHub Copilot skill in .github/skills/bb/",
  },
  {
    name: "Cursor",
    id: "cursor",
    detect: [".cursor", ".cursorrules"],
    skillPath: ".cursor/skills/bb/SKILL.md",
    description: "Cursor skill in .cursor/skills/bb/",
  },
  {
    name: "Windsurf",
    id: "windsurf",
    detect: [".windsurfrules", ".codeium"],
    skillPath: ".windsurf/skills/bb/SKILL.md",
    description: "Windsurf skill in .windsurf/skills/bb/",
  },
  {
    name: "OpenAI Codex",
    id: "codex",
    detect: [".codex", "AGENTS.md"],
    skillPath: ".codex/skills/bb/SKILL.md",
    description: "Codex skill in .codex/skills/bb/",
  },
  {
    name: "Amazon Q Developer",
    id: "amazonq",
    detect: [".amazonq"],
    skillPath: ".amazonq/skills/bb/SKILL.md",
    description: "Amazon Q skill in .amazonq/skills/bb/",
  },
  {
    name: "Augment Code",
    id: "augment",
    detect: [".augment", ".augment-guidelines"],
    skillPath: ".augment/skills/bb/SKILL.md",
    description: "Augment skill in .augment/skills/bb/",
  },
  {
    name: "Roo Code / Cline",
    id: "roo",
    detect: [".roo", ".clinerules"],
    skillPath: ".roo/skills/bb/SKILL.md",
    description: "Roo Code skill in .roo/skills/bb/",
  },
];
