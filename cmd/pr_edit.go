package cmd

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/nwp/bb/internal/api"
	bbcontext "github.com/nwp/bb/internal/context"
	"github.com/spf13/cobra"
)

var prEditCmd = &cobra.Command{
	Use:   "edit [number]",
	Short: "Edit a pull request",
	Args:  cobra.MaximumNArgs(1),
	RunE:  runPREdit,
}

var prEditFlags struct {
	title           string
	body            string
	base            string
	addReviewers    []string
	removeReviewers []string
	repo            string
	json            bool
}

func init() {
	prEditCmd.Flags().StringVarP(&prEditFlags.title, "title", "t", "", "New title")
	prEditCmd.Flags().StringVarP(&prEditFlags.body, "body", "b", "", "New description")
	prEditCmd.Flags().StringVarP(&prEditFlags.base, "base", "B", "", "New base branch")
	prEditCmd.Flags().StringArrayVar(&prEditFlags.addReviewers, "add-reviewer", nil, "Add reviewer (repeatable)")
	prEditCmd.Flags().StringArrayVar(&prEditFlags.removeReviewers, "remove-reviewer", nil, "Remove reviewer (repeatable)")
	prEditCmd.Flags().StringVarP(&prEditFlags.repo, "repo", "R", "", "Repository context (PROJECT/repo)")
	prEditCmd.Flags().BoolVar(&prEditFlags.json, "json", false, "Output as JSON")
}

func runPREdit(cmd *cobra.Command, args []string) error {
	ctx, err := bbcontext.Resolve(bbcontext.Options{RepoFlag: prEditFlags.repo})
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

	body := api.UpdatePRBody{Version: pr.Version}

	if prEditFlags.title != "" {
		body.Title = prEditFlags.title
	} else {
		body.Title = pr.Title
	}
	if prEditFlags.body != "" {
		body.Description = prEditFlags.body
	} else {
		body.Description = pr.Description
	}
	if prEditFlags.base != "" {
		toRef := &api.CreatePRRef{
			ID: "refs/heads/" + prEditFlags.base,
			Repository: api.CreatePRRefRepo{
				Slug:    ctx.Repo,
				Project: api.CreatePRProject{Key: ctx.Project},
			},
		}
		body.ToRef = toRef
	}

	// Merge reviewers: start with existing, add new, remove unwanted.
	remove := make(map[string]bool)
	for _, r := range prEditFlags.removeReviewers {
		remove[r] = true
	}
	reviewerSet := make(map[string]bool)
	for _, r := range pr.Reviewers {
		if !remove[r.User.Slug] {
			reviewerSet[r.User.Slug] = true
		}
	}
	for _, r := range prEditFlags.addReviewers {
		reviewerSet[r] = true
	}
	var reviewers []api.UserSlug
	for slug := range reviewerSet {
		var us api.UserSlug
		us.User.Slug = slug
		reviewers = append(reviewers, us)
	}
	body.Reviewers = reviewers

	updated, err := ctx.API.UpdatePR(context.Background(), ctx.Project, ctx.Repo, id, body)
	if err != nil {
		return err
	}

	if prEditFlags.json {
		return json.NewEncoder(cmd.OutOrStdout()).Encode(updated)
	}
	fmt.Fprintf(cmd.OutOrStdout(), "Updated pull request #%d\n", updated.ID)
	return nil
}
