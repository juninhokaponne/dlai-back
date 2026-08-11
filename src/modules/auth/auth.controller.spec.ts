import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { createDbMock } from "../../tests/helpes/db-mock.js";
import { mockRequest, mockResponse } from "../../tests/helpes/express-mock.js";
import { register } from "node:module";

jest.unstable_mockModule("../../database/index.js", () => ({
  db: createDbMock(),
}));

jest.unstable_mockModule("../../shared/utils/security.js", () => ({
  hashPassword: jest.fn(),
  verifyPassword: jest.fn(),
  generateAccessToken: jest.fn(),
  verifyAccessToken: jest.fn(),
  generateRefreshTokenRaw: jest.fn(),
  hashToken: jest.fn(),
  refreshTokenExpiry: jest.fn(),
  generateVerificationTokenRaw: jest.fn(),
  verificationTokenExpiry: jest.fn(),
}));

jest.unstable_mockModule("./email-verification.service.js", () => ({
  createVerificationToken: jest.fn().mockResolvedValue("mock-token"),
  confirmVerificationToken: jest.fn(),
}));

jest.unstable_mockModule("../../shared/email/send-welcome-email.js", () => ({
  sendWelcomeVerificationEmail: jest.fn().mockResolvedValue(undefined),
}));

jest.unstable_mockModule("./password-reset.service.js", () => ({
  createPasswordResetToken: jest.fn().mockResolvedValue("mock-reset-token"),
  confirmPasswordResetToken: jest.fn(),
}));

jest.unstable_mockModule("../../shared/email/send-password-emails.js", () => ({
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
  sendPasswordChangedEmail: jest.fn().mockResolvedValue(undefined),
}));

const { AuthController } = await import("./auth.controller.js");
const { db } = await import("../../database/index.js");

describe("AuthController.register", () => {
  let controller: InstanceType<typeof AuthController>;
  let req: any;
  let res: any;
  let next: jest.Mock;

  beforeEach(() => {
    controller = new AuthController();
    res = mockResponse();
    next = jest.fn();
  });

  it("Should return 409 if email already exists", async () => {
    req = mockRequest({
      body: { email: "existe@teste.com", name: "X", password: "12345678" },
    });

    (db.select as jest.Mock).mockReturnThis();
    (db.from as jest.Mock).mockReturnThis();
    (db.where as jest.Mock).mockReturnThis();
    (db.limit as jest.Mock).mockResolvedValue([
      { id: "1", email: "existe@teste.com" },
    ]);

    await controller.register(req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ error: "User already exists." });
  });

  it("Should forward unexpected errors to next()", async () => {
    req = mockRequest({
      body: { email: "x@teste.com", name: "X", password: "12345678" },
    });

    (db.select as jest.Mock).mockReturnThis();
    (db.from as jest.Mock).mockReturnThis();
    (db.where as jest.Mock).mockReturnThis();
    (db.limit as jest.Mock).mockRejectedValue(new Error("db down"));

    await controller.register(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(res.status).not.toHaveBeenCalled();
  });
});
