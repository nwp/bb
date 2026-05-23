package cmd

import (
	"context"
	"fmt"
	"os/exec"

	bbcontext "github.com/nwp/bb/internal/context"
	"github.com/spf13/cobra"
)

var prCheckoutCmd = &cobra.Command{
	Use:   "checkout <number>",
	Short: "Check out a pull request branch",
	Args:  cobra.ExactArgs(1),
	RunE:  runPRCheckout,
}

var prCheckoutRepo string

func init() {
	prCheckoutCmd.Flags().StringVarP(&prCheckoutRepo, "repo", "R", "", "Repository context (PROJECT/repo)")
}

func runPRCheckout(cmd *cobra.Command, args []string) error {
	ctx, err := bbcontext.Resolve(bbcontext.Options{RepoFlag: prCheckoutRepo})
	if err != nil {
		return err
	}
	id, err := bbcontext.ResolvePRID(context.Background(), ctx.API, ctx.Project, ctx.Repo, args[0])
	if err != nil {
		return err
	}
	pr, err := ctx.API.GetPR(context.Background(), ctx.Project, ctx.Repo, id)
	if err != nil {
		return err
	}

	branch := pr.FromRef.DisplayID

	// Try direct checkout first.
	if err := exec.Command("git", "checkout", branch).Run(); err == nil {
		fmt.Fprintf(cmd.OutOrStdout(), "Switched to branch '%s'\n", branch)
		return nil
	}

	// Fallback: fetch the branch and create a local tracking branch.
	remote := "origin"
	refSpec := fmt.Sprintf("refs/heads/%s:refs/remotes/%s/%s", branch, remote, branch)
	if err := exec.Command("git", "fetch", remote, refSpec).Run(); err != nil {
		return fmt.Errorf("fetching branch %q: %w", branch, err)
	}
	trackRef := fmt.Sprintf("%s/%s", remote, branch)
	if err := exec.Command("git", "checkout", "-b", branch, "--track", trackRef).Run(); err != nil {
		return fmt.Errorf("creating tracking branch: %w", err)
	}
	fmt.Fprintf(cmd.OutOrStdout(), "Switched to new branch '%s'\n", branch)
	return nil
}

var prDiffCmd = &cobra.Command{
	Use:   "diff [number]",
	Short: "Show the diff for a pull request",
	Args:  cobra.MaximumNArgs(1),
	RunE:  runPRDiff,
}

var prDiffRepo string

func init() {
	prDiffCmd.Flags().StringVarP(&prDiffRepo, "repo", "R", "", "Repository context (PROJECT/repo)")
}

func runPRDiff(cmd *cobra.Command, args []string) error {
	ctx, err := bbcontext.Resolve(bbcontext.Options{RepoFlag: prDiffRepo})
	if err != nil {
		return err
	}
	var numberArg string
	if len(args) > 0 {
		numberArg = args[0]
	}
	id, err := bbcontext.ResolvePRID(context.Background(), ctx.API, ctx.Project, ctx.Repo, numberArg)
	if err != nil {
		return err
	}
	diff, err := ctx.API.GetPRDiff(context.Background(), ctx.Project, ctx.Repo, id)
	if err != nil {
		return err
	}
	fmt.Fprint(cmd.OutOrStdout(), diff)
	return nil
}
