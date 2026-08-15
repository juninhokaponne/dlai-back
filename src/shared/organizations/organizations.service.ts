import { and, eq } from "drizzle-orm";
import { db } from "../../database/index.js";
import { organizationMembers } from "../../database/schema/schema.js";

export type Membership = { organizationId: string; role: "admin" | "member" };

export async function getMembership(userId: string): Promise<Membership | null> {
  const [row] = await db
    .select({ organizationId: organizationMembers.organizationId, role: organizationMembers.role })
    .from(organizationMembers)
    .where(eq(organizationMembers.userId, userId))
    .limit(1);

  return row ?? null;
}

export async function getAdminUserId(organizationId: string): Promise<string> {
  const [row] = await db
    .select({ userId: organizationMembers.userId })
    .from(organizationMembers)
    .where(and(eq(organizationMembers.organizationId, organizationId), eq(organizationMembers.role, "admin")))
    .limit(1);

  if (!row) {
    throw new Error(`Organization ${organizationId} has no admin member.`);
  }

  return row.userId;
}
