import { sqliteTable, text, index } from "drizzle-orm/sqlite-core";

export const records = sqliteTable(
  "crm_records",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    kind: text("kind").notNull(),
    companyId: text("company_id"),
    data: text("data", { mode: "json" }).$type<Record<string, any>>().notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [index("crm_owner").on(t.ownerId)],
);
