import { ensureUser, getAllowedSlots, getCurrentTripPayload, getDatabase, getMembership, getRequestUser, getTripMembers, jsonError, loadSnapshot, replaceNormalizedState, sanitizeSharedState, touchMembership, unauthorized } from "../../../_shared/server";

type RouteContext = { params: Promise<{ tripId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();
  const { tripId } = await context.params;
  const db = getDatabase();
  await ensureUser(db, user);
  const membership = await getMembership(db, tripId, user.userId);
  if (!membership) return jsonError("你不是该队伍成员", 403);
  await touchMembership(db, tripId, user.userId);
  const since = Number(new URL(request.url).searchParams.get("since") ?? -1);
  const tripVersion = await db.prepare("SELECT version FROM trips WHERE id = ?").bind(tripId).first<{ version: number }>();
  if (tripVersion && since === tripVersion.version) {
    return Response.json({ unchanged: true, version: tripVersion.version, currentMember: membership.slotName, members: await getTripMembers(db, tripId) });
  }
  return Response.json(await getCurrentTripPayload(db, tripId, membership.slotName));
}

export async function PUT(request: Request, context: RouteContext) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();
  const { tripId } = await context.params;
  const db = getDatabase();
  await ensureUser(db, user);
  const membership = await getMembership(db, tripId, user.userId);
  if (!membership) return jsonError("你不是该队伍成员", 403);
  const body = await request.json().catch(() => null) as { expectedVersion?: unknown; state?: unknown } | null;
  if (!body) return jsonError("请求格式不正确");
  const current = await loadSnapshot(db, tripId);
  const expectedVersion = Number(body.expectedVersion);
  if (!current) return jsonError("队伍数据不存在", 404);
  if (Number.isFinite(expectedVersion) && expectedVersion !== current.version) {
    return Response.json({ error: "队伍数据已更新", ...(await getCurrentTripPayload(db, tripId, membership.slotName)) }, { status: 409 });
  }
  const slots = await getAllowedSlots(db, tripId);
  const state = sanitizeSharedState(body.state, slots, current.state, membership.slotName);
  const updated = await db.prepare("UPDATE trips SET version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND version = ? RETURNING version")
    .bind(tripId, current.version).first<{ version: number }>();
  if (!updated) return Response.json({ error: "队伍数据已更新", ...(await getCurrentTripPayload(db, tripId, membership.slotName)) }, { status: 409 });
  await replaceNormalizedState(db, tripId, user.userId, state, updated.version);
  await db.batch([
    db.prepare("UPDATE trip_members SET last_seen_at = CURRENT_TIMESTAMP WHERE trip_id = ? AND user_id = ?").bind(tripId, user.userId),
    db.prepare("INSERT INTO trip_events (trip_id, actor_id, event_type, version) VALUES (?, ?, 'state_updated', ?)").bind(tripId, user.userId, updated.version),
  ]);
  return Response.json({ ok: true, version: updated.version, state });
}
