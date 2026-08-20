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

test("ships as an installable mobile PWA with local trip continuity", async () => {
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
  assert.match(page, /beforeinstallprompt/);
  assert.match(page, /navigator\.serviceWorker\.register\("\/sw\.js"\)/);
  assert.match(page, /localStorage\.setItem\(localStateKey/);
  assert.match(page, /添加到主屏幕/);
  assert.match(serviceWorker, /CACHE_NAME = "daiqi-app-v1"/);
  assert.match(serviceWorker, /request\.mode === "navigate"/);
  await Promise.all([
    access(new URL("../public/app-icon-192.png", import.meta.url)),
    access(new URL("../public/app-icon-512.png", import.meta.url)),
    access(new URL("../public/apple-touch-icon.png", import.meta.url)),
  ]);
});

test("onboarding and the main header avoid repeated trip metadata", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(page, /队伍名称|队伍成员|先把朋友聚到一起|创建队伍并生成清单/);
  assert.doesNotMatch(page, /teamName|destinationLabel|className="trip-chip"/);
  assert.doesNotMatch(page, /<i>＋<\/i>/);
  assert.match(page, /这次去哪儿/);
  assert.match(page, /className="trip-hero compact-trip-hero"/);
  assert.match(page, /"这次带什么？"/);
  assert.match(page, /className="presence-panel"/);
  assert.doesNotMatch(page, /点头像查看队友/);
  assert.equal(page.match(/className="topbar/g)?.length, 1, "only onboarding keeps a brand header");
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
  const [typography, css, layout] = await Promise.all([
    readFile(new URL("../app/typography.css", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
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
  assert.doesNotMatch(`${typography}\n${css}`, /font-size\s*:\s*[0-9.]+px/);
  assert.doesNotMatch(`${typography}\n${css}`, /font-weight\s*:\s*(?:[1-9][0-9]{2})/);
});

test("category headers stay concise without explanatory subtitles", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(page, /category\.note/);
  assert.doesNotMatch(page, /CategoryGraphic|categoryIcons/);
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

test("personal center uses preferences and gear only to preset unassigned items", async () => {
  const [page, css, route, prd] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/api/suggestions/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../docs/PERSONAL_CENTER_PRD.md", import.meta.url), "utf8"),
  ]);

  assert.match(page, /我的出行偏好/);
  assert.match(page, /我会怎么出行/);
  assert.match(page, /我有这些设备/);
  assert.match(page, /喜欢拍照/);
  assert.match(page, /有相机/);
  assert.match(page, /系统会把相关物品预设进清单，但不会替你认领/);
  assert.doesNotMatch(page, /有转换插头/);
  assert.match(page, /function isInternationalDestination/);
  assert.match(page, /function applyPresetItems/);
  assert.match(page, /境外目的地预设/);
  const seedBlock = page.slice(page.indexOf("const seedItems"), page.indexOf("const seedSuggestions"));
  assert.doesNotMatch(seedBlock, /name: "转换插头"/);
  const gearBlock = page.slice(page.indexOf("const gearOptions"), page.indexOf("const defaultProfile"));
  assert.doesNotMatch(gearBlock, /adapter|转换插头/);
  assert.match(page, /preferences:/);
  assert.match(css, /\.profile-modal/);
  assert.match(css, /\.preference-grid>button\.selected/);
  assert.match(route, /body\.preferences/);
  assert.match(route, /我的出行偏好/);
  assert.match(prd, /拥有不等于携带/);
  assert.match(prd, /GET \| `\/api\/me\/profile`/);
  assert.match(prd, /设备拥有不会自动生成已认领状态/);
  assert.match(prd, /设备库只影响预设物品/);
  assert.match(prd, /仅境外目的地预设/);
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

test("owner avatars and the also-bring control share one aligned circle row", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /\.shared-owner-action \{ align-items:flex-start; justify-content:flex-end; \}/);
  assert.match(css, /\.also-bring-button>span \{ width:34px; height:34px; \}/);
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
  assert.match(page, /const myItems = \[[\s\S]*!isPersonalItem\(item\) && item\.owners\.includes\("我"\)[\s\S]*items\.filter\(isPersonalItem\)/);
  assert.match(page, /const unassignedItems = items\.filter/);
  assert.match(page, /expandedCategories/);
  assert.match(page, /className="section-head section-toggle"/);
  assert.match(page, /personalExpanded/);
  assert.doesNotMatch(page, /const assignmentProgress|assignment-overview|只看待分配|团队物品在前，个人物品在底部|点击讨论/);
  assert.match(page, /phase === "verify" \? <button/);
  assert.match(page, /author: "我"/);
  assert.doesNotMatch(page, /setCurrentMember|prototype-note|context-tags/);
  assert.match(css, /team-chat-action/);
  assert.match(css, /list-controls/);
  assert.match(css, /\.list-controls \{[\s\S]*position:sticky;[\s\S]*top:0;[\s\S]*z-index:8/);
  assert.match(css, /\.list-controls \{[\s\S]*background:var\(--paper\);[\s\S]*border-bottom:2px solid var\(--ink\)/);
  assert.doesNotMatch(css, /\.list-controls \{[\s\S]*backdrop-filter/);
  assert.match(css, /section-toggle/);
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
  assert.match(page, /aria-pressed=\{activeItem\.owners\.includes\("我"\)\}/);
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
  assert.match(page, /phase === "verify" && viewedMember === "我" && !personal && currentWillBring/);
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
  assert.match(page, /assignmentProposal\?\.afterMessageId === message\.id/);
  assert.match(page, /AI 识别到一项分工/);
  assert.match(page, /你刚刚回复了“好”/);
  assert.match(page, /我不带/);
  assert.match(page, /我来带/);
  assert.match(page, /function resolveAssignmentProposal/);
  assert.doesNotMatch(page, /AI 只建议，确认后才会修改清单/);
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
  assert.match(css, /suggestion-card>button\s*\{[\s\S]*margin-top:auto/);
  assert.match(css, /list-controls \.list-filters \{[\s\S]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(css, /grid-template-columns:43px minmax\(0,1fr\) auto/);
});
