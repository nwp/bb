package cmd

import (
	"fmt"

	"github.com/nwp/bb/internal/config"
	"github.com/spf13/cobra"
)

var authMigrateCmd = &cobra.Command{
	Use:   "migrate",
	Short: "Migrate plaintext tokens from config file to the system keychain",
	RunE:  runAuthMigrate,
}

func runAuthMigrate(cmd *cobra.Command, _ []string) error {
	mgr := config.Default()
	n, err := mgr.MigrateToKeychain()
	if err != nil {
		return fmt.Errorf("migration failed: %w", err)
	}
	if n == 0 {
		fmt.Fprintln(cmd.OutOrStdout(), "No tokens to migrate (all already in keychain or no hosts configured)")
		return nil
	}
	fmt.Fprintf(cmd.OutOrStdout(), "Migrated %d token(s) to the system keychain\n", n)
	return nil
}
