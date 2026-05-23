package cmd

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"

	"github.com/nwp/bb/internal/config"
	"github.com/spf13/cobra"
)

var apiCmd = &cobra.Command{
	Use:   "api <endpoint>",
	Short: "Make an authenticated API request",
	Long: `Make an authenticated request to the Bitbucket Server REST API.

Example:
  bb api /rest/api/1.0/projects
  bb api /rest/api/1.0/projects/KEY/repos -X GET
  bb api /rest/api/1.0/projects -f limit=10 --jq .values[0].key`,
	Args: cobra.ExactArgs(1),
	RunE: runAPI,
}

var apiFlags struct {
	method   string
	fields   []string
	hostname string
	jq       string
}

func init() {
	apiCmd.Flags().StringVarP(&apiFlags.method, "method", "X", "GET", "HTTP method")
	apiCmd.Flags().StringArrayVarP(&apiFlags.fields, "field", "f", nil, "Add a key=value field (repeatable)")
	apiCmd.Flags().StringVarP(&apiFlags.hostname, "hostname", "H", "", "Override hostname")
	apiCmd.Flags().StringVar(&apiFlags.jq, "jq", "", "Filter JSON output with dot notation (e.g. .values[0].key)")
}

func runAPI(cmd *cobra.Command, args []string) error {
	endpoint := args[0]

	mgr := config.Default()
	var rh *config.ResolvedHost
	if apiFlags.hostname != "" {
		rh = mgr.ResolveHost(apiFlags.hostname)
		if rh == nil {
			return fmt.Errorf("host %q not configured", apiFlags.hostname)
		}
	} else {
		rh = mgr.DefaultHost()
		if rh == nil {
			return fmt.Errorf("not authenticated; run `bb auth login`")
		}
	}

	protocol := rh.Protocol
	if protocol == "" {
		protocol = "https"
	}

	// Build query params / body from -f fields.
	fields := url.Values{}
	for _, f := range apiFlags.fields {
		k, v, ok := strings.Cut(f, "=")
		if !ok {
			return fmt.Errorf("invalid field %q: expected key=value", f)
		}
		fields.Add(k, v)
	}

	u := fmt.Sprintf("%s://%s%s", protocol, rh.Hostname, endpoint)
	if apiFlags.method == http.MethodGet && len(fields) > 0 {
		u += "?" + fields.Encode()
		fields = nil
	}

	var bodyReader io.Reader
	if len(fields) > 0 {
		bodyReader = strings.NewReader(fields.Encode())
	}

	req, err := http.NewRequestWithContext(context.Background(), apiFlags.method, u, bodyReader)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+rh.Token)
	req.Header.Set("Accept", "application/json")
	if bodyReader != nil {
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("API error %s: %s", resp.Status, string(body))
	}

	if apiFlags.jq != "" {
		filtered, err := applyDotNotation(body, apiFlags.jq)
		if err != nil {
			return fmt.Errorf("jq filter failed: %w", err)
		}
		fmt.Fprintln(cmd.OutOrStdout(), filtered)
		return nil
	}

	// Pretty-print JSON if possible, otherwise raw.
	var v any
	if json.Unmarshal(body, &v) == nil {
		enc := json.NewEncoder(cmd.OutOrStdout())
		enc.SetIndent("", "  ")
		return enc.Encode(v)
	}
	fmt.Fprintln(cmd.OutOrStdout(), string(body))
	return nil
}

// applyDotNotation applies a simple dot-notation path (e.g. ".values[0].key")
// to a JSON byte slice and returns the result as a string.
func applyDotNotation(data []byte, path string) (string, error) {
	var root any
	if err := json.Unmarshal(data, &root); err != nil {
		return "", err
	}
	// Strip leading dot.
	path = strings.TrimPrefix(path, ".")
	if path == "" {
		b, _ := json.MarshalIndent(root, "", "  ")
		return string(b), nil
	}

	current := root
	parts := splitDotPath(path)
	for _, part := range parts {
		// Handle array index: key[N]
		if idx := strings.Index(part, "["); idx >= 0 {
			key := part[:idx]
			rest := part[idx:]
			if key != "" {
				m, ok := current.(map[string]any)
				if !ok {
					return "", fmt.Errorf("expected object at %q", key)
				}
				current = m[key]
			}
			// Parse [N].
			var n int
			if _, err := fmt.Sscanf(rest, "[%d]", &n); err != nil {
				return "", fmt.Errorf("invalid array index %q", rest)
			}
			arr, ok := current.([]any)
			if !ok {
				return "", fmt.Errorf("expected array")
			}
			if n < 0 || n >= len(arr) {
				return "", fmt.Errorf("index %d out of range (len %d)", n, len(arr))
			}
			current = arr[n]
		} else {
			m, ok := current.(map[string]any)
			if !ok {
				return "", fmt.Errorf("expected object at %q", part)
			}
			current = m[part]
		}
	}

	switch v := current.(type) {
	case string:
		return v, nil
	case nil:
		return "null", nil
	default:
		b, err := json.MarshalIndent(v, "", "  ")
		return string(b), err
	}
}

func splitDotPath(path string) []string {
	var parts []string
	current := ""
	for _, ch := range path {
		if ch == '.' && current != "" {
			parts = append(parts, current)
			current = ""
		} else {
			current += string(ch)
		}
	}
	if current != "" {
		parts = append(parts, current)
	}
	return parts
}
