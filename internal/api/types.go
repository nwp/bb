// Package api provides a typed HTTP client for the Bitbucket Server REST API.
package api

// PagedResponse is the standard Bitbucket Server paginated response envelope.
type PagedResponse[T any] struct {
	Size          int  `json:"size"`
	Limit         int  `json:"limit"`
	Start         int  `json:"start"`
	IsLastPage    bool `json:"isLastPage"`
	NextPageStart int  `json:"nextPageStart"`
	Values        []T  `json:"values"`
}

// BBLinks holds named clone/self URLs returned by the API.
type BBLinks struct {
	Clone []BBCloneLink `json:"clone"`
	Self  []BBSelfLink  `json:"self"`
}

// BBCloneLink is a clone URL entry (e.g. "http" or "ssh").
type BBCloneLink struct {
	Href string `json:"href"`
	Name string `json:"name"`
}

// BBSelfLink is a browser self-link.
type BBSelfLink struct {
	Href string `json:"href"`
}

// BBProject is a Bitbucket Server project.
type BBProject struct {
	Key         string  `json:"key"`
	ID          int     `json:"id"`
	Name        string  `json:"name"`
	Description string  `json:"description"`
	Public      bool    `json:"public"`
	Type        string  `json:"type"`
	Links       BBLinks `json:"links"`
}

// BBRepo is a Bitbucket Server repository.
type BBRepo struct {
	Slug        string    `json:"slug"`
	ID          int       `json:"id"`
	Name        string    `json:"name"`
	Project     BBProject `json:"project"`
	Public      bool      `json:"public"`
	Forkable    bool      `json:"forkable"`
	State       string    `json:"state"`
	ScmID       string    `json:"scmId"`
	Description string    `json:"description"`
	Links       BBLinks   `json:"links"`
}

// BBUser is a Bitbucket Server user.
type BBUser struct {
	Name         string `json:"name"`
	EmailAddress string `json:"emailAddress"`
	ID           int    `json:"id"`
	DisplayName  string `json:"displayName"`
	Active       bool   `json:"active"`
	Slug         string `json:"slug"`
	Type         string `json:"type"`
}

// BBRef is a branch reference in a pull request.
type BBRef struct {
	ID           string `json:"id"`
	DisplayID    string `json:"displayId"`
	LatestCommit string `json:"latestCommit"`
	Repository   BBRepo `json:"repository"`
}

// BBReviewer is a reviewer on a pull request with their status.
type BBReviewer struct {
	User               BBUser `json:"user"`
	Role               string `json:"role"`
	Approved           bool   `json:"approved"`
	Status             string `json:"status"`
	LastReviewedCommit string `json:"lastReviewedCommit"`
}

// BBPullRequest is a Bitbucket Server pull request.
type BBPullRequest struct {
	ID           int          `json:"id"`
	Version      int          `json:"version"`
	Title        string       `json:"title"`
	Description  string       `json:"description"`
	State        string       `json:"state"`
	Open         bool         `json:"open"`
	Closed       bool         `json:"closed"`
	Draft        bool         `json:"draft"`
	CreatedDate  int64        `json:"createdDate"`
	UpdatedDate  int64        `json:"updatedDate"`
	FromRef      BBRef        `json:"fromRef"`
	ToRef        BBRef        `json:"toRef"`
	Locked       bool         `json:"locked"`
	Author       BBReviewer   `json:"author"`
	Reviewers    []BBReviewer `json:"reviewers"`
	Participants []BBReviewer `json:"participants"`
	Links        BBLinks      `json:"links"`
}

// BBComment is a comment on a pull request.
type BBComment struct {
	ID          int    `json:"id"`
	Version     int    `json:"version"`
	Text        string `json:"text"`
	Author      BBUser `json:"author"`
	CreatedDate int64  `json:"createdDate"`
	UpdatedDate int64  `json:"updatedDate"`
}

// BBActivity is an activity entry in a pull request's activity feed.
type BBActivity struct {
	ID          int        `json:"id"`
	CreatedDate int64      `json:"createdDate"`
	User        BBUser     `json:"user"`
	Action      string     `json:"action"`
	Comment     *BBComment `json:"comment"`
}

// BBBuildStatus is a build/CI status record for a commit.
type BBBuildStatus struct {
	State       string `json:"state"`
	Key         string `json:"key"`
	Name        string `json:"name"`
	URL         string `json:"url"`
	Description string `json:"description"`
	DateAdded   int64  `json:"dateAdded"`
}

// CreatePRBody is the request body for creating a pull request.
type CreatePRBody struct {
	Title       string      `json:"title"`
	Description string      `json:"description,omitempty"`
	State       string      `json:"state"`
	Open        bool        `json:"open"`
	Closed      bool        `json:"closed"`
	Draft       bool        `json:"draft,omitempty"`
	FromRef     CreatePRRef `json:"fromRef"`
	ToRef       CreatePRRef `json:"toRef"`
	Locked      bool        `json:"locked"`
	Reviewers   []UserSlug  `json:"reviewers,omitempty"`
}

// CreatePRRef is a branch reference for creating a pull request.
type CreatePRRef struct {
	ID         string          `json:"id"`
	Repository CreatePRRefRepo `json:"repository"`
}

// CreatePRRefRepo identifies the repository for a CreatePRRef.
type CreatePRRefRepo struct {
	Slug    string          `json:"slug"`
	Project CreatePRProject `json:"project"`
}

// CreatePRProject identifies the project for a CreatePRRefRepo.
type CreatePRProject struct {
	Key string `json:"key"`
}

// UserSlug identifies a user by slug.
type UserSlug struct {
	User struct {
		Slug string `json:"slug"`
	} `json:"user"`
}

// UpdatePRBody is the request body for updating a pull request. Version is
// required for optimistic locking.
type UpdatePRBody struct {
	Version     int          `json:"version"`
	Title       string       `json:"title,omitempty"`
	Description string       `json:"description,omitempty"`
	ToRef       *CreatePRRef `json:"toRef,omitempty"`
	Reviewers   []UserSlug   `json:"reviewers,omitempty"`
	Draft       *bool        `json:"draft,omitempty"`
}
