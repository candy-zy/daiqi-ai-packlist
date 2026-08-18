"use client";

import { useMemo, useState } from "react";

type Member = "我" | "阿哲" | "小雨";
type Phase = "prepare" | "verify";
type Scope = "shared" | "private";

type PackItem = {
  id: number;
  name: string;
  icon: string;
  scope: Scope;
  group: string;
  owners: Member[];
  checked: Partial<Record<Member, boolean>>;
  aiReason?: string;
};

type Suggestion = {
  id: number;
  name: string;
  icon: string;
  scope: Scope;
  group: string;
  reason: string;
  signal: string;
  added: boolean;
};

type ChatMessage = {
  id: number;
  author: Member | "带齐助手";
  text: string;
  system?: boolean;
};

const members: { name: Member; short: string; profile: string; className: string }[] = [
  { name: "我", short: "我", profile: "有充电宝", className: "member-me" },
  { name: "阿哲", short: "哲", profile: "有相机", className: "member-zhe" },
  { name: "小雨", short: "雨", profile: "有保温杯", className: "member-yu" },
];

const seedItems: PackItem[] = [
  { id: 1, name: "相机", icon: "📷", scope: "shared", group: "拍摄", owners: ["阿哲"], checked: {}, aiReason: "根据装备档案分给阿哲" },
  { id: 2, name: "大容量充电宝", icon: "🔋", scope: "shared", group: "电子", owners: ["我"], checked: {}, aiReason: "你登记了 20,000mAh" },
  { id: 3, name: "三脚架", icon: "⌁", scope: "shared", group: "拍摄", owners: [], checked: {} },
  { id: 4, name: "公共药包", icon: "✚", scope: "shared", group: "应急", owners: [], checked: {} },
  { id: 5, name: "纸巾 / 湿巾", icon: "▤", scope: "shared", group: "日用", owners: ["小雨"], checked: {} },
  { id: 6, name: "护照", icon: "▣", scope: "private", group: "证件", owners: [], checked: {} },
  { id: 7, name: "长款羽绒服", icon: "♨", scope: "private", group: "衣物", owners: [], checked: {} },
  { id: 8, name: "换洗衣物", icon: "◫", scope: "private", group: "衣物", owners: [], checked: {} },
  { id: 9, name: "洗漱包", icon: "◉", scope: "private", group: "日用", owners: [], checked: {} },
  { id: 10, name: "日标转换插头", icon: "⌁", scope: "private", group: "电子", owners: [], checked: {} },
];

const seedSuggestions: Suggestion[] = [
  { id: 101, name: "蓝色围巾", icon: "▰", scope: "private", group: "穿搭", reason: "AI 判断为个人物品：属于个人穿搭，每个人可按自己的造型决定是否携带。", signal: "热门出片", added: false },
  { id: 103, name: "暖宝宝整包", icon: "☀", scope: "shared", group: "保暖", reason: "AI 判断为共用物品：一人带一整包，同行人按需分用；其他人也可以选择再带。", signal: "智能共用", added: false },
];

const seedMessages: ChatMessage[] = [
  { id: 1, author: "我", text: "三脚架谁能带？拍雪景可能会用。" },
  { id: 2, author: "阿哲", text: "我带相机，箱子空间可能不太够。" },
  { id: 3, author: "小雨", text: "保温杯我可以带一个大的。" },
];

export default function Home() {
  const [items, setItems] = useState(seedItems);
  const [suggestions, setSuggestions] = useState(seedSuggestions);
  const [phase, setPhase] = useState<Phase>("prepare");
  const [currentMember, setCurrentMember] = useState<Member>("我");
  const [showChat, setShowChat] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [addScope, setAddScope] = useState<Scope>("shared");
  const [newItem, setNewItem] = useState("");
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>(seedMessages);
  const [toast, setToast] = useState("");

  const sharedItems = items.filter((item) => item.scope === "shared");
  const privateItems = items.filter((item) => item.scope === "private");
  const unassigned = sharedItems.filter((item) => item.owners.length === 0).length;

  const status = useMemo(() => {
    const mine = privateItems.filter((item) => !item.checked[currentMember]).length;
    const sharedMine = sharedItems.filter((item) => item.owners.includes(currentMember) && !item.checked[currentMember]).length;
    return { mine, sharedMine, total: mine + sharedMine + unassigned };
  }, [currentMember, privateItems, sharedItems, unassigned]);

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 1800);
  }

  function claim(id: number) {
    setItems((current) => current.map((item) => item.id === id && !item.owners.includes(currentMember) ? { ...item, owners: [...item.owners, currentMember] } : item));
    notify(`${currentMember}也会带这件共用品`);
  }

  function release(id: number) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, owners: item.owners.filter((member) => member !== currentMember), checked: { ...item.checked, [currentMember]: false } } : item));
    notify("已取消自己的携带状态");
  }

  function togglePacked(item: PackItem) {
    if (item.scope === "shared" && !item.owners.includes(currentMember)) return;
    setItems((current) => current.map((entry) => entry.id === item.id ? {
      ...entry,
      checked: { ...entry.checked, [currentMember]: !entry.checked[currentMember] },
    } : entry));
  }

  function moveItem(id: number) {
    setItems((current) => current.map((item) => {
      if (item.id !== id) return item;
      const movingToShared = item.scope === "private";
      return {
        ...item,
        scope: movingToShared ? "shared" : "private",
        owners: movingToShared ? [currentMember] : [],
        checked: {},
      };
    }));
    const item = items.find((entry) => entry.id === id);
    notify(item?.scope === "private" ? "已移到共用物品" : "已移到我的物品");
  }

  function addSuggestion(suggestion: Suggestion) {
    if (suggestion.added) return;
    setItems((current) => [...current, {
      id: suggestion.id,
      name: suggestion.name,
      icon: suggestion.icon,
      scope: suggestion.scope,
      group: suggestion.group,
      owners: [],
      checked: {},
      aiReason: suggestion.reason,
    }]);
    setSuggestions((current) => current.map((entry) => entry.id === suggestion.id ? { ...entry, added: true } : entry));
    notify(`已加入${suggestion.scope === "shared" ? "共用" : "我的"}清单`);
  }

  function sendMessage() {
    const text = draft.trim();
    if (!text) return;
    const additions: ChatMessage[] = [{ id: Date.now(), author: currentMember, text }];
    const wantsToClaim = /(我来带|我带|我有|交给我|算我的)/.test(text);
    const matched = sharedItems.find((item) => !item.owners.includes(currentMember) && (text.includes(item.name) || text.includes(item.name.slice(0, 2))));
    if (wantsToClaim && matched) {
      setItems((current) => current.map((item) => item.id === matched.id ? { ...item, owners: [...item.owners, currentMember] } : item));
      additions.push({ id: Date.now() + 1, author: "带齐助手", text: `已同步：${currentMember}也会带${matched.name}`, system: true });
    }
    setMessages((current) => [...current, ...additions]);
    setDraft("");
  }

  function addCustomItem() {
    const name = newItem.trim();
    if (!name) return;
    setItems((current) => [...current, {
      id: Date.now(), name, icon: addScope === "shared" ? "◇" : "○", scope: addScope, group: "自定义", owners: [], checked: {},
    }]);
    setNewItem("");
    setShowAdd(false);
    notify(`已加入${addScope === "shared" ? "共用" : "我的"}清单`);
  }

  function renderItem(item: PackItem) {
    const ownerMembers = item.owners.map((owner) => members.find((member) => member.name === owner)).filter(Boolean);
    const currentWillBring = item.owners.includes(currentMember);
    const packed = Boolean(item.checked[currentMember]);
    const canCheck = item.scope === "private" || currentWillBring;

    return (
      <article className={`list-item ${packed ? "packed" : ""}`} key={item.id}>
        {phase === "verify" ? (
          <button className={`pack-check ${packed ? "checked" : ""}`} onClick={() => togglePacked(item)} disabled={!canCheck} aria-label={`${packed ? "取消" : "确认"}${item.name}已装包`}>{packed ? "✓" : ""}</button>
        ) : <span className="item-icon" aria-hidden="true">{item.icon}</span>}
        <div className="item-copy">
          <b>{item.name}</b>
          <div className="item-meta"><small>{item.group}{item.aiReason && <><i>✦</i>{item.aiReason}</>}</small>{phase === "prepare" && <button className="move-item-button" onClick={() => moveItem(item.id)}>↔ {item.scope === "shared" ? "移到我的" : "移到共用"}</button>}</div>
        </div>
        {item.scope === "shared" ? (
          item.owners.length ? (
            <div className="shared-owner-action">
              <div className="owner-avatars" aria-label={`${item.owners.join("、")}会带`}>
                {ownerMembers.slice(0, 3).map((owner) => <button className={`owner-avatar ${owner?.className}`} key={owner?.name} onClick={() => phase === "prepare" && owner?.name === currentMember && release(item.id)} disabled={owner?.name !== currentMember} title={owner?.name === currentMember ? "取消我会带" : `${owner?.name}会带`}>{owner?.short}</button>)}
              </div>
              <button className={`also-bring-button ${currentWillBring ? "joined" : ""}`} onClick={() => phase === "prepare" && !currentWillBring && claim(item.id)} disabled={phase !== "prepare" || currentWillBring}><span>{currentWillBring ? "✓" : "＋"}</span><small>{currentWillBring ? "我已带" : "我也带"}</small></button>
            </div>
          ) : <button className="claim-button" onClick={() => phase === "prepare" && claim(item.id)}>＋ 我来带</button>
        ) : (
          <span className="private-pill">仅我可见</span>
        )}
      </article>
    );
  }

  return (
    <main className="app-shell">
      <section className="phone-frame" aria-label="带齐旅行物品清单原型">
        <header className="topbar">
          <div className="brand-mark" aria-hidden="true"><span></span><span></span><span></span></div>
          <div className="brand-name">带齐</div>
          <button className="trip-chip">北海道 · 5天⌄</button>
          <button className="icon-button" aria-label="更多选项">•••</button>
        </header>

        <div className="scroll-area">
          <section className="trip-hero">
            <div>
              <p className="eyebrow">日本 · 北海道 · 3 人同行</p>
              <h1>{phase === "prepare" ? "这次，带什么？" : "出发前，逐件确认"}</h1>
            </div>
            <div className="member-switch" aria-label="切换成员">
              {members.map((member) => <button key={member.name} className={`${member.className} ${currentMember === member.name ? "selected" : ""}`} onClick={() => setCurrentMember(member.name)}>{member.short}</button>)}
            </div>
          </section>

          <div className="context-tags"><span>❄ 雪地</span><span>−8°C</span><span>◉ 想拍照</span></div>

          <div className="phase-tabs" role="tablist" aria-label="准备阶段">
            <button className={phase === "prepare" ? "active" : ""} onClick={() => setPhase("prepare")}><span>1</span>准备清单</button>
            <button className={phase === "verify" ? "active" : ""} onClick={() => setPhase("verify")}><span>2</span>出发核对</button>
          </div>

          {phase === "verify" && (
            <section className="verify-banner">
              <span>{status.total}</span><div><b>{currentMember}还有 {status.mine + status.sharedMine} 件没确认</b><small>{unassigned ? `另有 ${unassigned} 件共用品仍待认领` : "所有共用品都有人负责"}</small></div>
            </section>
          )}

          <section className="ai-section">
            <header>
              <div className="ai-title"><span>✦</span><div><p className="eyebrow">AI 已自动分类</p><h2>北海道建议，已分进对应清单</h2></div></div>
              <small>{suggestions.filter((item) => !item.added).length} 条建议</small>
            </header>
            <div className="suggestion-scroll">
              {suggestions.map((suggestion) => (
                <article className={`suggestion-card ${suggestion.added ? "added" : ""}`} key={suggestion.id}>
                  <div className={`suggestion-icon suggestion-${suggestion.id}`}>{suggestion.icon}</div>
                  <span className="signal">{suggestion.signal}</span>
                  <span className={`scope-decision ${suggestion.scope}`}>✦ AI 判断 · {suggestion.scope === "shared" ? "共用物品" : "我的物品"}</span>
                  <h3>{suggestion.name}</h3>
                  <p>{suggestion.reason}</p>
                  <button onClick={() => addSuggestion(suggestion)} disabled={suggestion.added}>{suggestion.added ? "✓ 已加入对应清单" : `＋ 加入${suggestion.scope === "shared" ? "共用物品" : "我的物品"}`}</button>
                </article>
              ))}
            </div>
          </section>

          <button className="chat-entry" onClick={() => setShowChat(true)}>
            <span className="chat-avatars"><i className="member-me">我</i><i className="member-zhe">哲</i><i className="member-yu">雨</i></span>
            <span><b>{unassigned ? `${unassigned} 件共用品没人带，聊一下` : "物品有变化？在这里聊"}</b><small>说“药包我来带”，结果自动同步</small></span>
            <span className="chat-count">{messages.length}</span>
          </button>

          <section className="list-section">
            <header className="section-head">
              <div><span className="scope-icon shared-icon">↔</span><div><h2>共用物品</h2><p>一人带一份，大家一起用</p></div></div>
              <span>{sharedItems.filter((item) => item.owners.length).length}/{sharedItems.length} 已认领</span>
            </header>
            <div className="item-list">{sharedItems.map(renderItem)}</div>
          </section>

          <section className="list-section private-section">
            <header className="section-head">
              <div><span className="scope-icon private-icon">●</span><div><h2>{currentMember === "我" ? "我的物品" : `${currentMember}的物品`}</h2><p>每个人都有自己的独立清单</p></div></div>
              <span>{privateItems.length} 件</span>
            </header>
            <div className="item-list">{privateItems.map(renderItem)}</div>
          </section>
        </div>

        <footer className="action-bar">
          <button className="add-item" onClick={() => setShowAdd(true)} aria-label="添加物品">＋</button>
          {phase === "prepare" ? (
            <button className="primary-action" onClick={() => setPhase("verify")}>进入出发核对 <span>→</span></button>
          ) : (
            <button className={`primary-action ${status.total === 0 ? "ready" : ""}`} onClick={() => notify(status.total ? `还有 ${status.total} 项需要处理` : "东西都带齐了，出发！")}>{status.total ? `继续核对 · 还有 ${status.total} 项` : "全部带齐 · 出发"}<span>{status.total ? "↑" : "✓"}</span></button>
          )}
        </footer>

        {showChat && (
          <div className="bottom-sheet" role="dialog" aria-modal="true" aria-label="物品讨论">
            <button className="sheet-backdrop" aria-label="关闭" onClick={() => setShowChat(false)} />
            <section className="sheet-card chat-card">
              <span className="sheet-handle" />
              <header className="chat-header"><div><p className="eyebrow">北海道 · 3 人</p><h2>物品讨论</h2></div><button onClick={() => setShowChat(false)}>×</button></header>
              <div className="chat-context"><span>✦</span><p><b>对话会同步认领</b><small>试试发送“药包我来带”。</small></p></div>
              <div className="chat-messages">
                {messages.map((message) => {
                  const meta = members.find((member) => member.name === message.author);
                  return <div className={`message-row ${message.author === currentMember ? "mine" : ""} ${message.system ? "system" : ""}`} key={message.id}><span className={`message-avatar ${meta?.className ?? "assistant-avatar"}`}>{meta?.short ?? "✦"}</span><div><small>{message.author}</small><p>{message.text}</p></div></div>;
                })}
              </div>
              {unassigned > 0 && <div className="chat-suggestions">{sharedItems.filter((item) => item.owners.length === 0).map((item) => <button key={item.id} onClick={() => setDraft(`谁可以带${item.name}？`)}>问问：{item.name}</button>)}</div>}
              <div className="chat-composer"><input autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => event.key === "Enter" && sendMessage()} placeholder={`以${currentMember}身份发消息…`} /><button onClick={sendMessage}>↑</button></div>
            </section>
          </div>
        )}

        {showAdd && (
          <div className="bottom-sheet" role="dialog" aria-modal="true" aria-label="添加物品">
            <button className="sheet-backdrop" aria-label="关闭" onClick={() => setShowAdd(false)} />
            <section className="sheet-card add-card">
              <span className="sheet-handle" />
              <h2>添加物品</h2><p>先选择这是大家共用，还是只放进自己的背包。</p>
              <div className="scope-picker"><button className={addScope === "shared" ? "active" : ""} onClick={() => setAddScope("shared")}><b>↔ 共用物品</b><small>需要一人认领</small></button><button className={addScope === "private" ? "active" : ""} onClick={() => setAddScope("private")}><b>● 私人物品</b><small>只进入我的清单</small></button></div>
              <input autoFocus value={newItem} onChange={(event) => setNewItem(event.target.value)} onKeyDown={(event) => event.key === "Enter" && addCustomItem()} placeholder="例如：自拍杆" />
              <button className="primary-action" onClick={addCustomItem}>加入清单</button>
            </section>
          </div>
        )}

        {toast && <div className="toast" role="status">{toast}</div>}
      </section>

      <aside className="prototype-note">
        <p className="eyebrow">PRODUCT PROTOTYPE · V4</p>
        <h2>目的地懂你，<br />清单依然简单。</h2>
        <p>手机端不再复制表格，而是回到最自然的纵向 List。AI 负责理解北海道的气候与出片偏好，用户只需要决定是否加入清单。</p>
        <div className="principle"><span>01</span><p><b>共用与私人分开</b><br />共用品要认领，私人物品归个人</p></div>
        <div className="principle"><span>02</span><p><b>AI 补充有理由</b><br />说明来自目的地特点还是热门玩法</p></div>
        <div className="principle"><span>03</span><p><b>不做旅游攻略</b><br />只回答“这次出发需要带什么”</p></div>
        <div className="demo-note">试试：把“蓝色围巾”加入我的清单，再进入出发核对。</div>
      </aside>
    </main>
  );
}
