package cmd

import (
	"io"
	"os"
	"os/exec"

	"github.com/nwp/bb/internal/api"
	"github.com/nwp/bb/internal/config"
)

// newAPIClient creates an API client from a resolved host configuration.
func newAPIClient(rh *config.ResolvedHost) *api.Client {
	return api.NewClient(rh.Hostname, rh.Token, rh.Protocol)
}

// runGit executes a git sub-command, streaming output to w.
func runGit(w io.Writer, args ...string) error {
	c := exec.Command("git", args...)
	c.Stdout = w
	c.Stderr = os.Stderr
	c.Stdin = os.Stdin
	return c.Run()
}
