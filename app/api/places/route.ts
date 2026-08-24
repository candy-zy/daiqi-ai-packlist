type PlaceResult = {
  id: string;
  name: string;
  country: string;
  admin1: string;
  latitude: number;
  longitude: number;
  timezone: string;
  label: string;
};

const FALLBACK_PLACES: PlaceResult[] = [
  { id: "seoul-kr", name: "首尔", country: "韩国", admin1: "首尔特别市", latitude: 37.566, longitude: 126.9784, timezone: "Asia/Seoul", label: "韩国 首尔" },
  { id: "sapporo-jp", name: "札幌", country: "日本", admin1: "北海道", latitude: 43.0618, longitude: 141.3545, timezone: "Asia/Tokyo", label: "日本 北海道 札幌" },
  { id: "tokyo-jp", name: "东京", country: "日本", admin1: "东京都", latitude: 35.6762, longitude: 139.6503, timezone: "Asia/Tokyo", label: "日本 东京" },
  { id: "osaka-jp", name: "大阪", country: "日本", admin1: "大阪府", latitude: 34.6937, longitude: 135.5023, timezone: "Asia/Tokyo", label: "日本 大阪" },
  { id: "shanghai-cn", name: "上海", country: "中国", admin1: "上海市", latitude: 31.2304, longitude: 121.4737, timezone: "Asia/Shanghai", label: "中国 上海" },
  { id: "chengdu-cn", name: "成都", country: "中国", admin1: "四川省", latitude: 30.5728, longitude: 104.0668, timezone: "Asia/Shanghai", label: "中国 四川 成都" },
];

function normalize(value: string) {
  return value.toLowerCase().replace(/[\s·・—_\-/（）()]/g, "");
}

function fallbackSearch(query: string) {
  const normalized = normalize(query);
  return FALLBACK_PLACES.filter((place) => normalize(`${place.country}${place.admin1}${place.name}${place.label}`).includes(normalized)).slice(0, 6);
}

export async function GET(request: Request) {
  if (!request.headers.get("oai-authenticated-user-id") || !request.headers.get("oai-authenticated-user-email")) {
    return Response.json({ error: "请先登录", signInPath: "/signin-with-chatgpt?return_to=%2F" }, { status: 401 });
  }
  const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, 60) ?? "";
  if (query.length < 2) return Response.json({ places: [] });

  try {
    const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
    url.searchParams.set("name", query);
    url.searchParams.set("count", "6");
    url.searchParams.set("language", "zh");
    url.searchParams.set("format", "json");
    const response = await fetch(url, { headers: { accept: "application/json" } });
    if (!response.ok) throw new Error(`Geocoding returned ${response.status}`);
    const payload = await response.json() as { results?: Array<Record<string, unknown>> };
    const places = (payload.results ?? []).flatMap((raw) => {
      const name = typeof raw.name === "string" ? raw.name.trim() : "";
      const country = typeof raw.country === "string" ? raw.country.trim() : "";
      const admin1 = typeof raw.admin1 === "string" ? raw.admin1.trim() : "";
      const latitude = Number(raw.latitude);
      const longitude = Number(raw.longitude);
      const timezone = typeof raw.timezone === "string" ? raw.timezone.trim() : "auto";
      if (!name || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];
      const parts = [country, admin1, name].filter((part, index, all) => part && all.indexOf(part) === index);
      return [{ id: String(raw.id ?? `${latitude},${longitude}`), name, country, admin1, latitude, longitude, timezone, label: parts.join(" ") }];
    });
    const preferred = fallbackSearch(query);
    const merged = [...preferred, ...places].filter((place, index, all) => all.findIndex((candidate) => candidate.id === place.id || (candidate.name === place.name && candidate.country === place.country)) === index).slice(0, 6);
    return Response.json({ places: merged });
  } catch {
    return Response.json({ places: fallbackSearch(query), source: "fallback" });
  }
}
