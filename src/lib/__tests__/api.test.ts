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
});
