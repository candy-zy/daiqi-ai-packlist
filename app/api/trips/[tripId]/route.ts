import { ensureUser, getDatabase, getMembership, getRequestUser, jsonError, unauthorized } from "../../_shared/server";

export async function DELETE(request: Request, context: { params: Promise<{ tripId: string }> }) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();
  const { tripId } = await context.params;
  if (!tripId) return jsonError("缺少队伍 ID");
  const db = getDatabase();
  await ensureUser(db, user);
  const trip = await db.prepare("SELECT id, owner_id AS ownerId FROM trips WHERE id = ?").bind(tripId).first<{ id: string; ownerId: string }>();
  if (!trip) return jsonError("队伍不存在", 404);
  const membership = await getMembership(db, tripId, user.userId);
  if (!membership) return jsonError("你不是该队伍成员", 403);
  if (trip.ownerId !== user.userId || membership.role !== "owner") return jsonError("只有队伍创建者可以删除队伍", 403);

  // Keep deletion explicit so it remains safe even if a deployment has foreign-key cascades disabled.
  await db.batch([
    db.prepare("DELETE FROM assignment_proposals WHERE trip_id = ?").bind(tripId),
    db.prepare("DELETE FROM item_owners WHERE trip_id = ?").bind(tripId),
    db.prepare("DELETE FROM trip_items WHERE trip_id = ?").bind(tripId),
    db.prepare("DELETE FROM item_notes WHERE trip_id = ?").bind(tripId),
    db.prepare("DELETE FROM chat_messages WHERE trip_id = ?").bind(tripId),
    db.prepare("DELETE FROM trip_snapshots WHERE trip_id = ?").bind(tripId),
    db.prepare("DELETE FROM trip_events WHERE trip_id = ?").bind(tripId),
    db.prepare("DELETE FROM trip_members WHERE trip_id = ?").bind(tripId),
    db.prepare("DELETE FROM trips WHERE id = ? AND owner_id = ?").bind(tripId, user.userId),
  ]);
  return Response.json({ ok: true, tripId });
}
