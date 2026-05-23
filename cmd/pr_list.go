package cmd

import (
	"context"
	"encoding/json"
	"fmt"

	bbcontext "github.com/nwp/bb/internal/context"
	"github.com/nwp/bb/internal/format"
	"github.com/spf13/cobra"
)

var prListCmd = &cobra.Command{
	Use:   "list",
	Short: "List pull requests",
	RunE:  runPRList,
}

var prListFlags struct {
	state string
	limit int
	repo  string
	json  bool
}

func init() {
	prListCmd.Flags().StringVarP(&prListFlags.state, "state", "s", "OPEN", "PR state: OPEN, MERGED, DECLINED, ALL")
	prListCmd.Flags().IntVarP(&prListFlags.limit, "limit", "L", 30, "Maximum number of pull requests to list")
	prListCmd.Flags().StringVarP(&prListFlags.repo, "repo", "R", "", "Repository context (PROJECT/repo)")
	prListCmd.Flags().BoolVar(&prListFlags.json, "json", false, "Output as JSON")
}

func runPRList(cmd *cobra.Command, _ []string) error {
	ctx, err := bbcontext.Resolve(bbcontext.Options{RepoFlag: prListFlags.repo})
	if err != nil {
		return err
	}

	prs, err := ctx.API.ListPRs(context.Background(), ctx.Project, ctx.Repo, prListFlags.state)
	if err != nil {
		return err
	}

	if len(prs) > prListFlags.limit {
		prs = prs[:prListFlags.limit]
	}

	if prListFlags.json {
		return json.NewEncoder(cmd.OutOrStdout()).Encode(prs)
	}

	if len(prs) == 0 {
		fmt.Fprintf(cmd.OutOrStdout(), "No %s pull requests in %s/%s\n", prListFlags.state, ctx.Project, ctx.Repo)
		return nil
	}

	var rows [][]string
	for _, pr := range prs {
		rows = append(rows, []string{
			fmt.Sprintf("#%d", pr.ID),
			format.StateColor(pr.State),
			format.Truncate(pr.Title, 60),
			pr.Author.User.DisplayName,
			format.FormatDate(pr.UpdatedDate),
		})
	}
	format.PrintTable(cmd.OutOrStdout(), rows)
	return nil
}
