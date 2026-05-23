package cmd

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/nwp/bb/internal/api"
	"github.com/nwp/bb/internal/config"
	"github.com/nwp/bb/internal/format"
	"github.com/spf13/cobra"
)

var repoListCmd = &cobra.Command{
	Use:   "list",
	Short: "List repositories",
	RunE:  runRepoList,
}

var repoListFlags struct {
	project string
	limit   int
	json    bool
}

func init() {
	repoListCmd.Flags().StringVarP(&repoListFlags.project, "project", "p", "", "Filter by project key")
	repoListCmd.Flags().IntVarP(&repoListFlags.limit, "limit", "L", 30, "Maximum number of repositories to list")
	repoListCmd.Flags().BoolVar(&repoListFlags.json, "json", false, "Output as JSON")
}

func runRepoList(cmd *cobra.Command, _ []string) error {
	mgr := config.Default()
	rh := mgr.DefaultHost()
	if rh == nil {
		return fmt.Errorf("not authenticated; run `bb auth login`")
	}

	client := newAPIClient(rh)
	ctx := context.Background()

	var repos []api.BBRepo
	var err error
	if repoListFlags.project != "" {
		repos, err = client.ListRepos(ctx, repoListFlags.project)
	} else {
		repos, err = client.ListAllRepos(ctx)
	}
	if err != nil {
		return err
	}

	if len(repos) > repoListFlags.limit {
		repos = repos[:repoListFlags.limit]
	}

	if repoListFlags.json {
		return json.NewEncoder(cmd.OutOrStdout()).Encode(repos)
	}

	var rows [][]string
	for _, r := range repos {
		visibility := "private"
		if r.Public {
			visibility = "public"
		}
		rows = append(rows, []string{
			r.Project.Key + "/" + r.Slug,
			format.Truncate(r.Description, 50),
			visibility,
		})
	}
	format.PrintTable(cmd.OutOrStdout(), rows)
	return nil
}
