import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { createDbMock } from "../../tests/helpes/db-mock.js";
import type { GraphEdge, GraphNode } from "./graph-walk.js";

const dbMock = createDbMock();
jest.unstable_mockModule("../../database/index.js", () => ({ db: dbMock }));

const resolveAudienceConditions = jest.fn();
const resolveSegmentWhereClause = jest.fn(() => "WHERE_CLAUSE");
jest.unstable_mockModule("../segments/segments.service.js", () => ({
  resolveAudienceConditions,
  resolveSegmentWhereClause,
}));

jest.unstable_mockModule("../../modules/newsletter/newsletter.service.js", () => ({
  createNewsletter: jest.fn(),
  startNewsletterGeneration: jest.fn(),
}));
jest.unstable_mockModule("../notifications/notifications.service.js", () => ({
  createNotification: jest.fn(),
  notifyOrganizationAdmins: jest.fn(),
}));

const { startRunForContacts } = await import("./run-orchestration.js");
const { db } = await import("../../database/index.js");

const triggerNode: GraphNode = { id: "trigger-1", type: "trigger", data: { subtype: "new_subscriber", config: {} } };
const edges: GraphEdge[] = [{ id: "e1", source: "trigger-1", target: "node-1" }];

function sendEmailNode(config: Record<string, string>): GraphNode {
  return { id: "node-1", type: "action", data: { subtype: "send_email", config } };
}

function fakeAutomation(nodes: GraphNode[]) {
  return {
    id: "automation-1",
    userId: "user-1",
    organizationId: "org-1",
    nodes,
    edges,
  } as any;
}

describe("startRunForContacts - audience targeting", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (db.where as jest.Mock).mockReturnThis();
    (db.limit as jest.Mock).mockReturnThis();
    (db.values as jest.Mock).mockReturnThis();
  });

  it("sends to every triggering contact when audience is unset (all contacts)", async () => {
    resolveAudienceConditions.mockResolvedValueOnce([]);
    (db.limit as jest.Mock).mockResolvedValueOnce([{ status: "ready" }]);
    (db.returning as jest.Mock).mockResolvedValueOnce([{ id: "run-1" }]);

    const automation = fakeAutomation([
      triggerNode,
      sendEmailNode({ contentType: "newsletter", contentId: "newsletter-1" }),
    ]);

    await startRunForContacts(automation, "new_subscriber", ["contact-1", "contact-2"]);

    expect(resolveAudienceConditions).toHaveBeenCalledWith("org-1", undefined);
    const insertedRows = (db.values as jest.Mock).mock.calls[1]![0] as { contactId: string }[];
    expect(insertedRows.map((row) => row.contactId)).toEqual(["contact-1", "contact-2"]);
  });

  it("narrows recipients to only the contacts matching the audience segment", async () => {
    resolveAudienceConditions.mockResolvedValueOnce([{ type: "status", value: "subscribed", negate: false }]);
    (db.where as jest.Mock).mockResolvedValueOnce([{ id: "contact-2" }]).mockImplementationOnce(function (this: unknown) {
      return this;
    });
    (db.limit as jest.Mock).mockResolvedValueOnce([{ status: "ready" }]);
    (db.returning as jest.Mock).mockResolvedValueOnce([{ id: "run-1" }]);

    const automation = fakeAutomation([
      triggerNode,
      sendEmailNode({ audience: "segment-1", contentType: "newsletter", contentId: "newsletter-1" }),
    ]);

    await startRunForContacts(automation, "new_subscriber", ["contact-1", "contact-2"]);

    expect(resolveAudienceConditions).toHaveBeenCalledWith("org-1", "segment-1");
    const insertedRows = (db.values as jest.Mock).mock.calls[1]![0] as { contactId: string }[];
    expect(insertedRows.map((row) => row.contactId)).toEqual(["contact-2"]);
  });

  it("starts no run at all when the audience segment no longer exists (never falls back to everyone)", async () => {
    resolveAudienceConditions.mockResolvedValueOnce(null);

    const automation = fakeAutomation([
      triggerNode,
      sendEmailNode({ audience: "deleted-segment", contentType: "newsletter", contentId: "newsletter-1" }),
    ]);

    await startRunForContacts(automation, "new_subscriber", ["contact-1", "contact-2"]);

    expect(db.insert).not.toHaveBeenCalled();
  });
});
