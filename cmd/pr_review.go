package cmd

import (
	"context"
	"encoding/json"
	"fmt"

	bbcontext "github.com/nwp/bb/internal/context"
	"github.com/spf13/cobra"
)

var prCommentCmd = &cobra.Command{
	Use:   "comment <number>",
	Short: "Add a comment to a pull request",
	Args:  cobra.ExactArgs(1),
	RunE:  runPRComment,
}

var prCommentFlags struct {
	body string
	repo string
	json bool
}

func init() {
	prCommentCmd.Flags().StringVarP(&prCommentFlags.body, "body", "b", "", "Comment text (required)")
	prCommentCmd.Flags().StringVarP(&prCommentFlags.repo, "repo", "R", "", "Repository context (PROJECT/repo)")
	prCommentCmd.Flags().BoolVar(&prCommentFlags.json, "json", false, "Output as JSON")
	_ = prCommentCmd.MarkFlagRequired("body")
}

func runPRComment(cmd *cobra.Command, args []string) error {
	ctx, err := bbcontext.Resolve(bbcontext.Options{RepoFlag: prCommentFlags.repo})
	if err != nil {
		return err
	}
	id, err := bbcontext.ResolvePRID(context.Background(), ctx.API, ctx.Project, ctx.Repo, args[0])
	if err != nil {
		return err
	}
	comment, err := ctx.API.AddPRComment(context.Background(), ctx.Project, ctx.Repo, id, prCommentFlags.body)
	if err != nil {
		return err
	}
	if prCommentFlags.json {
		return json.NewEncoder(cmd.OutOrStdout()).Encode(comment)
	}
	fmt.Fprintf(cmd.OutOrStdout(), "Added comment #%d to pull request #%d\n", comment.ID, id)
	return nil
}

var prReviewCmd = &cobra.Command{
	Use:   "review [number]",
	Short: "Approve or request changes on a pull request",
	Args:  cobra.MaximumNArgs(1),
	RunE:  runPRReview,
}

var prReviewFlags struct {
	approve        bool
	requestChanges bool
	body           string
	repo           string
}

func init() {
	prReviewCmd.Flags().BoolVar(&prReviewFlags.approve, "approve", false, "Approve the pull request")
	prReviewCmd.Flags().BoolVar(&prReviewFlags.requestChanges, "request-changes", false, "Request changes on the pull request")
	prReviewCmd.Flags().StringVarP(&prReviewFlags.body, "body", "b", "", "Review comment")
	prReviewCmd.Flags().StringVarP(&prReviewFlags.repo, "repo", "R", "", "Repository context (PROJECT/repo)")
}

func runPRReview(cmd *cobra.Command, args []string) error {
	if prReviewFlags.approve && prReviewFlags.requestChanges {
		return fmt.Errorf("--approve and --request-changes are mutually exclusive")
	}

	ctx, err := bbcontext.Resolve(bbcontext.Options{RepoFlag: prReviewFlags.repo})
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

	// View-only mode: no flags provided.
	if !prReviewFlags.approve && !prReviewFlags.requestChanges {
		pr, err := ctx.API.GetPR(context.Background(), ctx.Project, ctx.Repo, id)
		if err != nil {
			return err
		}
		fmt.Fprintf(cmd.OutOrStdout(), "Pull request #%d — %s\n", pr.ID, pr.Title)
		fmt.Fprintln(cmd.OutOrStdout(), "Reviewers:")
		for _, r := range pr.Reviewers {
			fmt.Fprintf(cmd.OutOrStdout(), "  %s — %s\n", r.User.DisplayName, r.Status)
		}
		return nil
	}

	// Optional comment first.
	if prReviewFlags.body != "" {
		if _, err := ctx.API.AddPRComment(context.Background(), ctx.Project, ctx.Repo, id, prReviewFlags.body); err != nil {
			return fmt.Errorf("adding review comment: %w", err)
		}
	}

	if prReviewFlags.approve {
		if err := ctx.API.ApprovePR(context.Background(), ctx.Project, ctx.Repo, id); err != nil {
			return err
		}
		fmt.Fprintf(cmd.OutOrStdout(), "Approved pull request #%d\n", id)
	} else {
		if err := ctx.API.RequestPRChanges(context.Background(), ctx.Project, ctx.Repo, id); err != nil {
			return err
		}
		fmt.Fprintf(cmd.OutOrStdout(), "Requested changes on pull request #%d\n", id)
	}
	return nil
}
