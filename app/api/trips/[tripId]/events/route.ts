import {
  ensureUser,
  getDatabase,
  getMembership,
  getRequestUser,
  jsonError,
  touchMembership,
  unauthorized,
} from "../../../_shared/server";
import { registerTripSocket } from "../../../_shared/realtime";

type RouteContext = { params: Promise<{ tripId: string }> };

export async function GET(request: Request, context: RouteContext) {
  if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
    return jsonError("该端点需要 WebSocket 升级", 426);
  }
  const user = getRequestUser(request);
  if (!user) return unauthorized();
  const { tripId } = await context.params;
  const db = getDatabase();
  await ensureUser(db, user);
  const membership = await getMembership(db, tripId, user.userId);
  if (!membership) return jsonError("你不是该队伍成员", 403);
  await touchMembership(db, tripId, user.userId);
  const initialTrip = await db.prepare("SELECT version FROM trips WHERE id = ?")
    .bind(tripId).first<{ version: number }>();
  if (!initialTrip) return jsonError("队伍不存在", 404);

  const pair = new WebSocketPair();
  const client = pair[0];
  const server = pair[1];
  server.accept();

  let lastVersion = initialTrip.version;
  let versionCheckInFlight = false;
  let unregister = registerTripSocket(tripId, server);
  const versionWatcher = setInterval(async () => {
    if (versionCheckInFlight) return;
    versionCheckInFlight = true;
    try {
      const trip = await db.prepare("SELECT version FROM trips WHERE id = ?")
        .bind(tripId).first<{ version: number }>();
      if (!trip || trip.version <= lastVersion) return;
      lastVersion = trip.version;
      server.send(JSON.stringify({ type: "trip_updated", tripId, version: trip.version, reason: "state" }));
    } catch {
      // The browser's 2.5-second version poll remains the final recovery path.
    } finally {
      versionCheckInFlight = false;
    }
  }, 1000);
  const cleanup = () => {
    clearInterval(versionWatcher);
    unregister();
    unregister = () => undefined;
  };
  server.addEventListener("message", async (event) => {
    if (event.data !== "ping") return;
    try {
      await touchMembership(db, tripId, user.userId);
      server.send(JSON.stringify({ type: "pong", tripId, at: Date.now() }));
    } catch {
      cleanup();
    }
  });
  server.addEventListener("close", cleanup);
  server.addEventListener("error", cleanup);
  server.send(JSON.stringify({ type: "ready", tripId, version: lastVersion }));

  return new Response(null, {
    status: 101,
    webSocket: client,
  } as ResponseInit & { webSocket: WebSocket });
}
