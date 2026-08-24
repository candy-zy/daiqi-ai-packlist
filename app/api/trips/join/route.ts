import { ensureUser, getDatabase, getRequestUser, getTripMembers, jsonError, loadSnapshot, nextMemberSlot, unauthorized } from "../../_shared/server";

export async function POST(request: Request) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();
  const body = await request.json().catch(() => null) as { inviteCode?: unknown } | null;
  const inviteCode = typeof body?.inviteCode === "string" ? body.inviteCode.trim().toUpperCase().slice(0, 10) : "";
  if (!inviteCode) return jsonError("请输入邀请码");
  const db = getDatabase();
  await ensureUser(db, user);
  const trip = await db.prepare("SELECT id, name, destination, invite_code AS inviteCode, version FROM trips WHERE invite_code = ?")
    .bind(inviteCode).first<{ id: string; name: string; destination: string; inviteCode: string; version: number }>();
  if (!trip) return jsonError("邀请码不存在或已失效", 404);
  const existing = await db.prepare("SELECT slot_name AS slotName, role FROM trip_members WHERE trip_id = ? AND user_id = ?")
    .bind(trip.id, user.userId).first<{ slotName: string; role: string }>();
  let currentMember = existing?.slotName;
  if (!currentMember) {
    currentMember = await nextMemberSlot(db, trip.id) ?? undefined;
    if (!currentMember) return jsonError("队伍已满，最多 4 人", 409);
    await db.prepare("INSERT INTO trip_members (trip_id, user_id, slot_name, role, joined_at, last_seen_at) VALUES (?, ?, ?, 'member', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)")
      .bind(trip.id, user.userId, currentMember).run();
    await db.prepare("INSERT INTO trip_events (trip_id, actor_id, event_type, version) VALUES (?, ?, 'member_joined', ?)")
      .bind(trip.id, user.userId, trip.version).run();
  }
  const snapshot = await loadSnapshot(db, trip.id);
  const members = await getTripMembers(db, trip.id);
  return Response.json({ trip: { ...trip, currentMember, role: existing?.role ?? "member" }, state: snapshot?.state, members });
}
