import { sql, db } from "./native-db";
import { setDefaultDatabase } from "./runtime";
import { createApp } from "./__core/app";
import { createWorkspaceApp } from "./app";
setDefaultDatabase({ sql, db });
export { router } from "./app";
export type { AppRouter, AppRouterClient } from "./app";
export default createWorkspaceApp(createApp);
