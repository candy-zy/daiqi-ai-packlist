import { detectAssignmentFallback, type IntentMessage, validateAssignmentIntents } from "../../../../../lib/chat-intent";
import { ensureUser, getAllowedSlots, getDatabase, getMembership, getRequestUser, jsonError, unauthorized } from "../../../_shared/server";

type RouteContext = { params: Promise<{ tripId: string }> };

function parseJsonObject(text: string) {
  return JSON.parse(text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")) as unknown;
}

export async function POST(request: Request, context: RouteContext) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();
  const { tripId } = await context.params;
  const db = getDatabase();
  await ensureUser(db, user);
  const membership = await getMembership(db, tripId, user.userId);
  if (!membership) return jsonError("你不是该队伍成员", 403);
  const body = await request.json().catch(() => null) as { messages?: unknown; items?: unknown } | null;
  const messages: IntentMessage[] = Array.isArray(body?.messages) ? body.messages.slice(-30).flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const value = raw as Record<string, unknown>;
    const id = Number(value.id);
    const author = typeof value.author === "string" ? value.author.slice(0, 20) : "";
    const text = typeof value.text === "string" ? value.text.trim().slice(0, 500) : "";
    return Number.isFinite(id) && author && text ? [{ id, author, text }] : [];
  }) : [];
  const items = Array.isArray(body?.items) ? body.items.slice(0, 160).flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const value = raw as Record<string, unknown>;
    const id = Number(value.id);
    const name = typeof value.name === "string" ? value.name.trim().slice(0, 60) : "";
    return Number.isFinite(id) && name ? [{ id, name }] : [];
  }) : [];
  if (!messages.length || !items.length) return Response.json({ assignments: [], source: "fallback" });
  const members = await getAllowedSlots(db, tripId);
  const fallback = detectAssignmentFallback(messages, items, members);
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return Response.json({ assignments: fallback, source: "fallback" });

  try {
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: `你负责从2-4人旅行群聊中识别物品分工，只分析给定物品清单和成员。输出JSON对象 {"assignments":[{"itemName":"清单中的精确名称","requester":"发起人","assignee":"负责人","intent":"claim|release|request","confidence":0到1,"evidenceMessageIds":[1,2]}]}。claim=负责人已明确同意或主动认领；release=负责人明确不再带；request=只是请求对方带、尚未同意。回复“好/行/可以”等要联系最近一条分工请求；若一次涉及多个物品分别输出。否定、反悔以最新消息为准。指代不清或置信度低于0.55就不输出。`,
          },
          {
            role: "user",
            content: `成员：${members.join("、")}\n物品：${items.map((item) => item.name).join("、")}\n聊天：\n${messages.map((message) => `[${message.id}] ${message.author}：${message.text}`).join("\n")}`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0,
        max_tokens: 900,
      }),
    });
    if (!response.ok) throw new Error(`DeepSeek returned ${response.status}`);
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = payload.choices?.[0]?.message?.content ?? "";
    const assignments = validateAssignmentIntents(parseJsonObject(content), items, members);
    return Response.json({ assignments: assignments.length ? assignments : fallback, source: assignments.length ? "model" : "fallback" });
  } catch {
    return Response.json({ assignments: fallback, source: "fallback" });
  }
}
