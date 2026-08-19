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

test("server-renders the 带齐 onboarding experience", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>带齐｜朋友一起收拾行李<\/title>/);
  assert.match(html, /一起准备/);
  assert.match(html, /创建队伍并生成清单/);
  assert.match(html, /character-avatar avatar-me/);
  assert.doesNotMatch(html, /Your site is taking shape|codex-preview/);
});

test("ships hand-drawn characters and graphical item icons", async () => {
  const [page, css, layout] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(page, /from "lucide-react"/);
  assert.match(page, /function ItemGraphic/);
  assert.match(page, /function CharacterAvatar/);
  assert.match(css, /team-characters\.png/);
  assert.match(css, /Hand-drawn travel journal theme/);
  assert.match(layout, /title: "带齐｜朋友一起收拾行李"/);
  await access(new URL("../public/team-characters.png", import.meta.url));
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

test("onboarding avatars stay consistent and verification supports select all", async () => {
  const [page, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(page, /function selectAllPacked/);
  assert.match(page, /一键全选/);
  assert.match(page, /currentMember !== "我"/);
  assert.match(css, /setup-illustration>\.avatar-me\{background-position:left center!important\}/);
  assert.match(css, /select-all-button/);
});
