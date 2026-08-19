import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
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
