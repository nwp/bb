package cmd

import "github.com/spf13/cobra"

var skillCmd = &cobra.Command{
	Use:   "skill <command>",
	Short: "Manage agent skill files",
}

func init() {
	skillCmd.AddCommand(skillInstallCmd)
}
