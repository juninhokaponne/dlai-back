export type GraphNodeType = "trigger" | "action" | "delay" | "condition";

export type GraphNode = {
  id: string;
  type: GraphNodeType;
  data: {
    subtype: string;
    config?: Record<string, string>;
  };
};

export type GraphEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
};

export type SendEventState = {
  sentAt: Date;
  openedAt: Date | null;
  clickedAt: Date | null;
};

export type WalkResult =
  | { action: "send"; nextNodeId: string | null }
  | { action: "advance"; nextNodeId: string | null }
  | { action: "wait"; waitUntil: Date }
  | { action: "updateTag"; tagId: string; tagAction: "add" | "remove"; nextNodeId: string | null };

const DELAY_UNIT_MS: Record<string, number> = {
  minutes: 60_000,
  hours: 60 * 60_000,
  days: 24 * 60 * 60_000,
};

function edgeTo(edges: GraphEdge[], sourceId: string, handle?: string): string | null {
  const match = edges.find((edge) => edge.source === sourceId && (handle === undefined || edge.sourceHandle === handle));
  return match?.target ?? null;
}

export function decideNextStep(input: {
  node: GraphNode;
  edges: GraphEdge[];
  now: Date;
  lastSendEvent: SendEventState | null;
}): WalkResult {
  const { node, edges, now, lastSendEvent } = input;

  if (node.type === "action" && node.data.subtype === "send_email") {
    return { action: "send", nextNodeId: edgeTo(edges, node.id) };
  }

  if (node.type === "action" && node.data.subtype === "update_segment") {
    const tagId = node.data.config?.tagId;
    if (!tagId) {
      return { action: "advance", nextNodeId: edgeTo(edges, node.id) };
    }
    const tagAction = node.data.config?.action === "remove" ? "remove" : "add";
    return { action: "updateTag", tagId, tagAction, nextNodeId: edgeTo(edges, node.id) };
  }

  if (node.type === "action") {
    return { action: "advance", nextNodeId: edgeTo(edges, node.id) };
  }

  if (node.type === "delay") {
    const amount = Number(node.data.config?.amount ?? "0");
    const unit = node.data.config?.unit ?? "minutes";
    const unitMs = DELAY_UNIT_MS[unit] ?? DELAY_UNIT_MS.minutes!;
    return { action: "wait", waitUntil: new Date(now.getTime() + amount * unitMs) };
  }

  // node.type === "condition"
  const conditionType = node.data.config?.conditionType ?? "custom";
  const evaluationHours = Number(node.data.config?.evaluationHours ?? "24");

  if (!lastSendEvent) {
    return { action: "advance", nextNodeId: edgeTo(edges, node.id, "no") };
  }

  const signalAt =
    conditionType === "opened_previous" ? lastSendEvent.openedAt : conditionType === "clicked_link" ? lastSendEvent.clickedAt : null;

  if (signalAt) {
    return { action: "advance", nextNodeId: edgeTo(edges, node.id, "yes") };
  }

  const windowEnd = new Date(lastSendEvent.sentAt.getTime() + evaluationHours * 60 * 60_000);
  if (now.getTime() < windowEnd.getTime()) {
    return { action: "wait", waitUntil: windowEnd };
  }

  return { action: "advance", nextNodeId: edgeTo(edges, node.id, "no") };
}
