import { jest, describe, it, expect } from "@jest/globals";
import { createDbMock } from "../../tests/helpes/db-mock.js";

jest.unstable_mockModule("../../database/index.js", () => ({
  db: createDbMock(),
}));

const { resolveSegmentWhereClause, segmentConditionSchema, upsertSegmentSchema } = await import(
  "./segments.service.js"
);

describe("segmentConditionSchema", () => {
  it("accepts a tag condition", () => {
    expect(
      segmentConditionSchema.safeParse({ type: "tag", tagId: "00000000-0000-4000-8000-000000000001", negate: false })
        .success,
    ).toBe(true);
  });

  it("accepts a tagAny condition", () => {
    expect(
      segmentConditionSchema.safeParse({
        type: "tagAny",
        tagIds: ["00000000-0000-4000-8000-000000000001"],
        negate: true,
      }).success,
    ).toBe(true);
  });

  it("accepts a status condition", () => {
    expect(segmentConditionSchema.safeParse({ type: "status", value: "subscribed", negate: false }).success).toBe(
      true,
    );
  });

  it("rejects an unknown condition type", () => {
    expect(segmentConditionSchema.safeParse({ type: "custom", negate: false }).success).toBe(false);
  });
});

describe("upsertSegmentSchema", () => {
  it("accepts a name with an empty conditions array (means: all contacts)", () => {
    expect(upsertSegmentSchema.safeParse({ name: "Everyone", conditions: [] }).success).toBe(true);
  });
});

describe("resolveSegmentWhereClause", () => {
  it("returns undefined for an empty conditions array", () => {
    expect(resolveSegmentWhereClause("org-1", [])).toBeUndefined();
  });

  it("returns a defined SQL clause for a status condition", () => {
    const clause = resolveSegmentWhereClause("org-1", [{ type: "status", value: "subscribed", negate: false }]);
    expect(clause).toBeDefined();
  });

  it("returns a defined SQL clause for a tag condition", () => {
    const clause = resolveSegmentWhereClause("org-1", [
      { type: "tag", tagId: "00000000-0000-4000-8000-000000000001", negate: false },
    ]);
    expect(clause).toBeDefined();
  });
});
