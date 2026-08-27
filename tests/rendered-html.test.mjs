import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function requestSite(path = "/", init) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const headers = new Headers(init?.headers ?? { accept: "text/html" });
  headers.set("oai-authenticated-user-id", "test-user");
  headers.set("oai-authenticated-user-email", "test@example.com");
  return worker.fetch(
    new Request(`http://localhost${path}`, { ...(init ?? {}), headers }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

async function render() {
  return requestSite();
}

test("server-renders a focused team-list home experience", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>带齐｜朋友一起收拾行李<\/title>/);
  assert.match(html, /我的旅行队伍/);
  assert.match(html, /还没有旅行队伍/);
  assert.match(html, /新建队伍/);
  assert.match(html, /加入队伍/);
  assert.match(html, /team-list-shell/);
  assert.match(html, /character-avatar avatar-me/);
  assert.doesNotMatch(html, /Your site is taking shape|codex-preview/);
});

test("renders a local sign-in fallback instead of a 404", async () => {
  const page = await readFile(new URL("../app/signin-with-chatgpt/page.tsx", import.meta.url), "utf8");
  assert.match(page, /本地开发时没有托管层/);
  assert.match(page, /前往线上登录/);
  assert.match(page, /返回带齐/);
  assert.match(page, /safeReturnTo/);
});

test("ships as a mobile PWA with local trip continuity", async () => {
  const [page, layout, manifest, serviceWorker] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"),
    readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
  ]);
  const parsedManifest = JSON.parse(manifest);

  assert.equal(parsedManifest.display, "standalone");
  assert.equal(parsedManifest.orientation, "portrait-primary");
  assert.equal(parsedManifest.start_url, "/");
  assert.ok(parsedManifest.icons.some((icon) => icon.sizes === "512x512" && icon.purpose === "maskable"));
  assert.match(layout, /manifest: "\/manifest\.webmanifest"/);
  assert.match(layout, /appleWebApp/);
  assert.match(layout, /viewportFit: "cover"/);
  assert.match(page, /navigator\.serviceWorker\.register\("\/sw\.js"\)/);
  assert.match(page, /localStorage\.setItem\(localStateKey/);
  assert.match(serviceWorker, /CACHE_NAME = "daiqi-app-v3"/);
  assert.match(serviceWorker, /departure-team-v2\.webp\?v=3/);
  assert.match(manifest, /app-icon-192\.png\?v=2/);
  assert.match(manifest, /app-icon-512\.png\?v=2/);
  assert.match(page, /className="brand-mark" src="\/app-icon-192\.png\?v=2"/);
  assert.match(serviceWorker, /request\.mode === "navigate"/);
  await Promise.all([
    access(new URL("../public/app-icon-192.png", import.meta.url)),
    access(new URL("../public/app-icon-512.png", import.meta.url)),
    access(new URL("../public/app-icon-master-v2.png", import.meta.url)),
    access(new URL("../public/apple-touch-icon.png", import.meta.url)),
  ]);
});

test("team list and create flow keep navigation predictable", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /className="topbar setup-topbar team-list-topbar"/);
  assert.match(page, /className="team-list-content"/);
  assert.match(page, /function startCreateTrip/);
  assert.match(page, /function startJoinTrip/);
  assert.match(page, /className="setup-back-button"/);
  assert.match(page, /这次去哪儿/);
  assert.match(page, /className="team-profile-button"[^>]*>\s*<CharacterAvatar member=\{currentMember\}\s*\/>\s*<\/button>/);
  assert.doesNotMatch(page, /className="install-app-button"/);
  assert.equal(page.match(/className="topbar/g)?.length, 2, "team list and create flow each keep one brand header");
});

test("ships hand-drawn characters and consistent line item icons", async () => {
  const [page, css, layout] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(page, /from "lucide-react"/);
  assert.match(page, /from "@phosphor-icons\/react"/);
  assert.match(page, /function ItemGraphic/);
  assert.match(page, /const phosphorItemIcons: Record<string, PhosphorIcon>/);
  assert.match(page, /const lucideItemIcons: Record<string, LucideIcon>/);
  assert.match(page, /phosphorItemIcons\[item\.name\]/);
  assert.match(page, /lucideItemIcons\[item\.name\] \?\? Package/);
  assert.match(page, /"裤子": Pants/);
  assert.match(page, /"袜子": Sock/);
  assert.match(page, /"流量卡": SimCard/);
  assert.doesNotMatch(page, /"驾驶证"|"鞋子"|"墨镜"/);
  assert.match(page, /weight="duotone"/);
  assert.doesNotMatch(page, /className="item-sticker-emoji"/);
  assert.match(page, /function CharacterAvatar/);
  assert.match(css, /team-characters\.png/);
  assert.doesNotMatch(css, /Apple Color Emoji/);
  assert.doesNotMatch(css, /item-sticker-emoji/);
  assert.match(css, /item-icon svg/);
  assert.match(css, /Hand-drawn travel journal theme/);
  assert.doesNotMatch(css, /\.make-personal-button/);
  assert.doesNotMatch(css, /Watercolor collage trial|watercolor-seoul-collage/);
  assert.match(layout, /title: "带齐｜朋友一起收拾行李"/);
  await access(new URL("../public/team-characters.png", import.meta.url));
});

test("uses one semantic rem-based typography system without undersized readable text", async () => {
  const [typography, layout] = await Promise.all([
    readFile(new URL("../app/typography.css", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);

  for (const token of ["display", "h1", "h2", "h3", "body", "secondary", "caption"]) {
    assert.match(typography, new RegExp(`--type-${token}-size:`));
    assert.match(typography, new RegExp(`--type-${token}-line:`));
  }
  assert.match(typography, /--type-display-size:2rem/);
  assert.match(typography, /--type-body-size:1rem/);
  assert.match(typography, /--type-caption-size:\.75rem/);
  assert.match(typography, /font-size:var\(--type-button-primary-size\)/);
  assert.match(typography, /font-size:var\(--type-input-size\)/);
  assert.match(typography, /Text scaling resilience/);
  assert.match(layout, /import "\.\/typography\.css"/);
  assert.doesNotMatch(typography, /font-size\s*:\s*[0-9.]+px/);
  assert.doesNotMatch(typography, /font-weight\s*:\s*(?:[1-9][0-9]{2})/);
});

test("category headers stay concise without explanatory subtitles", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(page, /category\.note/);
  assert.doesNotMatch(page, /CategoryGraphic|categoryIcons/);
  assert.doesNotMatch(page, /充电、存储与拍摄设备|证件、票务、订单与支付|常用药物与健康防护/);
  assert.match(page, /<h2>{category\.name}<\/h2>/);
});

test("AI suggestions use a prompt-first ranked model response and a server-only route", async () => {
  const [page, route] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/suggestions/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /T-money 交通卡/);
  assert.match(page, /流量卡/);
  assert.doesNotMatch(page, /韩系拍照发夹|折叠购物袋/);
  assert.match(page, /fetch\("\/api\/suggestions"/);
  assert.match(route, /process\.env\.DEEPSEEK_API_KEY/);
  assert.match(route, /https:\/\/api\.deepseek\.com\/chat\/completions/);
  assert.match(route, /response_format: \{ type: "json_object" \}/);
  assert.match(route, /按推荐优先级从高到低排序，列出10件具体物品/);
  assert.match(route, /我的旅行兴趣\/偏好是/);
  assert.match(route, /preferences\.join\("、"\)/);
  assert.match(route, /请结合目的地、明确的旅行日期、天气信息和我的兴趣偏好/);
  assert.match(route, /chooseUnseenSuggestions/);
  assert.match(route, /slice\(0, 2\)/);
  assert.match(route, /existingItems/);
});

test("team chat uses an authenticated atomic message endpoint and shared polling", async () => {
  const [page, route] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/trips/[tripId]/messages/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(page, /fetch\(`\/api\/trips\/\$\{activeTripId\}\/messages`/);
  assert.match(page, /chatSyncInFlightRef/);
  assert.match(page, /Math\.floor\(Math\.random\(\) \* 1_000_000_000\) \+ 1/);
  assert.match(page, /persistedMessages/);
  assert.match(page, /setInterval\(\(\) => void poll\(\), 2500\)/);
  assert.match(route, /getMembership/);
  assert.match(route, /membership\.slotName/);
  assert.match(route, /messages: \[\.\.\.current\.state\.messages/);
  assert.match(route, /UPDATE trips SET version = version \+ 1/);
  assert.match(route, /chat_message_sent/);
});

test("onboarding resolves weather only after submission and keeps it as hidden AI context", async () => {
  const [page, places, weather, suggestions, shared] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/places/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/weather/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/suggestions/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/_shared/server.ts", import.meta.url), "utf8"),
  ]);
  assert.match(page, /role="combobox"/);
  assert.match(page, /搜索城市或地区，如首尔、北海道/);
  assert.match(page, /async function resolveLocationInput/);
  assert.match(page, /const resolvedPlace = await resolveLocationInput\(\)/);
  assert.match(page, /if \(!resolvedPlace\.manual\)/);
  assert.doesNotMatch(page, /请从搜索结果中选择一个目的地/);
  assert.match(page, /onClick=\{openPreferences\}/);
  assert.match(page, /type="date"/);
  const createTeamBlock = page.slice(page.indexOf("async function createTeam"), page.indexOf("function openProfile"));
  assert.match(createTeamBlock, /fetch\("\/api\/weather"/);
  assert.match(createTeamBlock, /weather: resolvedWeather/);
  assert.doesNotMatch(page, /className=\{`setup-weather/);
  assert.doesNotMatch(page, /已加入当地季节信息/);
  assert.match(page, /applyPresetItems\(seedItems, profile, cleanDestination\)/);
  assert.match(places, /geocoding-api\.open-meteo\.com\/v1\/search/);
  assert.match(places, /id: "london-gb"/);
  assert.match(places, /id: "taizhou-zhejiang-cn"/);
  assert.match(places, /id: "wenzhou-cn"/);
  assert.match(places, /aliases: \["伦敦", "london", "英国伦敦", "英格兰伦敦"\]/);
  assert.match(places, /function geocodingQueries/);
  assert.match(places, /variants\.push\(`\$\{query\}市`\)/);
  assert.match(places, /fetchGeocodingResults\(query\)/);
  assert.match(places, /function manualPlace/);
  assert.match(places, /merged\.length \? merged : \[manualPlace\(query\)\]/);
  assert.match(places, /resultScore/);
  assert.match(places, /raw\.population/);
  assert.match(places, /featureCode === "PPLC"/);
  assert.match(weather, /api\.open-meteo\.com\/v1\/forecast/);
  assert.match(weather, /Weather forecast retrying with automatic timezone/);
  assert.match(weather, /cache: "no-store"/);
  assert.match(weather, /daysAway > 15/);
  assert.match(suggestions, /旅行日期是\$\{startDate\}至\$\{endDate\}/);
  assert.match(suggestions, /天气信息和日期优先于/);
  assert.match(shared, /tripContext: SharedTripContext \| null/);
  assert.match(shared, /sanitizeTripContext/);
});

test("AI suggestions skip an existing converter before selecting the next two ranked items", async () => {
  const response = await requestSite("/api/suggestions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ destination: "韩国 · 首尔", existingItems: ["身份证", "转换插头", "相机", "充电宝"] }),
  });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.source, "fallback");
  assert.deepEqual(result.suggestions.map((item) => item.name), ["T-money 交通卡", "流量卡"]);
});

test("AI suggestions keep the converter first when it is absent from the list", async () => {
  const response = await requestSite("/api/suggestions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ destination: "韩国 · 首尔", existingItems: ["身份证", "相机", "充电宝"] }),
  });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.deepEqual(result.suggestions.map((item) => item.name), ["转换插头", "T-money 交通卡"]);
});

test("AI ranking is filtered only after the model responds and common aliases are normalized", async () => {
  const [page, route] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/suggestions/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(route, /validateRankedItems/);
  assert.match(route, /chooseUnseenSuggestions\(rankedItems, existingItems, international\)/);
  assert.match(route, /canonicalizeSuggestion/);
  assert.match(route, /T-money 交通卡/);
  assert.match(route, /wi-\?fi\|sim卡\|esim\|流量卡/);
  assert.match(route, /这是境外旅行/);
  assert.match(route, /这是中国境内旅行/);
  assert.match(page, /applySuggestionDisplayPolicy/);
});

test("domestic destinations never fall back to foreign connectivity items", async () => {
  const response = await requestSite("/api/suggestions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ destination: "中国 四川 成都", existingItems: [] }),
  });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.ok(result.suggestions.every((item) => !/(流量卡|交通卡|T-money|转换插头)/i.test(item.name)));
});

test("domestic classification overrides a stale overseas flag", async () => {
  const response = await requestSite("/api/suggestions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ destination: "中国 四川 成都", international: true, existingItems: [] }),
  });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.ok(result.suggestions.every((item) => !/(流量卡|交通卡|T-money|转换插头)/i.test(item.name)));
});

test("legacy low-value recommendation cards refresh once through the ranked API", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /refreshedLegacySuggestionsRef/);
  assert.match(page, /便携加湿器\|折叠晾衣架/);
  assert.match(page, /hasLegacySuggestions/);
  assert.match(page, /hasInvalidDomesticSuggestions/);
  assert.match(page, /visibleSuggestions/);
  assert.match(page, /setSuggestions\(isInternationalDestination\(cleanDestination\) \? seedSuggestions : \[\]\)/);
  assert.match(page, /fetch\("\/api\/suggestions"/);
});

test("personal center uses preferences and gear only to preset unassigned items", async () => {
  const [page, css, route, prd] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/api/suggestions/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../docs/PERSONAL_CENTER_PRD.md", import.meta.url), "utf8"),
  ]);

  assert.match(page, /我的出行偏好/);
  assert.match(page, /旅行时，我更在意/);
  assert.match(page, /出行时，我容易/);
  assert.match(page, /我有这些设备/);
  assert.match(page, /label: "想出片"/);
  assert.match(page, /label: "会化妆"/);
  assert.match(page, /label: "重视护肤"/);
  assert.doesNotMatch(page, /label: "户外 \/ 徒步 \/ 露营"/);
  assert.doesNotMatch(page, /label: "观星 \/ 天文"/);
  assert.match(page, /容易晕车/);
  assert.match(page, /容易过敏/);
  assert.match(page, /容易低血糖/);
  assert.match(page, /有相机/);
  assert.match(page, /系统会把相关物品预设进清单，但不会替你认领/);
  assert.doesNotMatch(page, /习惯带零食/);
  assert.doesNotMatch(page, /option\.impact/);
  assert.match(page, /items: \["自拍杆", "手机稳定器", "三脚架"\]/);
  assert.match(page, /items: \["水乳", "面霜", "面膜", "防晒霜"\]/);
  assert.doesNotMatch(page, /label: "(?:运动 \/ 健身|带娃出行|宠物出行|钓鱼|滑雪 \/ 冰雪活动|水上运动 \/ 潜水|温泉 \/ 泡汤|美食|手作 \/ 绘画|商务出行|音乐 \/ 演出|骑行|自驾游)"/);
  assert.match(page, /const removedPreferenceItemNames = new Set\(\[/);
  assert.match(page, /"宠物证件", "宠物粮", "水碗", "牵引绳", "宠物常用药"/);
  assert.match(page, /const removedPetItemNames = new Set/);
  assert.match(page, /function isManagedPresetItem/);
  assert.match(page, /function cleanupRemovedPreferenceItems/);
  assert.match(page, /items: cleanedItems/);
  assert.match(page, /const removedLegacyItems = cleanedItems\.length/);
  assert.match(page, /removedLegacyItems \? JSON\.stringify\(payload\.state\) : serialized/);
  assert.match(page, /setItems\(cleanupHealthPreferenceItems\(cleanupRemovedPreferenceItems\(saved\.items/);
  assert.match(page, /items: \["葡萄糖"\]/);
  assert.match(page, /const healthPreferenceItemNames = new Set/);
  assert.match(page, /function cleanupHealthPreferenceItems/);
  assert.match(page, /healthPreferenceItemNames\.has\(item\.name\)/);
  const seedBlock = page.slice(page.indexOf("const seedItems"), page.indexOf("const seedSuggestions"));
  assert.doesNotMatch(seedBlock, /name: "个人慢性病药物"|name: "晕车药"|name: "过敏药"|name: "葡萄糖"/);
  assert.doesNotMatch(page, /有转换插头/);
  assert.match(page, /function isInternationalDestination/);
  assert.match(page, /function applyPresetItems/);
  assert.match(page, /境外目的地预设/);
  assert.doesNotMatch(seedBlock, /name: "转换插头"/);
  const gearBlock = page.slice(page.indexOf("const gearOptions"), page.indexOf("const defaultProfile"));
  assert.doesNotMatch(gearBlock, /adapter|转换插头/);
  assert.doesNotMatch(gearBlock, /power-bank|有充电宝/);
  assert.match(page, /preferences:/);
  assert.match(css, /\.profile-modal/);
  assert.match(css, /\.preference-grid>button\.selected/);
  assert.doesNotMatch(page, /profileImpactItems|将预设或重点关注/);
  assert.doesNotMatch(css, /\.profile-impact/);
  assert.match(css, /\.preference-grid b \{[^}]*font-weight:var\(--font-regular\)/);
  assert.match(css, /\.preference-grid>button\.selected b \{[^}]*font-weight:var\(--font-semibold\)/);
  assert.match(route, /不要参考任何预设物品，不要刻意包含某个答案/);
  assert.match(prd, /拥有不等于携带/);
  assert.match(prd, /GET \| `\/api\/profile`/);
  assert.match(prd, /设备拥有不会自动生成已认领状态/);
  assert.match(prd, /设备库只影响预设物品/);
  assert.match(prd, /仅境外目的地预设/);
  assert.match(prd, /同一物品可由多个偏好触发/);
});

test("onboarding avatars stay consistent and verification keeps one compact progress row", async () => {
  const [page, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(page, /function selectAllPacked/);
  assert.match(page, /"全选"/);
  assert.match(page, /viewedMember !== currentMember/);
  assert.match(page, /提醒TA/);
  assert.match(page, /className="verify-toolbar"/);
  assert.match(page, /我的物品/);
  assert.match(page, /下一件未确认/);
  assert.doesNotMatch(page, /className="verify-banner"/);
  assert.match(css, /setup-illustration>\.avatar-me\{background-position:left center!important\}/);
  assert.match(css, /select-all-button/);
});

test("owner avatars and the also-bring control share one aligned circle row", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /\.shared-owner-action \{ align-items:flex-start; justify-content:flex-end; \}/);
  assert.match(css, /\.also-bring-button>span \{ width:34px; height:34px; \}/);
});

test("personal earphones and demo identities keep complete avatar context", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /"牙刷", "毛巾", "耳机", "流量卡"/);
  assert.match(page, /members\.find\(\(member\) => member\.name === owner\) \?\? demoMembers\.find/);
  assert.match(page, /const presenceMembers = useMemo/);
  assert.match(page, /fetch\("\/api\/demo-session"/);
  assert.match(page, /setAvailableTrips\(Array\.isArray\(session\.trips\) \? session\.trips : \[\]\)/);
  assert.match(page, /presenceMembers\.map/);
});

test("preparation defaults to the full list, includes unassigned view, and stays collapsible", async () => {
  const [page, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(page, /className="team-chat-action"/);
  assert.match(page, /<MessageCircle aria-hidden="true"/);
  assert.match(page, /className="list-controls"/);
  assert.match(page, /className={`edit-list-button/);
  assert.match(page, /<Sparkles aria-hidden="true"/);
  assert.match(page, /useState<ListFilter>\("all"\)/);
  assert.match(page, /type ListFilter = "all" \| "mine" \| "unassigned"/);
  assert.match(page, />全部 <span>/);
  assert.match(page, />我的 <span>/);
  assert.match(page, />待分工 <span>/);
  assert.match(page, /const myItems = \[[\s\S]*!isPersonalItem\(item\) && item\.owners\.includes\(currentMember\)[\s\S]*items\.filter\(isPersonalItem\)/);
  assert.match(page, /const unassignedItems = items\.filter/);
  assert.match(page, /expandedCategories/);
  assert.match(page, /className="section-head section-toggle"/);
  assert.match(page, /personalExpanded/);
  assert.match(page, /className="list-section category-section personal-section"/);
  assert.match(page, /className="section-head section-toggle" onClick=\{\(\) => setPersonalExpanded/);
  assert.doesNotMatch(page, /className="personal-zone"/);
  assert.doesNotMatch(page, /const assignmentProgress|assignment-overview|只看待分配|团队物品在前，个人物品在底部|点击讨论/);
  assert.match(page, /phase === "verify" \? <button/);
  assert.match(page, /author: currentMember/);
  assert.match(page, /setCurrentMember/);
  assert.doesNotMatch(page, /prototype-note|context-tags/);
  assert.match(css, /team-chat-action/);
  assert.match(css, /list-controls/);
  assert.match(css, /\.list-controls \{[\s\S]*position:sticky;[\s\S]*top:0;[\s\S]*z-index:8/);
  assert.match(css, /\.list-controls \{[\s\S]*background:var\(--paper\);[\s\S]*border-bottom:2px solid var\(--ink\)/);
  assert.doesNotMatch(css, /\.list-controls \{[\s\S]*backdrop-filter/);
  assert.match(css, /section-toggle/);
});

test("main workflow has a one-step back action without a heavy divider below filters", async () => {
  const [page, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(page, /function goBackOneStep/);
  assert.match(page, /aria-label="返回上一步"/);
  assert.match(css, /\.main-back-button/);
  const controlsBlock = css.slice(css.indexOf(".list-controls {"), css.indexOf(".list-controls .list-filters"));
  assert.match(controlsBlock, /border-bottom:0/);
  assert.match(controlsBlock, /box-shadow:none/);
});

test("completed checklist opens a dedicated illustrated departure page", async () => {
  const [page, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(page, /"prepare" \| "verify" \| "departed"/);
  assert.match(page, /setPhase\("departed"\)/);
  assert.match(page, /带上好心情，出发！/);
  assert.match(page, /departure-team-v2\.webp/);
  assert.match(page, /<Image className="departure-illustration"/);
  assert.match(page, /priority unoptimized/);
  assert.match(page, /phase !== "verify"/);
  assert.match(page, /const departureImage = new window\.Image\(\)/);
  assert.match(page, /departureImage\.src = departureImageSrc/);
  assert.match(page, /className="departure-illustration-shell"/);
  assert.match(css, /departure-page/);
  assert.match(css, /\.departure-illustration-shell \{[\s\S]*background:#f8efe6/);
  assert.doesNotMatch(page, /件全部确认|READY TO GO|首尔逛拍小队已就绪|GO!/);
  assert.doesNotMatch(page, /departure-route/);
  await access(new URL("../public/departure-team-v2.webp", import.meta.url));
});

test("preset items are managed through a dedicated preparation edit mode", async () => {
  const [page, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(page, /const \[editMode, setEditMode\]/);
  assert.match(page, /function removeItem/);
  assert.match(page, /current\.filter\(\(entry\) => entry\.id !== item\.id\)/);
  assert.match(page, /type DeletedItemSnapshot/);
  assert.match(page, /function undoDelete\(\)/);
  assert.match(page, /notify\(`已删除「\$\{item\.name\}」`, 3000, true\)/);
  assert.match(page, /toast\.canUndo && <button onClick=\{undoDelete\}>撤回<\/button>/);
  assert.match(css, /\.toast button \{[\s\S]*background:var\(--lime\)/);
  assert.doesNotMatch(page, /function toggleEditMode\(\) \{[\s\S]{0,300}setListFilter\("all"\)/);
  assert.match(page, /function swapItems/);
  assert.match(page, /function startDragging/);
  assert.match(page, /function dragItem/);
  assert.doesNotMatch(page, /function changeItemCategory|<select|修改\$\{item\.name\}的分类/);
  assert.doesNotMatch(page, /改分类/);
  assert.match(page, /editMode \? "完成" : "编辑"/);
  assert.match(page, /className="drag-handle"/);
  assert.match(page, /<Menu aria-hidden="true"/);
  assert.ok(page.indexOf('className="edit-delete-button"') < page.indexOf('className="drag-handle"'));
  assert.doesNotMatch(page, /className="item-edit-panel"/);
  assert.doesNotMatch(page, /不需要，移除|remove-item-button|className="reorder-button"|aria-label={`上移|aria-label={`下移/);
  assert.match(css, /touch-action:none/);
  assert.match(css, /drag-handle/);
  assert.doesNotMatch(css, /item-edit-panel/);
  assert.match(css, /edit-delete-button/);
});

test("item notes stay separate from team chat and keep chronological context", async () => {
  const [page, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(page, /type ItemNote/);
  assert.match(page, /const seedItemNotes/);
  assert.match(page, /const \[itemNotes, setItemNotes\]/);
  assert.match(page, /time: "10:00"/);
  assert.match(page, /unreadItemIds/);
  assert.match(page, /function openItemNotes/);
  assert.match(page, /function addItemNote/);
  assert.match(page, /className="item-note-modal"/);
  assert.match(page, /className="item-note-dialog-stack"/);
  assert.match(page, /className="item-notes-card"/);
  assert.doesNotMatch(page, /className="sheet-card item-notes-card"|item-notes-card[\s\S]{0,80}sheet-handle/);
  assert.match(page, /className="item-note-row"/);
  assert.match(page, /<time>\{note\.time\}<\/time>/);
  assert.match(page, /className="item-copy"/);
  assert.match(page, /className="item-note-trigger"/);
  assert.doesNotMatch(page, /className="item-note-empty"><span>＋<\/span>/);
  assert.match(page, /className={`item-icon item-icon-button/);
  assert.match(page, /onClick=\{\(\) => openItemNotes\(item\.id\)\}/);
  assert.doesNotMatch(page, /function togglePersonal|make-personal-button|各带各的/);
  assert.match(page, /personal \? <span className="personal-pill">每人自备<\/span>/);
  assert.match(page, /className="unread-dot"/);
  assert.match(page, /有新留言/);
  assert.match(page, /"有留言"/);
  assert.match(page, /setShowChat\(true\)/);
  assert.match(page, /<h2>团队聊天<\/h2>/);
  assert.doesNotMatch(page, /activeChatMessages|查看全部消息|function sendItemMessage/);
  assert.match(page, /className="note-delete-action"/);
  assert.match(page, /className=\{`note-bring-action/);
  assert.match(page, /className=\{`note-release-action/);
  assert.match(page, /aria-pressed=\{activeItem\.owners\.includes\(currentMember\)\}/);
  assert.match(page, /<small>我来带<\/small>/);
  assert.match(page, /<small>我不带<\/small>/);
  assert.match(page, /claim\(activeItem\.id\); setActiveItemId\(null\);/);
  assert.match(page, /release\(activeItem\.id\); setActiveItemId\(null\);/);
  assert.match(page, /className="note-close-action"/);
  assert.match(page, /removeItem\(activeItem, true\)/);
  assert.match(css, /unread-dot/);
  assert.match(css, /\.item-note-modal \{[\s\S]*place-items:center/);
  assert.match(css, /item-notes-card/);
  assert.match(css, /\.item-notes-card \{[\s\S]*border-radius:24px;[\s\S]*box-shadow:/);
  assert.match(css, /\.item-notes-card \{[\s\S]*height:570px;[\s\S]*max-height:calc\(100dvh - 190px\)/);
  assert.match(css, /\.item-note-list \{[\s\S]*overflow-y:auto;[\s\S]*scrollbar-width:thin/);
  assert.doesNotMatch(css, /\.item-notes-card::before|\.item-notes-card::after/);
  assert.match(css, /item-note-actions/);
  assert.match(css, /\.item-note-actions button>span \{[\s\S]*border-radius:50%/);
});

test("verification is check-only and lets me return claimed team items", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /phase === "verify" \? <div className="verify-item-name">/);
  assert.match(page, /phase === "verify" && viewedMember === currentMember && !personal && currentWillBring/);
  assert.match(page, /className="verify-release-button" onClick=\{\(\) => release\(item\.id\)\}/);
  assert.match(page, />我不带了<\/button>/);
  assert.doesNotMatch(page, /phase === "verify"[^\n]*openItemNotes/);
});

test("chat assignments require the named traveler to confirm before changing the list", async () => {
  const [page, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(page, /type AssignmentProposal/);
  assert.match(page, /afterMessageId: number/);
  assert.match(page, /afterMessageId: messageId/);
  assert.match(page, /assignmentProposals\.filter\(\(proposal\) => proposal\.afterMessageId === message\.id/);
  assert.match(page, /text: "转换插头你来带吧。"/);
  assert.match(page, /text: "好。"/);
  assert.match(page, /afterMessageId: messageId/);
  assert.doesNotMatch(page, /流量卡要不要提前一起买？[\s\S]*转换插头你来带吧/);
  assert.match(page, /AI 识别到一项分工/);
  assert.match(page, /你愿意带/);
  assert.match(page, /确认后，将同步到你的清单/);
  assert.match(page, /我不带/);
  assert.match(page, /我来带/);
  assert.match(page, /function resolveAssignmentProposal/);
  assert.match(page, /\/api\/trips\/\$\{activeTripId\}\/assignments/);
  assert.match(page, /可以继续聊天/);
  assert.match(page, /assignmentResolutionFeedback/);
  assert.doesNotMatch(page.match(/async function resolveAssignmentProposal[\s\S]*?function renderAssignmentProposal/)?.[0] ?? "", /setShowChat\(false\)/);
  assert.doesNotMatch(page, /AI 只建议，确认后才会修改清单/);
  assert.match(css, /assignment-proposal/);
  assert.match(css, /assignment-resolution/);
  assert.match(css, /proposal-actions/);
});

test("claim actions stay quiet and AI suggestions use two compact fixed cards", async () => {
  const [page, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(page, /会带这件物品|已取消自己的携带状态/);
  assert.match(page, /visibleSuggestions\.slice\(0, 2\)/);
  assert.match(page, /AI 帮你补充了 \$\{visibleSuggestions\.length\} 件容易漏带的物品/);
  assert.match(page, /AI 检查完成，当前清单已覆盖常见遗漏/);
  assert.match(page, /这次不用额外补充，现有清单可以直接继续分工/);
  assert.match(page, /className="suggestion-main"/);
  assert.doesNotMatch(page, /className="signal"|className="category-decision"/);
  assert.match(page, /＋ 加入清单/);
  assert.match(page, /－ 移出清单/);
  assert.match(page, /function toggleSuggestion/);
  assert.match(page, /items\.find\(\(item\) => item\.id === suggestion\.id\)/);
  assert.doesNotMatch(page, /disabled=\{suggestion\.added\}/);
  assert.match(css, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /scroll-snap-type:none/);
  assert.match(css, /suggestion-card>button\s*\{[\s\S]*margin-top:auto/);
  assert.match(css, /suggestion-card > button\.remove-suggestion/);
  assert.match(css, /list-controls \.list-filters \{[\s\S]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(css, /grid-template-columns:43px minmax\(0,1fr\) auto/);
});

test("ships authenticated cloud collaboration with invite codes and server-authoritative state", async () => {
  const [hosting, schema, migration, shared, demoSession, session, trips, join, state, page] = await Promise.all([
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0000_stormy_darkhawk.sql", import.meta.url), "utf8"),
    readFile(new URL("../app/api/_shared/server.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/demo-session/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/session/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/trips/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/trips/join/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/trips/[tripId]/state/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.equal(JSON.parse(hosting).d1, "DB");
  for (const table of ["users", "profiles", "trips", "trip_members", "trip_items", "item_owners", "item_notes", "chat_messages", "assignment_proposals", "trip_snapshots", "trip_events"]) {
    assert.match(migration, new RegExp("CREATE TABLE `" + table + "`"));
  }
  assert.match(schema, /export const users/);
  assert.match(schema, /export const tripMembers/);
  assert.match(shared, /oai-authenticated-user-id/);
  assert.match(shared, /daiqi_demo_identity/);
  assert.match(shared, /:demo:\$\{identity\}/);
  assert.match(demoSession, /HttpOnly/);
  assert.match(demoSession, /SameSite=Lax/);
  assert.match(shared, /actorSlot && previous && slot !== actorSlot/);
  assert.match(shared, /owner !== actorSlot/);
  assert.match(shared, /existing\?\.author \?\? actorSlot/);
  assert.match(session, /ensureUser/);
  assert.match(trips, /createInviteCode/);
  assert.match(join, /最多 4 人/);
  assert.match(state, /expectedVersion/);
  assert.match(state, /status: 409/);
  assert.match(state, /你不是该队伍成员/);
  assert.match(page, /\/api\/trips\/join/);
  assert.match(page, /setInterval\(\(\) => void poll\(\), 2500\)/);
  assert.match(page, /function hasPendingCloudChanges/);
  assert.match(page, /rebasePendingMemberState\(result\.state, latestPending, currentMemberRef\.current\)/);
  assert.match(page, /邀请码已复制/);
});

test("rapid consecutive claims are not overwritten by stale polling responses", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const pollBlock = page.slice(page.indexOf("const poll = async"), page.indexOf("const timer = window.setInterval", page.indexOf("const poll = async")));
  assert.match(pollBlock, /syncInFlightRef\.current \|\| chatSyncInFlightRef\.current \|\| syncTimerRef\.current !== null \|\| hasPendingCloudChanges\(\)/);
  assert.ok(pollBlock.match(/hasPendingCloudChanges\(\)/g)?.length >= 2, "poll checks for local changes both before and after the request");
  assert.match(page, /incomingVersion < tripVersionRef\.current/);
  assert.match(page, /pendingSharedStateRef\.current = rebasedState/);
  assert.match(page, /owners:?,?[\s\S]*remoteItem\.owners\.filter\(\(owner\) => owner !== member\)/);
});

test("claims use a lightweight item endpoint and identity switching waits for its queue", async () => {
  const [page, claimRoute] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/trips/[tripId]/claims/route.ts", import.meta.url), "utf8"),
  ]);
  const claimBlock = page.slice(page.indexOf("function claim"), page.indexOf("function togglePacked"));
  const switchBlock = page.slice(page.indexOf("async function switchDemoMember"), page.indexOf("async function exitDemoMemberMode"));
  assert.match(claimBlock, /itemsRef\.current = nextItems/);
  assert.ok(claimBlock.match(/enqueueClaimMutation\(id, "(claim|release)"\)/g)?.length === 2);
  assert.match(claimBlock, /\/api\/trips\/\$\{tripId\}\/claims/);
  assert.match(switchBlock, /await claimMutationQueueRef\.current/);
  assert.match(switchBlock, /if \(hasPendingCloudChanges\(\)\) await flushCloudStateRef\.current\(\)/);
  assert.match(claimRoute, /UPDATE trips SET version = version \+ 1/);
  assert.match(claimRoute, /ON CONFLICT\(item_id, member_slot\)/);
  assert.match(claimRoute, /DELETE FROM item_owners WHERE item_id/);
  assert.match(claimRoute, /UPDATE trip_snapshots SET state_json/);
});

test("AI APIs use a server-only DeepSeek key and return structured recommendation and assignment data", async () => {
  const [envExample, suggestions, intent, fallback, page] = await Promise.all([
    readFile(new URL("../.env.example", import.meta.url), "utf8"),
    readFile(new URL("../app/api/suggestions/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/trips/[tripId]/intent/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/chat-intent.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(envExample, /^DEEPSEEK_API_KEY=/m);
  assert.doesNotMatch(envExample, /sk-[a-z0-9]/i);
  assert.match(suggestions, /process\.env\.DEEPSEEK_API_KEY/);
  assert.match(suggestions, /chooseUnseenSuggestions/);
  assert.match(suggestions, /validateRankedItems/);
  assert.match(suggestions, /slice\(0, 2\)/);
  assert.match(intent, /itemName/);
  assert.match(intent, /assignee/);
  assert.match(intent, /intent/);
  assert.match(intent, /confidence/);
  assert.match(intent, /一次涉及多个物品分别输出/);
  assert.match(fallback, /AGREEMENT/);
  assert.match(fallback, /RELEASE/);
  assert.match(fallback, /requestItems\.map/);
  assert.match(page, /\/intent`/);
  assert.match(page, /assignmentProposals/);
  assert.match(page, /proposals\.length/);
});

test("chat fallback recognizes multi-item consent, release, and rejects ambiguous talk", async () => {
  const { detectAssignmentFallback, validateAssignmentIntents } = await import("../lib/chat-intent.ts");
  const items = [{ id: 1, name: "充电器" }, { id: 2, name: "相机" }];
  const members = ["我", "阿哲", "小雨"];

  const accepted = detectAssignmentFallback([
    { id: 1, author: "阿哲", text: "充电器和相机你来带吧" },
    { id: 2, author: "我", text: "好" },
  ], items, members);
  assert.equal(accepted.length, 2);
  assert.deepEqual(accepted.map((entry) => entry.itemName), ["充电器", "相机"]);
  assert.ok(accepted.every((entry) => entry.assignee === "我" && entry.intent === "claim"));

  const released = detectAssignmentFallback([
    { id: 3, author: "我", text: "相机我不带了" },
  ], items, members);
  assert.equal(released.length, 1);
  assert.equal(released[0].intent, "release");

  assert.deepEqual(detectAssignmentFallback([
    { id: 4, author: "小雨", text: "谁带相机？" },
  ], items, members), []);

  const validated = validateAssignmentIntents({ assignments: [
    { itemName: "相机", requester: "阿哲", assignee: "我", intent: "claim", confidence: 0.9, evidenceMessageIds: [1, 2] },
    { itemName: "相机", requester: "阿哲", assignee: "陌生人", intent: "claim", confidence: 0.9, evidenceMessageIds: [1, 2] },
    { itemName: "相机", requester: "阿哲", assignee: "我", intent: "claim", confidence: 0.2, evidenceMessageIds: [1, 2] },
  ] }, items, members);
  assert.equal(validated.length, 1);
});
