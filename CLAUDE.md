# Claude Code instructions for this repository

This repository contains `bb`, a Bitbucket Server CLI modeled after GitHub's `gh`.

## Development

- Runtime: Bun
- Language: TypeScript (strict mode)
- CLI framework: Commander.js
- No test framework yet — run `bun run typecheck` to verify types

### Project structure

```
bin/bb.ts              Entry point
src/lib/api.ts         Bitbucket Server REST API client
src/lib/config.ts      Config management (~/.config/bb/)
src/lib/context.ts     Git context detection (project/repo from remote)
src/lib/format.ts      Terminal output formatting
src/commands/auth/     Auth commands (login, logout, status)
src/commands/repo/     Repo commands (list, view, clone)
src/commands/pr/       PR commands (list, view, create, merge, checkout, close, diff, comment, review, watch)
src/commands/api/      Raw API command
```

### Running locally

```sh
bun run bin/bb.ts <command>
```

### Type checking

```sh
bun run typecheck
```

## Using `bb` as a tool

If you need to interact with Bitbucket Server during a task, use `bb` the same
way you would use `gh` for GitHub. See [AGENTS.md](AGENTS.md) for full usage
reference.

Key patterns:
- `bb pr create --title "..." --body "..."` to open PRs
- `bb pr list --json` for machine-readable PR lists
- `bb pr view --json` to inspect the current branch's PR
- `bb api <endpoint>` for anything not covered by built-in commands
