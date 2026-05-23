// Package cmd implements the bb CLI command tree using cobra.
package cmd

import (
	"os"

	"github.com/spf13/cobra"
)

// version is set at build time via -ldflags "-X github.com/nwp/bb/cmd.version=x.y.z"
var version = "dev"

// rootCmd is the base command for the bb CLI.
var rootCmd = &cobra.Command{
	Use:           "bb",
	Short:         "Bitbucket Server CLI",
	Long:          "Work with Bitbucket Server from the command line.",
	Version:       version,
	SilenceUsage:  true,
	SilenceErrors: true,
}

// Execute runs the root command and exits on error.
func Execute() {
	if err := rootCmd.Execute(); err != nil {
		os.Stderr.WriteString("bb: " + err.Error() + "\n")
		os.Exit(1)
	}
}

func init() {
	rootCmd.AddCommand(authCmd)
	rootCmd.AddCommand(repoCmd)
	rootCmd.AddCommand(prCmd)
	rootCmd.AddCommand(apiCmd)
	rootCmd.AddCommand(cacheCmd)
	rootCmd.AddCommand(skillCmd)
}
