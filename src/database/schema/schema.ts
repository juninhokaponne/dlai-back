import {
  pgTable,
  uuid,
  varchar,
  integer,
  numeric,
  text,
  boolean,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  lastName: varchar("last_name", { length: 255 }).notNull(),
  company: varchar({ length: 255 }),
  age: integer("age").notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  isEmailVerified: boolean("is_email_verified").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const refreshTokens = pgTable("refresh_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  hashedToken: text("hashed_token").notNull().unique(),
  isRevoked: boolean("is_revoked").default(false).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  refreshTokens: many(refreshTokens),
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, {
    fields: [refreshTokens.userId],
    references: [users.id],
  }),
}));

export const newsletterStatus = pgEnum("newsletter_status", [
  "draft",
  "generating",
  "ready",
  "sending",
  "sent",
  "failed",
]);

export const newsletters = pgTable("newsletters", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  topic: varchar("topic", { length: 500 }).notNull(),
  title: varchar("title", { length: 255 }),
  content: text("content"),
  status: newsletterStatus("status").default("draft").notNull(),
  generationCostUsd: numeric("generation_cost_usd", {
    precision: 10,
    scale: 6,
  })
    .default("0")
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  sentAt: timestamp("sent_at"),
});

export const newslettersRelations = relations(newsletters, ({ one }) => ({
  user: one(users, {
    fields: [newsletters.userId],
    references: [users.id],
  }),
}));
