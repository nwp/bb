package config_test

import (
	"errors"
	"sync"
	"testing"

	"github.com/nwp/bb/internal/config"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// memTokenStore is an in-memory TokenStore for tests.
type memTokenStore struct {
	mu     sync.Mutex
	tokens map[string]string
}

func newMemStore() *memTokenStore { return &memTokenStore{tokens: map[string]string{}} }

func (m *memTokenStore) Get(h string) (string, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	t, ok := m.tokens[h]
	if !ok {
		return "", errors.New("not found")
	}
	return t, nil
}
func (m *memTokenStore) Set(h, t string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.tokens[h] = t
	return nil
}
func (m *memTokenStore) Delete(h string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.tokens, h)
	return nil
}

func newManager(t *testing.T) (*config.Manager, *memTokenStore) {
	t.Helper()
	ts := newMemStore()
	mgr := config.WithDir(t.TempDir(), ts)
	return mgr, ts
}

func TestLoadEmpty(t *testing.T) {
	mgr, _ := newManager(t)
	cfg := mgr.Load()
	assert.Empty(t, cfg.Hosts)
}

func TestSetAndResolveHost(t *testing.T) {
	mgr, ts := newManager(t)
	require.NoError(t, mgr.SetHost("bb.example.com", "mytoken", "alice", "https"))

	// Token should be in keychain.
	tok, err := ts.Get("bb.example.com")
	require.NoError(t, err)
	assert.Equal(t, "mytoken", tok)

	// Config should have token_store=keychain.
	cfg := mgr.Load()
	entry := cfg.Hosts["bb.example.com"]
	assert.Equal(t, "keychain", entry.TokenStore)
	assert.Empty(t, entry.Token) // not stored in file

	rh := mgr.ResolveHost("bb.example.com")
	require.NotNil(t, rh)
	assert.Equal(t, "mytoken", rh.Token)
	assert.Equal(t, "alice", rh.User)
}

func TestFallbackToPlaintext(t *testing.T) {
	// Simulate keychain failure by using a store that always errors on Set.
	dir := t.TempDir()
	ts := &failingStore{}
	mgr := config.WithDir(dir, ts)

	require.NoError(t, mgr.SetHost("bb.example.com", "mytoken", "", "https"))
	cfg := mgr.Load()
	entry := cfg.Hosts["bb.example.com"]
	assert.Equal(t, "file", entry.TokenStore)
	assert.Equal(t, "mytoken", entry.Token)

	rh := mgr.ResolveHost("bb.example.com")
	require.NotNil(t, rh)
	assert.Equal(t, "mytoken", rh.Token)
}

type failingStore struct{}

func (f *failingStore) Get(string) (string, error) { return "", errors.New("unavailable") }
func (f *failingStore) Set(string, string) error   { return errors.New("unavailable") }
func (f *failingStore) Delete(string) error        { return nil }

func TestRemoveHost(t *testing.T) {
	mgr, _ := newManager(t)
	require.NoError(t, mgr.SetHost("bb.example.com", "tok", "", "https"))
	require.NoError(t, mgr.RemoveHost("bb.example.com"))
	cfg := mgr.Load()
	assert.Empty(t, cfg.Hosts)
	assert.Nil(t, mgr.ResolveHost("bb.example.com"))
}

func TestDefaultHost(t *testing.T) {
	mgr, _ := newManager(t)
	assert.Nil(t, mgr.DefaultHost())
	require.NoError(t, mgr.SetHost("bb.example.com", "tok", "", "https"))
	rh := mgr.DefaultHost()
	require.NotNil(t, rh)
	assert.Equal(t, "bb.example.com", rh.Hostname)
}

func TestMigrateToKeychain(t *testing.T) {
	ts := newMemStore()
	mgr := config.WithDir(t.TempDir(), ts)

	// Manually write a plaintext entry.
	cfg := mgr.Load()
	cfg.Hosts["bb.example.com"] = config.HostConfig{Token: "plain-tok", TokenStore: "file"}
	require.NoError(t, mgr.Save(cfg))

	n, err := mgr.MigrateToKeychain()
	require.NoError(t, err)
	assert.Equal(t, 1, n)

	tok, _ := ts.Get("bb.example.com")
	assert.Equal(t, "plain-tok", tok)
	entry := mgr.Load().Hosts["bb.example.com"]
	assert.Equal(t, "keychain", entry.TokenStore)
	assert.Empty(t, entry.Token)
}

func TestNormalizeHostname(t *testing.T) {
	tests := []struct{ in, want string }{
		{"https://bitbucket.example.com", "bitbucket.example.com"},
		{"http://bitbucket.example.com/path", "bitbucket.example.com"},
		{"BITBUCKET.EXAMPLE.COM", "bitbucket.example.com"},
		{"bitbucket.example.com:7990", "bitbucket.example.com:7990"},
		{"[2001:db8::1]:7990", "[2001:db8::1]:7990"},
	}
	for _, tt := range tests {
		assert.Equal(t, tt.want, config.NormalizeHostname(tt.in), "input: %s", tt.in)
	}
}

func TestResolveHostAlias(t *testing.T) {
	hosts := map[string]config.HostConfig{
		"bitbucket.example.com": {},
	}
	// Exact match.
	assert.Equal(t, "bitbucket.example.com", config.ResolveHostAlias("bitbucket.example.com", hosts))
	// Port-agnostic match.
	assert.Equal(t, "bitbucket.example.com", config.ResolveHostAlias("bitbucket.example.com:7990", hosts))
	// Not found.
	assert.Equal(t, "", config.ResolveHostAlias("other.host.com", hosts))
}
