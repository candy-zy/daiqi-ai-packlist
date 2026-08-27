export type TripRealtimeEvent = {
  type: "trip_updated";
  tripId: string;
  version: number;
  reason: "state" | "message" | "claim" | "assignment" | "member";
};

type TripRealtimeListener = (event: TripRealtimeEvent) => void;
type RealtimeGlobal = typeof globalThis & {
  __daiqiTripRealtimeListeners?: Map<string, Set<TripRealtimeListener>>;
};

// The registry lives for the lifetime of the Worker isolate. It gives users
// connected to the same edge instance an immediate push path. D1 version
// polling remains the cross-isolate and reconnect safety net.
const realtimeGlobal = globalThis as RealtimeGlobal;
const listeners = realtimeGlobal.__daiqiTripRealtimeListeners
  ?? (realtimeGlobal.__daiqiTripRealtimeListeners = new Map());

export function subscribeToTrip(tripId: string, listener: TripRealtimeListener) {
  const tripListeners = listeners.get(tripId) ?? new Set<TripRealtimeListener>();
  tripListeners.add(listener);
  listeners.set(tripId, tripListeners);
  return () => {
    tripListeners.delete(listener);
    if (tripListeners.size === 0) listeners.delete(tripId);
  };
}

export function publishTripEvent(event: TripRealtimeEvent) {
  listeners.get(event.tripId)?.forEach((listener) => listener(event));
}
