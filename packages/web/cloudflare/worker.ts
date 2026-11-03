import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { createWorkspaceApp } from "../src/api/app";
import { runtime } from "../src/api/runtime";
import { databaseRuntime } from "./database";

const app = createWorkspaceApp();

interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  MIDWAY_ALLOW_SETUP?: string;
  MIDWAY_SETUP_TOKEN?: string;
  MIDWAY_SECURE_COOKIES?: string;
}
const api = new Hono()
  .use("*", bodyLimit({ maxSize: 8 * 1024 * 1024 }))
  .all("*", (c) => app.fetch(c.req.raw));
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (!new URL(request.url).pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    if (!env.DB)
      return Response.json({ message: "Database binding DB is missing" }, { status: 503 });
    return runtime.run(
      {
        database: databaseRuntime(env.DB),
        env: {
          ...env,
          NODE_ENV: "production",
          MIDWAY_CLIENT_KDF: "true",
          MIDWAY_SECURE_COOKIES: env.MIDWAY_SECURE_COOKIES || "true",
          MIDWAY_DEMO_MODE: "false",
        },
        limits: {
          attachmentBytes: 1024 * 1024,
          totalUploadBytes: 4 * 1024 * 1024,
          recordBytes: 1024 * 1024,
        },
      },
      () => api.fetch(request),
    );
  },
};
