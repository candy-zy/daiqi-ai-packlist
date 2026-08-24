import { ensureUser, getDatabase, getRequestUser, jsonError, unauthorized } from "../_shared/server";

export async function GET(request: Request) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();
  const db = getDatabase();
  await ensureUser(db, user);
  const profile = await db.prepare("SELECT display_name AS displayName, habits_json AS habitsJson, gear_json AS gearJson FROM profiles WHERE user_id = ?")
    .bind(user.userId).first<{ displayName: string; habitsJson: string; gearJson: string }>();
  if (!profile) return Response.json({ profile: { displayName: user.displayName, habits: [], gear: [] } });
  return Response.json({ profile: { displayName: profile.displayName, habits: JSON.parse(profile.habitsJson), gear: JSON.parse(profile.gearJson) } });
}

export async function PUT(request: Request) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();
  const body = await request.json().catch(() => null) as { displayName?: unknown; habits?: unknown; gear?: unknown } | null;
  if (!body) return jsonError("请求格式不正确");
  const displayName = typeof body.displayName === "string" ? body.displayName.trim().slice(0, 20) : user.displayName;
  const habits = Array.isArray(body.habits) ? body.habits.filter((item): item is string => typeof item === "string").slice(0, 12) : [];
  const gear = Array.isArray(body.gear) ? body.gear.filter((item): item is string => typeof item === "string").slice(0, 12) : [];
  const db = getDatabase();
  await ensureUser(db, { ...user, displayName });
  await db.prepare(`INSERT INTO profiles (user_id, display_name, habits_json, gear_json, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id) DO UPDATE SET display_name = excluded.display_name, habits_json = excluded.habits_json, gear_json = excluded.gear_json, updated_at = CURRENT_TIMESTAMP`)
    .bind(user.userId, displayName, JSON.stringify(habits), JSON.stringify(gear)).run();
  return Response.json({ profile: { displayName, habits, gear } });
}
