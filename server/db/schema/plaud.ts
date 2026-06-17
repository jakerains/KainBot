import { relations } from "drizzle-orm";
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";

// Per-user Plaud OAuth connection (access + refresh tokens for the hosted Plaud MCP).
export const plaudConnections = pgTable("plaud_connections", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  tokenExpiresAt: timestamp("token_expires_at", { mode: "date" }),
  accountId: text("account_id"),
  accountEmail: text("account_email"),
  connectedAt: timestamp("connected_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const plaudConnectionsRelations = relations(plaudConnections, ({ one }) => ({
  user: one(user, {
    fields: [plaudConnections.userId],
    references: [user.id],
  }),
}));
