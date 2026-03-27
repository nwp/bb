import type { AgentDef } from "./agents.js";

const FRONTMATTER = `---
name: bb
description: CLI for Bitbucket Server / Data Center, modeled after GitHub's \`gh\`. Use it to manage pull requests, repositories, and code review from the terminal.
---`;

export function generateSkillContent(_agent: AgentDef): string {
  return `${FRONTMATTER}

${CORE_CONTENT}`;
}

const CORE_CONTENT = `# bb — Bitbucket Server CLI

\`bb\` is a CLI for Bitbucket Server / Data Center, modeled after GitHub's \`gh\`.
Use it to manage pull requests, repositories, and code review from the terminal.

## Authentication

The user handles authentication themselves. **Never run \`bb auth login\`,
\`bb auth logout\`, \`bb auth status\`, or \`bb auth migrate\`.** These commands
require interactive input or expose tokens, and calling them wastes time.
If a \`bb\` command fails with an auth error, tell the user to run
\`bb auth login\` — do not run it for them.

## Repository context

\`bb\` resolves the project and repository using the following priority order:

1. Explicit \`-R PROJECT/repo-slug\` flag
2. Auto-detect from the current git remote (\`origin\`)
3. **Cached value from \`~/.bb-cli.json\`** — whenever a command successfully
   resolves a project/repo (via git remote or \`-R\`), the result is cached
   keyed by the working directory path. Subsequent invocations from the same
   directory reuse the cache automatically.

This means **you do not need to discover or pass the project/repo on every
command**. Run any \`bb\` command once from the repo directory and the context
is cached for future calls. Use \`bb cache list\` to inspect cached entries and
\`bb cache delete\` to remove a stale entry.

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
