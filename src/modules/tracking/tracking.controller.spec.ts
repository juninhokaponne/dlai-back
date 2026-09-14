import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { createDbMock } from "../../tests/helpes/db-mock.js";
import { mockRequest, mockResponse } from "../../tests/helpes/express-mock.js";

const dbMock = createDbMock();
jest.unstable_mockModule("../../database/index.js", () => ({ db: dbMock }));

const { TrackingController } = await import("./tracking.controller.js");
const { db } = await import("../../database/index.js");

const REAL_ID = "11111111-1111-4111-8111-111111111111";
const EVIL_URL = "https://evil.example.com/phish";
const encodedEvilUrl = Buffer.from(EVIL_URL, "utf-8").toString("base64url");

describe("TrackingController.click", () => {
  const controller = new TrackingController();

  beforeEach(() => {
    jest.clearAllMocks();
    (db.select as jest.Mock).mockReturnThis();
    (db.from as jest.Mock).mockReturnThis();
    (db.where as jest.Mock).mockReturnThis();
    (db.limit as jest.Mock).mockResolvedValue([]);
    (db.update as jest.Mock).mockReturnThis();
    (db.set as jest.Mock).mockReturnThis();
  });

  it("redirects to the encoded URL when sendEventId matches a real tracked event", async () => {
    (db.limit as jest.Mock).mockResolvedValueOnce([{ id: REAL_ID }]);
    const req = mockRequest({ params: { sendEventId: REAL_ID }, query: { u: encodedEvilUrl } });
    const res = mockResponse();

    await controller.click(req, res, jest.fn());

    expect(res.redirect).toHaveBeenCalledWith(302, EVIL_URL);
    expect(db.update).toHaveBeenCalled();
  });

  it("does NOT redirect to the encoded URL when sendEventId does not match any event (open redirect fix)", async () => {
    // db.limit resolves to [] (no matching row) via the beforeEach default.
    const req = mockRequest({ params: { sendEventId: REAL_ID }, query: { u: encodedEvilUrl } });
    const res = mockResponse();

    await controller.click(req, res, jest.fn());

    expect(res.redirect).toHaveBeenCalledWith(302, "/");
    expect(db.update).not.toHaveBeenCalled();
  });

  it("does NOT redirect to the encoded URL when sendEventId is not a well-formed UUID", async () => {
    const req = mockRequest({ params: { sendEventId: "not-a-uuid" }, query: { u: encodedEvilUrl } });
    const res = mockResponse();

    await controller.click(req, res, jest.fn());

    expect(res.redirect).toHaveBeenCalledWith(302, "/");
    expect(db.select).not.toHaveBeenCalled();
  });

  it("falls back to / for a non-http(s) protocol (e.g. javascript:) even with a real event", async () => {
    (db.limit as jest.Mock).mockResolvedValueOnce([{ id: REAL_ID }]);
    const evilScheme = Buffer.from("javascript:alert(1)", "utf-8").toString("base64url");
    const req = mockRequest({ params: { sendEventId: REAL_ID }, query: { u: evilScheme } });
    const res = mockResponse();

    await controller.click(req, res, jest.fn());

    expect(res.redirect).toHaveBeenCalledWith(302, "/");
  });

  it("falls back to / when the u query param is missing or not valid base64url", async () => {
    (db.limit as jest.Mock).mockResolvedValueOnce([{ id: REAL_ID }]);
    const req = mockRequest({ params: { sendEventId: REAL_ID }, query: {} });
    const res = mockResponse();

    await controller.click(req, res, jest.fn());

    expect(res.redirect).toHaveBeenCalledWith(302, "/");
  });
});

describe("TrackingController.open", () => {
  const controller = new TrackingController();

  beforeEach(() => {
    jest.clearAllMocks();
    (db.update as jest.Mock).mockReturnThis();
    (db.set as jest.Mock).mockReturnThis();
    (db.where as jest.Mock).mockResolvedValue(undefined);
  });

  it("always returns the tracking pixel, even for a garbage id", async () => {
    const req = mockRequest({ params: { sendEventId: "not-a-uuid" } });
    const res = mockResponse();

    await controller.open(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });
});
