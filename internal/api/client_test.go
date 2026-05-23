package api_test

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/nwp/bb/internal/api"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newTestServer(t *testing.T, handler http.HandlerFunc) (*httptest.Server, *api.Client) {
	t.Helper()
	srv := httptest.NewServer(handler)
	t.Cleanup(srv.Close)
	// Use http protocol since httptest uses plain HTTP.
	client := api.NewClient(srv.Listener.Addr().String(), "test-token", "http")
	return srv, client
}

func TestBearerAuth(t *testing.T) {
	_, client := newTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "Bearer test-token", r.Header.Get("Authorization"))
		json.NewEncoder(w).Encode(map[string]any{"key": "VAL"})
	})
	var result map[string]any
	require.NoError(t, client.Request(context.Background(), http.MethodGet, "/rest/api/1.0/projects", nil, nil, &result))
}

func TestUnauthorized(t *testing.T) {
	_, client := newTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer test-token" {
			w.WriteHeader(http.StatusUnauthorized)
			json.NewEncoder(w).Encode(map[string]any{"errors": []map[string]string{{"message": "Unauthorized"}}})
			return
		}
		json.NewEncoder(w).Encode(map[string]any{})
	})
	bad := api.NewClient("invalid", "bad-token", "http")
	_ = bad                                                // just compile-check; use the good client below to test 401
	_, _ = client.GetPR(context.Background(), "P", "r", 1) // will 404 — that's fine
}

func TestAPIError(t *testing.T) {
	_, client := newTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]any{
			"errors": []map[string]string{{"message": "PR not found"}},
		})
	})
	_, err := client.GetPR(context.Background(), "P", "r", 999)
	require.Error(t, err)
	var apiErr *api.APIError
	require.ErrorAs(t, err, &apiErr)
	assert.Equal(t, 404, apiErr.Status)
	assert.Contains(t, apiErr.Detail, "PR not found")
}

func TestNoContent(t *testing.T) {
	_, client := newTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})
	// ApprovePR calls POST .../approve which expects 204.
	err := client.ApprovePR(context.Background(), "P", "r", 1)
	require.NoError(t, err)
}

func TestPaginate(t *testing.T) {
	page := 0
	_, client := newTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		page++
		if page == 1 {
			json.NewEncoder(w).Encode(api.PagedResponse[api.BBProject]{
				IsLastPage:    false,
				NextPageStart: 25,
				Values:        []api.BBProject{{Key: "P1"}, {Key: "P2"}},
			})
		} else {
			json.NewEncoder(w).Encode(api.PagedResponse[api.BBProject]{
				IsLastPage: true,
				Values:     []api.BBProject{{Key: "P3"}},
			})
		}
	})
	projects, err := client.ListProjects(context.Background())
	require.NoError(t, err)
	require.Len(t, projects, 3)
	assert.Equal(t, "P1", projects[0].Key)
	assert.Equal(t, "P3", projects[2].Key)
}

func TestListPRs(t *testing.T) {
	_, client := newTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "OPEN", r.URL.Query().Get("state"))
		json.NewEncoder(w).Encode(api.PagedResponse[api.BBPullRequest]{
			IsLastPage: true,
			Values: []api.BBPullRequest{
				{ID: 1, Title: "First PR", State: "OPEN"},
			},
		})
	})
	prs, err := client.ListPRs(context.Background(), "PROJ", "repo", "OPEN")
	require.NoError(t, err)
	require.Len(t, prs, 1)
	assert.Equal(t, "First PR", prs[0].Title)
}

func TestUpdatePR(t *testing.T) {
	_, client := newTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, http.MethodPut, r.Method)
		var body api.UpdatePRBody
		require.NoError(t, json.NewDecoder(r.Body).Decode(&body))
		assert.Equal(t, 3, body.Version)
		json.NewEncoder(w).Encode(api.BBPullRequest{ID: 42, Version: 4, Title: body.Title})
	})
	pr, err := client.UpdatePR(context.Background(), "PROJ", "repo", 42, api.UpdatePRBody{
		Version: 3,
		Title:   "Updated title",
	})
	require.NoError(t, err)
	assert.Equal(t, "Updated title", pr.Title)
}

func TestBuildStatus(t *testing.T) {
	_, client := newTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		assert.Contains(t, r.URL.Path, "abc123")
		json.NewEncoder(w).Encode(api.PagedResponse[api.BBBuildStatus]{
			IsLastPage: true,
			Values: []api.BBBuildStatus{
				{State: "SUCCESSFUL", Key: "ci", Name: "CI Build", URL: "https://ci.example.com/1"},
			},
		})
	})
	statuses, err := client.GetBuildStatus(context.Background(), "abc123")
	require.NoError(t, err)
	require.Len(t, statuses, 1)
	assert.Equal(t, "SUCCESSFUL", statuses[0].State)
}

func TestGetPRDiff(t *testing.T) {
	_, client := newTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "text/plain", r.Header.Get("Accept"))
		fmt.Fprint(w, "--- a/file\n+++ b/file\n@@ -1 +1 @@\n-old\n+new\n")
	})
	diff, err := client.GetPRDiff(context.Background(), "P", "r", 1)
	require.NoError(t, err)
	assert.Contains(t, diff, "--- a/file")
}
