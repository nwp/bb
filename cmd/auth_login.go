package cmd

import (
	"bufio"
	"context"
	"fmt"
	"net/http"
	"os"
	"strings"

	"github.com/charmbracelet/huh"
	"github.com/nwp/bb/internal/config"
	"github.com/spf13/cobra"
)

var authLoginCmd = &cobra.Command{
	Use:   "login",
	Short: "Authenticate with a Bitbucket Server instance",
	RunE:  runAuthLogin,
}

var loginFlags struct {
	hostname   string
	token      string
	withToken  bool
	skipVerify bool
	protocol   string
}

func init() {
	authLoginCmd.Flags().StringVarP(&loginFlags.hostname, "hostname", "h", "", "Bitbucket Server hostname")
	authLoginCmd.Flags().StringVarP(&loginFlags.token, "token", "t", "", "Authentication token")
	authLoginCmd.Flags().BoolVar(&loginFlags.withToken, "with-token", false, "Read token from stdin")
	authLoginCmd.Flags().BoolVar(&loginFlags.skipVerify, "skip-verify", false, "Skip API connectivity check")
	authLoginCmd.Flags().StringVar(&loginFlags.protocol, "protocol", "https", "Protocol to use (https or http)")
}

func runAuthLogin(cmd *cobra.Command, _ []string) error {
	hostname := loginFlags.hostname
	token := loginFlags.token
	protocol := loginFlags.protocol

	// Non-interactive paths.
	if loginFlags.withToken {
		scanner := bufio.NewScanner(os.Stdin)
		if scanner.Scan() {
			token = strings.TrimSpace(scanner.Text())
		}
		if token == "" {
			return fmt.Errorf("no token received from stdin")
		}
		if hostname == "" {
			return fmt.Errorf("--hostname required when using --with-token")
		}
	} else if token != "" && hostname == "" {
		return fmt.Errorf("--hostname required when using --token")
	} else if token == "" || hostname == "" {
		// Interactive TUI form.
		var err error
		hostname, token, protocol, err = loginTUI(hostname, protocol)
		if err != nil {
			return err
		}
	}

	if !loginFlags.skipVerify {
		if err := verifyToken(hostname, token, protocol); err != nil {
			return fmt.Errorf("authentication failed: %w", err)
		}
	}

	mgr := config.Default()
	if err := mgr.SetHost(hostname, token, "", protocol); err != nil {
		return fmt.Errorf("saving credentials: %w", err)
	}

	cfg := mgr.Load()
	entry := cfg.Hosts[hostname]
	storeLabel := config.TokenStoreLabel(entry)
	fmt.Fprintf(cmd.OutOrStdout(), "Logged in to %s using token (%s)\n", hostname, storeLabel)
	return nil
}

// loginTUI presents a charmbracelet/huh form for interactive login.
func loginTUI(defaultHostname, defaultProtocol string) (hostname, token, protocol string, err error) {
	hostname = defaultHostname
	token = ""
	protocol = defaultProtocol

	form := huh.NewForm(
		huh.NewGroup(
			huh.NewInput().
				Title("Hostname").
				Description("Your Bitbucket Server hostname (e.g. bitbucket.example.com)").
				Placeholder("bitbucket.example.com").
				Value(&hostname).
				Validate(func(s string) error {
					if strings.TrimSpace(s) == "" {
						return fmt.Errorf("hostname is required")
					}
					return nil
				}),
			huh.NewSelect[string]().
				Title("Protocol").
				Options(
					huh.NewOption("HTTPS (recommended)", "https"),
					huh.NewOption("HTTP", "http"),
				).
				Value(&protocol),
			huh.NewInput().
				Title("Token").
				Description("Your HTTP access token").
				EchoMode(huh.EchoModePassword).
				Value(&token).
				Validate(func(s string) error {
					if strings.TrimSpace(s) == "" {
						return fmt.Errorf("token is required")
					}
					return nil
				}),
		),
	)

	if err := form.Run(); err != nil {
		return "", "", "", err
	}
	return strings.TrimSpace(hostname), strings.TrimSpace(token), protocol, nil
}

// verifyToken performs a lightweight API call to confirm the token is valid.
func verifyToken(hostname, token, protocol string) error {
	req, err := http.NewRequestWithContext(context.Background(), http.MethodGet,
		fmt.Sprintf("%s://%s/rest/api/1.0/users?limit=1", protocol, hostname), nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		return fmt.Errorf("invalid token (HTTP %d)", resp.StatusCode)
	}
	return nil
}

// maskToken returns a masked representation: first 4 + last 4 chars visible.
func maskToken(token string) string {
	if len(token) <= 8 {
		return strings.Repeat("*", len(token))
	}
	return token[:4] + strings.Repeat("*", len(token)-8) + token[len(token)-4:]
}
