import { env } from "cloudflare:workers";

export type AuthenticatedUser = { userId: string; email: string; displayName: string };
export type TripMember = { name: string; short: string; profile: string; className: string; online: boolean };
export type SharedTripContext = {
  startDate: string;
  endDate: string;
  place: { id: string; name: string; country: string; admin1: string; latitude: number; longitude: number; timezone: string; label: string; manual?: boolean } | null;
  weather: { source: "forecast" | "season"; summary: string; minTemp?: number; maxTemp?: number; precipitationProbability?: number; snowfall?: number; season?: string } | null;
};
export type SharedTripState = {
  items: Array<{ id: number; name: string; icon: string; group: string; owners: string[]; checked: Record<string, boolean>; aiReason?: string }>;
  suggestions: Array<{ id: number; name: string; icon: string; group: string; reason: string; signal: string; added: boolean }>;
  messages: Array<{ id: number; author: string; text: string; system?: boolean }>;
  itemNotes: Array<{ id: number; itemId: number; author: string; text: string; time: string }>;
  assignmentProposals: Array<{ id?: string; itemId: number; requester: string; target: string; afterMessageId: number; confidence?: number }>;
  tripContext: SharedTripContext | null;
};

const MEMBER_SLOTS = ["我", "阿哲", "小雨", "小安"];
const AVATAR_CLASSES = ["member-me", "member-zhe", "member-yu", "member-an"];

export function getDatabase(): D1Database {
  if (!env.DB) throw new Error("DATABASE_UNAVAILABLE");
  return env.DB;
}

export function getRequestUser(request: Request): AuthenticatedUser | null {
  const userId = request.headers.get("oai-authenticated-user-id");
  const email = request.headers.get("oai-authenticated-user-email");
  if (!userId || !email) return null;
  const encodedName = request.headers.get("oai-authenticated-user-full-name");
  const encoding = request.headers.get("oai-authenticated-user-full-name-encoding");
  let displayName = email.split("@")[0] || "旅行者";
  if (encodedName && encoding === "percent-encoded-utf-8") {
    try { displayName = decodeURIComponent(encodedName); } catch { /* keep email fallback */ }
  }
  return { userId, email, displayName: displayName.slice(0, 20) };
}

export function unauthorized() {
  return Response.json({ error: "请先登录", signInPath: "/signin-with-chatgpt?return_to=%2F" }, { status: 401 });
}

export function jsonError(error: string, status = 400) {
  return Response.json({ error }, { status });
}

export async function ensureUser(db: D1Database, user: AuthenticatedUser) {
  await db.prepare(`
    INSERT INTO users (id, email, display_name, created_at, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET email = excluded.email, display_name = excluded.display_name, updated_at = CURRENT_TIMESTAMP
  `).bind(user.userId, user.email, user.displayName).run();
}

export async function getMembership(db: D1Database, tripId: string, userId: string) {
  return db.prepare("SELECT slot_name AS slotName, role FROM trip_members WHERE trip_id = ? AND user_id = ?")
    .bind(tripId, userId).first<{ slotName: string; role: "owner" | "member" }>();
}

export async function touchMembership(db: D1Database, tripId: string, userId: string) {
  await db.prepare("UPDATE trip_members SET last_seen_at = CURRENT_TIMESTAMP WHERE trip_id = ? AND user_id = ?")
    .bind(tripId, userId).run();
}

export async function getTripMembers(db: D1Database, tripId: string): Promise<TripMember[]> {
  const result = await db.prepare(`
    SELECT tm.slot_name AS slotName, u.display_name AS displayName,
      CASE WHEN datetime(tm.last_seen_at) >= datetime('now', '-45 seconds') THEN 1 ELSE 0 END AS online
    FROM trip_members tm JOIN users u ON u.id = tm.user_id
    WHERE tm.trip_id = ? ORDER BY tm.joined_at ASC
  `).bind(tripId).all<{ slotName: string; displayName: string; online: number }>();
  return result.results.map((member, index) => ({
    name: member.slotName,
    short: member.slotName === "我" ? "我" : (member.displayName || member.slotName).slice(0, 1),
    profile: member.displayName || member.slotName,
    className: AVATAR_CLASSES[index] ?? "member-an",
    online: Boolean(member.online),
  }));
}

export function createId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}

export function createInviteCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join("");
}

function textValue(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function numberValue(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : 0;
}

function finiteValue(value: unknown, minimum: number, maximum: number) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(minimum, Math.min(maximum, number)) : undefined;
}

function sanitizeTripContext(value: unknown): SharedTripContext | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  const startDate = textValue(source.startDate, 10);
  const endDate = textValue(source.endDate, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate) || endDate < startDate) return null;
  const rawPlace = source.place && typeof source.place === "object" ? source.place as Record<string, unknown> : null;
  const latitude = finiteValue(rawPlace?.latitude, -90, 90);
  const longitude = finiteValue(rawPlace?.longitude, -180, 180);
  const place = rawPlace && latitude !== undefined && longitude !== undefined ? {
    id: textValue(rawPlace.id, 80) || `${latitude},${longitude}`,
    name: textValue(rawPlace.name, 60),
    country: textValue(rawPlace.country, 60),
    admin1: textValue(rawPlace.admin1, 60),
    latitude,
    longitude,
    timezone: textValue(rawPlace.timezone, 80) || "auto",
    label: textValue(rawPlace.label, 120),
    ...(rawPlace.manual === true ? { manual: true } : {}),
  } : null;
  if (!place?.name || !place.label) return null;
  const rawWeather = source.weather && typeof source.weather === "object" ? source.weather as Record<string, unknown> : null;
  const weatherSource = rawWeather?.source === "forecast" ? "forecast" : rawWeather?.source === "season" ? "season" : null;
  const weather = rawWeather && weatherSource ? {
    source: weatherSource,
    summary: textValue(rawWeather.summary, 180),
    ...(finiteValue(rawWeather.minTemp, -100, 70) !== undefined ? { minTemp: finiteValue(rawWeather.minTemp, -100, 70) } : {}),
    ...(finiteValue(rawWeather.maxTemp, -100, 70) !== undefined ? { maxTemp: finiteValue(rawWeather.maxTemp, -100, 70) } : {}),
    ...(finiteValue(rawWeather.precipitationProbability, 0, 100) !== undefined ? { precipitationProbability: finiteValue(rawWeather.precipitationProbability, 0, 100) } : {}),
    ...(finiteValue(rawWeather.snowfall, 0, 1000) !== undefined ? { snowfall: finiteValue(rawWeather.snowfall, 0, 1000) } : {}),
    ...(textValue(rawWeather.season, 20) ? { season: textValue(rawWeather.season, 20) } : {}),
  } : null;
  return { startDate, endDate, place, weather };
}

export function sanitizeSharedState(
  input: unknown,
  allowedSlots: string[],
  previous?: SharedTripState | null,
  actorSlot?: string,
): SharedTripState {
  const source = input && typeof input === "object" ? input as Partial<SharedTripState> : {};
  const slotSet = new Set(allowedSlots);
  const previousMessages = new Map((previous?.messages ?? []).map((message) => [message.id, message]));
  const previousNotes = new Map((previous?.itemNotes ?? []).map((note) => [note.id, note]));
  const previousItems = new Map((previous?.items ?? []).map((item) => [item.id, item]));
  const items = (Array.isArray(source.items) ? source.items : []).slice(0, 160).flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const item = raw as Record<string, unknown>;
    const id = numberValue(item.id);
    const name = textValue(item.name, 60);
    const group = textValue(item.group, 30);
    if (!id || !name || !group) return [];
    const requestedOwners = Array.isArray(item.owners) ? [...new Set(item.owners.filter((owner): owner is string => typeof owner === "string" && slotSet.has(owner)))] : [];
    const checkedSource = item.checked && typeof item.checked === "object" ? item.checked as Record<string, unknown> : {};
    const existing = previousItems.get(id);
    const owners = actorSlot && previous
      ? [...new Set([...(existing?.owners ?? []).filter((owner) => owner !== actorSlot), ...(requestedOwners.includes(actorSlot) ? [actorSlot] : [])])]
      : requestedOwners;
    const checked = Object.fromEntries(allowedSlots.map((slot) => [
      slot,
      actorSlot && previous && slot !== actorSlot
        ? existing?.checked[slot] === true
        : checkedSource[slot] === true,
    ]));
    return [{ id, name, icon: textValue(item.icon, 12), group, owners, checked, ...(textValue(item.aiReason, 120) ? { aiReason: textValue(item.aiReason, 120) } : {}) }];
  });
  const itemIds = new Set(items.map((item) => item.id));
  const suggestions = (Array.isArray(source.suggestions) ? source.suggestions : []).slice(0, 2).flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const suggestion = raw as Record<string, unknown>;
    const id = numberValue(suggestion.id);
    const name = textValue(suggestion.name, 40);
    if (!id || !name) return [];
    return [{ id, name, icon: textValue(suggestion.icon, 12), group: textValue(suggestion.group, 30), reason: textValue(suggestion.reason, 100), signal: textValue(suggestion.signal, 20), added: suggestion.added === true }];
  });
  const messages = (Array.isArray(source.messages) ? source.messages : []).slice(-300).flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const message = raw as Record<string, unknown>;
    const id = numberValue(message.id);
    const existing = previousMessages.get(id);
    const isSystem = existing?.system ?? message.system === true;
    const author = existing?.author ?? (isSystem ? "带齐助手" : actorSlot ?? textValue(message.author, 20));
    const text = existing?.text ?? textValue(message.text, 500);
    if (!id || !text || (author !== "带齐助手" && !slotSet.has(author))) return [];
    return [{ id, author, text, system: isSystem }];
  });
  const itemNotes = (Array.isArray(source.itemNotes) ? source.itemNotes : []).slice(-500).flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const note = raw as Record<string, unknown>;
    const id = numberValue(note.id);
    const itemId = numberValue(note.itemId);
    const existing = previousNotes.get(id);
    const author = existing?.author ?? actorSlot ?? textValue(note.author, 20);
    const text = existing?.text ?? textValue(note.text, 500);
    if (!id || !itemIds.has(itemId) || !text || !slotSet.has(author)) return [];
    return [{ id, itemId, author, text, time: textValue(note.time, 12) || "刚刚" }];
  });
  const assignmentSource = Array.isArray(source.assignmentProposals) ? source.assignmentProposals : [];
  const assignmentProposals = assignmentSource.slice(0, 12).flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const proposal = raw as Record<string, unknown>;
    const itemId = numberValue(proposal.itemId);
    const requester = textValue(proposal.requester, 20);
    const target = textValue(proposal.target, 20);
    if (!itemIds.has(itemId) || !slotSet.has(requester) || !slotSet.has(target)) return [];
    return [{ id: textValue(proposal.id, 80) || createId("proposal"), itemId, requester, target, afterMessageId: numberValue(proposal.afterMessageId), confidence: Math.max(0, Math.min(1, Number(proposal.confidence) || 0.8)) }];
  });
  const tripContext = sanitizeTripContext(source.tripContext) ?? previous?.tripContext ?? null;
  return { items, suggestions, messages, itemNotes, assignmentProposals, tripContext };
}

export async function loadSnapshot(db: D1Database, tripId: string): Promise<{ state: SharedTripState; version: number } | null> {
  const row = await db.prepare("SELECT state_json AS stateJson, version FROM trip_snapshots WHERE trip_id = ?")
    .bind(tripId).first<{ stateJson: string; version: number }>();
  if (!row) return null;
  try { return { state: JSON.parse(row.stateJson) as SharedTripState, version: row.version }; } catch { return null; }
}

export async function replaceNormalizedState(db: D1Database, tripId: string, userId: string, state: SharedTripState, version: number) {
  const cleanup: D1PreparedStatement[] = [
    db.prepare("DELETE FROM assignment_proposals WHERE trip_id = ?").bind(tripId),
    db.prepare("DELETE FROM item_notes WHERE trip_id = ?").bind(tripId),
    db.prepare("DELETE FROM chat_messages WHERE trip_id = ?").bind(tripId),
    db.prepare("DELETE FROM item_owners WHERE trip_id = ?").bind(tripId),
    db.prepare("DELETE FROM trip_items WHERE trip_id = ?").bind(tripId),
    db.prepare(`INSERT INTO trip_snapshots (trip_id, state_json, version, updated_by, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(trip_id) DO UPDATE SET state_json = excluded.state_json, version = excluded.version, updated_by = excluded.updated_by, updated_at = CURRENT_TIMESTAMP`)
      .bind(tripId, JSON.stringify(state), version, userId),
  ];
  const statements: D1PreparedStatement[] = [];
  state.items.forEach((item, position) => {
    const itemId = `${tripId}:${item.id}`;
    statements.push(db.prepare("INSERT INTO trip_items (id, trip_id, client_id, name, icon, category, ai_reason, position, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(itemId, tripId, item.id, item.name, item.icon, item.group, item.aiReason ?? null, position, userId));
    item.owners.forEach((owner) => statements.push(db.prepare("INSERT INTO item_owners (item_id, trip_id, member_slot, checked, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)")
      .bind(itemId, tripId, owner, item.checked[owner] ? 1 : 0)));
  });
  state.itemNotes.forEach((note) => statements.push(db.prepare("INSERT INTO item_notes (id, trip_id, item_client_id, author_slot, body, created_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)")
    .bind(`${tripId}:${note.id}`, tripId, note.itemId, note.author, note.text)));
  state.messages.forEach((message) => statements.push(db.prepare("INSERT INTO chat_messages (id, trip_id, author_slot, body, is_system, created_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)")
    .bind(`${tripId}:${message.id}`, tripId, message.author, message.text, message.system ? 1 : 0)));
  state.assignmentProposals.forEach((proposal) => statements.push(db.prepare("INSERT INTO assignment_proposals (id, trip_id, message_id, item_client_id, requester_slot, target_slot, intent, confidence, status) VALUES (?, ?, ?, ?, ?, ?, 'claim', ?, 'pending')")
    .bind(proposal.id ?? createId("proposal"), tripId, String(proposal.afterMessageId), proposal.itemId, proposal.requester, proposal.target, Math.round((proposal.confidence ?? 0.8) * 100))));
  await db.batch(cleanup);
  for (let index = 0; index < statements.length; index += 80) {
    await db.batch(statements.slice(index, index + 80));
  }
}

export async function getAllowedSlots(db: D1Database, tripId: string) {
  const result = await db.prepare("SELECT slot_name AS slotName FROM trip_members WHERE trip_id = ? ORDER BY joined_at ASC")
    .bind(tripId).all<{ slotName: string }>();
  return result.results.map((row) => row.slotName);
}

export async function nextMemberSlot(db: D1Database, tripId: string) {
  const used = new Set(await getAllowedSlots(db, tripId));
  return MEMBER_SLOTS.find((slot) => !used.has(slot)) ?? null;
}
