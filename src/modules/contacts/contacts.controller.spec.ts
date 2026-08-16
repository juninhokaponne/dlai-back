import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { createDbMock } from "../../tests/helpes/db-mock.js";
import { mockRequest, mockResponse } from "../../tests/helpes/express-mock.js";

jest.unstable_mockModule("../../database/index.js", () => ({
  db: createDbMock(),
}));

jest.unstable_mockModule("../../shared/automations/contact-triggers.js", () => ({
  fireNewSubscriberAutomations: jest.fn().mockResolvedValue(undefined),
}));

const { ContactsController } = await import("./contacts.controller.js");
const { db } = await import("../../database/index.js");

describe("ContactsController.addTag", () => {
  let controller: InstanceType<typeof ContactsController>;
  let req: any;
  let res: any;
  let next: jest.Mock;

  beforeEach(() => {
    controller = new ContactsController();
    res = mockResponse();
    next = jest.fn();
  });

  it("Should return 404 if the contact doesn't belong to this organization", async () => {
    req = mockRequest({
      params: { id: "00000000-0000-4000-8000-000000000001" },
      body: { tagId: "00000000-0000-4000-8000-000000000002" },
      user: { userId: "user-1", email: "a@teste.com", organizationId: "org-1", role: "member" },
    } as any);

    (db.select as jest.Mock).mockReturnThis();
    (db.from as jest.Mock).mockReturnThis();
    (db.where as jest.Mock).mockReturnThis();
    (db.limit as jest.Mock).mockResolvedValue([]);

    await controller.addTag(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Contact not found." });
  });

  it("Should return 404 if the tag doesn't belong to this organization", async () => {
    req = mockRequest({
      params: { id: "00000000-0000-4000-8000-000000000001" },
      body: { tagId: "00000000-0000-4000-8000-000000000002" },
      user: { userId: "user-1", email: "a@teste.com", organizationId: "org-1", role: "member" },
    } as any);

    (db.select as jest.Mock).mockReturnThis();
    (db.from as jest.Mock).mockReturnThis();
    (db.where as jest.Mock).mockReturnThis();
    (db.limit as jest.Mock)
      .mockResolvedValueOnce([{ id: "00000000-0000-4000-8000-000000000001" }])
      .mockResolvedValueOnce([]);

    await controller.addTag(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Tag not found." });
  });
});

describe("ContactsController.bulkTag", () => {
  let controller: InstanceType<typeof ContactsController>;
  let req: any;
  let res: any;
  let next: jest.Mock;

  beforeEach(() => {
    controller = new ContactsController();
    res = mockResponse();
    next = jest.fn();
  });

  it("Should return 404 if the tag doesn't belong to this organization", async () => {
    req = mockRequest({
      body: { contactIds: ["00000000-0000-4000-8000-000000000001"], tagId: "00000000-0000-4000-8000-000000000002" },
      user: { userId: "user-1", email: "a@teste.com", organizationId: "org-1", role: "member" },
    } as any);

    (db.select as jest.Mock).mockReturnThis();
    (db.from as jest.Mock).mockReturnThis();
    (db.where as jest.Mock).mockReturnThis();
    (db.limit as jest.Mock).mockResolvedValue([]);

    await controller.bulkTag(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Tag not found." });
  });

  it("Should tag only the contacts that belong to this organization and return the count", async () => {
    req = mockRequest({
      body: {
        contactIds: ["00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000003"],
        tagId: "00000000-0000-4000-8000-000000000002",
      },
      user: { userId: "user-1", email: "a@teste.com", organizationId: "org-1", role: "member" },
    } as any);

    (db.select as jest.Mock).mockReturnThis();
    (db.from as jest.Mock).mockReturnThis();
    // Two sequential `.where()` calls happen in bulkTag: the first is part of the
    // tag lookup's `.select().from().where().limit()` chain (must keep chaining,
    // so it returns `this`); the second is the contacts lookup, which awaits
    // `.where()` directly with no `.limit()` after it (so it must resolve).
    (db.where as jest.Mock)
      .mockImplementationOnce(function (this: unknown) {
        return this;
      })
      .mockResolvedValueOnce([{ id: "00000000-0000-4000-8000-000000000001" }]);
    (db.limit as jest.Mock).mockResolvedValue([{ id: "00000000-0000-4000-8000-000000000002" }]);
    (db.insert as jest.Mock).mockReturnThis();
    (db.values as jest.Mock).mockReturnThis();
    (db.onConflictDoNothing as jest.Mock) = jest.fn().mockResolvedValue(undefined);

    await controller.bulkTag(req, res, next);

    expect(res.json).toHaveBeenCalledWith({ tagged: 1 });
  });
});
