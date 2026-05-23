package cache_test

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/nwp/bb/internal/cache"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newCache(t *testing.T) *cache.Cache {
	t.Helper()
	dir := t.TempDir()
	return &cache.Cache{Path: filepath.Join(dir, ".bb.json")}
}

func TestGetMissing(t *testing.T) {
	c := newCache(t)
	assert.Nil(t, c.Get("/some/dir"))
}

func TestSetGet(t *testing.T) {
	c := newCache(t)
	e := cache.Entry{Hostname: "bb.example.com", Project: "PROJ", Repo: "my-repo"}
	require.NoError(t, c.Set("/my/dir", e))

	got := c.Get("/my/dir")
	require.NotNil(t, got)
	assert.Equal(t, "bb.example.com", got.Hostname)
	assert.Equal(t, "PROJ", got.Project)
	assert.Equal(t, "my-repo", got.Repo)
	assert.NotEmpty(t, got.CachedAt)
}

func TestSetOverwrites(t *testing.T) {
	c := newCache(t)
	require.NoError(t, c.Set("/my/dir", cache.Entry{Hostname: "h1", Project: "P1", Repo: "r1"}))
	time.Sleep(2 * time.Millisecond)
	require.NoError(t, c.Set("/my/dir", cache.Entry{Hostname: "h2", Project: "P2", Repo: "r2"}))

	got := c.Get("/my/dir")
	require.NotNil(t, got)
	assert.Equal(t, "h2", got.Hostname)
}

func TestDelete(t *testing.T) {
	c := newCache(t)
	require.NoError(t, c.Set("/my/dir", cache.Entry{Hostname: "h", Project: "P", Repo: "r"}))

	existed, err := c.Delete("/my/dir")
	require.NoError(t, err)
	assert.True(t, existed)
	assert.Nil(t, c.Get("/my/dir"))

	// Delete non-existent.
	existed, err = c.Delete("/my/dir")
	require.NoError(t, err)
	assert.False(t, existed)
}

func TestListSortedNewestFirst(t *testing.T) {
	c := newCache(t)
	require.NoError(t, c.Set("/dir/a", cache.Entry{Hostname: "h", Project: "P", Repo: "a"}))
	time.Sleep(2 * time.Millisecond)
	require.NoError(t, c.Set("/dir/b", cache.Entry{Hostname: "h", Project: "P", Repo: "b"}))
	time.Sleep(2 * time.Millisecond)
	require.NoError(t, c.Set("/dir/c", cache.Entry{Hostname: "h", Project: "P", Repo: "c"}))

	entries, err := c.List()
	require.NoError(t, err)
	require.Len(t, entries, 3)
	assert.Equal(t, "c", entries[0].Repo)
	assert.Equal(t, "b", entries[1].Repo)
	assert.Equal(t, "a", entries[2].Repo)
}

func TestListEmpty(t *testing.T) {
	c := newCache(t)
	entries, err := c.List()
	require.NoError(t, err)
	assert.Empty(t, entries)
}

func TestMalformedFile(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, ".bb.json")
	require.NoError(t, os.WriteFile(path, []byte("not json {{{"), 0644))
	c := &cache.Cache{Path: path}
	// Should silently treat malformed file as empty.
	assert.Nil(t, c.Get("/x"))
	entries, err := c.List()
	require.NoError(t, err)
	assert.Empty(t, entries)
}
