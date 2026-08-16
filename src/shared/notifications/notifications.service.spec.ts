import { jest, describe, it, expect } from "@jest/globals";
import { createDbMock } from "../../tests/helpes/db-mock.js";

jest.unstable_mockModule("../../database/index.js", () => ({
  db: createDbMock(),
}));

const { notifyOrganizationAdmins } = await import("./notifications.service.js");
const { db } = await import("../../database/index.js");

describe("notifyOrganizationAdmins", () => {
  it("Should create one notification per admin in the organization", async () => {
    (db.select as jest.Mock).mockReturnThis();
    (db.from as jest.Mock).mockReturnThis();
    (db.where as jest.Mock).mockResolvedValue([{ userId: "admin-1" }, { userId: "admin-2" }]);
    (db.insert as jest.Mock).mockReturnThis();
    (db.values as jest.Mock).mockResolvedValue(undefined);

    await notifyOrganizationAdmins({ organizationId: "org-1", type: "automation_paused_insufficient_credits" });

    expect(db.insert).toHaveBeenCalledTimes(2);
  });

  it("Should never throw, even if the query fails", async () => {
    (db.select as jest.Mock).mockReturnThis();
    (db.from as jest.Mock).mockReturnThis();
    (db.where as jest.Mock).mockRejectedValue(new Error("db down"));

    await expect(
      notifyOrganizationAdmins({ organizationId: "org-1", type: "automation_paused_insufficient_credits" }),
    ).resolves.toBeUndefined();
  });
});
