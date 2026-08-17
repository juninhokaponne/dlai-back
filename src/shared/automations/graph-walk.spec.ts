import { decideNextStep, type GraphEdge, type GraphNode } from "./graph-walk.js";

const NOW = new Date("2026-08-14T12:00:00Z");

function edge(source: string, target: string, sourceHandle: string | null = null): GraphEdge {
  return { id: `${source}-${target}`, source, target, sourceHandle };
}

describe("decideNextStep", () => {
  it("sends and advances for a send_email action node", () => {
    const node: GraphNode = { id: "n1", type: "action", data: { subtype: "send_email", config: {} } };
    const edges = [edge("n1", "n2")];
    const result = decideNextStep({ node, edges, now: NOW, lastSendEvent: null });
    expect(result).toEqual({ action: "send", nextNodeId: "n2" });
  });

  it("sends with a null nextNodeId when send_email has no outgoing edge", () => {
    const node: GraphNode = { id: "n1", type: "action", data: { subtype: "send_email", config: {} } };
    const result = decideNextStep({ node, edges: [], now: NOW, lastSendEvent: null });
    expect(result).toEqual({ action: "send", nextNodeId: null });
  });

  it("passes through webhook as an advance no-op", () => {
    const webhookNode: GraphNode = { id: "n1", type: "action", data: { subtype: "webhook", config: {} } };
    const edges = [edge("n1", "n2")];
    expect(decideNextStep({ node: webhookNode, edges, now: NOW, lastSendEvent: null })).toEqual({
      action: "advance",
      nextNodeId: "n2",
    });
  });

  it("adds a tag for an update_segment action node with action 'add'", () => {
    const node: GraphNode = {
      id: "n1",
      type: "action",
      data: { subtype: "update_segment", config: { tagId: "tag-1", action: "add" } },
    };
    const edges = [edge("n1", "n2")];
    const result = decideNextStep({ node, edges, now: NOW, lastSendEvent: null });
    expect(result).toEqual({ action: "updateTag", tagId: "tag-1", tagAction: "add", nextNodeId: "n2" });
  });

  it("removes a tag for an update_segment action node with action 'remove'", () => {
    const node: GraphNode = {
      id: "n1",
      type: "action",
      data: { subtype: "update_segment", config: { tagId: "tag-1", action: "remove" } },
    };
    const result = decideNextStep({ node, edges: [], now: NOW, lastSendEvent: null });
    expect(result).toEqual({ action: "updateTag", tagId: "tag-1", tagAction: "remove", nextNodeId: null });
  });

  it("defaults update_segment action to 'add' when unset", () => {
    const node: GraphNode = {
      id: "n1",
      type: "action",
      data: { subtype: "update_segment", config: { tagId: "tag-1" } },
    };
    const result = decideNextStep({ node, edges: [], now: NOW, lastSendEvent: null });
    expect(result).toEqual({ action: "updateTag", tagId: "tag-1", tagAction: "add", nextNodeId: null });
  });

  it("falls back to advance for a misconfigured update_segment node with no tagId", () => {
    const node: GraphNode = { id: "n1", type: "action", data: { subtype: "update_segment", config: {} } };
    const edges = [edge("n1", "n2")];
    const result = decideNextStep({ node, edges, now: NOW, lastSendEvent: null });
    expect(result).toEqual({ action: "advance", nextNodeId: "n2" });
  });

  it("waits for a delay node using amount/unit config", () => {
    const node: GraphNode = {
      id: "n1",
      type: "delay",
      data: { subtype: "delay", config: { amount: "2", unit: "days" } },
    };
    const result = decideNextStep({ node, edges: [], now: NOW, lastSendEvent: null });
    expect(result.action).toBe("wait");
    if (result.action === "wait") {
      expect(result.waitUntil.toISOString()).toBe("2026-08-16T12:00:00.000Z");
    }
  });

  it("branches yes immediately when the tracked open already happened", () => {
    const node: GraphNode = {
      id: "n1",
      type: "condition",
      data: { subtype: "condition", config: { conditionType: "opened_previous", evaluationHours: "24" } },
    };
    const edges = [edge("n1", "yesTarget", "yes"), edge("n1", "noTarget", "no")];
    const lastSendEvent = {
      sentAt: new Date("2026-08-13T12:00:00Z"),
      openedAt: new Date("2026-08-13T13:00:00Z"),
      clickedAt: null,
    };
    const result = decideNextStep({ node, edges, now: NOW, lastSendEvent });
    expect(result).toEqual({ action: "advance", nextNodeId: "yesTarget" });
  });

  it("branches yes for clicked_link when clickedAt is set", () => {
    const node: GraphNode = {
      id: "n1",
      type: "condition",
      data: { subtype: "condition", config: { conditionType: "clicked_link", evaluationHours: "24" } },
    };
    const edges = [edge("n1", "yesTarget", "yes"), edge("n1", "noTarget", "no")];
    const lastSendEvent = {
      sentAt: new Date("2026-08-13T12:00:00Z"),
      openedAt: null,
      clickedAt: new Date("2026-08-13T13:00:00Z"),
    };
    const result = decideNextStep({ node, edges, now: NOW, lastSendEvent });
    expect(result).toEqual({ action: "advance", nextNodeId: "yesTarget" });
  });

  it("waits when no signal yet and the evaluation window hasn't elapsed", () => {
    const node: GraphNode = {
      id: "n1",
      type: "condition",
      data: { subtype: "condition", config: { conditionType: "opened_previous", evaluationHours: "24" } },
    };
    const lastSendEvent = { sentAt: new Date("2026-08-14T00:00:00Z"), openedAt: null, clickedAt: null }; // 12h ago
    const result = decideNextStep({ node, edges: [], now: NOW, lastSendEvent });
    expect(result.action).toBe("wait");
    if (result.action === "wait") {
      expect(result.waitUntil.toISOString()).toBe("2026-08-15T00:00:00.000Z");
    }
  });

  it("branches no once the evaluation window has elapsed with no signal", () => {
    const node: GraphNode = {
      id: "n1",
      type: "condition",
      data: { subtype: "condition", config: { conditionType: "opened_previous", evaluationHours: "24" } },
    };
    const edges = [edge("n1", "yesTarget", "yes"), edge("n1", "noTarget", "no")];
    const lastSendEvent = { sentAt: new Date("2026-08-12T12:00:00Z"), openedAt: null, clickedAt: null }; // 48h ago
    const result = decideNextStep({ node, edges, now: NOW, lastSendEvent });
    expect(result).toEqual({ action: "advance", nextNodeId: "noTarget" });
  });

  it("treats conditionType 'custom' as always-no once its window elapses", () => {
    const node: GraphNode = {
      id: "n1",
      type: "condition",
      data: { subtype: "condition", config: { conditionType: "custom", evaluationHours: "1" } },
    };
    const edges = [edge("n1", "yesTarget", "yes"), edge("n1", "noTarget", "no")];
    const lastSendEvent = { sentAt: new Date("2026-08-14T10:00:00Z"), openedAt: null, clickedAt: null }; // 2h ago
    const result = decideNextStep({ node, edges, now: NOW, lastSendEvent });
    expect(result).toEqual({ action: "advance", nextNodeId: "noTarget" });
  });

  it("branches no immediately when there is no prior send event to check", () => {
    const node: GraphNode = {
      id: "n1",
      type: "condition",
      data: { subtype: "condition", config: { conditionType: "opened_previous", evaluationHours: "24" } },
    };
    const edges = [edge("n1", "yesTarget", "yes"), edge("n1", "noTarget", "no")];
    const result = decideNextStep({ node, edges, now: NOW, lastSendEvent: null });
    expect(result).toEqual({ action: "advance", nextNodeId: "noTarget" });
  });

  it("completes (null nextNodeId) when a condition branch has no matching edge", () => {
    const node: GraphNode = {
      id: "n1",
      type: "condition",
      data: { subtype: "condition", config: { conditionType: "opened_previous", evaluationHours: "24" } },
    };
    const result = decideNextStep({ node, edges: [], now: NOW, lastSendEvent: null });
    expect(result).toEqual({ action: "advance", nextNodeId: null });
  });

  it("defaults delay amount to 0 and unit to minutes when config is missing", () => {
    const node: GraphNode = { id: "n1", type: "delay", data: { subtype: "delay", config: {} } };
    const result = decideNextStep({ node, edges: [], now: NOW, lastSendEvent: null });
    expect(result.action).toBe("wait");
    if (result.action === "wait") {
      expect(result.waitUntil.toISOString()).toBe(NOW.toISOString());
    }
  });
});
