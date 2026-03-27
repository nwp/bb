# Agent Instructions for `bb` — Bitbucket Server CLI

This file describes how to use the `bb` CLI for interacting with Bitbucket Server.
If you are a coding agent (Claude Code, Copilot, Cursor, etc.), read this to
understand how to perform Bitbucket Server operations from the command line.

`bb` mirrors the GitHub `gh` CLI. If you know `gh`, substitute `bb` and adjust
for Bitbucket Server concepts (projects instead of owners, decline instead of
close, HTTP access tokens instead of OAuth).

## Quick reference

```
bb repo list        # List repos
bb repo view        # View current repo
bb repo clone       # Clone a repo

bb pr list          # List pull requests
bb pr view [N]      # View PR (or PR for current branch)
bb pr create        # Create PR from current branch
bb pr edit [N]      # Edit title, description, base, reviewers
bb pr ready [N]     # Mark draft PR as ready for review
bb pr merge [N]     # Merge PR
bb pr close [N]     # Decline PR
bb pr reopen N      # Reopen a declined PR
bb pr checkout N    # Check out PR branch
bb pr diff [N]      # Show PR diff
bb pr checks [N]    # View CI/build status
bb pr comment N     # Add comment
bb pr review [N]    # Approve or request changes
bb pr watch [N]     # Poll for activity

bb api <endpoint>   # Raw API call

bb cache list       # List cached project/repo entries
bb cache delete     # Remove cache entry for CWD (or given path)
```

## Authentication

The user handles authentication themselves. **Never run `bb auth login`,
`bb auth logout`, `bb auth status`, or `bb auth migrate`.** These commands
require interactive input or expose tokens, and calling them wastes time.
If a `bb` command fails with an auth error, tell the user to run
`bb auth login` — do not run it for them.

## Repository context

`bb` resolves project and repository using this priority order:

1. Explicit `-R PROJECT/repo-slug` flag
2. Auto-detect from the current git remote (`origin`)
3. **Cache** — `~/.bb.json` stores the last resolved context per working
   directory. Once any command succeeds in a directory, subsequent invocations
   reuse the cached project/repo automatically.

**You do not need to discover or pass project/repo on every command.** Run any
`bb` command once from the repo directory and the context is cached.

```sh
# Override for a one-off command
bb pr list -R MYPROJ/my-repo

# Inspect what is cached
bb cache list

# Clear a stale entry
bb cache delete
```

## Common agent workflows

### Create a pull request for the current branch

```sh
# Ensure changes are pushed first
git push -u origin HEAD

# Create PR (auto-detects source branch, targets default branch)
bb pr create --title "Description of change" --body "Details here"

# Create PR with reviewers
bb pr create --title "Fix auth bug" --reviewer jsmith --reviewer adoe

# Create PR targeting a specific base branch
bb pr create --title "Backport fix" --base release/2.0
```

### Check PR status and wait for approval

```sh
# View PR for current branch
bb pr view

# View specific PR as JSON (useful for parsing)
bb pr view 42 --json

# Watch PR and block until merged or declined
bb pr watch 42
```

### Review and merge workflow

```sh
# List open PRs
bb pr list

# View PR details
bb pr view 42

# View the diff
bb pr diff 42

# Approve
bb pr review 42 --approve

# Add a comment
bb pr comment 42 --body "LGTM, approved"

# Merge
bb pr merge 42
```

### Query the API directly

For operations not covered by built-in commands, use `bb api`:

```sh
# List projects
bb api /rest/api/1.0/projects

# Get repo details
bb api /rest/api/1.0/projects/KEY/repos/my-repo

# List branches
bb api /rest/api/1.0/projects/KEY/repos/my-repo/branches

# Get build status for a commit
bb api /rest/build-status/1.0/commits/abc123def

# POST with fields
bb api /rest/api/1.0/projects/KEY/repos/slug/pull-requests \
  -X POST \
  -f title="PR title" \
  -f description="PR body"

# Filter JSON output
bb api /rest/api/1.0/projects --jq ".values[].key"
```

## JSON output

Most commands support `--json` for machine-readable output. Always use `--json`
when you need to parse the result programmatically:

```sh
# Get PR data as JSON
bb pr view 42 --json

# List PRs as JSON
bb pr list --json

# List repos as JSON
bb repo list --json
```

## Key differences from `gh`

| Concept | `gh` (GitHub) | `bb` (Bitbucket Server) |
|---------|---------------|-------------------------|
| Namespace | `owner/repo` | `PROJECT/repo` |
| Auth | `gh auth login` (OAuth) | `bb auth login --token` (HTTP access token) |
| Close PR | `gh pr close` | `bb pr close` (calls decline API) |
| Issues | `gh issue list` | Not available (use Jira) |
| Checks/CI | `gh pr checks` | `bb pr checks` |
| Gists | `gh gist` | Not available |
| Releases | `gh release` | Not available |
| Discussions | `gh discussion` | Not available |

## Bitbucket Server REST API reference

The API base path is `/rest/api/1.0/`. Common endpoints:

| Endpoint | Description |
|----------|-------------|
| `/rest/api/1.0/projects` | List projects |
| `/rest/api/1.0/projects/{KEY}/repos` | List repos in project |
| `/rest/api/1.0/projects/{KEY}/repos/{SLUG}` | Get repo |
| `/rest/api/1.0/projects/{KEY}/repos/{SLUG}/pull-requests` | List PRs |
| `/rest/api/1.0/projects/{KEY}/repos/{SLUG}/pull-requests/{ID}` | Get PR |
| `/rest/api/1.0/projects/{KEY}/repos/{SLUG}/pull-requests/{ID}/merge` | Merge PR |
| `/rest/api/1.0/projects/{KEY}/repos/{SLUG}/pull-requests/{ID}/decline` | Decline PR |
| `/rest/api/1.0/projects/{KEY}/repos/{SLUG}/pull-requests/{ID}/activities` | PR activity |
| `/rest/api/1.0/projects/{KEY}/repos/{SLUG}/pull-requests/{ID}/diff` | PR diff |
| `/rest/api/1.0/projects/{KEY}/repos/{SLUG}/pull-requests/{ID}/comments` | PR comments |
| `/rest/api/1.0/projects/{KEY}/repos/{SLUG}/pull-requests/{ID}/approve` | Approve PR |
| `/rest/api/1.0/projects/{KEY}/repos/{SLUG}/branches` | List branches |
| `/rest/api/1.0/projects/{KEY}/repos/{SLUG}/default-branch` | Default branch |
| `/rest/build-status/1.0/commits/{SHA}` | Build status |

## Error handling

- If `bb` exits non-zero, the error message is printed to stderr.
- Auth failures print "Not authenticated. Run: bb auth login".
- If run outside a git repo without `-R`, it prints a context error.
- API errors include the HTTP status and Bitbucket error message.
