import {
  ensureUser,
  getDatabase,
  getMembership,
  getRequestUser,
  jsonError,
  touchMembership,
  unauthorized,
} from "../../../_shared/server";
import { subscribeToTrip, type TripRealtimeEvent } from "../../../_shared/realtime";

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

  const encoder = new TextEncoder();
  let stopListening: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: TripRealtimeEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: trip-update\ndata: ${JSON.stringify(event)}\n\n`));
        } catch {
          cleanup();
        }
      };
      const cleanup = () => {
        if (closed) return;
        closed = true;
        stopListening?.();
        if (heartbeat) clearInterval(heartbeat);
      };

      controller.enqueue(encoder.encode("retry: 1200\nevent: ready\ndata: {}\n\n"));
      stopListening = subscribeToTrip(tripId, send);
      heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(": keep-alive\n\n"));
        } catch {
          cleanup();
        }
      }, 15_000);
      request.signal.addEventListener("abort", cleanup, { once: true });
    },
    cancel() {
      closed = true;
      stopListening?.();
      if (heartbeat) clearInterval(heartbeat);
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
