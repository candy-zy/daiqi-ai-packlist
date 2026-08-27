import { ensureUser, getDatabase, getMembership, getRequestUser, jsonError, loadSnapshot, touchMembership, unauthorized } from "../../../_shared/server";

type RouteContext = { params: Promise<{ tripId: string }> };
type ClaimAction = "claim" | "release";

export async function POST(request: Request, context: RouteContext) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();
  const { tripId } = await context.params;
  const db = getDatabase();
  await ensureUser(db, user);
  const membership = await getMembership(db, tripId, user.userId);
  if (!membership) return jsonError("你不是该队伍成员", 403);

  const body = await request.json().catch(() => null) as { itemId?: unknown; action?: unknown } | null;
  const itemId = Number(body?.itemId);
  const action = body?.action as ClaimAction | undefined;
  if (!Number.isInteger(itemId) || itemId <= 0 || (action !== "claim" && action !== "release")) {
    return jsonError("认领请求格式不正确");
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const current = await loadSnapshot(db, tripId);
    if (!current) return jsonError("队伍数据不存在", 404);
    const item = current.state.items.find((entry) => entry.id === itemId);
    if (!item) return jsonError("物品不存在", 404);

    const hasOwner = item.owners.includes(membership.slotName);
    item.owners = action === "claim"
      ? (hasOwner ? item.owners : [...item.owners, membership.slotName])
      : item.owners.filter((owner) => owner !== membership.slotName);
    if (action === "release") item.checked[membership.slotName] = false;

    const updated = await db.prepare("UPDATE trips SET version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND version = ? RETURNING version")
      .bind(tripId, current.version).first<{ version: number }>();
    if (!updated) continue;

    const normalizedItemId = `${tripId}:${itemId}`;
    const ownerStatement = action === "claim"
      ? db.prepare(`INSERT INTO item_owners (item_id, trip_id, member_slot, checked, updated_at)
          VALUES (?, ?, ?, 0, CURRENT_TIMESTAMP)
          ON CONFLICT(item_id, member_slot) DO UPDATE SET updated_at = CURRENT_TIMESTAMP`)
          .bind(normalizedItemId, tripId, membership.slotName)
      : db.prepare("DELETE FROM item_owners WHERE item_id = ? AND member_slot = ?")
          .bind(normalizedItemId, membership.slotName);

    await db.batch([
      db.prepare("UPDATE trip_snapshots SET state_json = ?, version = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE trip_id = ?")
        .bind(JSON.stringify(current.state), updated.version, user.userId, tripId),
      ownerStatement,
      db.prepare("UPDATE trip_members SET last_seen_at = CURRENT_TIMESTAMP WHERE trip_id = ? AND user_id = ?")
        .bind(tripId, user.userId),
      db.prepare("INSERT INTO trip_events (trip_id, actor_id, event_type, version) VALUES (?, ?, 'claim_updated', ?)")
        .bind(tripId, user.userId, updated.version),
    ]);
    await touchMembership(db, tripId, user.userId);
    return Response.json({ ok: true, version: updated.version, itemId, action, member: membership.slotName });
  }

  return jsonError("队伍刚刚有更新，请再试一次", 409);
}
