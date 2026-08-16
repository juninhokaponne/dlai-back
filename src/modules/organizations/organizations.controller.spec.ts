import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { createDbMock } from "../../tests/helpes/db-mock.js";
import { mockRequest, mockResponse } from "../../tests/helpes/express-mock.js";

jest.unstable_mockModule("../../database/index.js", () => ({
  db: createDbMock(),
}));

jest.unstable_mockModule("../../shared/utils/security.js", () => ({
  generateVerificationTokenRaw: jest.fn().mockReturnValue("mock-invite-token"),
  inviteTokenExpiry: jest.fn().mockReturnValue(new Date("2026-08-23T00:00:00.000Z")),
  hashPassword: jest.fn().mockResolvedValue("hashed-pw"),
}));

jest.unstable_mockModule("../../shared/email/send-organization-invite-email.js", () => ({
  sendOrganizationInviteEmail: jest.fn().mockResolvedValue(undefined),
}));

const { OrganizationsController } = await import("./organizations.controller.js");
const { db } = await import("../../database/index.js");

describe("OrganizationsController.inviteMember", () => {
  let controller: InstanceType<typeof OrganizationsController>;
  let req: any;
  let res: any;
  let next: jest.Mock;

  beforeEach(() => {
    controller = new OrganizationsController();
    res = mockResponse();
    next = jest.fn();
  });

  it("Should return 409 if the email already belongs to an existing account", async () => {
    req = mockRequest({
      body: { email: "existing@teste.com", role: "member" },
      user: { userId: "admin-1", email: "admin@teste.com", organizationId: "org-1", role: "admin" },
    } as any);

    (db.select as jest.Mock).mockReturnThis();
    (db.from as jest.Mock).mockReturnThis();
    (db.where as jest.Mock).mockReturnThis();
    (db.limit as jest.Mock).mockResolvedValue([{ id: "existing-user" }]);

    await controller.inviteMember(req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ error: "This email already belongs to an existing account." });
  });

  it("Should forward unexpected errors to next()", async () => {
    req = mockRequest({
      body: { email: "new@teste.com", role: "member" },
      user: { userId: "admin-1", email: "admin@teste.com", organizationId: "org-1", role: "admin" },
    } as any);

    (db.select as jest.Mock).mockReturnThis();
    (db.from as jest.Mock).mockReturnThis();
    (db.where as jest.Mock).mockReturnThis();
    (db.limit as jest.Mock).mockRejectedValue(new Error("db down"));

    await controller.inviteMember(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe("OrganizationsController.acceptInvite", () => {
  let controller: InstanceType<typeof OrganizationsController>;
  let req: any;
  let res: any;
  let next: jest.Mock;

  beforeEach(() => {
    controller = new OrganizationsController();
    res = mockResponse();
    next = jest.fn();
  });

  it("Should return 400 if the invite has already been accepted", async () => {
    req = mockRequest({
      params: { token: "some-token" },
      body: { name: "Ana", lastname: "Silva", password: "Abcdefgh1234" },
    } as any);

    (db.select as jest.Mock).mockReturnThis();
    (db.from as jest.Mock).mockReturnThis();
    (db.where as jest.Mock).mockReturnThis();
    (db.limit as jest.Mock).mockResolvedValue([
      {
        id: "invite-1",
        organizationId: "org-1",
        email: "new@teste.com",
        role: "member",
        status: "accepted",
        expiresAt: new Date("2099-01-01"),
      },
    ]);

    await controller.acceptInvite(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "This invite is no longer valid." });
  });

  it("Should return 400 if the invite has expired", async () => {
    req = mockRequest({
      params: { token: "some-token" },
      body: { name: "Ana", lastname: "Silva", password: "Abcdefgh1234" },
    } as any);

    (db.select as jest.Mock).mockReturnThis();
    (db.from as jest.Mock).mockReturnThis();
    (db.where as jest.Mock).mockReturnThis();
    (db.limit as jest.Mock).mockResolvedValue([
      {
        id: "invite-1",
        organizationId: "org-1",
        email: "new@teste.com",
        role: "member",
        status: "pending",
        expiresAt: new Date("2000-01-01"),
      },
    ]);

    await controller.acceptInvite(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "This invite link has expired." });
  });
});

describe("OrganizationsController.updateMemberRole", () => {
  let controller: InstanceType<typeof OrganizationsController>;
  let req: any;
  let res: any;
  let next: jest.Mock;

  beforeEach(() => {
    controller = new OrganizationsController();
    res = mockResponse();
    next = jest.fn();
  });

  it("Should block demoting the last remaining admin", async () => {
    req = mockRequest({
      params: { userId: "00000000-0000-4000-8000-000000000001" },
      body: { role: "member" },
      user: { userId: "admin-1", email: "admin@teste.com", organizationId: "org-1", role: "admin" },
    } as any);

    (db.select as jest.Mock).mockReturnThis();
    (db.from as jest.Mock).mockReturnThis();
    (db.where as jest.Mock).mockReturnThis();
    (db.limit as jest.Mock).mockResolvedValue([{ role: "admin" }]);
    (db.$count as jest.Mock).mockResolvedValue(1);

    await controller.updateMemberRole(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "An organization must have at least one Admin." });
  });
});

describe("OrganizationsController.removeMember", () => {
  let controller: InstanceType<typeof OrganizationsController>;
  let req: any;
  let res: any;
  let next: jest.Mock;

  beforeEach(() => {
    controller = new OrganizationsController();
    res = mockResponse();
    next = jest.fn();
  });

  it("Should block removing the last remaining admin", async () => {
    req = mockRequest({
      params: { userId: "00000000-0000-4000-8000-000000000001" },
      user: { userId: "admin-1", email: "admin@teste.com", organizationId: "org-1", role: "admin" },
    } as any);

    (db.select as jest.Mock).mockReturnThis();
    (db.from as jest.Mock).mockReturnThis();
    (db.innerJoin as jest.Mock).mockReturnThis();
    (db.where as jest.Mock).mockReturnThis();
    (db.limit as jest.Mock).mockResolvedValue([{ role: "admin", name: "Ana" }]);
    (db.$count as jest.Mock).mockResolvedValue(1);

    await controller.removeMember(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "An organization must have at least one Admin." });
  });
});
