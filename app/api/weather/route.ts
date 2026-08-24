type WeatherResponse = {
  source: "forecast" | "season";
  summary: string;
  minTemp?: number;
  maxTemp?: number;
  precipitationProbability?: number;
  snowfall?: number;
  season?: string;
};

function dateValue(value: unknown) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

function seasonFor(month: number, latitude: number) {
  const northern = latitude >= 0;
  const seasons = northern
    ? [[12, 1, 2, "冬季"], [3, 4, 5, "春季"], [6, 7, 8, "夏季"], [9, 10, 11, "秋季"]]
    : [[12, 1, 2, "夏季"], [3, 4, 5, "秋季"], [6, 7, 8, "冬季"], [9, 10, 11, "春季"]];
  return String(seasons.find((entry) => (entry.slice(0, 3) as number[]).includes(month))?.[3] ?? "当季");
}

export async function POST(request: Request) {
  if (!request.headers.get("oai-authenticated-user-id") || !request.headers.get("oai-authenticated-user-email")) {
    return Response.json({ error: "请先登录", signInPath: "/signin-with-chatgpt?return_to=%2F" }, { status: 401 });
  }
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const startDate = dateValue(body?.startDate);
  const endDate = dateValue(body?.endDate);
  const latitude = Number(body?.latitude);
  const longitude = Number(body?.longitude);
  const timezone = typeof body?.timezone === "string" ? body.timezone.slice(0, 80) : "auto";
  if (!startDate || !endDate || endDate < startDate || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return Response.json({ error: "地点或日期不完整" }, { status: 400 });
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const daysAway = Math.floor((start.getTime() - today.getTime()) / 86400000);
  const endDaysAway = Math.floor((end.getTime() - today.getTime()) / 86400000);
  const month = Number(startDate.slice(5, 7));
  const season = seasonFor(month, latitude);
  if (daysAway < 0 || daysAway > 15 || endDaysAway > 15) {
    const result: WeatherResponse = { source: "season", season, summary: `行程在 ${month} 月，可靠预报尚未开放，将按当地${season}准备` };
    return Response.json(result);
  }

  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(latitude));
    url.searchParams.set("longitude", String(longitude));
    url.searchParams.set("daily", "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,snowfall_sum");
    url.searchParams.set("timezone", timezone || "auto");
    url.searchParams.set("start_date", startDate);
    url.searchParams.set("end_date", endDate);
    const response = await fetch(url, { headers: { accept: "application/json" } });
    if (!response.ok) throw new Error(`Forecast returned ${response.status}`);
    const payload = await response.json() as { daily?: Record<string, unknown> };
    const daily = payload.daily ?? {};
    const minValues = Array.isArray(daily.temperature_2m_min) ? daily.temperature_2m_min.map(Number).filter(Number.isFinite) : [];
    const maxValues = Array.isArray(daily.temperature_2m_max) ? daily.temperature_2m_max.map(Number).filter(Number.isFinite) : [];
    const rainValues = Array.isArray(daily.precipitation_probability_max) ? daily.precipitation_probability_max.map(Number).filter(Number.isFinite) : [];
    const snowValues = Array.isArray(daily.snowfall_sum) ? daily.snowfall_sum.map(Number).filter(Number.isFinite) : [];
    if (!minValues.length || !maxValues.length) throw new Error("Forecast data missing");
    const minTemp = Math.round(Math.min(...minValues));
    const maxTemp = Math.round(Math.max(...maxValues));
    const precipitationProbability = rainValues.length ? Math.round(Math.max(...rainValues)) : 0;
    const snowfall = snowValues.length ? Math.round(snowValues.reduce((sum, value) => sum + value, 0) * 10) / 10 : 0;
    const condition = snowfall > 0 ? `，预计有 ${snowfall} cm 降雪` : precipitationProbability >= 40 ? `，最高降水概率 ${precipitationProbability}%` : "，降水概率较低";
    const result: WeatherResponse = { source: "forecast", minTemp, maxTemp, precipitationProbability, snowfall, summary: `行程期间约 ${minTemp}–${maxTemp}°C${condition}` };
    return Response.json(result);
  } catch {
    const result: WeatherResponse = { source: "season", season, summary: `暂时无法获取逐日天气，将按当地${season}准备` };
    return Response.json(result);
  }
}
