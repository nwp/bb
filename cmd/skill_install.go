package cmd

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/spf13/cobra"
)

// agentDef describes a coding agent and how to detect and install skill files.
type agentDef struct {
	Name        string
	ID          string
	Detect      []string // marker files/dirs (relative to git root)
	SkillPath   string   // relative path under git root to write SKILL.md
	Description string
}

var agents = []agentDef{
	{
		Name:      "Claude Code",
		ID:        "claude",
		Detect:    []string{".claude"},
		SkillPath: ".claude/skills/bb/SKILL.md",
	},
	{
		Name:      "GitHub Copilot",
		ID:        "copilot",
		Detect:    []string{".github/copilot-instructions.md", ".github"},
		SkillPath: ".github/skills/bb/SKILL.md",
	},
	{
		Name:      "Cursor",
		ID:        "cursor",
		Detect:    []string{".cursor"},
		SkillPath: ".cursor/skills/bb/SKILL.md",
	},
	{
		Name:      "Windsurf",
		ID:        "windsurf",
		Detect:    []string{".windsurfrules"},
		SkillPath: ".windsurf/skills/bb/SKILL.md",
	},
	{
		Name:      "OpenAI Codex",
		ID:        "codex",
		Detect:    []string{"AGENTS.md"},
		SkillPath: "skills/bb/SKILL.md",
	},
	{
		Name:      "Amazon Q",
		ID:        "amazonq",
		Detect:    []string{".amazonq"},
		SkillPath: ".amazonq/skills/bb/SKILL.md",
	},
	{
		Name:      "Augment",
		ID:        "augment",
		Detect:    []string{".augment"},
		SkillPath: ".augment/skills/bb/SKILL.md",
	},
	{
		Name:      "Roo Code / Cline",
		ID:        "roo",
		Detect:    []string{".roo", ".cline"},
		SkillPath: ".roo/skills/bb/SKILL.md",
	},
}

var skillInstallCmd = &cobra.Command{
	Use:   "install",
	Short: "Install the bb skill file for coding agents",
	RunE:  runSkillInstall,
}

var skillInstallFlags struct {
	agent  string
	path   string
	list   bool
	force  bool
	dryRun bool
}

func init() {
	skillInstallCmd.Flags().StringVarP(&skillInstallFlags.agent, "agent", "a", "", "Target agent ID (or 'all')")
	skillInstallCmd.Flags().StringVarP(&skillInstallFlags.path, "path", "p", "", "Install to a specific directory")
	skillInstallCmd.Flags().BoolVar(&skillInstallFlags.list, "list", false, "List supported agents and detection status")
	skillInstallCmd.Flags().BoolVar(&skillInstallFlags.force, "force", false, "Overwrite existing SKILL.md")
	skillInstallCmd.Flags().BoolVar(&skillInstallFlags.dryRun, "dry-run", false, "Show what would be installed without writing")
}

func runSkillInstall(cmd *cobra.Command, _ []string) error {
	if skillInstallFlags.list {
		root, _ := gitRoot()
		for _, a := range agents {
			detected := "not detected"
			if root != "" && detectAgent(root, a) {
				detected = "detected"
			}
			fmt.Fprintf(cmd.OutOrStdout(), "%-22s %-12s %s\n", a.Name, "("+a.ID+")", detected)
		}
		return nil
	}

	if skillInstallFlags.path != "" {
		dest := filepath.Join(skillInstallFlags.path, "skills", "bb", "SKILL.md")
		return writeSkill(cmd, dest)
	}

	root, err := gitRoot()
	if err != nil {
		return fmt.Errorf("not inside a git repository")
	}

	var targets []agentDef
	switch skillInstallFlags.agent {
	case "all":
		targets = agents
	case "":
		for _, a := range agents {
			if detectAgent(root, a) {
				targets = append(targets, a)
			}
		}
		if len(targets) == 0 {
			fmt.Fprintln(cmd.OutOrStdout(), "No coding agents detected. Use --agent to specify one, or --list to see options.")
			return nil
		}
	default:
		for _, a := range agents {
			if strings.EqualFold(a.ID, skillInstallFlags.agent) {
				targets = append(targets, a)
				break
			}
		}
		if len(targets) == 0 {
			return fmt.Errorf("unknown agent %q; use --list to see supported agents", skillInstallFlags.agent)
		}
	}

	for _, a := range targets {
		dest := filepath.Join(root, a.SkillPath)
		if err := writeSkill(cmd, dest); err != nil {
			return err
		}
	}
	return nil
}

func writeSkill(cmd *cobra.Command, dest string) error {
	content := generateSkillContent()
	if skillInstallFlags.dryRun {
		fmt.Fprintf(cmd.OutOrStdout(), "Would write: %s\n", dest)
		return nil
	}
	if !skillInstallFlags.force {
		if _, err := os.Stat(dest); err == nil {
			fmt.Fprintf(cmd.OutOrStdout(), "Skipping %s (already exists; use --force to overwrite)\n", dest)
			return nil
		}
	}
	if err := os.MkdirAll(filepath.Dir(dest), 0755); err != nil {
		return fmt.Errorf("creating directory: %w", err)
	}
	if err := os.WriteFile(dest, []byte(content), 0644); err != nil {
		return fmt.Errorf("writing %s: %w", dest, err)
	}
	fmt.Fprintf(cmd.OutOrStdout(), "Installed: %s\n", dest)
	return nil
}

func detectAgent(root string, a agentDef) bool {
	for _, marker := range a.Detect {
		if _, err := os.Stat(filepath.Join(root, marker)); err == nil {
			return true
		}
	}
	return false
}

func gitRoot() (string, error) {
	out, err := exec.Command("git", "rev-parse", "--show-toplevel").Output()
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(out)), nil
}
