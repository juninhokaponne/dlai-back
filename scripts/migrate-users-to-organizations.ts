import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../src/database/index.js";
import {
  users,
  organizations,
  organizationMembers,
  newsletters,
  contacts,
  templates,
  automations,
  creditTransactions,
  subscriptions,
} from "../src/database/schema/schema.js";

async function migrateUser(user: typeof users.$inferSelect): Promise<void> {
  const [existingMembership] = await db
    .select({ id: organizationMembers.id })
    .from(organizationMembers)
    .where(eq(organizationMembers.userId, user.id))
    .limit(1);

  if (existingMembership) {
    console.log(`${user.email}: already migrated, skipping`);
    return;
  }

  await db.transaction(async (tx) => {
    const [organization] = await tx
      .insert(organizations)
      .values({
        name: user.company?.trim() || `${user.name}'s workspace`,
        creditBalance: user.creditBalance,
        stripeCustomerId: user.stripeCustomerId,
      })
      .returning();

    await tx.insert(organizationMembers).values({
      organizationId: organization!.id,
      userId: user.id,
      role: "admin",
    });

    await tx.update(newsletters).set({ organizationId: organization!.id }).where(eq(newsletters.userId, user.id));
    await tx.update(contacts).set({ organizationId: organization!.id }).where(eq(contacts.userId, user.id));
    await tx.update(templates).set({ organizationId: organization!.id }).where(eq(templates.userId, user.id));
    await tx.update(automations).set({ organizationId: organization!.id }).where(eq(automations.userId, user.id));
    await tx
      .update(creditTransactions)
      .set({ organizationId: organization!.id })
      .where(eq(creditTransactions.userId, user.id));
    await tx
      .update(subscriptions)
      .set({ organizationId: organization!.id })
      .where(eq(subscriptions.userId, user.id));

    console.log(`${user.email}: migrated -> organization ${organization!.id}`);
  });
}

const allUsers = await db.select().from(users);
for (const user of allUsers) {
  await migrateUser(user);
}

console.log(`Done. Processed ${allUsers.length} user(s).`);
