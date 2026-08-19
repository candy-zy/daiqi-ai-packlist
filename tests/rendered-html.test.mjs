import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function requestSite(path = "/", init) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, init ?? { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

async function render() {
  return requestSite();
}

test("server-renders a focused destination-first onboarding experience", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>带齐｜朋友一起收拾行李<\/title>/);
  assert.match(html, /和朋友一起/);
  assert.match(html, /这次去哪儿/);
  assert.match(html, /生成清单/);
  assert.match(html, /character-avatar avatar-me/);
  assert.doesNotMatch(html, /Your site is taking shape|codex-preview/);
});

test("onboarding removes repeated team fields and derives the team name", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /setTeamName\(`\$\{place\}逛拍小队`\)/);
  assert.doesNotMatch(page, /队伍名称|队伍成员|先把朋友聚到一起|创建队伍并生成清单/);
  assert.doesNotMatch(page, /<i>＋<\/i>/);
  assert.match(page, /这次去哪儿/);
});

test("ships hand-drawn characters and consistent line item icons", async () => {
  const [page, css, layout] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(page, /from "lucide-react"/);
  assert.match(page, /function ItemGraphic/);
  assert.match(page, /const itemIcons: Record<string, LucideIcon>/);
  assert.match(page, /const Icon = itemIcons\[item\.name\] \?\? Package/);
  assert.doesNotMatch(page, /className="item-sticker-emoji"/);
  assert.match(page, /function CharacterAvatar/);
  assert.match(css, /team-characters\.png/);
  assert.match(css, /Apple Color Emoji/);
  assert.doesNotMatch(css, /item-sticker-emoji/);
  assert.match(css, /item-icon svg/);
  assert.match(css, /Hand-drawn travel journal theme/);
  assert.match(layout, /title: "带齐｜朋友一起收拾行李"/);
  await access(new URL("../public/team-characters.png", import.meta.url));
});

test("category headers stay concise without explanatory subtitles", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(page, /category\.note/);
  assert.doesNotMatch(page, /充电、存储与拍摄设备|证件、票务、订单与支付|常用药物与健康防护/);
  assert.match(page, /<h2>{category\.name}<\/h2>/);
});

test("AI suggestions use two Seoul-specific fallbacks and a server-only model route", async () => {
  const [page, route] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/suggestions/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /T-money 交通卡/);
  assert.match(page, /流量卡/);
  assert.doesNotMatch(page, /韩系拍照发夹|折叠购物袋/);
  assert.match(page, /fetch\("\/api\/suggestions"/);
  assert.match(route, /process\.env\.OPENAI_API_KEY/);
  assert.match(route, /https:\/\/api\.openai\.com\/v1\/responses/);
  assert.match(route, /只给2个/);
  assert.match(route, /existingItems/);
});

test("AI suggestions endpoint returns exactly two unseen Seoul items without a key", async () => {
  const response = await requestSite("/api/suggestions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ destination: "韩国 · 首尔", existingItems: ["身份证", "相机", "充电宝"] }),
  });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.source, "fallback");
  assert.deepEqual(result.suggestions.map((item) => item.name), ["T-money 交通卡", "流量卡"]);
});

test("onboarding avatars stay consistent and verification keeps one compact progress row", async () => {
  const [page, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(page, /function selectAllPacked/);
  assert.match(page, /"全选"/);
  assert.match(page, /viewedMember !== "我"/);
  assert.match(page, /提醒TA/);
  assert.match(page, /className="verify-toolbar"/);
  assert.match(page, /我的物品/);
  assert.match(page, /下一件未确认/);
  assert.doesNotMatch(page, /className="verify-banner"/);
  assert.match(css, /setup-illustration>\.avatar-me\{background-position:left center!important\}/);
  assert.match(css, /select-all-button/);
});

test("preparation defaults to a calm pending view and keeps the full list collapsible", async () => {
  const [page, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(page, /className="team-chat-entry"/);
  assert.match(page, /AI 帮你同步分工/);
  assert.match(page, /className="list-toolbar"/);
  assert.match(page, /useState<ListFilter>\("pending"\)/);
  assert.match(page, />待处理 /);
  assert.match(page, /expandedCategories/);
  assert.match(page, /className="section-head section-toggle"/);
  assert.match(page, /personalExpanded/);
  assert.doesNotMatch(page, /const assignmentProgress|assignment-overview|只看待分配|团队物品在前，个人物品在底部|点击讨论|>待分配/);
  assert.match(page, /phase === "verify" \? <button/);
  assert.match(page, /author: "我"/);
  assert.doesNotMatch(page, /setCurrentMember|prototype-note|context-tags/);
  assert.match(css, /team-chat-entry/);
  assert.match(css, /list-toolbar/);
  assert.match(css, /section-toggle/);
});

test("completed checklist opens a dedicated illustrated departure page", async () => {
  const [page, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(page, /"prepare" \| "verify" \| "departed"/);
  assert.match(page, /setPhase\("departed"\)/);
  assert.match(page, /东西带齐了/);
  assert.match(css, /departure-girl\.png/);
  assert.match(css, /departure-page/);
  assert.match(css, /departure-illustration[^}]*overflow:hidden/);
  assert.doesNotMatch(page, /departure-route/);
  await access(new URL("../public/departure-girl.png", import.meta.url));
});

test("preset items are managed through a dedicated preparation edit mode", async () => {
  const [page, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(page, /const \[editMode, setEditMode\]/);
  assert.match(page, /function removeItem/);
  assert.match(page, /current\.filter\(\(entry\) => entry\.id !== item\.id\)/);
  assert.match(page, /function swapItems/);
  assert.match(page, /function startDragging/);
  assert.match(page, /function dragItem/);
  assert.match(page, /function changeItemCategory/);
  assert.match(page, /✎ 编辑/);
  assert.match(page, /className="drag-handle"/);
  assert.match(page, /<Menu aria-hidden="true"/);
  assert.match(page, /className="item-edit-panel"/);
  assert.doesNotMatch(page, /不需要，移除|remove-item-button|className="reorder-button"|aria-label={`上移|aria-label={`下移/);
  assert.match(css, /touch-action:none/);
  assert.match(css, /drag-handle/);
  assert.match(css, /item-edit-panel/);
  assert.match(css, /edit-delete-button/);
});

test("item discussions reuse team chat and unread replies show a red dot", async () => {
  const [page, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(page, /itemId\?: number/);
  assert.doesNotMatch(page, /seedItemMessages|setItemMessages/);
  assert.match(page, /unreadItemIds/);
  assert.match(page, /function openItemChat/);
  assert.match(page, /function sendItemMessage/);
  assert.match(page, /className="item-copy item-chat-trigger"/);
  assert.match(page, /className="unread-dot"/);
  assert.match(page, /有新消息/);
  assert.match(page, /setShowChat\(true\)/);
  assert.match(page, /activeChatMessages/);
  assert.match(page, /查看全部消息/);
  assert.doesNotMatch(page, /item-chat-card/);
  assert.match(css, /unread-dot/);
  assert.match(css, /chat-filter-clear/);
});

test("chat assignments require the named traveler to confirm before changing the list", async () => {
  const [page, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(page, /type AssignmentProposal/);
  assert.match(page, /AI 识别到一项分工/);
  assert.match(page, /你刚刚回复了“好”/);
  assert.match(page, /我不带/);
  assert.match(page, /我来带/);
  assert.match(page, /function resolveAssignmentProposal/);
  assert.match(page, /AI 只建议，确认后才会修改清单/);
  assert.match(css, /assignment-proposal/);
  assert.match(css, /proposal-actions/);
});

test("claim actions stay quiet and AI suggestions use two compact fixed cards", async () => {
  const [page, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(page, /会带这件物品|已取消自己的携带状态/);
  assert.match(page, /suggestions\.slice\(0, 2\)/);
  assert.match(page, /AI 帮你补充了 2 件容易漏带的物品/);
  assert.match(page, /className="suggestion-main"/);
  assert.doesNotMatch(page, /className="signal"|className="category-decision"/);
  assert.match(page, /＋ 加入清单/);
  assert.match(css, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /scroll-snap-type:none/);
});
