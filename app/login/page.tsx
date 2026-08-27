"use client";

import Image from "next/image";
import { useState } from "react";

const accounts = [
  { id: "xiaolin", name: "小林", description: "队伍创建者" },
  { id: "azhe", name: "阿哲", description: "同行朋友 1" },
  { id: "xiaoyu", name: "小雨", description: "同行朋友 2" },
] as const;

export default function LoginPage() {
  const [account, setAccount] = useState<(typeof accounts)[number]["id"]>("xiaolin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/preset-session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ account, password }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error || "登录失败");
      const returnTo = new URLSearchParams(window.location.search).get("return_to");
      window.location.href = returnTo?.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/";
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "登录失败");
    } finally {
      setSubmitting(false);
    }
  }

  return <main className="app-shell setup-shell preset-login-shell">
    <section className="phone-frame setup-frame preset-login-frame" aria-label="登录带齐">
      <header className="topbar setup-topbar">
        <Image className="brand-mark" src="/app-icon-192.png?v=2" alt="" width={32} height={32} priority />
        <div className="brand-name">带齐</div>
      </header>
      <div className="preset-login-content">
        <div><small>内测账号</small><h1>和朋友一起，<br />把行李带齐。</h1><p>选择一个身份登录，即可在不同窗口同时演示多人协作。</p></div>
        <form onSubmit={submit}>
          <fieldset><legend>选择账号</legend><div className="preset-account-grid">
            {accounts.map((item) => <button key={item.id} type="button" className={account === item.id ? "active" : ""} onClick={() => setAccount(item.id)} aria-pressed={account === item.id}>
              <span>{item.name.slice(0, 1)}</span><b>{item.name}</b><small>{item.description}</small>
            </button>)}
          </div></fieldset>
          <label className="preset-password-field"><span>密码</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="输入内测密码" autoComplete="current-password" /></label>
          <p className="preset-password-hint">三个账号的内测密码均为：<b>daiqi2026</b></p>
          {error && <p className="preset-login-error" role="alert">{error}</p>}
          <button className="preset-login-submit" disabled={submitting}>{submitting ? "正在登录…" : `以${accounts.find((item) => item.id === account)?.name}身份登录`} <span>→</span></button>
        </form>
      </div>
    </section>
  </main>;
}
