import { createId, createInviteCode, ensureUser, getDatabase, getRequestUser, getTripMembers, jsonError, replaceNormalizedState, sanitizeSharedState, unauthorized } from "../_shared/server";

export async function GET(request: Request) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();
  const db = getDatabase();
  await ensureUser(db, user);
  const trips = await db.prepare(`SELECT t.id, t.name, t.destination, t.invite_code AS inviteCode, t.version, tm.slot_name AS currentMember, tm.role
    FROM trips t JOIN trip_members tm ON tm.trip_id = t.id WHERE tm.user_id = ? ORDER BY t.updated_at DESC`)
    .bind(user.userId).all();
  return Response.json({ trips: trips.results });
}

export async function POST(request: Request) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();
  const body = await request.json().catch(() => null) as { name?: unknown; destination?: unknown; state?: unknown } | null;
  const destination = typeof body?.destination === "string" ? body.destination.trim().slice(0, 80) : "";
  if (!destination) return jsonError("请填写目的地");
  const name = typeof body?.name === "string" && body.name.trim() ? body.name.trim().slice(0, 40) : `${destination}小队`;
  const db = getDatabase();
  await ensureUser(db, user);
  const tripId = createId("trip");
  let inviteCode = createInviteCode();
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const exists = await db.prepare("SELECT id FROM trips WHERE invite_code = ?").bind(inviteCode).first();
    if (!exists) break;
    inviteCode = createInviteCode();
  }
  const state = sanitizeSharedState(body?.state, ["我"], null, "我");
  await db.batch([
    db.prepare("INSERT INTO trips (id, name, destination, owner_id, invite_code, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)")
      .bind(tripId, name, destination, user.userId, inviteCode),
    db.prepare("INSERT INTO trip_members (trip_id, user_id, slot_name, role, joined_at, last_seen_at) VALUES (?, ?, '我', 'owner', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)")
      .bind(tripId, user.userId),
  ]);
  await replaceNormalizedState(db, tripId, user.userId, state, 1);
  await db.prepare("INSERT INTO trip_events (trip_id, actor_id, event_type, version) VALUES (?, ?, 'trip_created', 1)").bind(tripId, user.userId).run();
  return Response.json({ trip: { id: tripId, name, destination, inviteCode, version: 1, currentMember: "我", role: "owner" }, state, members: await getTripMembers(db, tripId), version: 1 }, { status: 201 });
}
