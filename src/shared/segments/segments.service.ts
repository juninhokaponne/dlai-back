import { and, eq, inArray, not } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../database/index.js";
import { contacts, contactStatus, contactTags, segments, tags } from "../../database/schema/schema.js";

export const segmentConditionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("tag"), tagId: z.string().uuid(), negate: z.boolean() }),
  z.object({ type: z.literal("tagAny"), tagIds: z.array(z.string().uuid()).min(1).max(20), negate: z.boolean() }),
  z.object({ type: z.literal("status"), value: z.enum(contactStatus.enumValues), negate: z.boolean() }),
]);

export type SegmentCondition = z.infer<typeof segmentConditionSchema>;

export const upsertSegmentSchema = z.object({
  name: z.string().trim().min(1, "Segment name is required.").max(255),
  conditions: z.array(segmentConditionSchema).max(20),
});

// The single place a segment's stored rule becomes a real SQL filter — Stage
// 3's send-targeting code reuses this unchanged, so any future rule-shape
// change only has to happen here.
export function resolveSegmentWhereClause(organizationId: string, conditions: SegmentCondition[]) {
  if (conditions.length === 0) return undefined;

  const clauses = conditions.map((condition) => {
    if (condition.type === "status") {
      const base = eq(contacts.status, condition.value);
      return condition.negate ? not(base) : base;
    }

    const tagIds = condition.type === "tag" ? [condition.tagId] : condition.tagIds;
    // Scoped by organizationId here too (not just at write-time validation)
    // as defense in depth — a segment's `rules` JSON is unvalidated storage,
    // so this must never trust a stored tag id belongs to this org.
    const base = inArray(
      contacts.id,
      db
        .select({ id: contactTags.contactId })
        .from(contactTags)
        .innerJoin(tags, eq(contactTags.tagId, tags.id))
        .where(and(inArray(contactTags.tagId, tagIds), eq(tags.organizationId, organizationId))),
    );
    return condition.negate ? not(base) : base;
  });

  return and(...clauses);
}

// The one place a send node's "audience" config (either "all"/unset, or a
// segment id) becomes a condition list. Returns `null` when a specific
// segment id was requested but no longer resolves (deleted) - callers must
// treat that as "zero recipients", never fall back to "all contacts", since
// silently widening a deliberately-narrowed audience is a safety issue, not
// a convenience.
export async function resolveAudienceConditions(
  organizationId: string,
  audience: string | null | undefined,
): Promise<SegmentCondition[] | null> {
  if (!audience || audience === "all") return [];

  const [segment] = await db
    .select({ rules: segments.rules })
    .from(segments)
    .where(and(eq(segments.id, audience), eq(segments.organizationId, organizationId)))
    .limit(1);

  if (!segment) return null;
  return (segment.rules as { conditions: SegmentCondition[] }).conditions;
}
