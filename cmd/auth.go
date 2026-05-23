package cmd

import "github.com/spf13/cobra"

var authCmd = &cobra.Command{
	Use:   "auth <command>",
	Short: "Authenticate with Bitbucket Server",
}

func init() {
	authCmd.AddCommand(authLoginCmd)
	authCmd.AddCommand(authLogoutCmd)
	authCmd.AddCommand(authStatusCmd)
	authCmd.AddCommand(authMigrateCmd)
}
