package cmd

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"unicode"

	"github.com/nwp/bb/internal/api"
	bbcontext "github.com/nwp/bb/internal/context"
	"github.com/spf13/cobra"
)

var prCreateCmd = &cobra.Command{
	Use:   "create",
	Short: "Create a pull request",
	RunE:  runPRCreate,
}

var prCreateFlags struct {
	title     string
	body      string
	bodyFile  string
	template  string
	fill      bool
	base      string
	head      string
	reviewers []string
	repo      string
	draft     bool
	json      bool
}

func init() {
	prCreateCmd.Flags().StringVarP(&prCreateFlags.title, "title", "t", "", "Pull request title")
	prCreateCmd.Flags().StringVarP(&prCreateFlags.body, "body", "b", "", "Pull request description")
	prCreateCmd.Flags().StringVarP(&prCreateFlags.bodyFile, "body-file", "F", "", "File containing description (use - for stdin)")
	prCreateCmd.Flags().StringVar(&prCreateFlags.template, "template", "", "Template file for description")
	prCreateCmd.Flags().BoolVar(&prCreateFlags.fill, "fill", false, "Fill title and body from last commit message")
	prCreateCmd.Flags().StringVarP(&prCreateFlags.base, "base", "B", "", "Base branch (default: repo default branch)")
	prCreateCmd.Flags().StringVarP(&prCreateFlags.head, "head", "H", "", "Head branch (default: current branch)")
	prCreateCmd.Flags().StringArrayVarP(&prCreateFlags.reviewers, "reviewer", "r", nil, "Add reviewer by username (repeatable)")
	prCreateCmd.Flags().StringVarP(&prCreateFlags.repo, "repo", "R", "", "Repository context (PROJECT/repo)")
	prCreateCmd.Flags().BoolVar(&prCreateFlags.draft, "draft", false, "Create as draft pull request")
	prCreateCmd.Flags().BoolVar(&prCreateFlags.json, "json", false, "Output as JSON")
}

func runPRCreate(cmd *cobra.Command, _ []string) error {
	ctx, err := bbcontext.Resolve(bbcontext.Options{RepoFlag: prCreateFlags.repo})
	if err != nil {
		return err
	}

	// Determine head branch.
	head := prCreateFlags.head
	if head == "" {
		head, err = bbcontext.GetCurrentBranch()
		if err != nil {
			return fmt.Errorf("getting current branch: %w", err)
		}
	}

	// Determine base branch.
	base := prCreateFlags.base
	if base == "" {
		repo, err := ctx.API.GetRepo(context.Background(), ctx.Project, ctx.Repo)
		if err != nil {
			return fmt.Errorf("getting default branch: %w", err)
		}
		// Use default branch from links or fall back to "main".
		base = defaultBranchFromRepo(repo)
	}

	// Resolve title.
	title := prCreateFlags.title
	body, err := resolvePRDescription(prCreateFlags.body, prCreateFlags.bodyFile, prCreateFlags.template)
	if err != nil {
		return err
	}

	if prCreateFlags.fill || title == "" {
		commitTitle, commitBody, fillErr := lastCommitMessage()
		if fillErr == nil {
			if title == "" {
				title = commitTitle
			}
			if body == "" && prCreateFlags.fill {
				body = commitBody
			}
		}
	}

	if title == "" {
		title = inferTitleFromBranch(head)
	}

	if title == "" {
		return fmt.Errorf("pull request title is required (use --title or --fill)")
	}

	// Build reviewer list.
	var reviewers []api.UserSlug
	for _, r := range prCreateFlags.reviewers {
		var us api.UserSlug
		us.User.Slug = r
		reviewers = append(reviewers, us)
	}

	createBody := api.CreatePRBody{
		Title:       title,
		Description: body,
		State:       "OPEN",
		Open:        true,
		Closed:      false,
		Draft:       prCreateFlags.draft,
		FromRef: api.CreatePRRef{
			ID: "refs/heads/" + head,
			Repository: api.CreatePRRefRepo{
				Slug:    ctx.Repo,
				Project: api.CreatePRProject{Key: ctx.Project},
			},
		},
		ToRef: api.CreatePRRef{
			ID: "refs/heads/" + base,
			Repository: api.CreatePRRefRepo{
				Slug:    ctx.Repo,
				Project: api.CreatePRProject{Key: ctx.Project},
			},
		},
		Reviewers: reviewers,
	}

	pr, err := ctx.API.CreatePR(context.Background(), ctx.Project, ctx.Repo, createBody)
	if err != nil {
		return err
	}

	if prCreateFlags.json {
		return json.NewEncoder(cmd.OutOrStdout()).Encode(pr)
	}

	fmt.Fprintf(cmd.OutOrStdout(), "Created pull request #%d: %s\n", pr.ID, pr.Title)
	if len(pr.Links.Self) > 0 {
		fmt.Fprintf(cmd.OutOrStdout(), "%s\n", pr.Links.Self[0].Href)
	}
	return nil
}

// resolvePRDescription returns the description from --body, --body-file, or --template.
// Returns an error if more than one is provided.
func resolvePRDescription(body, bodyFile, template string) (string, error) {
	count := 0
	if body != "" {
		count++
	}
	if bodyFile != "" {
		count++
	}
	if template != "" {
		count++
	}
	if count > 1 {
		return "", fmt.Errorf("--body, --body-file, and --template are mutually exclusive")
	}
	if body != "" {
		return body, nil
	}
	if bodyFile != "" {
		return readBodyFile(bodyFile)
	}
	if template != "" {
		return readBodyFile(template)
	}
	return "", nil
}

func readBodyFile(path string) (string, error) {
	if path == "-" {
		var sb strings.Builder
		scanner := bufio.NewScanner(os.Stdin)
		for scanner.Scan() {
			sb.WriteString(scanner.Text())
			sb.WriteByte('\n')
		}
		return sb.String(), scanner.Err()
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return "", fmt.Errorf("reading %s: %w", path, err)
	}
	return string(data), nil
}

// inferTitleFromBranch derives a PR title from a branch name by stripping
// common prefixes and converting hyphens/underscores to spaces.
func inferTitleFromBranch(branch string) string {
	prefixes := []string{"feature/", "bugfix/", "bug/", "fix/", "chore/", "hotfix/", "release/"}
	for _, p := range prefixes {
		if strings.HasPrefix(branch, p) {
			branch = branch[len(p):]
			break
		}
	}
	branch = strings.ReplaceAll(branch, "-", " ")
	branch = strings.ReplaceAll(branch, "_", " ")
	if len(branch) > 0 {
		runes := []rune(branch)
		runes[0] = unicode.ToUpper(runes[0])
		branch = string(runes)
	}
	return branch
}

// lastCommitMessage returns the title and body of the last commit message.
func lastCommitMessage() (title, body string, err error) {
	out, err := exec.Command("git", "log", "-1", "--pretty=%B").Output()
	if err != nil {
		return "", "", err
	}
	return parseCommitTitleAndBody(strings.TrimSpace(string(out)))
}

// parseCommitTitleAndBody splits a commit message into title and body.
func parseCommitTitleAndBody(msg string) (title, body string, err error) {
	if msg == "" {
		return "", "", nil
	}
	parts := strings.SplitN(msg, "\n\n", 2)
	title = strings.TrimSpace(parts[0])
	if len(parts) > 1 {
		body = strings.TrimSpace(parts[1])
	}
	return title, body, nil
}

// defaultBranchFromRepo returns a sensible default branch name.
// Bitbucket Server doesn't surface this easily; fall back to "main".
func defaultBranchFromRepo(_ *api.BBRepo) string {
	return "main"
}
