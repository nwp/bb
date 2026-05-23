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

When suggesting fixes to the user, prefer concise checks:

\`\`\`sh
# Show auth + connectivity per host
bb auth status

# Raw authenticated API smoke test
bb api /rest/api/1.0/application-properties
\`\`\`

## Repository context

Bitbucket Server uses **project keys** (always UPPERCASE, e.g. \`PROJ\`, \`DEV\`,
\`INFRA\`) to namespace repositories. When passing \`-R\`, use the project key,
not the project name: \`-R PROJ/my-repo\`.

\`bb\` resolves the project and repository automatically:

1. Explicit \`-R PROJECT/repo-slug\` flag
2. Auto-detect from the current git remote (\`origin\`)
3. **Cached value from \`~/.bb.json\`** — the first successful resolution
   caches hostname, project key, and repo slug for the working directory.
   Subsequent commands reuse the cache automatically.

**You do not need to discover or pass the project/repo on every command.**
Run any \`bb\` command once from the repo directory and the context is cached.

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

# gh-style autofill from latest commit
bb pr create --fill

# Use body content from a file (or stdin)
bb pr create --title "Release notes" --body-file ./PR_BODY.md
cat ./PR_BODY.md | bb pr create --title "Release notes" --body-file -

# Use a template file
bb pr create --title "Release notes" --template .github/PULL_REQUEST_TEMPLATE.md

# Edit a PR (title, description, base branch, reviewers)
bb pr edit 42 --title "New title" --body "New description"
bb pr edit 42 --add-reviewer jsmith --remove-reviewer adoe
bb pr edit 42 --base develop

# Mark a draft PR as ready for review
bb pr ready 42

# Review
bb pr review 42 --approve
bb pr review 42 --request-changes

# Merge
bb pr merge 42

# Decline (close) and reopen
bb pr close 42
bb pr reopen 42

# View diff
bb pr diff 42

# Comment
bb pr comment 42 --body "Looks good!"

# Check out PR branch locally
bb pr checkout 42

# Check CI/build status
bb pr checks 42
bb pr checks 42 --watch      # poll until all checks complete

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
| \`gh pr list\` | \`bb pr list\` | |
| \`gh pr create\` | \`bb pr create\` | |
| \`gh pr edit\` | \`bb pr edit\` | Title, description, base, reviewers |
| \`gh pr ready\` | \`bb pr ready\` | Mark draft as ready |
| \`gh pr merge\` | \`bb pr merge\` | |
| \`gh pr close\` | \`bb pr close\` | Calls decline in Bitbucket |
| \`gh pr reopen\` | \`bb pr reopen\` | Reopen a declined PR |
| \`gh pr view\` | \`bb pr view\` | |
| \`gh pr diff\` | \`bb pr diff\` | |
| \`gh pr checks\` | \`bb pr checks\` | CI/build status |
| \`gh pr checkout\` | \`bb pr checkout\` | |
| \`gh pr review --approve\` | \`bb pr review --approve\` | |
| \`gh repo list\` | \`bb repo list\` | |
| \`gh repo clone\` | \`bb repo clone\` | |

## Key differences

- Repos are namespaced as \`PROJECT/repo\` (not \`owner/repo\`)
- Issues are not available (Bitbucket Server uses Jira)
- Auth uses HTTP access tokens with Bearer header
- \`bb pr close\` declines the PR (Bitbucket terminology)
`;
