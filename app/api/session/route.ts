import { ensureUser, getDatabase, getRequestUser, unauthorized } from "../_shared/server";

export async function GET(request: Request) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();
  const db = getDatabase();
  await ensureUser(db, user);
  const trips = await db.prepare(`
    SELECT t.id, t.name, t.destination, t.invite_code AS inviteCode, t.version, tm.slot_name AS currentMember, tm.role
    FROM trips t JOIN trip_members tm ON tm.trip_id = t.id
    WHERE tm.user_id = ? ORDER BY t.updated_at DESC LIMIT 20
  `).bind(user.userId).all();
  return Response.json({ user, trips: trips.results });
}
