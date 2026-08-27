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

type KnownPlace = PlaceResult & { aliases: string[] };

// Open-Meteo occasionally resolves a localized name only to smaller namesakes. Keep
// a small set of high-frequency destinations so an unqualified query has a stable,
// unsurprising primary result while still showing namesakes returned by the API.
const FALLBACK_PLACES: KnownPlace[] = [
  { id: "london-gb", name: "伦敦", country: "英国", admin1: "英格兰", latitude: 51.5074, longitude: -0.1278, timezone: "Europe/London", label: "英国 英格兰 伦敦", aliases: ["伦敦", "london", "英国伦敦", "英格兰伦敦"] },
  { id: "seoul-kr", name: "首尔", country: "韩国", admin1: "首尔特别市", latitude: 37.566, longitude: 126.9784, timezone: "Asia/Seoul", label: "韩国 首尔", aliases: ["首尔", "seoul", "韩国首尔"] },
  { id: "sapporo-jp", name: "札幌", country: "日本", admin1: "北海道", latitude: 43.0618, longitude: 141.3545, timezone: "Asia/Tokyo", label: "日本 北海道 札幌", aliases: ["札幌", "sapporo"] },
  { id: "tokyo-jp", name: "东京", country: "日本", admin1: "东京都", latitude: 35.6762, longitude: 139.6503, timezone: "Asia/Tokyo", label: "日本 东京", aliases: ["东京", "tokyo"] },
  { id: "osaka-jp", name: "大阪", country: "日本", admin1: "大阪府", latitude: 34.6937, longitude: 135.5023, timezone: "Asia/Tokyo", label: "日本 大阪", aliases: ["大阪", "osaka"] },
  { id: "shanghai-cn", name: "上海", country: "中国", admin1: "上海市", latitude: 31.2304, longitude: 121.4737, timezone: "Asia/Shanghai", label: "中国 上海", aliases: ["上海", "shanghai"] },
  { id: "chengdu-cn", name: "成都", country: "中国", admin1: "四川省", latitude: 30.5728, longitude: 104.0668, timezone: "Asia/Shanghai", label: "中国 四川 成都", aliases: ["成都", "chengdu"] },
  { id: "taizhou-zhejiang-cn", name: "台州", country: "中国", admin1: "浙江省", latitude: 28.6564, longitude: 121.4208, timezone: "Asia/Shanghai", label: "中国 浙江 台州", aliases: ["台州", "taizhou", "浙江台州"] },
];

function normalize(value: string) {
  return value.toLowerCase().replace(/[\s·・—_\-/（）()]/g, "");
}

function fallbackSearch(query: string) {
  const normalized = normalize(query);
  return FALLBACK_PLACES
    .filter((place) => normalize(`${place.country}${place.admin1}${place.name}${place.label}${place.aliases.join("")}`).includes(normalized))
    .map(({ id, name, country, admin1, latitude, longitude, timezone, label }) => ({ id, name, country, admin1, latitude, longitude, timezone, label }))
    .slice(0, 6);
}

function resultScore(raw: Record<string, unknown>, query: string) {
  const exactName = typeof raw.name === "string" && normalize(raw.name) === normalize(query);
  const population = Number(raw.population);
  const featureCode = typeof raw.feature_code === "string" ? raw.feature_code : "";
  const capitalBonus = featureCode === "PPLC" ? 100_000_000 : 0;
  return (exactName ? 1_000_000_000 : 0) + capitalBonus + (Number.isFinite(population) ? population : 0);
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
    const rankedResults = [...(payload.results ?? [])].sort((a, b) => resultScore(b, query) - resultScore(a, query));
    const places = rankedResults.flatMap((raw) => {
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
