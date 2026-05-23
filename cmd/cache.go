package cmd

import "github.com/spf13/cobra"

var cacheCmd = &cobra.Command{
	Use:   "cache <command>",
	Short: "Manage the repository context cache",
}

func init() {
	cacheCmd.AddCommand(cacheListCmd)
	cacheCmd.AddCommand(cacheDeleteCmd)
}
