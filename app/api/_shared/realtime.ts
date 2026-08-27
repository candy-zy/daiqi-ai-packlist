export type TripRealtimeEvent = {
  type: "trip_updated";
  tripId: string;
  version: number;
  reason: "state" | "message" | "claim" | "assignment" | "member";
};

type RealtimeGlobal = typeof globalThis & {
  __daiqiTripRealtimeSockets?: Map<string, Set<WebSocket>>;
};

// WebSocket connections are intentionally only a notification channel. D1 is
// still the source of truth, so reconnects and cross-isolate misses are safely
// recovered by the client's version poll.
const realtimeGlobal = globalThis as RealtimeGlobal;
const sockets = realtimeGlobal.__daiqiTripRealtimeSockets
  ?? (realtimeGlobal.__daiqiTripRealtimeSockets = new Map());

export function registerTripSocket(tripId: string, socket: WebSocket) {
  const tripSockets = sockets.get(tripId) ?? new Set<WebSocket>();
  tripSockets.add(socket);
  sockets.set(tripId, tripSockets);
  return () => {
    tripSockets.delete(socket);
    if (tripSockets.size === 0) sockets.delete(tripId);
  };
}

export function publishTripEvent(event: TripRealtimeEvent) {
  const tripSockets = sockets.get(event.tripId);
  if (!tripSockets) return;
  const payload = JSON.stringify(event);
  tripSockets.forEach((socket) => {
    try {
      socket.send(payload);
    } catch {
      tripSockets.delete(socket);
    }
  });
  if (tripSockets.size === 0) sockets.delete(event.tripId);
}
