package api

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

// APIError is returned when the Bitbucket Server API responds with a non-2xx status.
type APIError struct {
	Status     int
	StatusText string
	Detail     string
}

func (e *APIError) Error() string {
	if e.Detail != "" {
		return fmt.Sprintf("%s: %s", e.StatusText, e.Detail)
	}
	return e.StatusText
}

// Client is a Bitbucket Server REST API client.
type Client struct {
	baseURL    string
	token      string
	httpClient *http.Client
}

// NewClient constructs a Client for the given hostname and bearer token. Protocol
// defaults to "https" if empty.
func NewClient(hostname, token, protocol string) *Client {
	if protocol == "" {
		protocol = "https"
	}
	return &Client{
		baseURL:    fmt.Sprintf("%s://%s", protocol, hostname),
		token:      token,
		httpClient: &http.Client{Timeout: defaultHTTPTimeout},
	}
}

// Request performs an authenticated HTTP request against the Bitbucket Server API.
// params are appended as query string values. body (if non-nil) is JSON-encoded.
// If the response status is 204 No Content, result is not populated.
func (c *Client) Request(ctx context.Context, method, path string, params url.Values, body any, result any) error {
	u := c.baseURL + path
	if len(params) > 0 {
		u += "?" + params.Encode()
	}

	var bodyReader io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("encoding request body: %w", err)
		}
		bodyReader = bytes.NewReader(b)
	}

	req, err := http.NewRequestWithContext(ctx, method, u, bodyReader)
	if err != nil {
		return fmt.Errorf("building request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+c.token)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("executing request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNoContent {
		return nil
	}

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("reading response: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		detail := extractErrorDetail(respBody)
		return &APIError{
			Status:     resp.StatusCode,
			StatusText: resp.Status,
			Detail:     detail,
		}
	}

	if result == nil {
		return nil
	}
	if err := json.Unmarshal(respBody, result); err != nil {
		return fmt.Errorf("decoding response: %w", err)
	}
	return nil
}

// RequestText performs an authenticated GET that returns plain text (e.g. diffs).
func (c *Client) RequestText(ctx context.Context, path string) (string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+path, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+c.token)
	req.Header.Set("Accept", "text/plain")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	b, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", &APIError{Status: resp.StatusCode, StatusText: resp.Status, Detail: string(b)}
	}
	return string(b), nil
}

// extractErrorDetail tries to parse the Bitbucket Server JSON error format
// {"errors": [{"message": "..."}]}, falling back to raw text.
func extractErrorDetail(body []byte) string {
	var errResp struct {
		Errors []struct {
			Message string `json:"message"`
		} `json:"errors"`
	}
	if json.Unmarshal(body, &errResp) == nil && len(errResp.Errors) > 0 {
		return errResp.Errors[0].Message
	}
	return string(body)
}

const paginationLimit = 25
const defaultHTTPTimeout = 20 * time.Second

// Paginate fetches all pages of a paginated Bitbucket Server endpoint and
// returns the combined slice of values.
func Paginate[T any](ctx context.Context, c *Client, path string, params url.Values) ([]T, error) {
	if params == nil {
		params = url.Values{}
	}
	params.Set("limit", strconv.Itoa(paginationLimit))

	var all []T
	start := 0
	for {
		params.Set("start", strconv.Itoa(start))
		var page PagedResponse[T]
		if err := c.Request(ctx, http.MethodGet, path, params, nil, &page); err != nil {
			return nil, err
		}
		all = append(all, page.Values...)
		if page.IsLastPage {
			break
		}
		start = page.NextPageStart
	}
	return all, nil
}

// — Projects —

// ListProjects returns all projects.
func (c *Client) ListProjects(ctx context.Context) ([]BBProject, error) {
	return Paginate[BBProject](ctx, c, "/rest/api/1.0/projects", nil)
}

// — Repos —

// ListRepos returns all repositories in a project.
func (c *Client) ListRepos(ctx context.Context, projectKey string) ([]BBRepo, error) {
	return Paginate[BBRepo](ctx, c, fmt.Sprintf("/rest/api/1.0/projects/%s/repos", projectKey), nil)
}

// ListAllRepos returns all repos across all projects (no project filter).
func (c *Client) ListAllRepos(ctx context.Context) ([]BBRepo, error) {
	return Paginate[BBRepo](ctx, c, "/rest/api/1.0/repos", nil)
}

// GetRepo fetches a single repository.
func (c *Client) GetRepo(ctx context.Context, projectKey, repoSlug string) (*BBRepo, error) {
	var repo BBRepo
	err := c.Request(ctx, http.MethodGet,
		fmt.Sprintf("/rest/api/1.0/projects/%s/repos/%s", projectKey, repoSlug),
		nil, nil, &repo)
	return &repo, err
}

// GetDefaultBranch returns the default branch display ID for a repository.
func (c *Client) GetDefaultBranch(ctx context.Context, projectKey, repoSlug string) (string, error) {
	var ref BBRef
	err := c.Request(ctx, http.MethodGet,
		fmt.Sprintf("/rest/api/1.0/projects/%s/repos/%s/default-branch", projectKey, repoSlug),
		nil, nil, &ref)
	if err != nil {
		return "", err
	}
	if ref.DisplayID != "" {
		return ref.DisplayID, nil
	}
	if strings.HasPrefix(ref.ID, "refs/heads/") {
		return strings.TrimPrefix(ref.ID, "refs/heads/"), nil
	}
	return ref.ID, nil
}

// — Pull Requests —

func prPath(project, repo string) string {
	return fmt.Sprintf("/rest/api/1.0/projects/%s/repos/%s/pull-requests", project, repo)
}

func prIDPath(project, repo string, id int) string {
	return fmt.Sprintf("%s/%d", prPath(project, repo), id)
}

// ListPRs returns pull requests filtered by state (OPEN, MERGED, DECLINED, ALL).
func (c *Client) ListPRs(ctx context.Context, project, repo, state string) ([]BBPullRequest, error) {
	params := url.Values{"state": {state}}
	return Paginate[BBPullRequest](ctx, c, prPath(project, repo), params)
}

// GetPR fetches a single pull request.
func (c *Client) GetPR(ctx context.Context, project, repo string, id int) (*BBPullRequest, error) {
	var pr BBPullRequest
	err := c.Request(ctx, http.MethodGet, prIDPath(project, repo, id), nil, nil, &pr)
	return &pr, err
}

// CreatePR creates a new pull request.
func (c *Client) CreatePR(ctx context.Context, project, repo string, body CreatePRBody) (*BBPullRequest, error) {
	var pr BBPullRequest
	err := c.Request(ctx, http.MethodPost, prPath(project, repo), nil, body, &pr)
	return &pr, err
}

// UpdatePR updates a pull request (title, description, base, reviewers, draft).
func (c *Client) UpdatePR(ctx context.Context, project, repo string, id int, body UpdatePRBody) (*BBPullRequest, error) {
	var pr BBPullRequest
	err := c.Request(ctx, http.MethodPut, prIDPath(project, repo, id), nil, body, &pr)
	return &pr, err
}

// MergePR merges a pull request. Version is required for optimistic locking.
func (c *Client) MergePR(ctx context.Context, project, repo string, id, version int) (*BBPullRequest, error) {
	params := url.Values{"version": {strconv.Itoa(version)}}
	var pr BBPullRequest
	err := c.Request(ctx, http.MethodPost, prIDPath(project, repo, id)+"/merge", params, nil, &pr)
	return &pr, err
}

// DeclinePR declines (closes) a pull request.
func (c *Client) DeclinePR(ctx context.Context, project, repo string, id, version int) (*BBPullRequest, error) {
	params := url.Values{"version": {strconv.Itoa(version)}}
	var pr BBPullRequest
	err := c.Request(ctx, http.MethodPost, prIDPath(project, repo, id)+"/decline", params, nil, &pr)
	return &pr, err
}

// ReopenPR reopens a declined pull request.
func (c *Client) ReopenPR(ctx context.Context, project, repo string, id, version int) (*BBPullRequest, error) {
	params := url.Values{"version": {strconv.Itoa(version)}}
	var pr BBPullRequest
	err := c.Request(ctx, http.MethodPost, prIDPath(project, repo, id)+"/reopen", params, nil, &pr)
	return &pr, err
}

// GetPRDiff returns the unified diff for a pull request as plain text.
func (c *Client) GetPRDiff(ctx context.Context, project, repo string, id int) (string, error) {
	return c.RequestText(ctx, prIDPath(project, repo, id)+"/diff")
}

// ListPRActivities returns all activity entries for a pull request.
func (c *Client) ListPRActivities(ctx context.Context, project, repo string, id int) ([]BBActivity, error) {
	return Paginate[BBActivity](ctx, c, prIDPath(project, repo, id)+"/activities", nil)
}

// AddPRComment posts a comment on a pull request.
func (c *Client) AddPRComment(ctx context.Context, project, repo string, id int, text string) (*BBComment, error) {
	body := map[string]string{"text": text}
	var comment BBComment
	err := c.Request(ctx, http.MethodPost, prIDPath(project, repo, id)+"/comments", nil, body, &comment)
	return &comment, err
}

// ApprovePR approves a pull request.
func (c *Client) ApprovePR(ctx context.Context, project, repo string, id int) error {
	return c.Request(ctx, http.MethodPost, prIDPath(project, repo, id)+"/approve", nil, nil, nil)
}

// UnapprovePR removes approval from a pull request.
func (c *Client) UnapprovePR(ctx context.Context, project, repo string, id int) error {
	return c.Request(ctx, http.MethodDelete, prIDPath(project, repo, id)+"/approve", nil, nil, nil)
}

// RequestPRChanges submits a "needs work" review on a pull request.
func (c *Client) RequestPRChanges(ctx context.Context, project, repo string, id int) error {
	return c.Request(ctx, http.MethodPost, prIDPath(project, repo, id)+"/participants/~current", nil,
		map[string]string{"status": "NEEDS_WORK"}, nil)
}

// — Build Status —

// GetBuildStatus returns all build statuses for a commit SHA.
func (c *Client) GetBuildStatus(ctx context.Context, commitSHA string) ([]BBBuildStatus, error) {
	return Paginate[BBBuildStatus](ctx, c,
		fmt.Sprintf("/rest/build-status/1.0/commits/%s", commitSHA), nil)
}
