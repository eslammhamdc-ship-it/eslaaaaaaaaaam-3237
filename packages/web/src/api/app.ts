import type { RouterClient } from "@orpc/server";
import { createApp } from "./__core/app";
import workspace from "./workspace";
import { crm } from "./routes/crm";
import { planning } from "./routes/planning";
import { ping } from "./routes/ping";

// API features are oRPC procedures, one file per feature in ./routes/,
// composed into this router — typed end-to-end via the clients
// (web: src/web/lib/api.ts, mobile: lib/api.ts).
// Keep each routes/ file under 500 lines (`bun run lint` enforces this);
// split into more feature files as they grow.
// Patterns and examples: skills/app/references/api.md
export const router = {
  ping,
  crm,
  planning,
};

export type AppRouter = typeof router;
/** Typed client for the router — used by the web and mobile api clients. */
export type AppRouterClient = RouterClient<AppRouter>;

export function createWorkspaceApp(factory: typeof createApp = createApp) {
  const app = factory(router);
  app.route("/api/workspace", workspace);
  return app;
}
