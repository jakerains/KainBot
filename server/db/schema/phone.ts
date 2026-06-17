import { pgTable, primaryKey, text, uniqueIndex } from "drizzle-orm/pg-core";

export const phoneLinks = pgTable("phone_links", {
  appUserId: text("app_user_id").notNull(),
  phoneNumber: text("phone_number").notNull(),
  linkedAt: text("linked_at").notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => [
  primaryKey({ columns: [table.phoneNumber] }),
  uniqueIndex("phone_links_app_user_idx").on(table.appUserId),
]);
