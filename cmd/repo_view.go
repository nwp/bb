package cmd

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/nwp/bb/internal/config"
	bbcontext "github.com/nwp/bb/internal/context"
	"github.com/spf13/cobra"
)

var repoViewCmd = &cobra.Command{
	Use:   "view [repo]",
	Short: "View repository details",
	Args:  cobra.MaximumNArgs(1),
	RunE:  runRepoView,
}

var repoViewJSON bool

func init() {
	repoViewCmd.Flags().BoolVar(&repoViewJSON, "json", false, "Output as JSON")
}

func runRepoView(cmd *cobra.Command, args []string) error {
	var repoFlag string
	if len(args) > 0 {
		repoFlag = args[0]
	}

	ctx, err := bbcontext.Resolve(bbcontext.Options{RepoFlag: repoFlag})
	if err != nil {
		return err
	}

	repo, err := ctx.API.GetRepo(context.Background(), ctx.Project, ctx.Repo)
	if err != nil {
		return err
	}

	if repoViewJSON {
		return json.NewEncoder(cmd.OutOrStdout()).Encode(repo)
	}

	w := cmd.OutOrStdout()
	fmt.Fprintf(w, "%s/%s\n", repo.Project.Key, repo.Slug)
	if repo.Description != "" {
		fmt.Fprintf(w, "  %s\n", repo.Description)
	}
	fmt.Fprintf(w, "  State:    %s\n", repo.State)
	visibility := "private"
	if repo.Public {
		visibility = "public"
	}
	fmt.Fprintf(w, "  Visibility: %s\n", visibility)
	fmt.Fprintf(w, "  Forkable: %v\n", repo.Forkable)

	for _, link := range repo.Links.Clone {
		fmt.Fprintf(w, "  Clone (%s): %s\n", link.Name, link.Href)
	}
	return nil
}

var repoCloneCmd = &cobra.Command{
	Use:   "clone <repo>",
	Short: "Clone a repository",
	Args:  cobra.ExactArgs(1),
	RunE:  runRepoClone,
}

var repoCloneProtocol string

func init() {
	repoCloneCmd.Flags().StringVar(&repoCloneProtocol, "protocol", "ssh", "Protocol to use for cloning (ssh or https)")
}

func runRepoClone(cmd *cobra.Command, args []string) error {
	parts := strings.SplitN(args[0], "/", 2)
	if len(parts) != 2 {
		return fmt.Errorf("invalid repo format: expected PROJECT/repo")
	}
	project, repoSlug := parts[0], parts[1]

	mgr := config.Default()
	rh := mgr.DefaultHost()
	if rh == nil {
		return fmt.Errorf("not authenticated; run `bb auth login`")
	}

	client := newAPIClient(rh)
	repo, err := client.GetRepo(context.Background(), project, repoSlug)
	if err != nil {
		return err
	}

	var cloneURL string
	for _, link := range repo.Links.Clone {
		if strings.EqualFold(link.Name, repoCloneProtocol) {
			cloneURL = link.Href
			break
		}
	}
	if cloneURL == "" {
		return fmt.Errorf("no %s clone URL found for %s/%s", repoCloneProtocol, project, repoSlug)
	}

	return runGit(cmd.OutOrStdout(), "clone", cloneURL)
}
