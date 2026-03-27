# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is this?

`bb` is a Bitbucket Server CLI modeled after GitHub's `gh`. It wraps the Bitbucket Server REST API and maps it to a familiar command structure. See [AGENTS.md](AGENTS.md) for full CLI usage reference.

## Development

- **Runtime:** Bun
- **Language:** TypeScript (strict mode)
- **CLI framework:** Commander.js
- **Dependencies:** chalk (colors), open (browser URLs)

### Commands

```sh
bun run bin/bb.ts <command>   # run locally
bun test                      # run all tests
bun test src/lib/__tests__/api.test.ts  # run a single test file
bun run typecheck             # type check only
bun build bin/bb.ts --compile --outfile bb  # build standalone binary
```

### Testing

Tests live in `src/lib/__tests__/` and cover the core library layer. The API tests spin up a local `Bun.serve()` mock server on a random port — no external services needed. Use `bun:test` imports (`describe`, `test`, `expect`, `beforeAll`, `afterAll`).

## Architecture

**Entry point:** `bin/bb.ts` — creates the root Commander program and registers all command groups.

**Library layer** (`src/lib/`):
- `api.ts` — `BitbucketAPI` class: typed REST client with Bearer auth, auto-pagination (`paginate<T>`), and convenience methods for projects, repos, and PRs. All BB Server types (`BBPullRequest`, `BBRepo`, etc.) are defined here.
- `context.ts` — `resolveContext()`: resolves the current repo context via three fallbacks: explicit `-R` flag → git remote parsing → `~/.bb.json` cache. `parseRemoteUrl()` handles HTTPS, SSH, and SCP-style Bitbucket URLs.
- `config.ts` — Manages `~/.config/bb/config.json`. Auth tokens are stored in the OS keychain when available (macOS Keychain / Linux libsecret), falling back to the config file.
- `keychain.ts` — Platform-specific keychain backends (macOS `security` CLI, Linux `secret-tool`). Cached singleton detection.
- `repo-cache.ts` — Per-directory project/repo cache at `~/.bb.json` so subsequent commands skip git remote parsing.
- `format.ts` — Terminal output helpers: relative dates, ANSI-colored state labels, table alignment with `printTable()`, `fatal()` for error-and-exit.

**Command layer** (`src/commands/`): each group (`auth/`, `repo/`, `pr/`, `api/`, `cache/`, `skill/`) has an `index.ts` that registers subcommands. Every command follows the same pattern: parse options → `resolveContext()` → call `BitbucketAPI` methods → format output (or `--json` for raw JSON).

**Key pattern for adding commands:** create a new file in the appropriate command group, export a `Command`, and register it in the group's `index.ts`.
