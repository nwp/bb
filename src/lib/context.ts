import { $ } from "bun";
import { getDefaultHost, getResolvedHostConfig, type HostConfig } from "./config.js";
import { BitbucketAPI } from "./api.js";
import { getCacheEntry, setCacheEntry } from "./repo-cache.js";

export interface RepoContext {
  hostname: string;
  hostConfig: HostConfig;
  project: string;
  repo: string;
  api: BitbucketAPI;
}

/**
 * Parse a Bitbucket Server remote URL into hostname, project, and repo.
 * Supports:
 *   https://bitbucket.example.com/scm/PROJ/repo.git
 *   ssh://git@bitbucket.example.com:7999/PROJ/repo.git
 *   ssh://git@bitbucket.example.com/PROJ/repo.git
 *   git@bitbucket.example.com:7999/PROJ/repo.git
 */
export function parseRemoteUrl(url: string): { hostname: string; project: string; repo: string } | null {
  const httpsMatch = url.match(/https?:\/\/([^/]+)\/(?:scm\/)?([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (httpsMatch) {
    return { hostname: httpsMatch[1], project: httpsMatch[2], repo: httpsMatch[3] };
  }

  const sshMatch = url.match(/ssh:\/\/[^@]+@([^:/]+)(?::(\d+))?\/([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (sshMatch) {
    const host = sshMatch[2] ? `${sshMatch[1]}:${sshMatch[2]}` : sshMatch[1];
    return { hostname: host, project: sshMatch[3], repo: sshMatch[4] };
  }

  const scpWithPortMatch = url.match(/[^@]+@([^:]+):(\d+)\/([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (scpWithPortMatch) {
    return {
      hostname: `${scpWithPortMatch[1]}:${scpWithPortMatch[2]}`,
      project: scpWithPortMatch[3],
      repo: scpWithPortMatch[4],
    };
  }
  const scpMatch = url.match(/[^@]+@([^:]+):([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (scpMatch) {
    return { hostname: scpMatch[1], project: scpMatch[2], repo: scpMatch[3] };
  }

  return null;
}

/** Get the remote URL for origin (or specified remote) */
async function getRemoteUrl(remote = "origin"): Promise<string | null> {
  try {
    const result = await $`git remote get-url ${remote}`.text();
    return result.trim() || null;
  } catch {
    return null;
  }
}

/** Get the current branch name */
export async function getCurrentBranch(): Promise<string | null> {
  try {
    const result = await $`git rev-parse --abbrev-ref HEAD`.text();
    return result.trim() || null;
  } catch {
    return null;
  }
}

async function detectRepoIdentity(): Promise<{ hostname: string; project: string; repo: string } | null> {
  const remoteUrl = await getRemoteUrl();
  if (!remoteUrl) return null;
  return parseRemoteUrl(remoteUrl);
}

/**
 * Resolve context: parse git remote or use explicit flags, then look up auth.
 * The hostname may be remapped to a configured alias (for example, an SSH
 * remote host with a port mapped to an HTTPS API host without the port).
 */
export async function resolveContext(opts?: {
  repo?: string; // format: PROJECT/repo or host/PROJECT/repo
}): Promise<RepoContext> {
  let hostname: string;
  let project: string;
  let repo: string;

  if (opts?.repo) {
    const parts = opts.repo.split("/");
    if (parts.length === 3) {
      [hostname, project, repo] = parts;
    } else if (parts.length === 2) {
      [project, repo] = parts;
      const defaultHost = await getDefaultHost();
      if (!defaultHost) throw new Error("Not authenticated to any host. Run: bb auth login");
      hostname = defaultHost.hostname;
    } else {
      throw new Error("Invalid repo format. Use PROJECT/repo or hostname/PROJECT/repo");
    }
  } else {
    const identity = await detectRepoIdentity();
    if (identity) {
      ({ hostname, project, repo } = identity);
    } else {
      const cached = await getCacheEntry(process.cwd());
      if (cached) {
        ({ hostname, project, repo } = cached);
      } else {
        throw new Error(
          "Could not determine repository context.\n" +
            "Either run this command from within a Bitbucket Server git repo,\n" +
            "or specify --repo PROJECT/repo"
        );
      }
    }
  }

  const resolvedHost = await getResolvedHostConfig(hostname);
  if (!resolvedHost) {
    throw new Error(`Not authenticated to ${hostname}. Run: bb auth login`);
  }

  hostname = resolvedHost.hostname;
  const hostConfig = resolvedHost.config;

  setCacheEntry(process.cwd(), { hostname, project, repo }).catch(() => {});

  return {
    hostname,
    hostConfig,
    project,
    repo,
    api: new BitbucketAPI({ hostname, hostConfig }),
  };
}

/** Create an API client from the default host */
export async function apiForDefaultHost(): Promise<{ hostname: string; api: BitbucketAPI }> {
  const defaultHost = await getDefaultHost();
  if (!defaultHost) throw new Error("Not authenticated to any host. Run: bb auth login");
  return {
    hostname: defaultHost.hostname,
    api: new BitbucketAPI({ hostname: defaultHost.hostname, hostConfig: defaultHost.config }),
  };
}

/**
 * Resolve a PR ID from an optional argument or the current branch.
 * Many PR subcommands accept an optional PR number and fall back to
 * finding the open PR whose source branch matches HEAD.
 */
export async function resolvePRId(
  api: BitbucketAPI,
  project: string,
  repo: string,
  numberArg?: string
): Promise<number> {
  if (numberArg) return parseInt(numberArg, 10);

  const branch = await getCurrentBranch();
  if (branch) {
    const prs = await api.listPRs(project, repo, "OPEN");
    const match = prs.find((pr) => pr.fromRef.displayId === branch);
    if (match) return match.id;
  }

  throw new Error("No PR number specified and no PR found for current branch");
}
