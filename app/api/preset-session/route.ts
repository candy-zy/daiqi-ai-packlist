import { authenticatePresetAccount, presetAccountCookieName } from "../_shared/server";

function expiredCookie(request: Request) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${presetAccountCookieName()}=; Path=/; HttpOnly${secure}; SameSite=Lax; Max-Age=0`;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { account?: unknown; password?: unknown } | null;
  const account = typeof body?.account === "string" ? body.account.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const user = authenticatePresetAccount(account, password);
  if (!user) return Response.json({ error: "账号或密码不正确" }, { status: 401 });

  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  const cookie = `${presetAccountCookieName()}=${encodeURIComponent(account)}; Path=/; HttpOnly${secure}; SameSite=Lax; Max-Age=604800`;
  return Response.json({ ok: true, user }, { headers: { "set-cookie": cookie } });
}

export async function GET(request: Request) {
  const response = Response.redirect(new URL("/login", request.url), 303);
  response.headers.set("set-cookie", expiredCookie(request));
  return response;
}

export async function DELETE(request: Request) {
  return Response.json({ ok: true }, { headers: { "set-cookie": expiredCookie(request) } });
}
