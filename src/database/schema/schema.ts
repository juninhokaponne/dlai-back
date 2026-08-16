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
  jsonb,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { TRIAL_CREDITS } from "../../shared/billing/credits.config.js";

export const newsletterViewMode = pgEnum("newsletter_view_mode", ["list", "grid"]);
export const userLocale = pgEnum("user_locale", ["en", "pt", "es"]);
export const automationRunStatus = pgEnum("automation_run_status", ["running", "completed", "failed"]);
export const automationRunContactStatus = pgEnum("automation_run_contact_status", [
  "pending",
  "waiting",
  "completed",
  "failed",
]);
export const organizationRole = pgEnum("organization_role", ["admin", "member"]);
export const organizationInviteStatus = pgEnum("organization_invite_status", [
  "pending",
  "accepted",
  "expired",
  "revoked",
]);

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
  newsletterViewMode: newsletterViewMode("newsletter_view_mode").default("list").notNull(),
  locale: userLocale("locale").default("en").notNull(),
  timezone: varchar("timezone", { length: 64 }).default("America/Sao_Paulo").notNull(),
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
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
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
  organization: one(organizations, {
    fields: [newsletters.organizationId],
    references: [organizations.id],
  }),
}));

export const templates = pgTable("templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
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
  organization: one(organizations, {
    fields: [templates.organizationId],
    references: [organizations.id],
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
    organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }),
    status: contactStatus("status").default("subscribed").notNull(),
    unsubscribeToken: uuid("unsubscribe_token").defaultRandom().notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [unique("contacts_organization_id_email_unique").on(table.organizationId, table.email)],
);

export const contactsRelations = relations(contacts, ({ one, many }) => ({
  user: one(users, {
    fields: [contacts.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [contacts.organizationId],
    references: [organizations.id],
  }),
  contactTags: many(contactTags),
}));

export const tags = pgTable(
  "tags",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [unique("tags_organization_id_name_unique").on(table.organizationId, table.name)],
);

export const tagsRelations = relations(tags, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [tags.organizationId],
    references: [organizations.id],
  }),
  contactTags: many(contactTags),
}));

export const contactTags = pgTable(
  "contact_tags",
  {
    contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "cascade" }).notNull(),
    tagId: uuid("tag_id").references(() => tags.id, { onDelete: "cascade" }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.contactId, table.tagId] })],
);

export const contactTagsRelations = relations(contactTags, ({ one }) => ({
  contact: one(contacts, {
    fields: [contactTags.contactId],
    references: [contacts.id],
  }),
  tag: one(tags, {
    fields: [contactTags.tagId],
    references: [tags.id],
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
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
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
    organization: one(organizations, {
      fields: [creditTransactions.organizationId],
      references: [organizations.id],
    }),
  }),
);

export const notificationType = pgEnum("notification_type", [
  "newsletter_generated",
  "newsletter_generation_failed",
  "newsletter_sent",
  "newsletter_send_failed",
  "automation_paused_insufficient_credits",
  "automation_run_failed",
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
  organizationId: uuid("organization_id")
    .references(() => organizations.id, { onDelete: "cascade" })
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
  organization: one(organizations, {
    fields: [subscriptions.organizationId],
    references: [organizations.id],
  }),
}));

export const stripeEvents = pgTable("stripe_events", {
  id: varchar("id", { length: 255 }).primaryKey(),
  type: varchar("type", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const automationStatus = pgEnum("automation_status", ["draft", "active"]);

export const automations = pgTable("automations", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  status: automationStatus("status").default("draft").notNull(),
  nodes: jsonb("nodes").default([]).notNull(),
  edges: jsonb("edges").default([]).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  nextRunAt: timestamp("next_run_at"),
  lastRunAt: timestamp("last_run_at"),
});

export const automationsRelations = relations(automations, ({ one }) => ({
  user: one(users, {
    fields: [automations.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [automations.organizationId],
    references: [organizations.id],
  }),
}));

export const automationRuns = pgTable("automation_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  automationId: uuid("automation_id")
    .references(() => automations.id, { onDelete: "cascade" })
    .notNull(),
  newsletterId: uuid("newsletter_id").references(() => newsletters.id, { onDelete: "set null" }),
  status: automationRunStatus("status").default("running").notNull(),
  triggeredAt: timestamp("triggered_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const automationRunsRelations = relations(automationRuns, ({ one, many }) => ({
  automation: one(automations, {
    fields: [automationRuns.automationId],
    references: [automations.id],
  }),
  newsletter: one(newsletters, {
    fields: [automationRuns.newsletterId],
    references: [newsletters.id],
  }),
  runContacts: many(automationRunContacts),
}));

export const automationRunContacts = pgTable("automation_run_contacts", {
  id: uuid("id").defaultRandom().primaryKey(),
  runId: uuid("run_id")
    .references(() => automationRuns.id, { onDelete: "cascade" })
    .notNull(),
  automationId: uuid("automation_id")
    .references(() => automations.id, { onDelete: "cascade" })
    .notNull(),
  contactId: uuid("contact_id")
    .references(() => contacts.id, { onDelete: "cascade" })
    .notNull(),
  currentNodeId: varchar("current_node_id", { length: 255 }).notNull(),
  status: automationRunContactStatus("status").default("pending").notNull(),
  waitUntil: timestamp("wait_until"),
  lastSendEventId: uuid("last_send_event_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const automationRunContactsRelations = relations(automationRunContacts, ({ one }) => ({
  run: one(automationRuns, {
    fields: [automationRunContacts.runId],
    references: [automationRuns.id],
  }),
  contact: one(contacts, {
    fields: [automationRunContacts.contactId],
    references: [contacts.id],
  }),
}));

export const automationSendEvents = pgTable("automation_send_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  runContactId: uuid("run_contact_id")
    .references(() => automationRunContacts.id, { onDelete: "cascade" })
    .notNull(),
  contactId: uuid("contact_id")
    .references(() => contacts.id, { onDelete: "cascade" })
    .notNull(),
  newsletterId: uuid("newsletter_id").references(() => newsletters.id, { onDelete: "set null" }),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
  openedAt: timestamp("opened_at"),
  clickedAt: timestamp("clicked_at"),
});

export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  creditBalance: integer("credit_balance").default(TRIAL_CREDITS).notNull(),
  stripeCustomerId: varchar("stripe_customer_id", { length: 255 }).unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const organizationsRelations = relations(organizations, ({ many }) => ({
  members: many(organizationMembers),
  invites: many(organizationInvites),
}));

export const organizationMembers = pgTable("organization_members", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id, { onDelete: "cascade" })
    .notNull(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  role: organizationRole("role").default("member").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const organizationMembersRelations = relations(organizationMembers, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationMembers.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [organizationMembers.userId],
    references: [users.id],
  }),
}));

export const organizationInvites = pgTable("organization_invites", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id, { onDelete: "cascade" })
    .notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  role: organizationRole("role").default("member").notNull(),
  invitedByUserId: uuid("invited_by_user_id").references(() => users.id, { onDelete: "set null" }),
  token: varchar("token", { length: 255 }).notNull().unique(),
  status: organizationInviteStatus("status").default("pending").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const organizationInvitesRelations = relations(organizationInvites, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationInvites.organizationId],
    references: [organizations.id],
  }),
  invitedBy: one(users, {
    fields: [organizationInvites.invitedByUserId],
    references: [users.id],
  }),
}));

export const automationSendEventsRelations = relations(automationSendEvents, ({ one }) => ({
  runContact: one(automationRunContacts, {
    fields: [automationSendEvents.runContactId],
    references: [automationRunContacts.id],
  }),
  contact: one(contacts, {
    fields: [automationSendEvents.contactId],
    references: [contacts.id],
  }),
}));
