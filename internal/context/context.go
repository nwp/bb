// Package context resolves the Bitbucket Server repository context for a
// command invocation, using a three-tier fallback: explicit -R flag → git
// remote parsing → per-directory cache.
package context

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"regexp"
	"strconv"
	"strings"

	"github.com/nwp/bb/internal/api"
	"github.com/nwp/bb/internal/cache"
	"github.com/nwp/bb/internal/config"
)

// RepoContext is the resolved repository context for a command.
type RepoContext struct {
	Hostname string
	Project  string
	Repo     string
	Host     *config.ResolvedHost
	API      *api.Client
}

// RemoteInfo is the parsed result of a Bitbucket Server remote URL.
type RemoteInfo struct {
	Hostname string
	Project  string
	Repo     string
}

// remote URL patterns supported by Bitbucket Server.
var (
	// https://bitbucket.example.com/scm/PROJ/repo.git  (with optional /scm/)
	reHTTPS = regexp.MustCompile(`(?i)^https?://([^/]+?)(?:/scm)?/([^/]+)/([^/]+?)(?:\.git)?/?$`)
	// ssh://git@host:port/PROJ/repo.git
	reSSHPort = regexp.MustCompile(`(?i)^ssh://[^@]+@([^:/]+(?::\d+)?)/([^/]+)/([^/]+?)(?:\.git)?/?$`)
	// git@host:7999/PROJ/repo.git  (SCP with numeric port in path segment)
	reSCPPort = regexp.MustCompile(`(?i)^[^@]+@(\[?[^\]/:]+(?::\d+)?\]?):(\d+)/([^/]+)/([^/]+?)(?:\.git)?/?$`)
	// git@host:PROJ/repo.git  (SCP without port)
	reSCPNoPort = regexp.MustCompile(`(?i)^[^@]+@(\[?[^\]/:]+\]?):([^/\d][^/]*)/([^/]+?)(?:\.git)?/?$`)
)

// ParseRemoteURL parses a Bitbucket Server git remote URL into its components.
// Returns nil if the URL is not a recognised Bitbucket Server format.
func ParseRemoteURL(rawURL string) *RemoteInfo {
	rawURL = strings.TrimSpace(rawURL)

	if m := reHTTPS.FindStringSubmatch(rawURL); m != nil {
		return &RemoteInfo{Hostname: strings.ToLower(m[1]), Project: m[2], Repo: m[3]}
	}
	if m := reSSHPort.FindStringSubmatch(rawURL); m != nil {
		return &RemoteInfo{Hostname: strings.ToLower(m[1]), Project: m[2], Repo: m[3]}
	}
	if m := reSCPPort.FindStringSubmatch(rawURL); m != nil {
		// host:port/PROJ/repo — embed port into hostname.
		host := fmt.Sprintf("%s:%s", strings.ToLower(m[1]), m[2])
		return &RemoteInfo{Hostname: host, Project: m[3], Repo: m[4]}
	}
	if m := reSCPNoPort.FindStringSubmatch(rawURL); m != nil {
		return &RemoteInfo{Hostname: strings.ToLower(m[1]), Project: m[2], Repo: m[3]}
	}
	return nil
}

// Options controls how context resolution behaves.
type Options struct {
	// RepoFlag is the value of -R / --repo (e.g. "PROJECT/repo" or "host/PROJECT/repo").
	RepoFlag string
	// ConfigManager is used to look up host credentials. If nil, the default is used.
	ConfigManager *config.Manager
	// Cache is the repo cache. If nil, the default is used.
	Cache *cache.Cache
}

// Resolve determines the current repository context. It tries, in order:
//  1. The explicit -R / --repo flag.
//  2. Parsing the git remote URL of "origin".
//  3. The per-directory cache at ~/.bb.json.
func Resolve(opts Options) (*RepoContext, error) {
	mgr := opts.ConfigManager
	if mgr == nil {
		mgr = config.Default()
	}
	c := opts.Cache
	if c == nil {
		c = cache.Default()
	}

	var hostname, project, repo string

	switch {
	case opts.RepoFlag != "":
		parts := strings.Split(opts.RepoFlag, "/")
		switch len(parts) {
		case 2:
			project, repo = parts[0], parts[1]
		case 3:
			hostname, project, repo = parts[0], parts[1], parts[2]
		default:
			return nil, fmt.Errorf("invalid --repo format: expected PROJECT/repo or host/PROJECT/repo, got %q", opts.RepoFlag)
		}

	default:
		// Try git remote.
		if info, err := detectFromGit(); err == nil && info != nil {
			hostname = info.Hostname
			project = info.Project
			repo = info.Repo
		} else {
			// Try cache.
			cwd, err := currentDir()
			if err != nil {
				return nil, fmt.Errorf("getting working directory: %w", err)
			}
			entry := c.Get(cwd)
			if entry == nil {
				return nil, fmt.Errorf("not a Bitbucket Server repository (no git remote, no cache entry); use -R PROJECT/repo or run `bb auth login`")
			}
			hostname = entry.Hostname
			project = entry.Project
			repo = entry.Repo
		}
	}

	// Resolve host config.
	var host *config.ResolvedHost
	if hostname != "" {
		host = mgr.ResolveHost(hostname)
	} else {
		host = mgr.DefaultHost()
	}
	if host == nil {
		return nil, fmt.Errorf("not authenticated; run `bb auth login`")
	}
	if hostname == "" {
		hostname = host.Hostname
	}

	// Cache the resolved context for next time.
	cwd, _ := currentDir()
	if cwd != "" {
		_ = c.Set(cwd, cache.Entry{
			Hostname: hostname,
			Project:  project,
			Repo:     repo,
		})
	}

	client := api.NewClient(hostname, host.Token, host.Protocol)
	return &RepoContext{
		Hostname: hostname,
		Project:  project,
		Repo:     repo,
		Host:     host,
		API:      client,
	}, nil
}

// detectFromGit reads the "origin" remote URL and parses it.
func detectFromGit() (*RemoteInfo, error) {
	out, err := exec.Command("git", "remote", "get-url", "origin").Output()
	if err != nil {
		return nil, err
	}
	return ParseRemoteURL(strings.TrimSpace(string(out))), nil
}

// currentDir returns the git repository root directory, or the process working
// directory as a fallback.
func currentDir() (string, error) {
	out, err := exec.Command("git", "rev-parse", "--show-toplevel").Output()
	if err == nil {
		return strings.TrimSpace(string(out)), nil
	}
	return os.Getwd()
}

// GetCurrentBranch returns the current git branch name.
func GetCurrentBranch() (string, error) {
	out, err := exec.Command("git", "rev-parse", "--abbrev-ref", "HEAD").Output()
	if err != nil {
		return "", fmt.Errorf("getting current branch: %w", err)
	}
	return strings.TrimSpace(string(out)), nil
}

// ResolvePRID resolves a PR number from an explicit argument string, or falls
// back to finding the open PR whose fromRef matches the current branch.
func ResolvePRID(ctx context.Context, apiClient *api.Client, project, repo, numberArg string) (int, error) {
	if numberArg != "" {
		n, err := strconv.Atoi(numberArg)
		if err != nil {
			return 0, fmt.Errorf("invalid PR number %q", numberArg)
		}
		return n, nil
	}

	branch, err := GetCurrentBranch()
	if err != nil {
		return 0, fmt.Errorf("no PR number specified and could not determine current branch: %w", err)
	}

	prs, err := apiClient.ListPRs(ctx, project, repo, "OPEN")
	if err != nil {
		return 0, fmt.Errorf("listing PRs: %w", err)
	}
	for _, pr := range prs {
		if pr.FromRef.DisplayID == branch {
			return pr.ID, nil
		}
	}
	return 0, fmt.Errorf("no open PR found for branch %q; specify a PR number", branch)
}
