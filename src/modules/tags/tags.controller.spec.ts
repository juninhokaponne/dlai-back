import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { createDbMock } from "../../tests/helpes/db-mock.js";
import { mockRequest, mockResponse } from "../../tests/helpes/express-mock.js";

jest.unstable_mockModule("../../database/index.js", () => ({
  db: createDbMock(),
}));

const { TagsController } = await import("./tags.controller.js");
const { db } = await import("../../database/index.js");

describe("TagsController.create", () => {
  let controller: InstanceType<typeof TagsController>;
  let req: any;
  let res: any;
  let next: jest.Mock;

  beforeEach(() => {
    controller = new TagsController();
    res = mockResponse();
    next = jest.fn();
  });

  it("Should return the existing tag (200) if a tag with that name already exists in the org", async () => {
    req = mockRequest({
      body: { name: "VIP" },
      user: { userId: "user-1", email: "a@teste.com", organizationId: "org-1", role: "member" },
    } as any);

    (db.select as jest.Mock).mockReturnThis();
    (db.from as jest.Mock).mockReturnThis();
    (db.where as jest.Mock).mockReturnThis();
    (db.limit as jest.Mock).mockResolvedValue([{ id: "tag-1", name: "VIP", createdAt: new Date() }]);

    await controller.create(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ tag: { id: "tag-1", name: "VIP", createdAt: expect.any(Date) } });
  });

  it("Should create a new tag (201) if none exists with that name yet", async () => {
    req = mockRequest({
      body: { name: "New Tag" },
      user: { userId: "user-1", email: "a@teste.com", organizationId: "org-1", role: "member" },
    } as any);

    (db.select as jest.Mock).mockReturnThis();
    (db.from as jest.Mock).mockReturnThis();
    (db.where as jest.Mock).mockReturnThis();
    (db.limit as jest.Mock).mockResolvedValue([]);
    (db.insert as jest.Mock).mockReturnThis();
    (db.values as jest.Mock).mockReturnThis();
    (db.returning as jest.Mock).mockResolvedValue([{ id: "tag-2", name: "New Tag", createdAt: new Date() }]);

    await controller.create(req, res, next);

    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("Should forward unexpected errors to next()", async () => {
    req = mockRequest({
      body: { name: "New Tag" },
      user: { userId: "user-1", email: "a@teste.com", organizationId: "org-1", role: "member" },
    } as any);

    (db.select as jest.Mock).mockReturnThis();
    (db.from as jest.Mock).mockReturnThis();
    (db.where as jest.Mock).mockReturnThis();
    (db.limit as jest.Mock).mockRejectedValue(new Error("db down"));

    await controller.create(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

describe("TagsController.remove", () => {
  let controller: InstanceType<typeof TagsController>;
  let req: any;
  let res: any;
  let next: jest.Mock;

  beforeEach(() => {
    controller = new TagsController();
    res = mockResponse();
    next = jest.fn();
  });

  it("Should return 404 if the tag doesn't exist in this organization", async () => {
    req = mockRequest({
      params: { id: "00000000-0000-4000-8000-000000000001" },
      user: { userId: "user-1", email: "a@teste.com", organizationId: "org-1", role: "member" },
    } as any);

    (db.delete as jest.Mock).mockReturnThis();
    (db.where as jest.Mock).mockReturnThis();
    (db.returning as jest.Mock).mockResolvedValue([]);

    await controller.remove(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Tag not found." });
  });
});
