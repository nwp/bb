package cmd

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	bbcontext "github.com/nwp/bb/internal/context"
	"github.com/nwp/bb/internal/format"
	"github.com/spf13/cobra"
)

var prChecksCmd = &cobra.Command{
	Use:   "checks [number]",
	Short: "View CI/build status for a pull request",
	Args:  cobra.MaximumNArgs(1),
	RunE:  runPRChecks,
}

var prChecksFlags struct {
	repo  string
	json  bool
	watch bool
}

func init() {
	prChecksCmd.Flags().StringVarP(&prChecksFlags.repo, "repo", "R", "", "Repository context (PROJECT/repo)")
	prChecksCmd.Flags().BoolVar(&prChecksFlags.json, "json", false, "Output as JSON")
	prChecksCmd.Flags().BoolVarP(&prChecksFlags.watch, "watch", "w", false, "Watch and re-poll until all checks complete")
}

func runPRChecks(cmd *cobra.Command, args []string) error {
	ctx, err := bbcontext.Resolve(bbcontext.Options{RepoFlag: prChecksFlags.repo})
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
	commitSHA := pr.FromRef.LatestCommit

	printChecks := func() (bool, error) {
		statuses, err := ctx.API.GetBuildStatus(context.Background(), commitSHA)
		if err != nil {
			return false, err
		}
		if prChecksFlags.json {
			return true, json.NewEncoder(cmd.OutOrStdout()).Encode(statuses)
		}

		if len(statuses) == 0 {
			fmt.Fprintln(cmd.OutOrStdout(), "No build statuses found")
			return true, nil
		}

		var rows [][]string
		allDone := true
		for _, s := range statuses {
			if s.State == "INPROGRESS" {
				allDone = false
			}
			rows = append(rows, []string{
				format.StateColor(s.State),
				s.Name,
				s.URL,
			})
		}
		format.PrintTable(cmd.OutOrStdout(), rows)
		return allDone, nil
	}

	if !prChecksFlags.watch {
		_, err := printChecks()
		return err
	}

	// Watch mode.
	for {
		done, err := printChecks()
		if err != nil {
			fmt.Fprintf(cmd.ErrOrStderr(), "polling error: %v\n", err)
		}
		if done {
			return nil
		}
		time.Sleep(10 * time.Second)
		// Clear last output lines by reprinting header.
		fmt.Fprintln(cmd.OutOrStdout())
	}
}
