import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { createDbMock } from "../../tests/helpes/db-mock.js";
import { mockRequest, mockResponse } from "../../tests/helpes/express-mock.js";

jest.unstable_mockModule("../../database/index.js", () => ({
  db: createDbMock(),
}));

const { SegmentsController } = await import("./segments.controller.js");
const { db } = await import("../../database/index.js");

describe("SegmentsController.create", () => {
  let controller: InstanceType<typeof SegmentsController>;
  let req: any;
  let res: any;
  let next: jest.Mock;

  beforeEach(() => {
    controller = new SegmentsController();
    res = mockResponse();
    next = jest.fn();
  });

  it("Should return 400 if a referenced tag doesn't belong to this organization", async () => {
    req = mockRequest({
      body: {
        name: "VIP subscribers",
        conditions: [{ type: "tag", tagId: "00000000-0000-4000-8000-000000000001", negate: false }],
      },
      user: { userId: "user-1", email: "a@teste.com", organizationId: "org-1", role: "member" },
    } as any);

    (db.select as jest.Mock).mockReturnThis();
    (db.from as jest.Mock).mockReturnThis();
    (db.where as jest.Mock).mockResolvedValue([]);

    await controller.create(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "One or more tags in this segment don't exist." });
  });

  it("Should create the segment and unwrap conditions in the response when tags are valid", async () => {
    req = mockRequest({
      body: { name: "Everyone subscribed", conditions: [{ type: "status", value: "subscribed", negate: false }] },
      user: { userId: "user-1", email: "a@teste.com", organizationId: "org-1", role: "member" },
    } as any);

    (db.select as jest.Mock).mockReturnThis();
    (db.from as jest.Mock).mockReturnThis();
    (db.where as jest.Mock).mockResolvedValue([]);
    (db.insert as jest.Mock).mockReturnThis();
    (db.values as jest.Mock).mockReturnThis();
    (db.returning as jest.Mock).mockResolvedValue([
      {
        id: "segment-1",
        name: "Everyone subscribed",
        rules: { conditions: [{ type: "status", value: "subscribed", negate: false }] },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    await controller.create(req, res, next);

    expect(res.status).toHaveBeenCalledWith(201);
    const payload = (res.json as jest.Mock).mock.calls[0][0];
    expect(payload.segment.conditions).toEqual([{ type: "status", value: "subscribed", negate: false }]);
  });
});

describe("SegmentsController.remove", () => {
  let controller: InstanceType<typeof SegmentsController>;
  let req: any;
  let res: any;
  let next: jest.Mock;

  beforeEach(() => {
    controller = new SegmentsController();
    res = mockResponse();
    next = jest.fn();
  });

  it("Should return 404 if the segment doesn't exist in this organization", async () => {
    req = mockRequest({
      params: { id: "00000000-0000-4000-8000-000000000001" },
      user: { userId: "user-1", email: "a@teste.com", organizationId: "org-1", role: "member" },
    } as any);

    (db.delete as jest.Mock).mockReturnThis();
    (db.where as jest.Mock).mockReturnThis();
    (db.returning as jest.Mock).mockResolvedValue([]);

    await controller.remove(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Segment not found." });
  });
});
