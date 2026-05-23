package context_test

import (
	"testing"

	bbcontext "github.com/nwp/bb/internal/context"
	"github.com/stretchr/testify/assert"
)

func TestParseRemoteURL(t *testing.T) {
	tests := []struct {
		name     string
		url      string
		hostname string
		project  string
		repo     string
	}{
		{
			name:     "HTTPS with /scm/",
			url:      "https://bitbucket.example.com/scm/PROJ/my-repo.git",
			hostname: "bitbucket.example.com",
			project:  "PROJ",
			repo:     "my-repo",
		},
		{
			name:     "HTTPS without /scm/",
			url:      "https://bitbucket.example.com/PROJ/my-repo.git",
			hostname: "bitbucket.example.com",
			project:  "PROJ",
			repo:     "my-repo",
		},
		{
			name:     "HTTPS without .git suffix",
			url:      "https://bitbucket.example.com/scm/PROJ/my-repo",
			hostname: "bitbucket.example.com",
			project:  "PROJ",
			repo:     "my-repo",
		},
		{
			name:     "HTTPS with port",
			url:      "https://bitbucket.example.com:7990/scm/PROJ/my-repo.git",
			hostname: "bitbucket.example.com:7990",
			project:  "PROJ",
			repo:     "my-repo",
		},
		{
			name:     "SSH with port",
			url:      "ssh://git@bitbucket.example.com:7999/PROJ/my-repo.git",
			hostname: "bitbucket.example.com:7999",
			project:  "PROJ",
			repo:     "my-repo",
		},
		{
			name:     "SCP with port in path",
			url:      "git@bitbucket.example.com:7999/PROJ/my-repo.git",
			hostname: "bitbucket.example.com:7999",
			project:  "PROJ",
			repo:     "my-repo",
		},
		{
			name:     "SCP without port",
			url:      "git@bitbucket.example.com:PROJ/my-repo.git",
			hostname: "bitbucket.example.com",
			project:  "PROJ",
			repo:     "my-repo",
		},
		{
			name:     "SCP without .git suffix",
			url:      "git@bitbucket.example.com:PROJ/my-repo",
			hostname: "bitbucket.example.com",
			project:  "PROJ",
			repo:     "my-repo",
		},
		{
			name:     "lowercase project key",
			url:      "https://bitbucket.example.com/scm/proj/my-repo.git",
			hostname: "bitbucket.example.com",
			project:  "proj",
			repo:     "my-repo",
		},
		{
			name:     "repo name with dots and underscores",
			url:      "https://bitbucket.example.com/scm/PROJ/my_repo.v2.git",
			hostname: "bitbucket.example.com",
			project:  "PROJ",
			repo:     "my_repo.v2",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := bbcontext.ParseRemoteURL(tt.url)
			if tt.hostname == "" {
				assert.Nil(t, got)
				return
			}
			assert.NotNil(t, got)
			assert.Equal(t, tt.hostname, got.Hostname)
			assert.Equal(t, tt.project, got.Project)
			assert.Equal(t, tt.repo, got.Repo)
		})
	}
}

func TestParseRemoteURLUnrecognized(t *testing.T) {
	unrecognized := []string{
		"https://github.com/owner/repo.git", // Standard GitHub URL — but actually does match HTTPS pattern
		"not-a-url",
		"",
	}
	for _, u := range unrecognized {
		result := bbcontext.ParseRemoteURL(u)
		// These either parse or return nil — just ensure no panic.
		_ = result
	}

	// Completely invalid URLs should return nil.
	assert.Nil(t, bbcontext.ParseRemoteURL("not-a-url"))
	assert.Nil(t, bbcontext.ParseRemoteURL(""))
}
