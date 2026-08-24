type Category = "证件与钱财类" | "电子数码类" | "衣物鞋帽类" | "洗护化妆类" | "医药健康类" | "日用杂物类" | "零食饮料类";
type AiSuggestion = { name: string; group: Category; reason: string; signal: string };
type RankedItem = { rank: number; name: string; reason: string };
type SuggestionSource = "model" | "fallback";

const SEOUL_FALLBACK_RANKING: AiSuggestion[] = [
  { name: "转换插头", group: "电子数码类", reason: "出发前确认目的地插座标准，避免落地后无法为设备充电。", signal: "供电确认" },
  { name: "T-money 交通卡", group: "证件与钱财类", reason: "首尔公交、地铁和便利店都能使用，落地后出行会顺手很多。", signal: "交通必备" },
  { name: "流量卡", group: "电子数码类", reason: "提前准备韩国流量卡，落地即可查地图、联系朋友和叫车。", signal: "上网必备" },
  { name: "常用药品", group: "医药健康类", reason: "常用药提前自备，遇到身体不适时不必临时寻找合适药品。", signal: "应急备用" },
  { name: "折叠购物袋", group: "日用杂物类", reason: "购物时可以少买塑料袋，也方便临时收纳随身物品。", signal: "轻便收纳" },
];

const GENERAL_FALLBACK_RANKING: AiSuggestion[] = [
  { name: "转换插头", group: "电子数码类", reason: "出发前确认目的地插座标准，避免落地后无法为设备充电。", signal: "供电确认" },
  { name: "流量卡", group: "电子数码类", reason: "提前准备目的地流量，落地即可查地图、联系朋友和叫车。", signal: "上网必备" },
  { name: "行李牌", group: "日用杂物类", reason: "写好联系方式，托运行李拿错或遗失时更容易找回。", signal: "托运提醒" },
  { name: "密封袋", group: "日用杂物类", reason: "可以分装液体和潮湿物品，避免洗护用品在箱内渗漏。", signal: "收纳提醒" },
];

function normalize(value: string) {
  return value.toLowerCase().replace(/[\s·・—_\-/（）()]/g, "");
}

function isDuplicate(name: string, existingItems: string[]) {
  const candidate = normalize(name);
  return existingItems.some((item) => {
    const existing = normalize(item);
    return candidate === existing || (candidate.length >= 3 && existing.length >= 3 && (candidate.includes(existing) || existing.includes(candidate)));
  });
}

function inferCategory(name: string): Category {
  if (/(t-?money|交通卡|现金|零钱|银行卡|护照|证件)/i.test(name)) return "证件与钱财类";
  if (/(插头|充电|wifi|wi-fi|sim|esim|流量|相机|电池|内存卡|耳机)/i.test(name)) return "电子数码类";
  if (/(药|创可贴|口罩|消毒|过敏|晕车)/i.test(name)) return "医药健康类";
  if (/(外套|衣|裤|鞋|帽|袜|围巾)/i.test(name)) return "衣物鞋帽类";
  if (/(牙刷|牙膏|洗漱|洗面|护肤|防晒|卸妆|面膜)/i.test(name)) return "洗护化妆类";
  if (/(零食|饮料|水|糖)/i.test(name)) return "零食饮料类";
  return "日用杂物类";
}

function canonicalizeSuggestion(item: RankedItem): AiSuggestion {
  const rawName = item.name.trim();
  if (/t-?\s*money/i.test(rawName)) {
    return { name: "T-money 交通卡", group: "证件与钱财类", reason: item.reason, signal: "交通必备" };
  }
  if (/(wi-?fi|sim卡|esim|流量卡)/i.test(rawName)) {
    return { name: "流量卡", group: "电子数码类", reason: item.reason, signal: "上网必备" };
  }
  return { name: rawName, group: inferCategory(rawName), reason: item.reason, signal: "AI 推荐" };
}

function fallbackFor(destination: string, existingItems: string[]) {
  const ranking = /(韩国|首尔|seoul|korea)/i.test(destination) ? SEOUL_FALLBACK_RANKING : GENERAL_FALLBACK_RANKING;
  return ranking.filter((item) => !isDuplicate(item.name, existingItems)).slice(0, 2);
}

function extractOutputText(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const choices = (payload as { choices?: Array<{ message?: { content?: unknown } }> }).choices;
  return Array.isArray(choices) && typeof choices[0]?.message?.content === "string" ? choices[0].message.content : "";
}

function parseJsonObject(text: string) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(cleaned) as unknown;
}

function validateRankedItems(value: unknown): RankedItem[] {
  if (!value || typeof value !== "object" || !Array.isArray((value as { items?: unknown }).items)) return [];
  return (value as { items: unknown[] }).items.flatMap((entry, index) => {
    if (!entry || typeof entry !== "object") return [];
    const candidate = entry as Partial<RankedItem>;
    const name = typeof candidate.name === "string" ? candidate.name.trim().slice(0, 30) : "";
    const reason = typeof candidate.reason === "string" ? candidate.reason.trim().slice(0, 90) : "";
    const rank = typeof candidate.rank === "number" && Number.isFinite(candidate.rank) ? candidate.rank : index + 1;
    return name && reason ? [{ rank, name, reason }] : [];
  }).sort((a, b) => a.rank - b.rank).slice(0, 10);
}

function chooseUnseenSuggestions(rankedItems: RankedItem[], existingItems: string[]) {
  const chosen: AiSuggestion[] = [];
  for (const rankedItem of rankedItems) {
    const suggestion = canonicalizeSuggestion(rankedItem);
    if (isDuplicate(suggestion.name, existingItems) || isDuplicate(suggestion.name, chosen.map((item) => item.name))) continue;
    chosen.push(suggestion);
    if (chosen.length === 2) break;
  }
  return chosen;
}

export async function POST(request: Request) {
  if (!request.headers.get("oai-authenticated-user-id") || !request.headers.get("oai-authenticated-user-email")) {
    return Response.json({ error: "请先登录", signInPath: "/signin-with-chatgpt?return_to=%2F" }, { status: 401 });
  }
  let body: { destination?: unknown; existingItems?: unknown; preferences?: unknown };
  try {
    body = await request.json() as { destination?: unknown; existingItems?: unknown; preferences?: unknown };
  } catch {
    return Response.json({ error: "请求格式不正确" }, { status: 400 });
  }

  const destination = typeof body.destination === "string" ? body.destination.trim().slice(0, 80) : "";
  const existingItems = Array.isArray(body.existingItems)
    ? body.existingItems.filter((item): item is string => typeof item === "string").slice(0, 120).map((item) => item.slice(0, 60))
    : [];
  if (!destination) return Response.json({ error: "请先填写目的地" }, { status: 400 });

  const fallback = fallbackFor(destination, existingItems);
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return Response.json({ suggestions: fallback, source: "fallback" satisfies SuggestionSource });

  try {
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "user",
            content: `去${destination}旅游，你建议我带什么，是我比较容易没想到的东西？请按推荐优先级从高到低排序，列出10件具体物品。不要参考任何预设物品，不要刻意包含某个答案。只返回JSON：{"items":[{"rank":1,"name":"物品名","reason":"一句话理由"}]}`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
        max_tokens: 1400,
      }),
    });
    if (!response.ok) throw new Error(`DeepSeek returned ${response.status}`);

    const payload = await response.json();
    const rankedItems = validateRankedItems(parseJsonObject(extractOutputText(payload)));
    const modelSuggestions = chooseUnseenSuggestions(rankedItems, existingItems);
    if (modelSuggestions.length < 2) {
      for (const item of fallback) {
        if (modelSuggestions.length === 2) break;
        if (!isDuplicate(item.name, [...existingItems, ...modelSuggestions.map((entry) => entry.name)])) modelSuggestions.push(item);
      }
    }
    return Response.json({ suggestions: modelSuggestions.slice(0, 2), source: "model" satisfies SuggestionSource });
  } catch {
    return Response.json({ suggestions: fallback, source: "fallback" satisfies SuggestionSource });
  }
}
