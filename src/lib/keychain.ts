import { $ } from "bun";

const SERVICE = "bb-cli";

/**
 * Secure token storage using the OS keychain.
 *
 * - macOS: uses `security` (Keychain Services)
 * - Linux: uses `secret-tool` (libsecret / GNOME Keyring / KWallet)
 * - Fallback: returns null so the caller can fall back to file storage
 *
 * This mirrors how `gh` handles credential storage.
 */

export interface KeychainBackend {
  name: string;
  get(account: string): Promise<string | null>;
  set(account: string, token: string): Promise<boolean>;
  delete(account: string): Promise<boolean>;
}

// ── macOS Keychain ───────────────────────────────────────────────

const macosKeychain: KeychainBackend = {
  name: "macOS Keychain",

  async get(account: string): Promise<string | null> {
    try {
      const result = await $`security find-generic-password -s ${SERVICE} -a ${account} -w`.text();
      return result.trim() || null;
    } catch {
      return null;
    }
  },

  async set(account: string, token: string): Promise<boolean> {
    try {
      await $`security delete-generic-password -s ${SERVICE} -a ${account}`.quiet().nothrow();
      await $`security add-generic-password -s ${SERVICE} -a ${account} -w ${token}`.quiet();
      return true;
    } catch {
      return false;
    }
  },

  async delete(account: string): Promise<boolean> {
    try {
      await $`security delete-generic-password -s ${SERVICE} -a ${account}`.quiet();
      return true;
    } catch {
      return false;
    }
  },
};

// ── Linux secret-tool (libsecret) ────────────────────────────────

const linuxKeychain: KeychainBackend = {
  name: "secret-tool (libsecret)",

  async get(account: string): Promise<string | null> {
    try {
      const result = await $`secret-tool lookup service ${SERVICE} account ${account}`.text();
      return result.trim() || null;
    } catch {
      return null;
    }
  },

  async set(account: string, token: string): Promise<boolean> {
    try {
      const proc = Bun.spawn(
        ["secret-tool", "store", "--label", `bb token for ${account}`, "service", SERVICE, "account", account],
        { stdin: "pipe" }
      );
      proc.stdin.write(token);
      proc.stdin.end();
      const exitCode = await proc.exited;
      return exitCode === 0;
    } catch {
      return false;
    }
  },

  async delete(account: string): Promise<boolean> {
    try {
      await $`secret-tool clear service ${SERVICE} account ${account}`.quiet();
      return true;
    } catch {
      return false;
    }
  },
};

// ── Backend detection ────────────────────────────────────────────

let _backend: KeychainBackend | null | undefined;

async function isCommandAvailable(cmd: string): Promise<boolean> {
  try {
    await $`which ${cmd}`.quiet();
    return true;
  } catch {
    return false;
  }
}

export async function getKeychainBackend(): Promise<KeychainBackend | null> {
  if (_backend !== undefined) return _backend;

  if (process.platform === "darwin" && await isCommandAvailable("security")) {
    _backend = macosKeychain;
  } else if (process.platform === "linux" && await isCommandAvailable("secret-tool")) {
    _backend = linuxKeychain;
  } else {
    _backend = null;
  }

  return _backend;
}

// ── Public API ───────────────────────────────────────────────────

/** Store a token securely. Returns true if keychain was used. */
export async function setToken(hostname: string, token: string): Promise<boolean> {
  const backend = await getKeychainBackend();
  if (backend) {
    return backend.set(hostname, token);
  }
  return false;
}

/** Retrieve a token. Returns null if not found or no keychain. */
export async function getToken(hostname: string): Promise<string | null> {
  const backend = await getKeychainBackend();
  if (backend) {
    return backend.get(hostname);
  }
  return null;
}

/** Delete a token. Returns true if keychain was used. */
export async function deleteToken(hostname: string): Promise<boolean> {
  const backend = await getKeychainBackend();
  if (backend) {
    return backend.delete(hostname);
  }
  return false;
}

/** Get the name of the active keychain backend, or null. */
export async function getKeychainName(): Promise<string | null> {
  const backend = await getKeychainBackend();
  return backend?.name ?? null;
}
