package cmd

import _ "embed"

//go:embed skill_content.md
var skillMDContent string

// generateSkillContent returns the SKILL.md content for the bb CLI.
func generateSkillContent() string {
	return skillMDContent
}
