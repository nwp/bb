package cmd

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/nwp/bb/internal/api"
	bbcontext "github.com/nwp/bb/internal/context"
	"github.com/spf13/cobra"
)

// prMergeCmd, prCloseCmd, prReopenCmd, prReadyCmd all follow the same
// "fetch version → mutate" pattern.

var prMergeCmd = &cobra.Command{
	Use:   "merge [number]",
	Short: "Merge a pull request",
	Args:  cobra.MaximumNArgs(1),
	RunE:  runPRMerge,
}

var prMergeFlags struct {
	repo string
	json bool
}

func init() {
	prMergeCmd.Flags().StringVarP(&prMergeFlags.repo, "repo", "R", "", "Repository context (PROJECT/repo)")
	prMergeCmd.Flags().BoolVar(&prMergeFlags.json, "json", false, "Output as JSON")
}

func runPRMerge(cmd *cobra.Command, args []string) error {
	ctx, err := bbcontext.Resolve(bbcontext.Options{RepoFlag: prMergeFlags.repo})
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
	pr, err := ctx.API.GetPR(context.Background(), ctx.Project, ctx.Repo, id)
	if err != nil {
		return err
	}
	merged, err := ctx.API.MergePR(context.Background(), ctx.Project, ctx.Repo, id, pr.Version)
	if err != nil {
		return err
	}
	if prMergeFlags.json {
		return json.NewEncoder(cmd.OutOrStdout()).Encode(merged)
	}
	fmt.Fprintf(cmd.OutOrStdout(), "Merged pull request #%d\n", merged.ID)
	return nil
}

// — Close (decline) —

var prCloseCmd = &cobra.Command{
	Use:   "close [number]",
	Short: "Close (decline) a pull request",
	Args:  cobra.MaximumNArgs(1),
	RunE:  runPRClose,
}

var prCloseFlags struct {
	repo string
	json bool
}

func init() {
	prCloseCmd.Flags().StringVarP(&prCloseFlags.repo, "repo", "R", "", "Repository context (PROJECT/repo)")
	prCloseCmd.Flags().BoolVar(&prCloseFlags.json, "json", false, "Output as JSON")
}

func runPRClose(cmd *cobra.Command, args []string) error {
	ctx, err := bbcontext.Resolve(bbcontext.Options{RepoFlag: prCloseFlags.repo})
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
	pr, err := ctx.API.GetPR(context.Background(), ctx.Project, ctx.Repo, id)
	if err != nil {
		return err
	}
	declined, err := ctx.API.DeclinePR(context.Background(), ctx.Project, ctx.Repo, id, pr.Version)
	if err != nil {
		return err
	}
	if prCloseFlags.json {
		return json.NewEncoder(cmd.OutOrStdout()).Encode(declined)
	}
	fmt.Fprintf(cmd.OutOrStdout(), "Closed pull request #%d\n", declined.ID)
	return nil
}

// — Reopen —

var prReopenCmd = &cobra.Command{
	Use:   "reopen <number>",
	Short: "Reopen a declined pull request",
	Args:  cobra.ExactArgs(1),
	RunE:  runPRReopen,
}

var prReopenFlags struct {
	repo string
	json bool
}

func init() {
	prReopenCmd.Flags().StringVarP(&prReopenFlags.repo, "repo", "R", "", "Repository context (PROJECT/repo)")
	prReopenCmd.Flags().BoolVar(&prReopenFlags.json, "json", false, "Output as JSON")
}

func runPRReopen(cmd *cobra.Command, args []string) error {
	ctx, err := bbcontext.Resolve(bbcontext.Options{RepoFlag: prReopenFlags.repo})
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
	reopened, err := ctx.API.ReopenPR(context.Background(), ctx.Project, ctx.Repo, id, pr.Version)
	if err != nil {
		return err
	}
	if prReopenFlags.json {
		return json.NewEncoder(cmd.OutOrStdout()).Encode(reopened)
	}
	fmt.Fprintf(cmd.OutOrStdout(), "Reopened pull request #%d\n", reopened.ID)
	return nil
}

// — Ready —

var prReadyCmd = &cobra.Command{
	Use:   "ready [number]",
	Short: "Mark a draft pull request as ready for review",
	Args:  cobra.MaximumNArgs(1),
	RunE:  runPRReady,
}

var prReadyFlags struct {
	repo string
	json bool
}

func init() {
	prReadyCmd.Flags().StringVarP(&prReadyFlags.repo, "repo", "R", "", "Repository context (PROJECT/repo)")
	prReadyCmd.Flags().BoolVar(&prReadyFlags.json, "json", false, "Output as JSON")
}

func runPRReady(cmd *cobra.Command, args []string) error {
	ctx, err := bbcontext.Resolve(bbcontext.Options{RepoFlag: prReadyFlags.repo})
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
	pr, err := ctx.API.GetPR(context.Background(), ctx.Project, ctx.Repo, id)
	if err != nil {
		return err
	}
	draftFalse := false
	updateBody := api.UpdatePRBody{
		Version:     pr.Version,
		Title:       pr.Title,
		Description: pr.Description,
		Draft:       &draftFalse,
	}
	updated, err := ctx.API.UpdatePR(context.Background(), ctx.Project, ctx.Repo, id, updateBody)
	if err != nil {
		return err
	}
	if prReadyFlags.json {
		return json.NewEncoder(cmd.OutOrStdout()).Encode(updated)
	}
	fmt.Fprintf(cmd.OutOrStdout(), "Pull request #%d is now ready for review\n", updated.ID)
	return nil
}
