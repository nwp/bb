---
name: bb
description: Bitbucket Server CLI — use bb to manage pull requests, repositories, and authentication with a Bitbucket Server instance.
---

# bb — Bitbucket Server CLI

## Authentication policy

**NEVER run** `bb auth login`, `bb auth logout`, `bb auth status`, or `bb auth migrate` automatically.
These require interactive input or expose tokens. If a bb command fails with an auth error, tell the user to run `bb auth login`.

## Repository context

bb resolves project and repo using this priority:

1. Explicit `-R PROJECT/repo` flag
2. Auto-detect from the current git remote (`origin`)
3. Cache at `~/.bb.json` (set after first successful command)

You do **not** need to discover or pass project/repo on every command. Run any `bb` command once from the repo directory and the context is cached.

## Common workflows

### Create a pull request

```sh
git push -u origin HEAD
bb pr create --title "My feature" --body "Details here"
bb pr create --title "Fix bug" --reviewer jsmith --reviewer adoe
bb pr create --fill   # use last commit message
```

### Review and merge

```sh
bb pr list
bb pr view 42
bb pr diff 42
bb pr review 42 --approve
bb pr merge 42
```

### Check CI status

```sh
bb pr checks 42
bb pr checks 42 --watch  # poll until complete
```

### Raw API access

```sh
bb api /rest/api/1.0/projects
bb api /rest/api/1.0/projects/KEY/repos/slug --jq .slug
```

## Key differences from gh (GitHub CLI)

| Concept | gh (GitHub) | bb (Bitbucket Server) |
|---------|-------------|----------------------|
| Namespace | owner/repo | PROJECT/repo |
| Auth | OAuth | HTTP access token |
| Close PR | `gh pr close` | `bb pr close` (decline) |
| Issues | `gh issue` | Not available |
