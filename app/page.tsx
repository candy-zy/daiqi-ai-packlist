"use client";

import { useMemo, useState } from "react";

type Owner = "我" | "阿哲" | "小雨" | "待认领";
type Filter = "全部" | "我负责" | "待认领";

type PackItem = {
  id: number;
  name: string;
  category: "重要物品" | "共用物品" | "个人物品";
  owner: Owner;
  shared?: boolean;
  packed: boolean;
  detail?: string;
  ai?: boolean;
};

const seedItems: PackItem[] = [
  { id: 1, name: "身份证", category: "重要物品", owner: "我", packed: true, detail: "每人都要带" },
  { id: 2, name: "充电宝", category: "重要物品", owner: "阿哲", packed: false, shared: true, detail: "已确认可供 3 人使用" },
  { id: 3, name: "车钥匙", category: "重要物品", owner: "小雨", packed: false, detail: "放进随身包" },
  { id: 4, name: "防晒霜", category: "共用物品", owner: "我", packed: true, shared: true },
  { id: 5, name: "一次性雨衣 ×3", category: "共用物品", owner: "待认领", packed: false, shared: true, ai: true, detail: "AI 根据天气补充" },
  { id: 6, name: "纸巾 / 湿巾", category: "共用物品", owner: "阿哲", packed: true, shared: true },
  { id: 7, name: "桌游卡牌", category: "共用物品", owner: "小雨", packed: true, shared: true },
  { id: 8, name: "相机", category: "个人物品", owner: "我", packed: false },
  { id: 9, name: "相机备用电池", category: "个人物品", owner: "我", packed: false, ai: true, detail: "AI 发现带了相机但缺少备用电池" },
  { id: 10, name: "拖鞋", category: "个人物品", owner: "阿哲", packed: true },
  { id: 11, name: "换洗衣物", category: "个人物品", owner: "小雨", packed: true },
  { id: 12, name: "洗漱包", category: "个人物品", owner: "我", packed: true },
];

const ownerColors: Record<Owner, string> = {
  我: "owner-me",
  阿哲: "owner-zhe",
  小雨: "owner-yu",
  待认领: "owner-none",
};

export default function Home() {
  const [items, setItems] = useState(seedItems);
  const [filter, setFilter] = useState<Filter>("全部");
  const [view, setView] = useState<"list" | "ai" | "me">("list");
  const [showAdd, setShowAdd] = useState(false);
  const [newItem, setNewItem] = useState("");
  const [toast, setToast] = useState("");

  const packed = items.filter((item) => item.packed).length;
  const remaining = items.length - packed;
  const progress = Math.round((packed / items.length) * 100);

  const visibleItems = useMemo(() => {
    if (filter === "我负责") return items.filter((item) => item.owner === "我");
    if (filter === "待认领") return items.filter((item) => item.owner === "待认领");
    return items;
  }, [items, filter]);

  function togglePacked(id: number) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, packed: !item.packed } : item));
  }

  function claimItem(id: number) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, owner: "我" } : item));
    setToast("已由你负责，记得装包");
    window.setTimeout(() => setToast(""), 1800);
  }

  function addItem() {
    const name = newItem.trim();
    if (!name) return;
    setItems((current) => [...current, {
      id: Date.now(),
      name,
      category: "个人物品",
      owner: "我",
      packed: false,
    }]);
    setNewItem("");
    setShowAdd(false);
    setToast("已加入清单");
    window.setTimeout(() => setToast(""), 1800);
  }

  const categories: PackItem["category"][] = ["重要物品", "共用物品", "个人物品"];

  return (
    <main className="app-shell">
      <section className="phone-frame" aria-label="带齐旅行物品清单原型">
        <header className="topbar">
          <div className="brand-mark" aria-hidden="true"><span></span><span></span><span></span></div>
          <div className="brand-name">带齐</div>
          <button className="icon-button" aria-label="更多选项">•••</button>
        </header>

        <div className="scroll-area">
          {view === "list" && (
            <>
              <section className="trip-head">
                <div className="trip-copy">
                  <p className="eyebrow">3 人同行 · 周五 19:30 出发</p>
                  <h1>海边周末，东西带齐了吗？</h1>
                </div>
                <div className="member-stack" aria-label="同行成员">
                  <span className="avatar avatar-me">我</span>
                  <span className="avatar avatar-zhe">哲</span>
                  <span className="avatar avatar-yu">雨</span>
                  <button className="avatar avatar-add" aria-label="邀请朋友">＋</button>
                </div>
              </section>

              <section className="status-card">
                <div className="status-top">
                  <div>
                    <span className="status-number">{remaining}</span>
                    <span className="status-unit">件还没装包</span>
                  </div>
                  <span className="status-percent">{progress}%</span>
                </div>
                <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
                <p>{packed} 件已确认 · {items.filter((item) => item.owner === "待认领").length} 件还没人负责</p>
              </section>

              <button className="ai-nudge" onClick={() => setView("ai")}>
                <span className="spark">✦</span>
                <span><b>AI 又发现 2 个可能遗漏</b><small>雨衣和相机备用电池，去确认一下</small></span>
                <span className="arrow">›</span>
              </button>

              <div className="filters" role="tablist" aria-label="筛选清单">
                {(["全部", "我负责", "待认领"] as Filter[]).map((name) => (
                  <button key={name} role="tab" aria-selected={filter === name} className={filter === name ? "active" : ""} onClick={() => setFilter(name)}>
                    {name}{name === "待认领" ? ` ${items.filter((item) => item.owner === "待认领").length}` : ""}
                  </button>
                ))}
              </div>

              <div className="list-area">
                {categories.map((category) => {
                  const grouped = visibleItems.filter((item) => item.category === category);
                  if (!grouped.length) return null;
                  return (
                    <section className="category" key={category}>
                      <div className="category-title">
                        <h2>{category}</h2>
                        <span>{grouped.filter((item) => item.packed).length}/{grouped.length}</span>
                      </div>
                      <div className="item-group">
                        {grouped.map((item) => (
                          <article className={`pack-item ${item.packed ? "is-packed" : ""}`} key={item.id}>
                            <button className="check" aria-label={`${item.packed ? "取消" : "标记"}${item.name}已装包`} onClick={() => togglePacked(item.id)}>
                              {item.packed ? "✓" : ""}
                            </button>
                            <button className="item-main" onClick={() => togglePacked(item.id)}>
                              <span className="item-name">{item.name}{item.shared && <em>共用</em>}</span>
                              {item.detail && <small>{item.ai && <b>✦ </b>}{item.detail}</small>}
                            </button>
                            {item.owner === "待认领" ? (
                              <button className="claim" onClick={() => claimItem(item.id)}>我来带</button>
                            ) : (
                              <span className={`owner ${ownerColors[item.owner]}`}>{item.owner}</span>
                            )}
                          </article>
                        ))}
                      </div>
                    </section>
                  );
                })}
                {!visibleItems.length && <div className="empty-state">这里已经清空啦 ✓</div>}
              </div>
            </>
          )}

          {view === "ai" && (
            <section className="panel-view ai-view">
              <button className="back-link" onClick={() => setView("list")}>‹ 返回清单</button>
              <div className="ai-orb">✦</div>
              <p className="eyebrow">AI 出发前检查</p>
              <h1>我帮你们查了两处遗漏</h1>
              <p className="lead">我只根据已有物品和出发条件补漏，不推荐景点，也不改变你们的行程。</p>
              <div className="insight-card">
                <span className="insight-icon rain">☂</span>
                <div><b>一次性雨衣 ×3</b><p>周末可能下雨，清单里还没有雨具。</p></div>
                <button onClick={() => { setView("list"); setFilter("待认领"); }}>去认领</button>
              </div>
              <div className="insight-card">
                <span className="insight-icon battery">▣</span>
                <div><b>相机备用电池</b><p>你带了相机，连续拍摄可能需要备用电池。</p></div>
                <button onClick={() => { setView("list"); setFilter("我负责"); }}>去确认</button>
              </div>
              <div className="ai-safe"><span>✓</span><p><b>证件没有遗漏</b><br />3 位成员都已经确认身份证</p></div>
            </section>
          )}

          {view === "me" && (
            <section className="panel-view me-view">
              <div className="profile-avatar">我</div>
              <p className="eyebrow">我的背包</p>
              <h1>你还差 {items.filter((i) => i.owner === "我" && !i.packed).length} 件</h1>
              <p className="lead">只看你负责的物品，装进包里就勾掉。</p>
              <button className="primary-action" onClick={() => { setView("list"); setFilter("我负责"); }}>检查我的物品</button>
              <div className="people-card">
                <h2>大家的进度</h2>
                {(["我", "阿哲", "小雨"] as Owner[]).map((owner) => {
                  const mine = items.filter((i) => i.owner === owner);
                  const done = mine.filter((i) => i.packed).length;
                  return <div className="person-row" key={owner}><span className={`owner ${ownerColors[owner]}`}>{owner}</span><b>{done}/{mine.length} 已装包</b><div className="mini-track"><span style={{ width: `${mine.length ? done / mine.length * 100 : 0}%` }} /></div></div>;
                })}
              </div>
            </section>
          )}
        </div>

        {showAdd && (
          <div className="add-sheet" role="dialog" aria-modal="true" aria-label="添加物品">
            <button className="sheet-backdrop" aria-label="关闭" onClick={() => setShowAdd(false)} />
            <div className="sheet-card">
              <span className="sheet-handle" />
              <h2>加一件要带的东西</h2>
              <p>默认由你负责，可以稍后改成共用。</p>
              <input autoFocus value={newItem} onChange={(event) => setNewItem(event.target.value)} onKeyDown={(event) => event.key === "Enter" && addItem()} placeholder="例如：扑克牌" aria-label="物品名称" />
              <button className="primary-action" onClick={addItem}>加入清单</button>
            </div>
          </div>
        )}

        {toast && <div className="toast" role="status">✓ {toast}</div>}

        <nav className="bottom-nav" aria-label="主要导航">
          <button className={view === "list" ? "selected" : ""} onClick={() => setView("list")}><span>☷</span>清单</button>
          <button className={view === "ai" ? "selected" : ""} onClick={() => setView("ai")}><span>✦</span>AI 补漏</button>
          <button className="add-button" aria-label="添加物品" onClick={() => setShowAdd(true)}>＋</button>
          <button className={view === "me" ? "selected" : ""} onClick={() => setView("me")}><span>●</span>我的</button>
        </nav>
      </section>

      <aside className="prototype-note">
        <p className="eyebrow">PRODUCT PROTOTYPE</p>
        <h2>一起收拾，<br />真的不落东西。</h2>
        <p>为 2–4 位朋友设计的协作装包清单。AI 藏在清单背后，只在容易遗漏时提醒你。</p>
        <div className="demo-hint"><span>01</span><p><b>点圆圈</b><br />确认已经装包</p></div>
        <div className="demo-hint"><span>02</span><p><b>点“我来带”</b><br />认领共用物品</p></div>
        <div className="demo-hint"><span>03</span><p><b>试试 AI 补漏</b><br />看出发前检查</p></div>
      </aside>
    </main>
  );
}
