# bb

`bb` is Bitbucket Server on the command line. It brings pull requests, repositories, and code review to your terminal — designed to feel instantly familiar to anyone who uses [`gh`](https://github.com/cli/cli).

```
bb pr list

#42  Add retry logic to sync worker  feature/retry → main  OPEN  2h ago  Jane Smith
#41  Fix null check in auth handler   bugfix/auth → main   OPEN  5h ago  Alex Chen
#39  Update dependency versions        deps/update → main   OPEN  1d ago  CI Bot
```

## About

`bb` is purpose-built for **Bitbucket Server / Data Center** (not Bitbucket Cloud). It wraps the [Bitbucket Server REST API](https://developer.atlassian.com/server/bitbucket/rest/v819/) and maps it to a command structure that mirrors the GitHub CLI as closely as possible.

If you know `gh`, you already know `bb`.

| `gh` | `bb` | Notes |
|------|------|-------|
| `gh auth login` | `bb auth login` | Uses HTTP access tokens instead of OAuth |
| `gh repo list` | `bb repo list` | Scoped by project |
| `gh pr create` | `bb pr create` | Auto-detects branch from git context |
| `gh pr merge` | `bb pr merge` | |
| `gh pr view` | `bb pr view` | |
| `gh api` | `bb api` | Raw REST API access |

## Installation

### Prerequisites

- [Bun](https://bun.sh) v1.0 or later

Install Bun if you don't have it:

```sh
curl -fsSL https://bun.sh/install | bash
```

### Quick start (from source)

```sh
git clone https://github.com/nwp/bb.git
cd bb
bun install
```

Run directly without building:

```sh
bun run bin/bb.ts --help
```

### Build a standalone binary

Bun can compile the entire CLI into a single self-contained executable with no
runtime dependencies — no need to have Bun or Node.js installed on the target
machine:

```sh
bun build bin/bb.ts --compile --outfile bb
```

This produces a single `bb` binary in the current directory. Test it:

```sh
./bb --help
```

### Install on macOS

Build the binary and move it into your PATH:

```sh
# Build
bun build bin/bb.ts --compile --outfile bb

# Install to a directory in your PATH
sudo mv bb /usr/local/bin/bb

# Verify
bb --version
```

If you prefer not to use `sudo`, install to a user-local bin directory instead:

```sh
mkdir -p ~/.local/bin
mv bb ~/.local/bin/bb
```

Make sure `~/.local/bin` is in your PATH. Add this to your `~/.zshrc` (or
`~/.bashrc`) if it isn't:

```sh
export PATH="$HOME/.local/bin:$PATH"
```

Then reload your shell:

```sh
source ~/.zshrc
```

### Install on Linux

Same as macOS:

```sh
bun build bin/bb.ts --compile --outfile bb
sudo mv bb /usr/local/bin/bb
```

### Making `bb` available to coding agents

Coding agents (Claude Code, Copilot, Cursor, etc.) need `bb` to be in the
system PATH. After installing the binary to `/usr/local/bin` or `~/.local/bin`
as shown above, any agent running in a terminal session will be able to invoke
`bb` directly.

For agents running in CI or Docker containers, add the build step to your
image:

```dockerfile
# In your Dockerfile
COPY --from=oven/bun:latest /usr/local/bin/bun /usr/local/bin/bun
COPY . /opt/bb
RUN cd /opt/bb && bun install && bun build bin/bb.ts --compile --outfile /usr/local/bin/bb
```

For agents that need to authenticate non-interactively, set the token via flags:

```sh
bb auth login --hostname bitbucket.example.com --token "$BB_TOKEN"
```

Or pre-populate the config file directly:

```sh
mkdir -p ~/.config/bb
cat > ~/.config/bb/config.json << 'EOF'
{
  "hosts": {
    "bitbucket.example.com": {
      "token": "YOUR_TOKEN_HERE",
      "protocol": "https"
    }
  }
}
EOF
```

### Updating

Pull the latest source and rebuild:

```sh
cd bb
git pull
bun install
bun build bin/bb.ts --compile --outfile bb
sudo mv bb /usr/local/bin/bb
```

## Authentication

`bb` authenticates using **HTTP access tokens** — the standard token mechanism in Bitbucket Server / Data Center. These are _not_ the same as Bitbucket Cloud app passwords.

HTTP access tokens can be scoped at three levels:

- **User-level** — created under _Manage Account → HTTP Access Tokens_
- **Project-level** — created under _Project Settings → HTTP Access Tokens_
- **Repository-level** — created under _Repository Settings → HTTP Access Tokens_

### Login

Interactive:

```sh
bb auth login
```

Non-interactive (CI, scripts, agents):

```sh
bb auth login --hostname bitbucket.example.com --token <your-token>
```

For HTTP (non-TLS) instances:

```sh
bb auth login --hostname bitbucket.internal --token <token> --protocol http
```

### Check status

```sh
bb auth status
```

### Logout

```sh
bb auth logout
```

### Secure token storage

Tokens are stored in the **system keychain** when available:

- **macOS**: Keychain Access (via `security`)
- **Linux**: GNOME Keyring / KWallet (via `secret-tool` from `libsecret-tools`)

If no keychain is available, tokens fall back to `~/.config/bb/config.json`
(mode `0600`) with a warning. To migrate existing plaintext tokens after
installing a keychain:

```sh
bb auth migrate
```

Multiple hosts are supported.

## Usage

### Working with pull requests

`bb` detects the current repository and branch from your git working directory, just like `gh`.

```sh
# List open PRs
bb pr list

# View PR for current branch
bb pr view

# Create a PR from the current branch
bb pr create --title "My change" --reviewer jsmith

# Approve a PR
bb pr review --approve

# Merge
bb pr merge

# Watch a PR for activity (polls for updates)
bb pr watch
```

Specify a PR by number:

```sh
bb pr view 42
bb pr merge 42
bb pr diff 42
bb pr comment 42 --body "Looks good!"
```

Target a different repo with `-R`:

```sh
bb pr list -R PROJECT/repo-slug
```

### Working with repositories

```sh
# List repos (all, or filtered by project)
bb repo list
bb repo list --project MYPROJ

# View repo details
bb repo view

# Clone
bb repo clone PROJECT/my-repo
```

### Raw API access

Make authenticated requests to any Bitbucket Server REST endpoint:

```sh
# GET
bb api /rest/api/1.0/projects

# POST with fields
bb api /rest/api/1.0/projects/KEY/repos/slug/pull-requests \
  -X POST \
  -f title="My PR" \
  -f fromRef.id=refs/heads/feature

# Simple jq-style filtering
bb api /rest/api/1.0/projects --jq ".values[].key"
```

### JSON output

Most commands support `--json` for machine-readable output, useful for scripting and agent integrations:

```sh
bb pr list --json
bb pr view 42 --json
bb repo view --json
```

## Configuration

Auth config is stored at `~/.config/bb/config.json`:

```json
{
  "hosts": {
    "bitbucket.example.com": {
      "token": "...",
      "protocol": "https"
    }
  }
}
```

### Repository context cache

`bb` caches the resolved project and repository for each working directory in
`~/.bb-cli.json`. Once a command successfully resolves context (via git remote
or `--repo`), subsequent invocations from the same directory work without a
git remote or explicit flag.

```sh
# Inspect the cache
bb cache list

# Remove the entry for the current directory
bb cache delete

# Remove an entry for a specific path
bb cache delete /path/to/repo
```

## Command reference

```
bb auth login       Authenticate with a Bitbucket Server instance
bb auth logout      Remove authentication
bb auth status      Show authentication status
bb auth migrate     Migrate plaintext tokens to the system keychain

bb repo list        List repositories
bb repo view        View repository details
bb repo clone       Clone a repository

bb pr list          List pull requests
bb pr view          View a pull request
bb pr create        Create a pull request
bb pr merge         Merge a pull request
bb pr close         Decline (close) a pull request
bb pr checkout      Check out a PR branch locally
bb pr diff          View PR diff
bb pr comment       Comment on a pull request
bb pr review        Approve or request changes
bb pr watch         Watch for PR activity and status changes

bb api <endpoint>   Make an authenticated API request

bb cache list       List cached project/repo entries (~/.bb-cli.json)
bb cache delete     Delete a cached entry (defaults to CWD)

bb skill install    Install bb skill file for coding agents in this repo
```

Run `bb <command> --help` for detailed usage of any command.

## Coding agent skill files

`bb` can auto-generate skill/instruction files so that coding agents in your
repo know how to use the CLI. It detects which agents are configured by looking
for their marker directories and places the skill file in the right location.

### Supported agents

| Agent | Detection | Skill path |
|-------|-----------|------------|
| Claude Code | `.claude/` | `.claude/skills/bb/SKILL.md` |
| GitHub Copilot | `.github/` | `.github/instructions/bb.instructions.md` |
| Cursor | `.cursor/` or `.cursorrules` | `.cursor/rules/bb.md` |
| Windsurf | `.windsurfrules` or `.codeium/` | `.windsurf/rules/bb.md` |
| OpenAI Codex | `.codex/` or `AGENTS.md` | `.codex/skills/bb.md` |
| Amazon Q | `.amazonq/` | `.amazonq/rules/bb.md` |
| Augment Code | `.augment/` or `.augment-guidelines` | `.augment/rules/bb.md` |
| Roo Code / Cline | `.roo/` or `.clinerules` | `.roo/rules/bb.md` |

### Usage

```sh
# Auto-detect agents and install skill files
bb skill install

# See what agents are detected
bb skill install --list

# Install for a specific agent
bb skill install --agent claude
bb skill install --agent copilot

# Install for all detected agents
bb skill install --agent all

# Install for an agent not in the list — specify the target directory directly
bb skill install --path .my-agent/instructions

# Preview without writing files
bb skill install --dry-run

# Overwrite existing skill files
bb skill install --force
```

## Differences from `gh`

| Area | `gh` | `bb` |
|------|------|------|
| Auth | OAuth / personal access tokens | HTTP access tokens (Bearer) |
| Namespacing | `owner/repo` | `PROJECT/repo` |
| PR close | Closes | Declines (Bitbucket terminology) |
| Issues | Supported | Not available (Bitbucket Server uses Jira) |
| Gists | Supported | Not available |
| PR watch | Not built-in | `bb pr watch` polls for activity |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

## License

[MIT](LICENSE)
