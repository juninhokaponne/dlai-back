import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { createDbMock } from "../../tests/helpes/db-mock.js";
import { mockRequest, mockResponse } from "../../tests/helpes/express-mock.js";

jest.unstable_mockModule("../../database/index.js", () => ({
  db: createDbMock(),
}));

jest.unstable_mockModule("../../shared/utils/security.js", () => ({
  hashPassword: jest.fn(),
  verifyPassword: jest.fn(),
  generateAccessToken: jest.fn(),
  generateRefreshTokenRaw: jest.fn(),
  hashToken: jest.fn(),
}));

const { AuthController } = await import("./auth.controller.js");
const { db } = await import("../../database/index.js");

describe("AuthController.register", () => {
  let controller: InstanceType<typeof AuthController>;
  let req: any;
  let res: any;

  beforeEach(() => {
    controller = new AuthController();
    res = mockResponse();
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

    await controller.register(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ error: "User already exists." });
  });
});
