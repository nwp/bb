package cmd

import (
	"context"
	"encoding/json"
	"fmt"

	bbcontext "github.com/nwp/bb/internal/context"
	"github.com/nwp/bb/internal/format"
	"github.com/spf13/cobra"
)

var prViewCmd = &cobra.Command{
	Use:   "view [number]",
	Short: "View a pull request",
	Args:  cobra.MaximumNArgs(1),
	RunE:  runPRView,
}

var prViewFlags struct {
	repo string
	json bool
}

func init() {
	prViewCmd.Flags().StringVarP(&prViewFlags.repo, "repo", "R", "", "Repository context (PROJECT/repo)")
	prViewCmd.Flags().BoolVar(&prViewFlags.json, "json", false, "Output as JSON")
}

func runPRView(cmd *cobra.Command, args []string) error {
	ctx, err := bbcontext.Resolve(bbcontext.Options{RepoFlag: prViewFlags.repo})
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

	if prViewFlags.json {
		return json.NewEncoder(cmd.OutOrStdout()).Encode(pr)
	}

	w := cmd.OutOrStdout()
	fmt.Fprintf(w, "#%d %s\n", pr.ID, pr.Title)
	fmt.Fprintf(w, "  State:  %s\n", format.StateColor(pr.State))
	fmt.Fprintf(w, "  Author: %s\n", pr.Author.User.DisplayName)
	fmt.Fprintf(w, "  From:   %s → %s\n", pr.FromRef.DisplayID, pr.ToRef.DisplayID)
	fmt.Fprintf(w, "  Created: %s\n", format.FormatDate(pr.CreatedDate))
	fmt.Fprintf(w, "  Updated: %s\n", format.FormatDate(pr.UpdatedDate))
	if pr.Draft {
		fmt.Fprintln(w, "  Draft: yes")
	}
	if pr.Description != "" {
		fmt.Fprintf(w, "\n%s\n", pr.Description)
	}
	if len(pr.Reviewers) > 0 {
		fmt.Fprintln(w, "\nReviewers:")
		for _, r := range pr.Reviewers {
			fmt.Fprintf(w, "  %s — %s\n", r.User.DisplayName, format.StateColor(r.Status))
		}
	}
	return nil
}
