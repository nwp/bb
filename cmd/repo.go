package cmd

import "github.com/spf13/cobra"

var repoCmd = &cobra.Command{
	Use:   "repo <command>",
	Short: "Manage repositories",
}

func init() {
	repoCmd.AddCommand(repoListCmd)
	repoCmd.AddCommand(repoViewCmd)
	repoCmd.AddCommand(repoCloneCmd)
}
