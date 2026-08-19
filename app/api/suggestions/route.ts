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

const SEOUL_FALLBACK: AiSuggestion[] = [
  { name: "T-money 交通卡", group: "证件与钱财类", reason: "首尔公交、地铁和便利店都能使用，落地后出行会顺手很多。", signal: "交通必备" },
  { name: "流量卡", group: "电子数码类", reason: "提前准备韩国流量卡，落地即可查地图、联系朋友和叫车。", signal: "容易漏带" },
];

const GENERAL_FALLBACK: AiSuggestion[] = [
  { name: "流量卡", group: "电子数码类", reason: "提前准备目的地流量，落地即可查地图、联系朋友和叫车。", signal: "容易漏带" },
  { name: "行李牌", group: "日用杂物类", reason: "在行李牌写好联系方式，托运行李拿错或遗失时更容易找回。", signal: "托运提醒" },
  { name: "密封袋", group: "日用杂物类", reason: "可以分装液体和潮湿物品，也能避免洗护用品在箱内渗漏。", signal: "收纳提醒" },
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

function fallbackFor(destination: string, existingItems: string[]) {
  const candidates = /(韩国|首尔|seoul|korea)/i.test(destination)
    ? [...SEOUL_FALLBACK, ...GENERAL_FALLBACK]
    : GENERAL_FALLBACK;
  return candidates.filter((item) => !isDuplicate(item.name, existingItems)).slice(0, 2);
}

function extractOutputText(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const output = (payload as { output?: unknown[] }).output;
  if (!Array.isArray(output)) return "";
  for (const entry of output) {
    if (!entry || typeof entry !== "object") continue;
    const content = (entry as { content?: unknown[] }).content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (block && typeof block === "object" && (block as { type?: string }).type === "output_text") {
        return String((block as { text?: unknown }).text ?? "");
      }
    }
  }
  return "";
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
    if (!name || !reason || !signal || !CATEGORIES.includes(candidate.group as Category) || isDuplicate(name, existingItems) || seen.has(normalize(name))) return [];
    seen.add(normalize(name));
    return [{ name, group: candidate.group as Category, reason, signal }];
  }).slice(0, 2);
}

export async function POST(request: Request) {
  let body: { destination?: unknown; existingItems?: unknown };
  try {
    body = await request.json() as { destination?: unknown; existingItems?: unknown };
  } catch {
    return Response.json({ error: "请求格式不正确" }, { status: 400 });
  }

  const destination = typeof body.destination === "string" ? body.destination.trim().slice(0, 80) : "";
  const existingItems = Array.isArray(body.existingItems)
    ? body.existingItems.filter((item): item is string => typeof item === "string").slice(0, 120).map((item) => item.slice(0, 60))
    : [];
  if (!destination) return Response.json({ error: "请先填写目的地" }, { status: 400 });

  const fallback = fallbackFor(destination, existingItems);
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return Response.json({ suggestions: fallback, source: "fallback" });

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-5.6",
        input: [
          {
            role: "system",
            content: "你是旅行物品清单助手，不做路线或景点攻略。只推荐容易被忽略、但对目的地确实实用的随身物品。必须排除当前清单中已有的物品及其同义项，只给2个。名称要短，理由要具体。韩国或首尔旅行可优先考虑T-money交通卡、流量卡等基础但易漏的物品。",
          },
          {
            role: "user",
            content: `去${destination}旅游，你建议我带什么，是我比较容易没想到的东西？当前清单已有：${existingItems.join("、") || "暂无"}。只给2个，不能与清单重复。`,
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "packing_suggestions",
            strict: true,
            schema: {
              type: "object",
              properties: {
                suggestions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      group: { type: "string", enum: CATEGORIES },
                      reason: { type: "string" },
                      signal: { type: "string" },
                    },
                    required: ["name", "group", "reason", "signal"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["suggestions"],
              additionalProperties: false,
            },
          },
        },
      }),
    });
    if (!response.ok) throw new Error(`OpenAI returned ${response.status}`);

    const payload = await response.json();
    const outputText = extractOutputText(payload);
    const modelSuggestions = validateSuggestions(JSON.parse(outputText), existingItems);
    const completed = [...modelSuggestions];
    for (const item of fallback) {
      if (completed.length === 2) break;
      if (!isDuplicate(item.name, [...existingItems, ...completed.map((entry) => entry.name)])) completed.push(item);
    }

    return Response.json({ suggestions: completed.slice(0, 2), source: modelSuggestions.length === 2 ? "model" : "fallback" });
  } catch {
    return Response.json({ suggestions: fallback, source: "fallback" });
  }
}
