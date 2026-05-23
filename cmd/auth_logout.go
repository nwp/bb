package cmd

import (
	"fmt"

	"github.com/nwp/bb/internal/config"
	"github.com/spf13/cobra"
)

var authLogoutCmd = &cobra.Command{
	Use:   "logout",
	Short: "Log out of a Bitbucket Server instance",
	RunE:  runAuthLogout,
}

var logoutHostname string

func init() {
	authLogoutCmd.Flags().StringVarP(&logoutHostname, "hostname", "h", "", "Hostname to log out of")
}

func runAuthLogout(cmd *cobra.Command, _ []string) error {
	mgr := config.Default()
	hostname := logoutHostname

	if hostname == "" {
		cfg := mgr.Load()
		if len(cfg.Hosts) == 0 {
			return fmt.Errorf("not logged in to any host")
		}
		if len(cfg.Hosts) > 1 {
			fmt.Fprintln(cmd.OutOrStdout(), "Multiple hosts configured. Specify --hostname:")
			for h := range cfg.Hosts {
				fmt.Fprintln(cmd.OutOrStdout(), " ", h)
			}
			return fmt.Errorf("use --hostname to select a host")
		}
		for h := range cfg.Hosts {
			hostname = h
		}
	}

	if err := mgr.RemoveHost(hostname); err != nil {
		return err
	}
	fmt.Fprintf(cmd.OutOrStdout(), "Logged out of %s\n", hostname)
	return nil
}
