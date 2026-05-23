// Package config manages ~/.config/bb/config.json and host authentication.
package config

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

// HostConfig holds authentication and connection settings for a single host.
type HostConfig struct {
	Token      string `json:"token,omitempty"` // plaintext fallback only
	TokenStore string `json:"token_store"`     // "keychain" or "file"
	User       string `json:"user,omitempty"`
	Protocol   string `json:"protocol,omitempty"` // "https" or "http"
}

// Config is the top-level structure of ~/.config/bb/config.json.
type Config struct {
	Hosts    map[string]HostConfig `json:"hosts"`
	Defaults struct {
		Hostname string `json:"hostname,omitempty"`
	} `json:"defaults,omitempty"`
}

// TokenStore abstracts keychain vs file storage, injectable for tests.
type TokenStore interface {
	Get(hostname string) (string, error)
	Set(hostname, token string) error
	Delete(hostname string) error
}

// DefaultTokenStore returns the platform keyring-backed TokenStore.
func DefaultTokenStore() TokenStore {
	return &keychainStore{}
}

// Manager provides config read/write operations. TokenStore is injectable for
// testing; if nil, the platform keyring is used.
type Manager struct {
	dir        string
	TokenStore TokenStore
}

// Default returns a Manager using ~/.config/bb/.
func Default() *Manager {
	home, _ := os.UserHomeDir()
	return &Manager{
		dir:        filepath.Join(home, ".config", "bb"),
		TokenStore: DefaultTokenStore(),
	}
}

// WithDir returns a Manager using a custom config directory (for testing).
func WithDir(dir string, ts TokenStore) *Manager {
	return &Manager{dir: dir, TokenStore: ts}
}

func (m *Manager) configFile() string { return filepath.Join(m.dir, "config.json") }

// Load reads and returns the current config. Returns an empty Config on
// missing or malformed file.
func (m *Manager) Load() Config {
	data, err := os.ReadFile(m.configFile())
	if err != nil {
		return Config{Hosts: map[string]HostConfig{}}
	}
	var cfg Config
	if err := json.Unmarshal(data, &cfg); err != nil {
		return Config{Hosts: map[string]HostConfig{}}
	}
	if cfg.Hosts == nil {
		cfg.Hosts = map[string]HostConfig{}
	}
	return cfg
}

// Save writes cfg to disk with 0600 permissions.
func (m *Manager) Save(cfg Config) error {
	if err := os.MkdirAll(m.dir, 0755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}
	data = append(data, '\n')
	return os.WriteFile(m.configFile(), data, 0600)
}

// SetHost stores authentication for hostname. Tries the keychain first; falls
// back to plaintext in the config file.
func (m *Manager) SetHost(hostname string, token, user, protocol string) error {
	cfg := m.Load()
	entry := HostConfig{User: user, Protocol: protocol}

	if err := m.TokenStore.Set(hostname, token); err == nil {
		entry.TokenStore = "keychain"
	} else {
		entry.TokenStore = "file"
		entry.Token = token
	}
	cfg.Hosts[hostname] = entry
	cfg.Defaults.Hostname = hostname
	return m.Save(cfg)
}

// RemoveHost deletes a host's config and its keychain entry.
func (m *Manager) RemoveHost(hostname string) error {
	cfg := m.Load()
	if _, ok := cfg.Hosts[hostname]; !ok {
		return fmt.Errorf("host %q not configured", hostname)
	}
	_ = m.TokenStore.Delete(hostname) // best-effort
	delete(cfg.Hosts, hostname)
	if cfg.Defaults.Hostname == hostname {
		cfg.Defaults.Hostname = ""
		for h := range cfg.Hosts {
			cfg.Defaults.Hostname = h
			break
		}
	}
	return m.Save(cfg)
}

// ResolvedHost holds the effective connection settings for a host.
type ResolvedHost struct {
	Hostname string
	Token    string
	User     string
	Protocol string
}

// ResolveHost returns auth+connection settings for hostname, fetching the token
// from the appropriate store. Returns nil if no config or token found.
func (m *Manager) ResolveHost(hostname string) *ResolvedHost {
	cfg := m.Load()
	key := ResolveHostAlias(hostname, cfg.Hosts)
	if key == "" {
		return nil
	}
	entry := cfg.Hosts[key]
	token := ""
	if entry.TokenStore == "keychain" {
		token, _ = m.TokenStore.Get(key)
	}
	if token == "" {
		token = entry.Token
	}
	if token == "" {
		return nil
	}
	return &ResolvedHost{
		Hostname: key,
		Token:    token,
		User:     entry.User,
		Protocol: entry.Protocol,
	}
}

// DefaultHost returns the default configured host, or nil if none.
func (m *Manager) DefaultHost() *ResolvedHost {
	cfg := m.Load()
	if h := cfg.Defaults.Hostname; h != "" {
		if rh := m.ResolveHost(h); rh != nil {
			return rh
		}
	}
	// Fall back to first resolvable host.
	for h := range cfg.Hosts {
		if rh := m.ResolveHost(h); rh != nil {
			return rh
		}
	}
	return nil
}

// AllHosts returns all host entries and their resolved tokens (token may be
// empty if retrieval failed).
func (m *Manager) AllHosts() []ResolvedHost {
	cfg := m.Load()
	var out []ResolvedHost
	for h, entry := range cfg.Hosts {
		token := ""
		if entry.TokenStore == "keychain" {
			token, _ = m.TokenStore.Get(h)
		}
		if token == "" {
			token = entry.Token
		}
		out = append(out, ResolvedHost{
			Hostname: h,
			Token:    token,
			User:     entry.User,
			Protocol: entry.Protocol,
		})
	}
	return out
}

// TokenStoreLabel returns "keychain" or "plaintext config" for the given host
// entry — used for display purposes.
func TokenStoreLabel(entry HostConfig) string {
	if entry.TokenStore == "keychain" {
		return "keychain"
	}
	return "plaintext config"
}

// MigrateToKeychain moves all plaintext tokens in cfg to the keychain.
// Returns the count of tokens migrated.
func (m *Manager) MigrateToKeychain() (int, error) {
	cfg := m.Load()
	count := 0
	for h, entry := range cfg.Hosts {
		if entry.TokenStore == "keychain" || entry.Token == "" {
			continue
		}
		if err := m.TokenStore.Set(h, entry.Token); err != nil {
			return count, fmt.Errorf("storing token for %s: %w", h, err)
		}
		entry.Token = ""
		entry.TokenStore = "keychain"
		cfg.Hosts[h] = entry
		count++
	}
	if count > 0 {
		return count, m.Save(cfg)
	}
	return 0, nil
}

// — Hostname helpers —

var numericPort = regexp.MustCompile(`:\d+$`)
var ipv6Bracket = regexp.MustCompile(`^\[`)

// NormalizeHostname strips protocol, trailing paths, and lowercases. Preserves
// explicit ports and IPv6 brackets.
func NormalizeHostname(input string) string {
	// Strip protocol.
	for _, p := range []string{"https://", "http://"} {
		if strings.HasPrefix(input, p) {
			input = input[len(p):]
		}
	}
	// Strip path (after first /).
	if i := strings.IndexByte(input, '/'); i >= 0 {
		input = input[:i]
	}
	return strings.ToLower(input)
}

// StripNumericPort removes a trailing :NNN from a hostname string.
func StripNumericPort(hostname string) string {
	if ipv6Bracket.MatchString(hostname) {
		return hostname // Don't strip from IPv6 literals.
	}
	return numericPort.ReplaceAllString(hostname, "")
}

// HostMatches reports whether two hostnames are equal ignoring numeric ports.
func HostMatches(a, b string) bool {
	return strings.EqualFold(StripNumericPort(a), StripNumericPort(b))
}

// ResolveHostAlias finds the best matching key in hosts for the requested
// hostname. Priority: exact → normalized → port-agnostic. Returns "" if none.
func ResolveHostAlias(requested string, hosts map[string]HostConfig) string {
	// 1. Exact match.
	if _, ok := hosts[requested]; ok {
		return requested
	}
	// 2. Normalized match.
	norm := NormalizeHostname(requested)
	for k := range hosts {
		if NormalizeHostname(k) == norm {
			return k
		}
	}
	// 3. Port-agnostic match.
	for k := range hosts {
		if HostMatches(k, requested) {
			return k
		}
	}
	return ""
}
