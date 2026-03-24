import { $ } from "bun";
import { getHostConfig, getDefaultHost, type HostConfig } from "./config.js";
import { BitbucketAPI } from "./api.js";

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
  // HTTPS: https://host/scm/PROJECT/repo.git or https://host/PROJECT/repo.git
  const httpsMatch = url.match(/https?:\/\/([^/]+)\/(?:scm\/)?([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (httpsMatch) {
    return { hostname: httpsMatch[1], project: httpsMatch[2], repo: httpsMatch[3] };
  }

  // SSH: ssh://git@host:port/PROJECT/repo.git or ssh://git@host/PROJECT/repo.git
  const sshMatch = url.match(/ssh:\/\/[^@]+@([^:/]+)(?::\d+)?\/([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (sshMatch) {
    return { hostname: sshMatch[1], project: sshMatch[2], repo: sshMatch[3] };
  }

  // SCP-style: git@host:port/PROJECT/repo.git or git@host:PROJECT/repo.git
  const scpMatch = url.match(/[^@]+@([^:]+):(?:\d+\/)?([^/]+)\/([^/]+?)(?:\.git)?$/);
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

/** Detect repo context from the current git directory */
export async function detectContext(): Promise<RepoContext | null> {
  const remoteUrl = await getRemoteUrl();
  if (!remoteUrl) return null;

  const parsed = parseRemoteUrl(remoteUrl);
  if (!parsed) return null;

  const hostConfig = await getHostConfig(parsed.hostname);
  if (!hostConfig) return null;

  return {
    hostname: parsed.hostname,
    hostConfig,
    project: parsed.project,
    repo: parsed.repo,
    api: new BitbucketAPI({ hostname: parsed.hostname, hostConfig }),
  };
}

/**
 * Resolve context: either from git repo or from explicit flags.
 * Throws if no context can be determined.
 */
export async function resolveContext(opts?: {
  repo?: string; // format: PROJECT/repo or host/PROJECT/repo
}): Promise<RepoContext> {
  if (opts?.repo) {
    const parts = opts.repo.split("/");
    if (parts.length === 3) {
      const [hostname, project, repo] = parts;
      const hostConfig = await getHostConfig(hostname);
      if (!hostConfig) throw new Error(`Not authenticated to ${hostname}. Run: bb auth login`);
      return {
        hostname,
        hostConfig,
        project,
        repo,
        api: new BitbucketAPI({ hostname, hostConfig }),
      };
    } else if (parts.length === 2) {
      const [project, repo] = parts;
      const defaultHost = await getDefaultHost();
      if (!defaultHost) throw new Error("Not authenticated to any host. Run: bb auth login");
      return {
        hostname: defaultHost.hostname,
        hostConfig: defaultHost.config,
        project,
        repo,
        api: new BitbucketAPI({ hostname: defaultHost.hostname, hostConfig: defaultHost.config }),
      };
    }
    throw new Error("Invalid repo format. Use PROJECT/repo or hostname/PROJECT/repo");
  }

  const ctx = await detectContext();
  if (!ctx) {
    throw new Error(
      "Could not determine repository context.\n" +
        "Either run this command from within a Bitbucket Server git repo,\n" +
        "or specify --repo PROJECT/repo"
    );
  }
  return ctx;
}

/** Create an API client for a given hostname */
export async function apiForHost(hostname: string): Promise<BitbucketAPI> {
  const hostConfig = await getHostConfig(hostname);
  if (!hostConfig) throw new Error(`Not authenticated to ${hostname}. Run: bb auth login`);
  return new BitbucketAPI({ hostname, hostConfig });
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
