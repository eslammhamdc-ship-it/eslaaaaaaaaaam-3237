import { currentDatabase } from "./runtime";
import type * as Native from "./native-db";
function proxy<T extends object>(name: "sql" | "db"): T {
  return new Proxy({} as T, {
    get(_target, key) {
      const object = currentDatabase()[name] as any;
      const value = object[key];
      return typeof value === "function" ? value.bind(object) : value;
    },
  });
}
export const sql = proxy<typeof Native.sql>("sql");
export const db = proxy<typeof Native.db>("db");
