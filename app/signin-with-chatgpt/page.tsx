import Image from "next/image";
import Link from "next/link";

// Sites 的托管层会接管这个路径并发起 ChatGPT 登录。
// 本地开发时没有托管层，因此提供一个明确的回退页，避免用户看到 404。
export const dynamic = "force-dynamic";

type SignInPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SignInWithChatGPTPage({ searchParams }: SignInPageProps) {
  const params = searchParams ? await searchParams : {};
  const returnTo = first(params.return_to);
  const safeReturnTo = returnTo?.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/";

  return (
    <main className="app-shell setup-shell auth-fallback-shell">
      <section className="phone-frame setup-frame auth-fallback-frame" aria-label="登录带齐">
        <header className="topbar setup-topbar">
          <Image className="brand-mark" src="/app-icon-192.png?v=2" alt="" width={32} height={32} priority />
          <div className="brand-name">带齐</div>
        </header>
        <div className="auth-fallback-content">
          <div className="auth-fallback-mark" aria-hidden="true">↗</div>
          <h1>登录带齐</h1>
          <p>登录后才能创建队伍、保存清单，并和朋友同步行李分工。</p>
          <div className="auth-fallback-card">
            <b>请从已部署的带齐站点登录</b>
            <span>ChatGPT 登录由托管平台提供。本地预览环境没有登录网关，所以不会在这里重复发起登录。</span>
          </div>
          <a className="auth-fallback-login" href="https://daiqi-packlist.xuchenyu020412.chatgpt.site/signin-with-chatgpt?return_to=%2F">前往线上登录 <span>→</span></a>
          <Link className="auth-fallback-home" href={safeReturnTo}>返回带齐</Link>
        </div>
      </section>
    </main>
  );
}
