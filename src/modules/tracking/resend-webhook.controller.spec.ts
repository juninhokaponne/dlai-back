import { jest, describe, it, expect, beforeEach, afterAll } from "@jest/globals";
import { createDbMock } from "../../tests/helpes/db-mock.js";
import { mockRequest, mockResponse } from "../../tests/helpes/express-mock.js";

const dbMock = createDbMock();
jest.unstable_mockModule("../../database/index.js", () => ({ db: dbMock }));

const verifyMock = jest.fn();
jest.unstable_mockModule("svix", () => ({
  Webhook: jest.fn().mockImplementation(() => ({ verify: verifyMock })),
}));

const { handleResendWebhook } = await import("./resend-webhook.controller.js");
const { db } = await import("../../database/index.js");

const ORIGINAL_SECRET = process.env.RESEND_WEBHOOK_SECRET;

function requestWith(body: unknown, headers: Record<string, string> | null = {
  "svix-id": "msg_1",
  "svix-timestamp": "1700000000",
  "svix-signature": "v1,abc",
}) {
  return mockRequest({
    headers: (headers ?? {}) as any,
    body: Buffer.from(JSON.stringify(body)) as any,
  });
}

describe("handleResendWebhook", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.RESEND_WEBHOOK_SECRET = "whsec_test";
    (db.where as jest.Mock).mockReturnThis();
    (db.limit as jest.Mock).mockReturnThis();
    (db.set as jest.Mock).mockReturnThis();
    (db.update as jest.Mock).mockReturnThis();
  });

  afterAll(() => {
    process.env.RESEND_WEBHOOK_SECRET = ORIGINAL_SECRET;
  });

  it("returns 500 when RESEND_WEBHOOK_SECRET is not set", async () => {
    delete process.env.RESEND_WEBHOOK_SECRET;
    const res = mockResponse();
    await handleResendWebhook(requestWith({}), res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("returns 400 when svix headers are missing", async () => {
    const res = mockResponse();
    await handleResendWebhook(requestWith({}, {}), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 400 when signature verification fails", async () => {
    verifyMock.mockImplementation(() => {
      throw new Error("bad signature");
    });
    const res = mockResponse();
    await handleResendWebhook(requestWith({ type: "email.delivered", data: { email_id: "e1" } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("no-ops with 200 when no send event matches the email_id", async () => {
    verifyMock.mockReturnValue({ type: "email.delivered", data: { email_id: "unknown-id" } });
    (db.limit as jest.Mock).mockResolvedValueOnce([]);
    const res = mockResponse();
    await handleResendWebhook(requestWith({}), res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(db.update).not.toHaveBeenCalled();
  });

  it("sets deliveredAt on email.delivered", async () => {
    verifyMock.mockReturnValue({ type: "email.delivered", data: { email_id: "e1" } });
    (db.limit as jest.Mock).mockResolvedValueOnce([{ id: "event-1", contactId: "contact-1" }]);
    const res = mockResponse();
    await handleResendWebhook(requestWith({}), res);
    expect(db.set).toHaveBeenCalledWith(expect.objectContaining({ deliveredAt: expect.any(Date) }));
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("marks the contact bounced on a Permanent (hard) bounce", async () => {
    verifyMock.mockReturnValue({
      type: "email.bounced",
      data: { email_id: "e1", bounce: { type: "Permanent" } },
    });
    (db.limit as jest.Mock).mockResolvedValueOnce([{ id: "event-1", contactId: "contact-1" }]);
    const res = mockResponse();
    await handleResendWebhook(requestWith({}), res);
    expect(db.set).toHaveBeenCalledWith(expect.objectContaining({ bouncedAt: expect.any(Date), bounceType: "Permanent" }));
    expect(db.set).toHaveBeenCalledWith(expect.objectContaining({ status: "bounced" }));
  });

  it("does NOT mark the contact bounced on a Transient (soft) bounce", async () => {
    verifyMock.mockReturnValue({
      type: "email.bounced",
      data: { email_id: "e1", bounce: { type: "Transient" } },
    });
    (db.limit as jest.Mock).mockResolvedValueOnce([{ id: "event-1", contactId: "contact-1" }]);
    const res = mockResponse();
    await handleResendWebhook(requestWith({}), res);
    const setCalls = (db.set as jest.Mock).mock.calls.map((call) => call[0] as Record<string, unknown>);
    expect(setCalls.some((set) => set.status === "bounced")).toBe(false);
  });

  it("marks the contact complained on email.complained", async () => {
    verifyMock.mockReturnValue({ type: "email.complained", data: { email_id: "e1" } });
    (db.limit as jest.Mock).mockResolvedValueOnce([{ id: "event-1", contactId: "contact-1" }]);
    const res = mockResponse();
    await handleResendWebhook(requestWith({}), res);
    expect(db.set).toHaveBeenCalledWith(expect.objectContaining({ complainedAt: expect.any(Date) }));
    expect(db.set).toHaveBeenCalledWith(expect.objectContaining({ status: "complained" }));
  });

  it("ignores unhandled event types with a 200", async () => {
    verifyMock.mockReturnValue({ type: "email.opened", data: { email_id: "e1" } });
    (db.limit as jest.Mock).mockResolvedValueOnce([{ id: "event-1", contactId: "contact-1" }]);
    const res = mockResponse();
    await handleResendWebhook(requestWith({}), res);
    expect(db.set).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
