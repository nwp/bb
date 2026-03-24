import { Command } from "commander";
import chalk from "chalk";
import { getDefaultHost, getHostConfig } from "../../lib/config.js";
import { BitbucketAPI } from "../../lib/api.js";

export const apiCmd = new Command("api")
  .description("Make an authenticated API request to Bitbucket Server")
  .argument("<endpoint>", "API endpoint path (e.g. /rest/api/1.0/projects)")
  .option("-X, --method <method>", "HTTP method", "GET")
  .option("-f, --field <fields...>", "Add a body field (key=value)")
  .option("-H, --hostname <hostname>", "Bitbucket Server hostname")
  .option("--jq <expression>", "Filter JSON output (simple dot notation)")
  .option("-i, --include", "Include HTTP response headers")
  .action(async (endpoint: string, opts) => {
    let hostname: string;
    let hostConfig;

    if (opts.hostname) {
      // Use credentials for the specified hostname
      hostConfig = await getHostConfig(opts.hostname);
      if (!hostConfig) {
        console.error(chalk.red(`Not authenticated to ${opts.hostname}. Run: bb auth login`));
        process.exit(1);
      }
      hostname = opts.hostname;
    } else {
      const host = await getDefaultHost();
      if (!host) {
        console.error(chalk.red("Not authenticated. Run: bb auth login"));
        process.exit(1);
      }
      hostname = host.hostname;
      hostConfig = host.config;
    }

    const api = new BitbucketAPI({ hostname, hostConfig });

    // Build body from --field flags
    let body: Record<string, unknown> | undefined;
    if (opts.field) {
      body = {};
      for (const f of opts.field as string[]) {
        const eq = f.indexOf("=");
        if (eq === -1) {
          console.error(chalk.red(`Invalid field format: ${f}. Use key=value`));
          process.exit(1);
        }
        const key = f.slice(0, eq);
        let value: unknown = f.slice(eq + 1);

        // Try to parse as JSON for booleans/numbers/objects
        try {
          value = JSON.parse(value as string);
        } catch {
          // keep as string
        }
        body[key] = value;
      }
    }

    // Ensure endpoint starts with /
    const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;

    try {
      const result = await api.request(opts.method.toUpperCase(), path, { body });

      if (result === undefined) {
        // 204 No Content
        return;
      }

      // Simple jq-style filtering
      let output = result;
      if (opts.jq) {
        output = resolveJqPath(result, opts.jq);
      }

      console.log(JSON.stringify(output, null, 2));
    } catch (err: any) {
      console.error(chalk.red(err.message));
      process.exit(1);
    }
  });

/** Very simple jq-style path resolver (e.g. ".values[].name", ".size") */
function resolveJqPath(data: any, expr: string): any {
  const path = expr.replace(/^\./, "");
  if (!path) return data;

  const parts = path.split(/\.|\[|\]/).filter(Boolean);
  let current = data;

  for (const part of parts) {
    if (current === null || current === undefined) return null;

    if (part === "" || part === "*") {
      // array expansion
      if (Array.isArray(current)) {
        continue;
      }
    }

    if (Array.isArray(current)) {
      // Map over array
      current = current.map((item) => item?.[part]).flat();
    } else {
      current = current[part];
    }
  }

  return current;
}
