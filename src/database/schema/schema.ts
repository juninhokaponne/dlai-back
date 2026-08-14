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
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { TRIAL_CREDITS } from "../../shared/billing/credits.config.js";

export const newsletterViewMode = pgEnum("newsletter_view_mode", ["list", "grid"]);
export const userLocale = pgEnum("user_locale", ["en", "pt", "es"]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  lastName: varchar("last_name", { length: 255 }).notNull(),
  company: varchar({ length: 255 }),
  avatarUrl: text("avatar_url"),
  addressLine1: varchar("address_line1", { length: 255 }),
  addressLine2: varchar("address_line2", { length: 255 }),
  addressCity: varchar("address_city", { length: 255 }),
  addressState: varchar("address_state", { length: 255 }),
  addressPostalCode: varchar("address_postal_code", { length: 20 }),
  addressCountry: varchar("address_country", { length: 255 }),
  age: integer("age"),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  isEmailVerified: boolean("is_email_verified").default(false).notNull(),
  creditBalance: integer("credit_balance").default(TRIAL_CREDITS).notNull(),
  stripeCustomerId: varchar("stripe_customer_id", { length: 255 }).unique(),
  newsletterViewMode: newsletterViewMode("newsletter_view_mode").default("list").notNull(),
  locale: userLocale("locale").default("en").notNull(),
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

export const emailVerificationTokens = pgTable("email_verification_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  hashedToken: text("hashed_token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  hashedToken: text("hashed_token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  refreshTokens: many(refreshTokens),
  emailVerificationTokens: many(emailVerificationTokens),
  passwordResetTokens: many(passwordResetTokens),
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, {
    fields: [refreshTokens.userId],
    references: [users.id],
  }),
}));

export const emailVerificationTokensRelations = relations(emailVerificationTokens, ({ one }) => ({
  user: one(users, {
    fields: [emailVerificationTokens.userId],
    references: [users.id],
  }),
}));

export const passwordResetTokensRelations = relations(passwordResetTokens, ({ one }) => ({
  user: one(users, {
    fields: [passwordResetTokens.userId],
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
  lastErrorMessage: text("last_error_message"),
  recipientCount: integer("recipient_count"),
  isArchived: boolean("is_archived").default(false).notNull(),
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

export const templates = pgTable("templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 100 }),
  contentHtml: text("content_html").notNull(),
  aiGenerated: boolean("ai_generated").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const templatesRelations = relations(templates, ({ one }) => ({
  user: one(users, {
    fields: [templates.userId],
    references: [users.id],
  }),
}));

export const contactStatus = pgEnum("contact_status", [
  "subscribed",
  "unsubscribed",
  "bounced",
  "complained",
  "suppressed",
]);

export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }),
    status: contactStatus("status").default("subscribed").notNull(),
    unsubscribeToken: uuid("unsubscribe_token").defaultRandom().notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [unique("contacts_user_id_email_unique").on(table.userId, table.email)],
);

export const contactsRelations = relations(contacts, ({ one }) => ({
  user: one(users, {
    fields: [contacts.userId],
    references: [users.id],
  }),
}));

export const creditTransactionReason = pgEnum("credit_transaction_reason", [
  "trial_grant",
  "subscription_grant",
  "generation_debit",
  "generation_refund",
  "manual_adjustment",
]);

export const creditTransactions = pgTable("credit_transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  amount: integer("amount").notNull(),
  reason: creditTransactionReason("reason").notNull(),
  newsletterId: uuid("newsletter_id").references(() => newsletters.id, {
    onDelete: "set null",
  }),
  stripeEventId: varchar("stripe_event_id", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const creditTransactionsRelations = relations(
  creditTransactions,
  ({ one }) => ({
    user: one(users, {
      fields: [creditTransactions.userId],
      references: [users.id],
    }),
    newsletter: one(newsletters, {
      fields: [creditTransactions.newsletterId],
      references: [newsletters.id],
    }),
  }),
);

export const notificationType = pgEnum("notification_type", [
  "newsletter_generated",
  "newsletter_generation_failed",
  "newsletter_sent",
  "newsletter_send_failed",
]);

export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  type: notificationType("type").notNull(),
  newsletterId: uuid("newsletter_id").references(() => newsletters.id, {
    onDelete: "set null",
  }),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  newsletter: one(newsletters, {
    fields: [notifications.newsletterId],
    references: [newsletters.id],
  }),
}));

export const subscriptionStatus = pgEnum("subscription_status", [
  "active",
  "past_due",
  "canceled",
  "incomplete",
  "incomplete_expired",
  "trialing",
  "unpaid",
  "paused",
]);

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  plan: varchar("plan", { length: 50 }).notNull(),
  stripeSubscriptionId: varchar("stripe_subscription_id", {
    length: 255,
  })
    .notNull()
    .unique(),
  stripePriceId: varchar("stripe_price_id", { length: 255 }).notNull(),
  status: subscriptionStatus("status").notNull(),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false).notNull(),
  currentPeriodEnd: timestamp("current_period_end").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, {
    fields: [subscriptions.userId],
    references: [users.id],
  }),
}));

export const stripeEvents = pgTable("stripe_events", {
  id: varchar("id", { length: 255 }).primaryKey(),
  type: varchar("type", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
