import { Command } from "commander";
import { $ } from "bun";
import { readFile } from "fs/promises";
import chalk from "chalk";
import { resolveContext, getCurrentBranch } from "../../lib/context.js";
import type { CreatePRBody } from "../../lib/api.js";

export function inferTitleFromBranch(branch: string): string {
  return branch
    .replace(/^(feature|bugfix|hotfix)\//i, "")
    .replace(/[-_]/g, " ")
    .replace(/^\w/, (c: string) => c.toUpperCase());
}

export function parseCommitTitleAndBody(message: string): { title: string; body?: string } {
  const normalized = message.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return { title: "" };
  }

  const [rawTitle, ...rest] = normalized.split("\n");
  const title = rawTitle.trim();
  const bodyText = rest.join("\n").trim();

  return {
    title,
    body: bodyText || undefined,
  };
}

async function getLatestCommitTitleAndBody(): Promise<{ title: string; body?: string } | null> {
  try {
    const message = await $`git log -1 --pretty=%B`.text();
    const parsed = parseCommitTitleAndBody(message);
    if (!parsed.title) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function readAllFromStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    process.stdin.on("data", (chunk) => {
      if (typeof chunk === "string") {
        chunks.push(Buffer.from(chunk));
      } else {
        chunks.push(chunk);
      }
    });
    process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    process.stdin.on("error", reject);
    process.stdin.resume();
  });
}

export async function resolvePRDescription(
  body: string | undefined,
  bodyFile: string | undefined,
  templateFile: string | undefined
): Promise<string | undefined> {
  const explicitSources = [
    body !== undefined,
    !!bodyFile,
    !!templateFile,
  ].filter(Boolean).length;

  if (explicitSources > 1) {
    throw new Error("--body, --body-file, and --template are mutually exclusive");
  }

  if (body !== undefined) {
    return body;
  }

  if (!bodyFile) {
    if (!templateFile) {
      return undefined;
    }

    if (templateFile === "-") {
      return await readAllFromStdin();
    }

    return await readFile(templateFile, "utf-8");
  }

  if (bodyFile === "-") {
    return await readAllFromStdin();
  }

  return await readFile(bodyFile, "utf-8");
}

export const prCreateCmd = new Command("create")
  .description("Create a pull request")
  .option("-t, --title <title>", "PR title")
  .option("-b, --body <body>", "PR description")
  .option("-F, --body-file <file>", "Read PR description from file (use '-' to read from stdin)")
  .option("--template <file>", "Read PR description template from file (use '-' to read from stdin)")
  .option("--fill", "Autofill title/body from latest commit message (like gh)")
  .option("-B, --base <branch>", "Base branch (target)", "")
  .option("-H, --head <branch>", "Head branch (source)")
  .option("-r, --reviewer <users...>", "Reviewer usernames")
  .option("-R, --repo <repo>", "Repository in PROJECT/repo format")
  .option("--draft", "Create as a draft PR (if supported)")
  .option("--json", "Output as JSON")
  .action(async (opts) => {
    const ctx = await resolveContext({ repo: opts.repo });
    const head = opts.head ?? (await getCurrentBranch());

    if (!head) {
      console.error(chalk.red("Could not determine source branch. Use --head to specify."));
      process.exit(1);
    }

    let base = opts.base;
    if (!base) {
      try {
        const defaultBranch = await ctx.api.get<{ displayId: string }>(
          `/rest/api/1.0/projects/${ctx.project}/repos/${ctx.repo}/default-branch`
        );
        base = defaultBranch.displayId;
      } catch {
        base = "main";
      }
    }

    let title = opts.title as string | undefined;
    let description: string | undefined;

    try {
      description = await resolvePRDescription(opts.body, opts.bodyFile, opts.template);
    } catch (err: any) {
      console.error(chalk.red(err?.message ?? String(err)));
      process.exit(1);
    }

    if (opts.fill) {
      const fromCommit = await getLatestCommitTitleAndBody();
      if (fromCommit) {
        title = title ?? fromCommit.title;
        description = description ?? fromCommit.body;
      }
    }

    if (!title) {
      title = inferTitleFromBranch(head);
    }

    const prBody: CreatePRBody = {
      title,
      description,
      fromRef: {
        id: `refs/heads/${head}`,
        repository: { slug: ctx.repo, project: { key: ctx.project } },
      },
      toRef: {
        id: `refs/heads/${base}`,
        repository: { slug: ctx.repo, project: { key: ctx.project } },
      },
    };

    if (opts.reviewer) {
      prBody.reviewers = opts.reviewer.map((u: string) => ({ user: { name: u } }));
    }

    const pr = await ctx.api.createPR(ctx.project, ctx.repo, prBody);

    if (opts.json) {
      console.log(JSON.stringify(pr, null, 2));
      return;
    }

    console.log(chalk.green(`✓ Created pull request #${pr.id}`));
    console.log(`  ${chalk.bold(pr.title)}`);
    console.log(`  ${pr.fromRef.displayId} → ${pr.toRef.displayId}`);

    const selfLink = pr.links?.self?.[0]?.href;
    if (selfLink) {
      console.log(`  ${selfLink}`);
    }
  });
