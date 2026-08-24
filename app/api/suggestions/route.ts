const CATEGORIES = [
  "证件与钱财类",
  "电子数码类",
  "衣物鞋帽类",
  "洗护化妆类",
  "医药健康类",
  "日用杂物类",
  "零食饮料类",
] as const;

type Category = typeof CATEGORIES[number];
type AiSuggestion = { name: string; group: Category; reason: string; signal: string };
type SuggestionSource = "rules" | "hybrid" | "model" | "fallback";

const SEOUL_FALLBACK: AiSuggestion[] = [
  { name: "T-money 交通卡", group: "证件与钱财类", reason: "首尔公交、地铁和便利店都能使用，落地后出行会顺手很多。", signal: "交通必备" },
  { name: "流量卡", group: "电子数码类", reason: "提前准备韩国流量卡，落地即可查地图、联系朋友和叫车。", signal: "容易漏带" },
];

const GENERAL_FALLBACK: AiSuggestion[] = [
  { name: "流量卡", group: "电子数码类", reason: "提前准备目的地流量，落地即可查地图、联系朋友和叫车。", signal: "容易漏带" },
  { name: "行李牌", group: "日用杂物类", reason: "在行李牌写好联系方式，托运行李拿错或遗失时更容易找回。", signal: "托运提醒" },
  { name: "密封袋", group: "日用杂物类", reason: "可以分装液体和潮湿物品，也能避免洗护用品在箱内渗漏。", signal: "收纳提醒" },
];

const LOW_VALUE_ITEM_PATTERN = /(便携加湿器|加湿器|折叠晾衣架|晾衣架|便携熨斗|熨斗|吹风机|烧水壶|热水壶)/;

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

function fallbackFor(destination: string, existingItems: string[]) {
  const candidates = /(韩国|首尔|seoul|korea)/i.test(destination)
    ? [...SEOUL_FALLBACK, ...GENERAL_FALLBACK]
    : GENERAL_FALLBACK;
  return candidates.filter((item) => !isDuplicate(item.name, existingItems)).slice(0, 2);
}

function destinationPriorityFor(destination: string, existingItems: string[]) {
  if (!/(韩国|首尔|seoul|korea)/i.test(destination)) return [];
  return SEOUL_FALLBACK.filter((item) => !isDuplicate(item.name, existingItems)).slice(0, 2);
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

function validateSuggestions(value: unknown, existingItems: string[]): AiSuggestion[] {
  if (!value || typeof value !== "object" || !Array.isArray((value as { suggestions?: unknown }).suggestions)) return [];
  const seen = new Set<string>();
  return (value as { suggestions: unknown[] }).suggestions.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const candidate = entry as Partial<AiSuggestion>;
    const name = typeof candidate.name === "string" ? candidate.name.trim().slice(0, 30) : "";
    const reason = typeof candidate.reason === "string" ? candidate.reason.trim().slice(0, 70) : "";
    const signal = typeof candidate.signal === "string" ? candidate.signal.trim().slice(0, 10) : "";
    if (!name || !reason || !signal || LOW_VALUE_ITEM_PATTERN.test(name) || !CATEGORIES.includes(candidate.group as Category) || isDuplicate(name, existingItems) || seen.has(normalize(name))) return [];
    seen.add(normalize(name));
    return [{ name, group: candidate.group as Category, reason, signal }];
  }).slice(0, 2);
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
  const preferences = Array.isArray(body.preferences)
    ? body.preferences.filter((item): item is string => typeof item === "string").slice(0, 20).map((item) => item.trim().slice(0, 30)).filter(Boolean)
    : [];
  if (!destination) return Response.json({ error: "请先填写目的地" }, { status: 400 });

  const prioritySuggestions = destinationPriorityFor(destination, existingItems);
  if (prioritySuggestions.length === 2) {
    return Response.json({ suggestions: prioritySuggestions, source: "rules" satisfies SuggestionSource });
  }

  const reservedNames = prioritySuggestions.map((item) => item.name);
  const modelExistingItems = [...existingItems, ...reservedNames];
  const fallback = fallbackFor(destination, modelExistingItems);
  const slotsNeeded = 2 - prioritySuggestions.length;
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return Response.json({
      suggestions: [...prioritySuggestions, ...fallback].slice(0, 2),
      source: prioritySuggestions.length ? "rules" : "fallback" satisfies SuggestionSource,
    });
  }

  try {
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: `你是旅行物品清单助手，不做路线或景点攻略。推荐优先级依次是：目的地高频刚需；体积小但遗漏影响大；符合季节和用户偏好。必须排除当前清单已有物品及同义项、酒店通常提供的物品、低必要性物品和明显增加行李负担的物品。禁止推荐便携加湿器、晾衣架、熨斗、吹风机和热水壶。没有可靠建议时可以少推荐。名称要短，理由必须说明在目的地的具体用途。只输出 JSON：{"suggestions":[{"name":"物品","group":"${CATEGORIES.join("|此处任选一个|")}","reason":"一句具体理由","signal":"最多6字"}]}`,
          },
          {
            role: "user",
            content: `去${destination}旅游，请补充${slotsNeeded}件我容易没想到、但高频实用且便携的物品。当前清单及已预留推荐已有：${modelExistingItems.join("、") || "暂无"}。我的出行偏好：${preferences.join("、") || "未填写"}。不能重复，也不要为了凑数推荐低必要性物品；偏好只用于提高相关性。`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
        max_tokens: 700,
      }),
    });
    if (!response.ok) throw new Error(`DeepSeek returned ${response.status}`);

    const payload = await response.json();
    const outputText = extractOutputText(payload);
    const modelSuggestions = validateSuggestions(parseJsonObject(outputText), modelExistingItems).slice(0, slotsNeeded);
    const completed = [...prioritySuggestions, ...modelSuggestions];
    for (const item of fallback) {
      if (completed.length === 2) break;
      if (!isDuplicate(item.name, [...existingItems, ...completed.map((entry) => entry.name)])) completed.push(item);
    }

    const source: SuggestionSource = prioritySuggestions.length && modelSuggestions.length
      ? "hybrid"
      : modelSuggestions.length === slotsNeeded
        ? "model"
        : prioritySuggestions.length
          ? "rules"
          : "fallback";
    return Response.json({ suggestions: completed.slice(0, 2), source });
  } catch {
    return Response.json({
      suggestions: [...prioritySuggestions, ...fallback].slice(0, 2),
      source: prioritySuggestions.length ? "rules" : "fallback" satisfies SuggestionSource,
    });
  }
}
