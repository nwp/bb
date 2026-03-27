import type { HostConfig } from "./config.js";

export interface APIOptions {
  hostname: string;
  hostConfig: HostConfig;
}

export interface PagedResponse<T> {
  size: number;
  limit: number;
  start: number;
  isLastPage: boolean;
  nextPageStart?: number;
  values: T[];
}

export class BitbucketAPI {
  private baseUrl: string;
  private token: string;

  constructor(opts: APIOptions) {
    const proto = opts.hostConfig.protocol ?? "https";
    this.baseUrl = `${proto}://${opts.hostname}`;
    this.token = opts.hostConfig.token;
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
  }

  async request<T = unknown>(
    method: string,
    path: string,
    opts?: { body?: unknown; params?: Record<string, string> }
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    if (opts?.params) {
      for (const [k, v] of Object.entries(opts.params)) {
        url.searchParams.set(k, v);
      }
    }

    const resp = await fetch(url.toString(), {
      method,
      headers: this.headers(),
      body: opts?.body ? JSON.stringify(opts.body) : undefined,
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      let detail = text;
      try {
        const json = JSON.parse(text);
        if (json.errors) {
          detail = json.errors.map((e: { message: string }) => e.message).join("; ");
        }
      } catch {
        // raw text used as-is
      }
      throw new APIError(resp.status, resp.statusText, detail);
    }

    if (resp.status === 204) return undefined as T;

    return (await resp.json()) as T;
  }

  async get<T = unknown>(path: string, params?: Record<string, string>): Promise<T> {
    return this.request<T>("GET", path, { params });
  }

  async post<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("POST", path, { body });
  }

  async put<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("PUT", path, { body });
  }

  async delete<T = unknown>(path: string): Promise<T> {
    return this.request<T>("DELETE", path);
  }

  /** Fetch all pages of a paginated endpoint */
  async paginate<T>(path: string, params?: Record<string, string>): Promise<T[]> {
    const all: T[] = [];
    let start = 0;

    while (true) {
      const page = await this.get<PagedResponse<T>>(path, {
        ...params,
        start: String(start),
        limit: "25",
      });
      all.push(...page.values);
      if (page.isLastPage) break;
      start = page.nextPageStart ?? start + page.size;
    }

    return all;
  }

  // Projects
  async listProjects() {
    return this.paginate<BBProject>("/rest/api/1.0/projects");
  }

  async getProject(projectKey: string) {
    return this.get<BBProject>(`/rest/api/1.0/projects/${projectKey}`);
  }

  // Repos
  async listRepos(projectKey: string) {
    return this.paginate<BBRepo>(`/rest/api/1.0/projects/${projectKey}/repos`);
  }

  async getRepo(projectKey: string, repoSlug: string) {
    return this.get<BBRepo>(`/rest/api/1.0/projects/${projectKey}/repos/${repoSlug}`);
  }

  // Pull Requests
  private prBasePath(projectKey: string, repoSlug: string) {
    return `/rest/api/1.0/projects/${projectKey}/repos/${repoSlug}/pull-requests`;
  }

  async listPRs(projectKey: string, repoSlug: string, state = "OPEN") {
    return this.paginate<BBPullRequest>(this.prBasePath(projectKey, repoSlug), { state });
  }

  async getPR(projectKey: string, repoSlug: string, prId: number) {
    return this.get<BBPullRequest>(`${this.prBasePath(projectKey, repoSlug)}/${prId}`);
  }

  async createPR(projectKey: string, repoSlug: string, body: CreatePRBody) {
    return this.post<BBPullRequest>(this.prBasePath(projectKey, repoSlug), body);
  }

  async mergePR(projectKey: string, repoSlug: string, prId: number, version: number) {
    return this.post<BBPullRequest>(
      `${this.prBasePath(projectKey, repoSlug)}/${prId}/merge`,
      { version }
    );
  }

  async declinePR(projectKey: string, repoSlug: string, prId: number, version: number) {
    return this.post<BBPullRequest>(
      `${this.prBasePath(projectKey, repoSlug)}/${prId}/decline`,
      { version }
    );
  }

  async reopenPR(projectKey: string, repoSlug: string, prId: number, version: number) {
    return this.post<BBPullRequest>(
      `${this.prBasePath(projectKey, repoSlug)}/${prId}/reopen`,
      { version }
    );
  }

  async updatePR(projectKey: string, repoSlug: string, prId: number, body: UpdatePRBody) {
    return this.put<BBPullRequest>(
      `${this.prBasePath(projectKey, repoSlug)}/${prId}`,
      body
    );
  }

  async getPRDiff(projectKey: string, repoSlug: string, prId: number) {
    const path = `${this.prBasePath(projectKey, repoSlug)}/${prId}/diff`;
    const resp = await fetch(`${this.baseUrl}${path}`, {
      headers: { ...this.headers(), Accept: "text/plain" },
    });
    if (!resp.ok) throw new APIError(resp.status, resp.statusText, await resp.text());
    return resp.text();
  }

  async listPRActivities(projectKey: string, repoSlug: string, prId: number) {
    return this.paginate<BBActivity>(
      `${this.prBasePath(projectKey, repoSlug)}/${prId}/activities`
    );
  }

  async addPRComment(projectKey: string, repoSlug: string, prId: number, text: string) {
    return this.post<BBComment>(
      `${this.prBasePath(projectKey, repoSlug)}/${prId}/comments`,
      { text }
    );
  }

  async approvePR(projectKey: string, repoSlug: string, prId: number) {
    return this.post(
      `${this.prBasePath(projectKey, repoSlug)}/${prId}/approve`
    );
  }

  async unapprovePR(projectKey: string, repoSlug: string, prId: number) {
    return this.delete(
      `${this.prBasePath(projectKey, repoSlug)}/${prId}/approve`
    );
  }

  // Build status
  async getBuildStatus(commitHash: string) {
    return this.paginate<BBBuildStatus>(
      `/rest/build-status/1.0/commits/${commitHash}`
    );
  }
}

export class APIError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public detail: string
  ) {
    super(`HTTP ${status} ${statusText}: ${detail}`);
    this.name = "APIError";
  }
}

export interface BBProject {
  key: string;
  id: number;
  name: string;
  description?: string;
  public: boolean;
  type: string;
  links: BBLinks;
}

export interface BBRepo {
  slug: string;
  id: number;
  name: string;
  description?: string;
  state: string;
  forkable: boolean;
  project: BBProject;
  public: boolean;
  links: BBLinks;
  scmId: string;
}

export interface BBPullRequest {
  id: number;
  version: number;
  title: string;
  description?: string;
  state: string;
  open: boolean;
  closed: boolean;
  draft?: boolean;
  createdDate: number;
  updatedDate: number;
  fromRef: BBRef;
  toRef: BBRef;
  locked: boolean;
  author: { user: BBUser; role: string; approved: boolean };
  reviewers: Array<{ user: BBUser; role: string; approved: boolean; status: string }>;
  participants: Array<{ user: BBUser; role: string; approved: boolean }>;
  links: BBLinks;
}

export interface BBRef {
  id: string;
  displayId: string;
  latestCommit: string;
  repository: BBRepo;
}

export interface BBUser {
  name: string;
  emailAddress?: string;
  id: number;
  displayName: string;
  active: boolean;
  slug: string;
  type: string;
}

export interface BBComment {
  id: number;
  version: number;
  text: string;
  author: BBUser;
  createdDate: number;
  updatedDate: number;
}

export interface BBActivity {
  id: number;
  createdDate: number;
  user: BBUser;
  action: string;
  comment?: BBComment;
}

export interface BBBuildStatus {
  state: string; // SUCCESSFUL, FAILED, INPROGRESS
  key: string;
  name?: string;
  url: string;
  description?: string;
  dateAdded: number;
}

export interface BBLinks {
  self?: Array<{ href: string }>;
  clone?: Array<{ href: string; name: string }>;
}

export interface CreatePRBody {
  title: string;
  description?: string;
  fromRef: { id: string; repository: { slug: string; project: { key: string } } };
  toRef: { id: string; repository: { slug: string; project: { key: string } } };
  reviewers?: Array<{ user: { name: string } }>;
}

export interface UpdatePRBody {
  version: number;
  title?: string;
  description?: string;
  toRef?: { id: string; repository: { slug: string; project: { key: string } } };
  reviewers?: Array<{ user: { name: string } }>;
  draft?: boolean;
}
