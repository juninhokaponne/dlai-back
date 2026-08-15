import { jest, describe, it, expect } from "@jest/globals";
import { requireRole } from "./auth.js";
import { mockResponse } from "../../tests/helpes/express-mock.js";

describe("requireRole", () => {
  it("calls next() when the user has the required role", () => {
    const req: any = { user: { userId: "u1", email: "a@b.com", organizationId: "o1", role: "admin" } };
    const res = mockResponse();
    const next = jest.fn();

    requireRole("admin")(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("returns 403 when the user has a different role", () => {
    const req: any = { user: { userId: "u1", email: "a@b.com", organizationId: "o1", role: "member" } };
    const res = mockResponse();
    const next = jest.fn();

    requireRole("admin")(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: "You don't have permission to do this." });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when there is no authenticated user", () => {
    const req: any = {};
    const res = mockResponse();
    const next = jest.fn();

    requireRole("admin")(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
