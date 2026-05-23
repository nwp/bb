// Package cache manages the per-directory repository context cache at ~/.bb.json.
// It stores project/repo context so commands don't need to re-parse git remotes
// on every invocation.
package cache

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sort"
	"time"
)

// Entry is a cached repository context for a directory.
type Entry struct {
	Hostname string `json:"hostname"`
	Project  string `json:"project"`
	Repo     string `json:"repo"`
	CachedAt string `json:"cachedAt"` // RFC3339Nano
}

// DirectoryEntry pairs a directory path with its Entry.
type DirectoryEntry struct {
	Dir string
	Entry
}

// cacheMap is the on-disk JSON format: directory path → Entry.
type cacheMap map[string]Entry

// Cache provides access to the ~/.bb.json repo cache. The Path field is
// settable for testing; leave empty to use the default ~/.bb.json.
type Cache struct {
	Path string
}

// Default returns a Cache using ~/.bb.json.
func Default() *Cache {
	home, _ := os.UserHomeDir()
	return &Cache{Path: filepath.Join(home, ".bb.json")}
}

func (c *Cache) load() (cacheMap, error) {
	data, err := os.ReadFile(c.Path)
	if os.IsNotExist(err) {
		return cacheMap{}, nil
	}
	if err != nil {
		return cacheMap{}, err
	}
	var m cacheMap
	if err := json.Unmarshal(data, &m); err != nil {
		// Malformed file — treat as empty.
		return cacheMap{}, nil
	}
	return m, nil
}

func (c *Cache) save(m cacheMap) error {
	data, err := json.MarshalIndent(m, "", "  ")
	if err != nil {
		return err
	}
	data = append(data, '\n')
	return os.WriteFile(c.Path, data, 0644)
}

// Get returns the cached entry for dir, or nil if none exists.
func (c *Cache) Get(dir string) *Entry {
	m, err := c.load()
	if err != nil {
		return nil
	}
	e, ok := m[dir]
	if !ok {
		return nil
	}
	return &e
}

// Set stores an entry for dir, overwriting any existing entry.
func (c *Cache) Set(dir string, e Entry) error {
	m, err := c.load()
	if err != nil {
		m = cacheMap{}
	}
	e.CachedAt = time.Now().UTC().Format(time.RFC3339Nano)
	m[dir] = e
	return c.save(m)
}

// Delete removes the entry for dir. Returns true if an entry existed.
func (c *Cache) Delete(dir string) (bool, error) {
	m, err := c.load()
	if err != nil {
		return false, nil
	}
	_, existed := m[dir]
	if !existed {
		return false, nil
	}
	delete(m, dir)
	return true, c.save(m)
}

// List returns all entries sorted by CachedAt descending (newest first).
func (c *Cache) List() ([]DirectoryEntry, error) {
	m, err := c.load()
	if err != nil {
		return nil, err
	}
	entries := make([]DirectoryEntry, 0, len(m))
	for dir, e := range m {
		entries = append(entries, DirectoryEntry{Dir: dir, Entry: e})
	}
	sort.Slice(entries, func(i, j int) bool {
		return entries[i].CachedAt > entries[j].CachedAt
	})
	return entries, nil
}
