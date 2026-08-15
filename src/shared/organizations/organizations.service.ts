import { eq } from "drizzle-orm";
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
