import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { BitbucketAPI, APIError } from "../api.js";

// ── Mock server ──────────────────────────────────────────────────

let server: ReturnType<typeof Bun.serve>;
let basePort: number;

beforeAll(() => {
  server = Bun.serve({
    port: 0, // random available port
    fetch(req) {
      const url = new URL(req.url);
      const auth = req.headers.get("authorization");

      // Auth check
      if (auth !== "Bearer test-token") {
        return Response.json({ errors: [{ message: "Unauthorized" }] }, { status: 401 });
      }

      // Routes
      if (url.pathname === "/rest/api/1.0/projects" && req.method === "GET") {
        const start = parseInt(url.searchParams.get("start") ?? "0");
        if (start === 0) {
          return Response.json({
            size: 2,
            limit: 2,
            start: 0,
            isLastPage: false,
            nextPageStart: 2,
            values: [
              { key: "PROJ1", id: 1, name: "Project One" },
              { key: "PROJ2", id: 2, name: "Project Two" },
            ],
          });
        } else {
          return Response.json({
            size: 1,
            limit: 2,
            start: 2,
            isLastPage: true,
            values: [{ key: "PROJ3", id: 3, name: "Project Three" }],
          });
        }
      }

      if (url.pathname === "/rest/api/1.0/test-post" && req.method === "POST") {
        return req.json().then((body) =>
          Response.json({ received: body })
        );
      }

      if (url.pathname === "/rest/api/1.0/no-content" && req.method === "DELETE") {
        return new Response(null, { status: 204 });
      }

      if (url.pathname === "/rest/api/1.0/error") {
        return Response.json(
          { errors: [{ message: "Something went wrong" }, { message: "Another error" }] },
          { status: 400 }
        );
      }

      if (url.pathname === "/rest/api/1.0/plain-error") {
        return new Response("Internal Server Error", { status: 500 });
      }

      // PR endpoints
      const prMatch = url.pathname.match(
        /^\/rest\/api\/1\.0\/projects\/(\w+)\/repos\/([\w-]+)\/pull-requests(?:\/(\d+)(?:\/(reopen|merge|decline|diff|activities|comments|approve))?)?$/
      );
      if (prMatch) {
        const [, , , prIdStr, action] = prMatch;

        if (!prIdStr && req.method === "GET") {
          return Response.json({
            size: 1, limit: 25, start: 0, isLastPage: true,
            values: [
              { id: 42, version: 1, title: "Test PR", state: "OPEN",
                fromRef: { id: "refs/heads/feature/test", displayId: "feature/test", latestCommit: "abc123" },
                toRef: { id: "refs/heads/main", displayId: "main", latestCommit: "def456" },
                author: { user: { name: "tester", displayName: "Tester" } },
                reviewers: [{ user: { name: "reviewer1", displayName: "Reviewer One" }, status: "UNAPPROVED" }],
              },
            ],
          });
        }

        const prId = parseInt(prIdStr ?? "0", 10);

        if (action === "reopen" && req.method === "POST") {
          return Response.json({ id: prId, version: 2, state: "OPEN", title: "Reopened PR",
            fromRef: { displayId: "feature/test" }, toRef: { displayId: "main" } });
        }

        if (!action && req.method === "PUT") {
          return req.json().then((body: Record<string, unknown>) =>
            Response.json({ id: prId, version: (body.version as number) + 1, state: "OPEN",
              title: body.title ?? "Original Title",
              description: body.description ?? "",
              draft: body.draft ?? false,
              fromRef: { displayId: "feature/test" },
              toRef: { displayId: "main" },
              reviewers: (body.reviewers as Array<{ user: { name: string } }> ?? []).map((r) => ({
                user: { name: r.user.name, displayName: r.user.name },
                status: "UNAPPROVED",
              })),
            })
          );
        }

        if (!action && req.method === "GET" && prId) {
          return Response.json({ id: prId, version: 1, title: "Test PR", state: "OPEN",
            fromRef: { id: "refs/heads/feature/test", displayId: "feature/test", latestCommit: "abc123" },
            toRef: { id: "refs/heads/main", displayId: "main" },
            author: { user: { name: "tester" } },
            reviewers: [{ user: { name: "reviewer1", displayName: "Reviewer One" }, status: "UNAPPROVED" }],
          });
        }
      }

      // Build status
      const buildMatch = url.pathname.match(/^\/rest\/build-status\/1\.0\/commits\/(\w+)$/);
      if (buildMatch && req.method === "GET") {
        return Response.json({
          size: 2, limit: 25, start: 0, isLastPage: true,
          values: [
            { state: "SUCCESSFUL", key: "build-1", name: "CI Build", url: "https://ci.example.com/1", dateAdded: Date.now() },
            { state: "FAILED", key: "build-2", name: "Lint", url: "https://ci.example.com/2", dateAdded: Date.now() },
          ],
        });
      }

      return Response.json({ errors: [{ message: "Not found" }] }, { status: 404 });
    },
  });
  basePort = server.port!;
});

afterAll(() => {
  server.stop();
});

function createAPI() {
  return new BitbucketAPI({
    hostname: `localhost:${basePort}`,
    hostConfig: { token: "test-token", protocol: "http" },
  });
}

function createBadAuthAPI() {
  return new BitbucketAPI({
    hostname: `localhost:${basePort}`,
    hostConfig: { token: "wrong-token", protocol: "http" },
  });
}

// ── Tests ────────────────────────────────────────────────────────

describe("BitbucketAPI", () => {
  describe("authentication", () => {
    test("sends Bearer token in Authorization header", async () => {
      const api = createAPI();
      const result = await api.get("/rest/api/1.0/projects");
      expect(result).toBeDefined();
    });

    test("rejects with 401 for invalid token", async () => {
      const api = createBadAuthAPI();
      try {
        await api.get("/rest/api/1.0/projects");
        expect(true).toBe(false); // should not reach
      } catch (err) {
        expect(err).toBeInstanceOf(APIError);
        expect((err as APIError).status).toBe(401);
      }
    });
  });

  describe("GET requests", () => {
    test("returns parsed JSON", async () => {
      const api = createAPI();
      const result = await api.get<{ values: unknown[] }>("/rest/api/1.0/projects");
      expect(result.values).toHaveLength(2);
    });

    test("passes query parameters", async () => {
      const api = createAPI();
      const result = await api.get<{ start: number }>("/rest/api/1.0/projects", { start: "2" });
      expect(result).toBeDefined();
    });
  });

  describe("POST requests", () => {
    test("sends JSON body", async () => {
      const api = createAPI();
      const result = await api.post<{ received: { foo: string } }>("/rest/api/1.0/test-post", {
        foo: "bar",
      });
      expect(result.received.foo).toBe("bar");
    });
  });

  describe("DELETE requests", () => {
    test("handles 204 No Content", async () => {
      const api = createAPI();
      const result = await api.delete("/rest/api/1.0/no-content");
      expect(result).toBeUndefined();
    });
  });

  describe("pagination", () => {
    test("fetches all pages automatically", async () => {
      const api = createAPI();
      const all = await api.paginate<{ key: string }>("/rest/api/1.0/projects");
      expect(all).toHaveLength(3);
      expect(all.map((p) => p.key)).toEqual(["PROJ1", "PROJ2", "PROJ3"]);
    });
  });

  describe("error handling", () => {
    test("throws APIError with structured error messages", async () => {
      const api = createAPI();
      try {
        await api.get("/rest/api/1.0/error");
        expect(true).toBe(false);
      } catch (err) {
        expect(err).toBeInstanceOf(APIError);
        const apiErr = err as APIError;
        expect(apiErr.status).toBe(400);
        expect(apiErr.detail).toContain("Something went wrong");
        expect(apiErr.detail).toContain("Another error");
      }
    });

    test("handles plain text error responses", async () => {
      const api = createAPI();
      try {
        await api.get("/rest/api/1.0/plain-error");
        expect(true).toBe(false);
      } catch (err) {
        expect(err).toBeInstanceOf(APIError);
        expect((err as APIError).status).toBe(500);
        expect((err as APIError).detail).toBe("Internal Server Error");
      }
    });

    test("throws APIError for 404", async () => {
      const api = createAPI();
      try {
        await api.get("/rest/api/1.0/nonexistent");
        expect(true).toBe(false);
      } catch (err) {
        expect(err).toBeInstanceOf(APIError);
        expect((err as APIError).status).toBe(404);
      }
    });
  });

  describe("PR convenience methods", () => {
    test("listPRs returns PRs for a repo", async () => {
      const api = createAPI();
      const prs = await api.listPRs("PROJ", "my-repo");
      expect(prs).toHaveLength(1);
      expect(prs[0].id).toBe(42);
      expect(prs[0].fromRef.displayId).toBe("feature/test");
    });

    test("getPR returns a single PR", async () => {
      const api = createAPI();
      const pr = await api.getPR("PROJ", "my-repo", 42);
      expect(pr.id).toBe(42);
      expect(pr.title).toBe("Test PR");
    });

    test("updatePR sends PUT and returns updated PR", async () => {
      const api = createAPI();
      const updated = await api.updatePR("PROJ", "my-repo", 42, {
        version: 1,
        title: "Updated Title",
        reviewers: [{ user: { name: "jsmith" } }],
      });
      expect(updated.title).toBe("Updated Title");
      expect(updated.version).toBe(2);
      expect(updated.reviewers[0].user.name).toBe("jsmith");
    });

    test("updatePR can set draft to false", async () => {
      const api = createAPI();
      const updated = await api.updatePR("PROJ", "my-repo", 42, {
        version: 1,
        draft: false,
      });
      expect(updated.draft).toBe(false);
    });

    test("reopenPR sends POST to reopen endpoint", async () => {
      const api = createAPI();
      const reopened = await api.reopenPR("PROJ", "my-repo", 42, 1);
      expect(reopened.id).toBe(42);
      expect(reopened.state).toBe("OPEN");
    });
  });

  describe("build status", () => {
    test("getBuildStatus returns statuses for a commit", async () => {
      const api = createAPI();
      const statuses = await api.getBuildStatus("abc123");
      expect(statuses).toHaveLength(2);
      expect(statuses[0].state).toBe("SUCCESSFUL");
      expect(statuses[0].name).toBe("CI Build");
      expect(statuses[1].state).toBe("FAILED");
      expect(statuses[1].name).toBe("Lint");
    });
  });
});
