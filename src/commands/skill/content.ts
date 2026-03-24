/**
 * Generates the skill/instruction content for a given agent.
 * The core content is the same — only the preamble varies slightly
 * to match each agent's conventions.
 */

import type { AgentDef } from "./agents.js";

export function generateSkillContent(agent: AgentDef): string {
  // Claude Code SKILL.md has a specific frontmatter format
  if (agent.id === "claude") {
    return `---
name: bb
description: Interact with Bitbucket Server (pull requests, repos, code review)
---

${CORE_CONTENT}`;
  }

  // GitHub Copilot instructions use a heading + applyTo pattern
  if (agent.id === "copilot") {
    return `---
applyTo: "**"
---

${CORE_CONTENT}`;
  }

  // All others use plain markdown
  return CORE_CONTENT;
}

const CORE_CONTENT = `# bb — Bitbucket Server CLI

\`bb\` is a CLI for Bitbucket Server / Data Center, modeled after GitHub's \`gh\`.
Use it to manage pull requests, repositories, and code review from the terminal.

## Authentication

\`bb\` authenticates using HTTP access tokens (Bearer auth). Before any operation,
ensure authentication is configured:

\`\`\`sh
# Check if already authenticated
bb auth status

# Login (non-interactive — preferred for agents and scripts)
bb auth login --hostname bitbucket.example.com --token "$BB_TOKEN"

# For HTTP (non-TLS) instances
bb auth login --hostname bitbucket.internal --token "$BB_TOKEN" --protocol http
\`\`\`

Credentials are stored in \`~/.config/bb/config.json\`.

## Repository context

\`bb\` auto-detects the project and repository from the current git remote
(\`origin\`). Most commands work without arguments inside a cloned Bitbucket
Server repo. Override with \`-R PROJECT/repo-slug\`.

## Pull request workflow

\`\`\`sh
# List open PRs
bb pr list

# View PR for current branch (or by number)
bb pr view
bb pr view 42

# Create a PR from the current branch
bb pr create --title "Description" --body "Details"
bb pr create --title "Fix bug" --reviewer jsmith --reviewer adoe
bb pr create --title "Backport" --base release/2.0

# Review
bb pr review 42 --approve
bb pr review 42 --request-changes
bb pr review 42 --body "Comment text"

# Merge
bb pr merge 42

# Decline (close)
bb pr close 42

# View diff
bb pr diff 42

# Comment
bb pr comment 42 --body "Looks good!"

# Check out PR branch locally
bb pr checkout 42

# Watch for activity (polls until merged/declined)
bb pr watch 42
\`\`\`

## Repository operations

\`\`\`sh
bb repo list                    # List all repos
bb repo list --project MYPROJ   # Filter by project
bb repo view                    # View current repo
bb repo clone PROJECT/my-repo   # Clone a repo
\`\`\`

## Raw API access

For operations not covered by built-in commands:

\`\`\`sh
# GET
bb api /rest/api/1.0/projects

# POST with fields
bb api /rest/api/1.0/projects/KEY/repos/slug/pull-requests \\
  -X POST -f title="PR title" -f description="Body"

# Filter output
bb api /rest/api/1.0/projects --jq ".values[].key"
\`\`\`

## JSON output

Use \`--json\` for machine-readable output:

\`\`\`sh
bb pr list --json
bb pr view 42 --json
bb repo list --json
\`\`\`

## Mapping from \`gh\` to \`bb\`

| \`gh\` command | \`bb\` equivalent | Notes |
|--------------|-----------------|-------|
| \`gh auth login\` | \`bb auth login --token\` | HTTP access tokens, not OAuth |
| \`gh pr list\` | \`bb pr list\` | |
| \`gh pr create\` | \`bb pr create\` | |
| \`gh pr merge\` | \`bb pr merge\` | |
| \`gh pr close\` | \`bb pr close\` | Calls decline in Bitbucket |
| \`gh pr view\` | \`bb pr view\` | |
| \`gh pr diff\` | \`bb pr diff\` | |
| \`gh pr checkout\` | \`bb pr checkout\` | |
| \`gh pr review --approve\` | \`bb pr review --approve\` | |
| \`gh repo list\` | \`bb repo list\` | |
| \`gh repo clone\` | \`bb repo clone\` | |
| \`gh api\` | \`bb api\` | |

## Key differences

- Repos are namespaced as \`PROJECT/repo\` (not \`owner/repo\`)
- Issues are not available (Bitbucket Server uses Jira)
- Auth uses HTTP access tokens with Bearer header
- \`bb pr close\` declines the PR (Bitbucket terminology)
`;
