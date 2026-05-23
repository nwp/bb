package cmd

import (
	"context"
	"fmt"
	"net/http"

	"github.com/nwp/bb/internal/config"
	"github.com/spf13/cobra"
)

var authStatusCmd = &cobra.Command{
	Use:   "status",
	Short: "Display authentication status for configured hosts",
	RunE:  runAuthStatus,
}

func runAuthStatus(cmd *cobra.Command, _ []string) error {
	mgr := config.Default()
	hosts := mgr.AllHosts()

	if len(hosts) == 0 {
		fmt.Fprintln(cmd.OutOrStdout(), "Not logged in to any host. Run: bb auth login")
		return nil
	}

	cfg := mgr.Load()
	for _, rh := range hosts {
		entry := cfg.Hosts[rh.Hostname]
		storeLabel := config.TokenStoreLabel(entry)
		protocol := rh.Protocol
		if protocol == "" {
			protocol = "https"
		}

		fmt.Fprintf(cmd.OutOrStdout(), "%s\n", rh.Hostname)
		fmt.Fprintf(cmd.OutOrStdout(), "  ✓ Logged in as %s\n", rh.Hostname)
		fmt.Fprintf(cmd.OutOrStdout(), "  Protocol: %s\n", protocol)
		fmt.Fprintf(cmd.OutOrStdout(), "  Token: %s (%s)\n", maskToken(rh.Token), storeLabel)

		// Connectivity check.
		status, err := checkConnectivity(rh.Hostname, rh.Token, protocol)
		if err != nil || status >= 400 {
			fmt.Fprintf(cmd.OutOrStdout(), "  ✗ Connection failed\n")
		} else {
			fmt.Fprintf(cmd.OutOrStdout(), "  ✓ Connected\n")
		}
		fmt.Fprintln(cmd.OutOrStdout())
	}
	return nil
}

func checkConnectivity(hostname, token, protocol string) (int, error) {
	url := fmt.Sprintf("%s://%s/rest/api/1.0/application-properties", protocol, hostname)
	req, err := http.NewRequestWithContext(context.Background(), http.MethodGet, url, nil)
	if err != nil {
		return 0, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()
	return resp.StatusCode, nil
}
