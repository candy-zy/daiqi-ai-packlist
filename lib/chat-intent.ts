export type IntentMessage = { id: number; author: string; text: string };
export type IntentItem = { id: number; name: string };
export type AssignmentIntent = {
  itemId: number;
  itemName: string;
  requester: string;
  assignee: string;
  intent: "claim" | "release" | "request";
  confidence: number;
  evidenceMessageIds: number[];
};

const AGREEMENT = /^(好|好的|可以|行|没问题|ok|okay|收到|我带|我来带)[。！!，,\s]*$/i;
const RELEASE = /(我不带了?|我带不了|算了.{0,4}(?:不带|你带)|改成.{0,6}带)/;

function mentionedItems(text: string, items: IntentItem[]) {
  return items.filter((item) => text.includes(item.name));
}

export function detectAssignmentFallback(
  messages: IntentMessage[],
  items: IntentItem[],
  members: string[],
): AssignmentIntent[] {
  const recent = messages.slice(-20);
  const latest = recent.at(-1);
  if (!latest) return [];
  const directItems = mentionedItems(latest.text, items);
  if (directItems.length && RELEASE.test(latest.text)) {
    return directItems.map((item) => ({
      itemId: item.id,
      itemName: item.name,
      requester: latest.author,
      assignee: latest.author,
      intent: "release" as const,
      confidence: 0.92,
      evidenceMessageIds: [latest.id],
    }));
  }
  if (directItems.length && /(我来带|我带|交给我)/.test(latest.text)) {
    return directItems.map((item) => ({
      itemId: item.id,
      itemName: item.name,
      requester: latest.author,
      assignee: latest.author,
      intent: "claim" as const,
      confidence: 0.94,
      evidenceMessageIds: [latest.id],
    }));
  }
  if (!AGREEMENT.test(latest.text)) return [];

  for (let index = recent.length - 2; index >= 0; index -= 1) {
    const request = recent[index];
    if (request.author === latest.author) continue;
    const requestItems = mentionedItems(request.text, items);
    if (!requestItems.length || !/(你来带|你带|交给你|麻烦你带|帮忙带)/.test(request.text)) continue;
    const namedTarget = members.find((member) => member !== request.author && request.text.includes(member));
    if (namedTarget && namedTarget !== latest.author) continue;
    return requestItems.map((item) => ({
      itemId: item.id,
      itemName: item.name,
      requester: request.author,
      assignee: latest.author,
      intent: "claim" as const,
      confidence: namedTarget ? 0.96 : 0.88,
      evidenceMessageIds: [request.id, latest.id],
    }));
  }
  return [];
}

export function validateAssignmentIntents(
  value: unknown,
  items: IntentItem[],
  members: string[],
): AssignmentIntent[] {
  if (!value || typeof value !== "object") return [];
  const raw = (value as { assignments?: unknown }).assignments;
  if (!Array.isArray(raw)) return [];
  const itemByName = new Map(items.map((item) => [item.name, item]));
  const seen = new Set<string>();
  return raw.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const candidate = entry as Record<string, unknown>;
    const itemName = typeof candidate.itemName === "string" ? candidate.itemName.trim() : "";
    const item = itemByName.get(itemName);
    const requester = typeof candidate.requester === "string" ? candidate.requester : "";
    const assignee = typeof candidate.assignee === "string" ? candidate.assignee : "";
    const intent = candidate.intent;
    const confidence = Math.max(0, Math.min(1, Number(candidate.confidence) || 0));
    const evidenceMessageIds = Array.isArray(candidate.evidenceMessageIds)
      ? candidate.evidenceMessageIds.map(Number).filter(Number.isFinite).slice(0, 4)
      : [];
    const key = `${item?.id}:${assignee}:${intent}`;
    if (!item || !members.includes(requester) || !members.includes(assignee)
      || !["claim", "release", "request"].includes(String(intent)) || confidence < 0.55 || seen.has(key)) return [];
    seen.add(key);
    return [{ itemId: item.id, itemName, requester, assignee, intent: intent as AssignmentIntent["intent"], confidence, evidenceMessageIds }];
  }).slice(0, 6);
}
