import {
  ensureUser,
  getCurrentTripPayload,
  getDatabase,
  getMembership,
  getRequestUser,
  jsonError,
  loadSnapshot,
  unauthorized,
} from "../../../_shared/server";
import { publishTripEvent } from "../../../_shared/realtime";

type RouteContext = { params: Promise<{ tripId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();
  const { tripId } = await context.params;
  const db = getDatabase();
  await ensureUser(db, user);
  const membership = await getMembership(db, tripId, user.userId);
  if (!membership) return jsonError("你不是该队伍成员", 403);

  const body = await request.json().catch(() => null) as { id?: unknown; text?: unknown } | null;
  const id = Number(body?.id);
  const text = typeof body?.text === "string" ? body.text.trim().slice(0, 500) : "";
  if (!Number.isSafeInteger(id) || id <= 0 || !text) return jsonError("消息内容不正确");

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const current = await loadSnapshot(db, tripId);
    if (!current) return jsonError("队伍数据不存在", 404);
    const existing = current.state.messages.find((message) => message.id === id);
    if (existing) {
      if (existing.author !== membership.slotName || existing.text !== text) return jsonError("消息编号冲突", 409);
      await db.prepare("UPDATE trip_members SET last_seen_at = CURRENT_TIMESTAMP WHERE trip_id = ? AND user_id = ?")
        .bind(tripId, user.userId).run();
      return Response.json({ ok: true, ...(await getCurrentTripPayload(db, tripId, membership.slotName)) });
    }

    const state = {
      ...current.state,
      messages: [...current.state.messages, { id, author: membership.slotName, text, system: false }].slice(-300),
    };
    const updated = await db.prepare("UPDATE trips SET version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND version = ? RETURNING version")
      .bind(tripId, current.version).first<{ version: number }>();
    if (!updated) continue;

    await db.batch([
      db.prepare("UPDATE trip_snapshots SET state_json = ?, version = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE trip_id = ?")
        .bind(JSON.stringify(state), updated.version, user.userId, tripId),
      db.prepare("INSERT INTO chat_messages (id, trip_id, author_slot, body, is_system, created_at) VALUES (?, ?, ?, ?, 0, CURRENT_TIMESTAMP)")
        .bind(`${tripId}:${id}`, tripId, membership.slotName, text),
      db.prepare("UPDATE trip_members SET last_seen_at = CURRENT_TIMESTAMP WHERE trip_id = ? AND user_id = ?").bind(tripId, user.userId),
      db.prepare("INSERT INTO trip_events (trip_id, actor_id, event_type, version) VALUES (?, ?, 'chat_message_sent', ?)").bind(tripId, user.userId, updated.version),
    ]);
    publishTripEvent({ type: "trip_updated", tripId, version: updated.version, reason: "message" });
    return Response.json({ ok: true, ...(await getCurrentTripPayload(db, tripId, membership.slotName)) });
  }

  return Response.json({ error: "队伍消息正在同步，请重试", ...(await getCurrentTripPayload(db, tripId, membership.slotName)) }, { status: 409 });
}
