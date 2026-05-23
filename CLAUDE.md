# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is this?

`bb` is a Bitbucket Server CLI modeled after GitHub's `gh`. It wraps the Bitbucket Server REST API and maps it to a familiar command structure. See [AGENTS.md](AGENTS.md) for full CLI usage reference.

## Development

- **Runtime:** Go 1.22+
- **Language:** Go (strict vet, no CGO required)
- **CLI framework:** [cobra](https://github.com/spf13/cobra)
- **Key dependencies:** `fatih/color` (ANSI), `zalando/go-keyring` (keychain), `charmbracelet/huh` (TUI login), `testify` (tests)

### Commands

```sh
go run . <command>                         # run locally
go build -o bb .                           # build binary
go test ./...                              # run all tests
go test ./internal/api/...                 # run a single package's tests
go vet ./...                               # static analysis
make build                                 # build with version injected from git tag
make build-all                             # cross-compile for darwin/linux × amd64/arm64
```

### Testing

Tests live in `internal/*/` and use `testify`. The API tests spin up a local `net/http` test server on a random port — no external services needed. All test files use `package <pkg>_test` (external test package style).

## Architecture

**Entry point:** `main.go` → `cmd.Execute()`

**Library layer** (`internal/`):
- `internal/api/` — `Client` struct: typed REST client with Bearer auth and generic `Paginate[T]()`. All BB Server types (`BBPullRequest`, `BBRepo`, etc.) are in `types.go`.
- `internal/context/` — `Resolve(opts Options) (*RepoContext, error)`: resolves the current repo context via three fallbacks: explicit `-R` flag → git remote parsing → `~/.bb.json` cache. `ParseRemoteURL()` handles HTTPS, SSH, and SCP-style Bitbucket URLs.
- `internal/config/` — Manages `~/.config/bb/config.json`. Tokens stored via `TokenStore` interface — keyring-backed (`keychain.go`) with file fallback.
- `internal/cache/` — Per-directory project/repo cache at `~/.bb.json` so subsequent commands skip git remote parsing.
- `internal/format/` — Terminal output helpers: relative dates, ANSI-colored state labels, `PrintTable()`, `Fatal()`.

**Command layer** (`cmd/`): one file per subcommand group, using cobra. Every command follows the same pattern: parse flags → `bbcontext.Resolve()` → call `internal/api` methods → format output (or `--json` for raw JSON).

**Key pattern for adding commands:** create a new `cmd/<group>_<subcommand>.go`, define a `cobra.Command` var, register it in the group's `init()` in `cmd/<group>.go`.

**Version injection:** `var version = "dev"` in `cmd/root.go` is overridden at build time:
```sh
go build -ldflags "-X github.com/nwp/bb/cmd.version=$(git describe --tags)" -o bb .
```
