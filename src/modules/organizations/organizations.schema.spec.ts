import { describe, it, expect } from "@jest/globals";
import { acceptInviteSchema, inviteMemberSchema, updateMemberRoleSchema } from "./organizations.schema.js";

describe("inviteMemberSchema", () => {
  it("accepts a valid email and role", () => {
    const result = inviteMemberSchema.safeParse({ email: "Person@Example.com", role: "member" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("person@example.com");
    }
  });

  it("rejects an invalid role", () => {
    const result = inviteMemberSchema.safeParse({ email: "person@example.com", role: "owner" });
    expect(result.success).toBe(false);
  });
});

describe("updateMemberRoleSchema", () => {
  it("accepts admin or member", () => {
    expect(updateMemberRoleSchema.safeParse({ role: "admin" }).success).toBe(true);
    expect(updateMemberRoleSchema.safeParse({ role: "member" }).success).toBe(true);
  });
});

describe("acceptInviteSchema", () => {
  it("rejects a weak password", () => {
    const result = acceptInviteSchema.safeParse({ name: "Ana", lastname: "Silva", password: "short" });
    expect(result.success).toBe(false);
  });

  it("accepts a strong password with name and lastname", () => {
    const result = acceptInviteSchema.safeParse({ name: "Ana", lastname: "Silva", password: "Abcdefgh1234" });
    expect(result.success).toBe(true);
  });
});
