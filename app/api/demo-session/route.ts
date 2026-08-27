import { demoIdentityCookieName, getBaseRequestUser, jsonError, unauthorized } from "../_shared/server";

const allowed = new Set(["我", "阿哲", "小雨"]);

export async function POST(request: Request) {
  const baseUser = getBaseRequestUser(request);
  if (!baseUser) return unauthorized();
  const body = await request.json().catch(() => null) as { identity?: unknown } | null;
  const identity = typeof body?.identity === "string" ? body.identity : "";
  if (!allowed.has(identity)) return jsonError("演示身份不存在");

  const cookieName = demoIdentityCookieName();
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  const cookie = identity === "我"
    ? `${cookieName}=; Path=/; HttpOnly${secure}; SameSite=Lax; Max-Age=0`
    : `${cookieName}=${encodeURIComponent(identity)}; Path=/; HttpOnly${secure}; SameSite=Lax; Max-Age=86400`;
  return Response.json({ ok: true, identity }, { headers: { "set-cookie": cookie } });
}
