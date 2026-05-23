package cmd

import (
	"context"
	"fmt"
	"time"

	bbcontext "github.com/nwp/bb/internal/context"
	"github.com/nwp/bb/internal/format"
	"github.com/spf13/cobra"
)

var prWatchCmd = &cobra.Command{
	Use:   "watch [number]",
	Short: "Watch a pull request for activity",
	Args:  cobra.MaximumNArgs(1),
	RunE:  runPRWatch,
}

var prWatchFlags struct {
	repo     string
	interval int
}

func init() {
	prWatchCmd.Flags().StringVarP(&prWatchFlags.repo, "repo", "R", "", "Repository context (PROJECT/repo)")
	prWatchCmd.Flags().IntVarP(&prWatchFlags.interval, "interval", "i", 10, "Polling interval in seconds")
}

func runPRWatch(cmd *cobra.Command, args []string) error {
	ctx, err := bbcontext.Resolve(bbcontext.Options{RepoFlag: prWatchFlags.repo})
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

	var lastActivityID int
	interval := time.Duration(prWatchFlags.interval) * time.Second

	for {
		pr, err := ctx.API.GetPR(context.Background(), ctx.Project, ctx.Repo, id)
		if err != nil {
			fmt.Fprintf(cmd.ErrOrStderr(), "error: %v\n", err)
			time.Sleep(interval)
			continue
		}

		// Check for terminal state.
		if pr.State == "MERGED" || pr.State == "DECLINED" {
			fmt.Fprintf(cmd.OutOrStdout(), "Pull request #%d is %s\n", pr.ID, format.StateColor(pr.State))
			return nil
		}

		// Fetch new activity.
		activities, err := ctx.API.ListPRActivities(context.Background(), ctx.Project, ctx.Repo, id)
		if err != nil {
			time.Sleep(interval)
			continue
		}

		newestSeen := lastActivityID
		for _, a := range activities {
			if a.ID <= lastActivityID {
				continue
			}
			if a.ID > newestSeen {
				newestSeen = a.ID
			}
		}

		for i := len(activities) - 1; i >= 0; i-- {
			a := activities[i]
			if a.ID <= lastActivityID {
				continue
			}
			switch a.Action {
			case "COMMENTED":
				if a.Comment != nil {
					fmt.Fprintf(cmd.OutOrStdout(), "[%s] %s commented: %s\n",
						format.FormatDate(a.CreatedDate), a.User.DisplayName, a.Comment.Text)
				}
			case "APPROVED":
				fmt.Fprintf(cmd.OutOrStdout(), "[%s] %s approved\n",
					format.FormatDate(a.CreatedDate), a.User.DisplayName)
			case "REVIEWED":
				fmt.Fprintf(cmd.OutOrStdout(), "[%s] %s reviewed\n",
					format.FormatDate(a.CreatedDate), a.User.DisplayName)
			default:
				fmt.Fprintf(cmd.OutOrStdout(), "[%s] %s: %s\n",
					format.FormatDate(a.CreatedDate), a.User.DisplayName, a.Action)
			}
		}
		lastActivityID = newestSeen

		time.Sleep(interval)
	}
}
