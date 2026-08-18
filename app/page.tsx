"use client";

import { useMemo, useState } from "react";

type Member = "我" | "阿哲" | "小雨";
type Phase = "assign" | "verify";

type ChatMessage = {
  id: number;
  author: Member | "带齐助手";
  text: string;
  system?: boolean;
};

type PackItem = {
  id: number;
  name: string;
  category: "共用物品" | "每人必带";
  owner: Member | null;
  suggestedOwner?: Member;
  aiReason?: string;
  checked: Partial<Record<Member, boolean>>;
};

const members: { name: Member; short: string; profile: string; className: string }[] = [
  { name: "我", short: "我", profile: "有充电宝", className: "member-me" },
  { name: "阿哲", short: "哲", profile: "有相机", className: "member-zhe" },
  { name: "小雨", short: "雨", profile: "有音箱 · 爱桌游", className: "member-yu" },
];

const seedItems: PackItem[] = [
  { id: 1, name: "相机", category: "共用物品", owner: null, suggestedOwner: "阿哲", aiReason: "阿哲登记了有相机", checked: {} },
  { id: 2, name: "充电宝", category: "共用物品", owner: null, suggestedOwner: "我", aiReason: "你有 20,000mAh 充电宝", checked: {} },
  { id: 3, name: "蓝牙音箱", category: "共用物品", owner: null, suggestedOwner: "小雨", aiReason: "小雨登记了有音箱", checked: {} },
  { id: 4, name: "桌游卡牌", category: "共用物品", owner: null, suggestedOwner: "小雨", aiReason: "小雨的旅行偏好有桌游", checked: {} },
  { id: 5, name: "防晒霜", category: "共用物品", owner: null, checked: {} },
  { id: 6, name: "折叠雨伞", category: "共用物品", owner: null, checked: {} },
  { id: 7, name: "纸巾 / 湿巾", category: "共用物品", owner: null, checked: {} },
  { id: 8, name: "常用药包", category: "共用物品", owner: null, checked: {} },
  { id: 9, name: "身份证", category: "每人必带", owner: null, checked: {} },
  { id: 10, name: "换洗衣物", category: "每人必带", owner: null, checked: {} },
  { id: 11, name: "洗漱包", category: "每人必带", owner: null, checked: {} },
];

const seedMessages: ChatMessage[] = [
  { id: 1, author: "我", text: "大家看下空着的，家里有就直接认领吧～" },
  { id: 2, author: "阿哲", text: "防晒霜谁有新的？不用为了这个单独买。" },
  { id: 3, author: "小雨", text: "雨伞我还没找到，晚点回家确认一下。" },
];

export default function Home() {
  const [items, setItems] = useState(seedItems);
  const [phase, setPhase] = useState<Phase>("assign");
  const [currentMember, setCurrentMember] = useState<Member>("我");
  const [showAdd, setShowAdd] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [newItem, setNewItem] = useState("");
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>(seedMessages);
  const [toast, setToast] = useState("");

  const sharedItems = items.filter((item) => item.category === "共用物品");
  const assignedCount = sharedItems.filter((item) => item.owner).length;
  const unassignedCount = sharedItems.length - assignedCount;

  const checks = useMemo(() => {
    const required = items.reduce((count, item) => count + (item.category === "每人必带" ? members.length : item.owner ? 1 : 0), 0);
    const done = items.reduce((count, item) => {
      if (item.category === "每人必带") return count + members.filter((member) => item.checked[member.name]).length;
      return count + (item.owner && item.checked[item.owner] ? 1 : 0);
    }, 0);
    return { required, done, remaining: required - done };
  }, [items]);
  const totalPending = checks.remaining + unassignedCount;

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 1800);
  }

  function applyAiAssignments() {
    setItems((current) => current.map((item) => item.owner || !item.suggestedOwner ? item : { ...item, owner: item.suggestedOwner }));
    notify("AI 按大家已有装备分配了 4 件");
  }

  function claim(id: number) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, owner: currentMember } : item));
    notify(`${currentMember}认领了这件物品`);
  }

  function release(id: number) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, owner: null, checked: {} } : item));
    notify("已放回待认领");
  }

  function toggleCheck(id: number, member: Member) {
    setItems((current) => current.map((item) => item.id === id ? {
      ...item,
      checked: { ...item.checked, [member]: !item.checked[member] },
    } : item));
  }

  function enterVerify() {
    setPhase("verify");
    if (unassignedCount > 0) notify(`${unassignedCount} 件未认领，已带到核对阶段继续处理`);
    document.querySelector(".matrix-scroll")?.scrollTo({ top: 0, behavior: "smooth" });
  }

  function sendMessage() {
    const text = draft.trim();
    if (!text) return;

    const additions: ChatMessage[] = [{ id: Date.now(), author: currentMember, text }];
    const wantsToClaim = /(我来带|我带|我有|交给我|算我的)/.test(text);
    const matchedItem = sharedItems.find((item) => {
      const shortName = item.name.split(/[ /]/)[0];
      return !item.owner && (text.includes(item.name) || text.includes(shortName));
    });

    if (wantsToClaim && matchedItem) {
      setItems((current) => current.map((item) => item.id === matchedItem.id ? { ...item, owner: currentMember } : item));
      additions.push({ id: Date.now() + 1, author: "带齐助手", text: `已同步到表格：${matchedItem.name} → ${currentMember}`, system: true });
    }

    setMessages((current) => [...current, ...additions]);
    setDraft("");
  }

  function addItem() {
    const name = newItem.trim();
    if (!name) return;
    setItems((current) => [...current, { id: Date.now(), name, category: "共用物品", owner: null, checked: {} }]);
    setNewItem("");
    setShowAdd(false);
    setPhase("assign");
    notify("已加入待认领清单");
  }

  const categories: PackItem["category"][] = ["共用物品", "每人必带"];

  return (
    <main className="app-shell">
      <section className="phone-frame" aria-label="带齐旅行物品分工表原型">
        <header className="topbar">
          <div className="brand-mark" aria-hidden="true"><span></span><span></span><span></span></div>
          <div className="brand-name">带齐</div>
          <span className="trip-name">海边周末</span>
          <button className="icon-button" aria-label="更多选项">•••</button>
        </header>

        <div className="scroll-area">
          <section className="trip-head">
            <p className="eyebrow">3 人同行 · 周五 19:30 出发</p>
            <h1>{phase === "assign" ? "先说好，谁带什么" : "出发前，最后核对"}</h1>
            <p className="subcopy">{phase === "assign" ? "每件共用品只要一份，空格等大家来认领。" : "谁负责，谁亲手确认已经装进行李。"}</p>
          </section>

          <div className="phase-switch" role="tablist" aria-label="准备阶段">
            <button role="tab" aria-selected={phase === "assign"} className={phase === "assign" ? "active" : ""} onClick={() => setPhase("assign")}>
              <span>1</span><b>分配谁带</b><small>{assignedCount}/{sharedItems.length} 已分配</small>
            </button>
            <button role="tab" aria-selected={phase === "verify"} className={phase === "verify" ? "active" : ""} onClick={enterVerify}>
              <span>2</span><b>出发核对</b><small>{phase === "verify" ? `${checks.done}/${checks.required} 已确认` : "可随时进入"}</small>
            </button>
          </div>

          {phase === "assign" ? (
            <button className="ai-assign" onClick={applyAiAssignments}>
              <span className="spark">✦</span>
              <span><b>让 AI 先按装备分一分</b><small>相机给有相机的人，减少不合理认领</small></span>
              <span className="arrow">›</span>
            </button>
          ) : (
            <div className={`verify-status ${totalPending === 0 ? "all-done" : ""}`}>
              <span>{totalPending === 0 ? "✓" : totalPending}</span>
              <p><b>{totalPending === 0 ? "全部带齐，可以出发！" : "项还需要处理"}</b><small>{unassignedCount ? `${unassignedCount} 件未认领 · ${checks.remaining} 格待确认` : "点负责人名下的方框逐项确认"}</small></p>
            </div>
          )}

          <button className="chat-entry" onClick={() => setShowChat(true)}>
            <span className="chat-avatars"><i className="member-me">我</i><i className="member-zhe">哲</i><i className="member-yu">雨</i></span>
            <span><b>{unassignedCount ? `${unassignedCount} 件没人带，群里问问` : "分工有变化？在这里聊"}</b><small>不用切换聊天软件 · 对话可同步认领结果</small></span>
            <span className="chat-count">{messages.length}</span>
          </button>

          <section className="identity-bar">
            <div>
              <p className="eyebrow">正在以谁的身份查看</p>
              <b>{currentMember}</b><small> · 点击头像切换，模拟朋友一起认领</small>
            </div>
            <div className="member-switch" aria-label="切换成员身份">
              {members.map((member) => (
                <button key={member.name} className={`${member.className} ${currentMember === member.name ? "selected" : ""}`} onClick={() => setCurrentMember(member.name)} aria-label={`切换为${member.name}`} title={member.profile}>
                  {member.short}
                </button>
              ))}
            </div>
          </section>

          <section className="matrix-card">
            <div className="matrix-scroll">
              <div className="matrix-grid matrix-head">
                <div className="item-col">物品</div>
                {members.map((member) => (
                  <div key={member.name} className={`person-col ${currentMember === member.name ? "current" : ""}`}>
                    <span className={member.className}>{member.short}</span>
                    <b>{member.name}</b>
                    <small>{member.profile}</small>
                  </div>
                ))}
              </div>

              {categories.map((category) => (
                <div key={category} className="matrix-section">
                  <div className="section-label"><b>{category}</b><small>{category === "共用物品" ? "每件只需 1 人负责" : "每个人都要确认"}</small></div>
                  {items.filter((item) => item.category === category).map((item) => (
                    <div className={`matrix-grid matrix-row ${phase === "verify" && category === "共用物品" && !item.owner ? "unresolved-row" : ""}`} key={item.id}>
                      <div className="item-col item-info">
                        <b>{item.name}</b>
                        {phase === "assign" && item.aiReason && <small><i>✦</i>{item.aiReason}</small>}
                      </div>
                      {members.map((member) => {
                        const isCurrent = currentMember === member.name;
                        const isOwner = item.owner === member.name;
                        const checked = Boolean(item.checked[member.name]);

                        if (phase === "assign") {
                          if (category === "每人必带") return <div className={`claim-cell personal ${isCurrent ? "current" : ""}`} key={member.name}><span>各自带</span></div>;
                          if (isOwner) return <div className={`claim-cell ${isCurrent ? "current" : ""}`} key={member.name}><button className={`claimed ${member.className}`} onClick={() => isCurrent && release(item.id)} aria-label={`${member.name}已认领${item.name}`}>✓<small>{isCurrent ? "已认领" : "负责"}</small></button></div>;
                          if (!item.owner && isCurrent) return <div className="claim-cell current" key={member.name}><button className="claim-me" onClick={() => claim(item.id)}>＋<small>我来带</small></button></div>;
                          return <div className="claim-cell" key={member.name}><span className="empty-dot">·</span></div>;
                        }

                        const needsCheck = category === "每人必带" || isOwner;
                        return (
                          <div className={`claim-cell verify-cell ${isCurrent ? "current" : ""}`} key={member.name}>
                            {needsCheck ? (
                              <button className={`verify-check ${checked ? `checked ${member.className}` : ""}`} onClick={() => toggleCheck(item.id, member.name)} aria-label={`${member.name}${checked ? "取消确认" : "确认带了"}${item.name}`}>
                                {checked ? "✓" : ""}<small>{checked ? "带了" : "确认"}</small>
                              </button>
                            ) : !item.owner && isCurrent ? (
                              <button className="claim-me urgent" onClick={() => claim(item.id)}>＋<small>我来带</small></button>
                            ) : <span className={item.owner ? "empty-dot" : "unclaimed-mark"}>{item.owner ? "—" : "?"}</span>}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </section>

          {phase === "assign" && (
            <div className="assignment-summary">
              <div className="mini-progress"><span style={{ width: `${assignedCount / sharedItems.length * 100}%` }} /></div>
              <p><b>{unassignedCount ? `还剩 ${unassignedCount} 件没人带` : "分工完成"}</b><small>{unassignedCount ? "可以先去核对，也可以在群里继续商量" : "现在可以进入出发前核对"}</small></p>
            </div>
          )}
        </div>

        <footer className="action-bar">
          <button className="add-item" onClick={() => setShowAdd(true)} aria-label="添加物品">＋</button>
          {phase === "assign" ? (
            <button className="primary-action" onClick={enterVerify}>
              {unassignedCount ? `进入核对 · ${unassignedCount} 件稍后再定` : "进入出发前核对"}<span>→</span>
            </button>
          ) : (
            <button className={`primary-action ${totalPending ? "not-ready" : "ready"}`} onClick={() => totalPending ? notify(`还有 ${totalPending} 项待处理`) : notify("东西都带齐了，出发！")}>
              {totalPending ? `继续核对 · 还有 ${totalPending} 项` : "全部带齐 · 出发"}<span>{totalPending ? "↑" : "✓"}</span>
            </button>
          )}
        </footer>

        {showChat && (
          <div className="add-sheet chat-sheet" role="dialog" aria-modal="true" aria-label="同行群聊">
            <button className="sheet-backdrop" aria-label="关闭群聊" onClick={() => setShowChat(false)} />
            <section className="sheet-card chat-card">
              <span className="sheet-handle" />
              <header className="chat-header">
                <div><p className="eyebrow">海边周末 · 3 人</p><h2>物品讨论</h2></div>
                <button onClick={() => setShowChat(false)} aria-label="关闭">×</button>
              </header>
              <div className="chat-context"><span>✦</span><p><b>带齐助手会听懂认领</b><small>试试发送“药包我来带”，结果会自动回到表格。</small></p></div>
              <div className="chat-messages" aria-live="polite">
                {messages.map((message) => {
                  const meta = members.find((member) => member.name === message.author);
                  return (
                    <div className={`message-row ${message.author === currentMember ? "mine" : ""} ${message.system ? "system" : ""}`} key={message.id}>
                      <span className={`message-avatar ${meta?.className ?? "assistant-avatar"}`}>{meta?.short ?? "✦"}</span>
                      <div><small>{message.author}</small><p>{message.text}</p></div>
                    </div>
                  );
                })}
              </div>
              {unassignedCount > 0 && (
                <div className="chat-suggestions">
                  {sharedItems.filter((item) => !item.owner).slice(0, 3).map((item) => <button key={item.id} onClick={() => setDraft(`谁可以带${item.name}？`)}>问问：{item.name}</button>)}
                </div>
              )}
              <div className="chat-composer">
                <input autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => event.key === "Enter" && sendMessage()} placeholder={`以${currentMember}身份发消息…`} aria-label="输入群聊消息" />
                <button onClick={sendMessage} aria-label="发送消息">↑</button>
              </div>
            </section>
          </div>
        )}

        {showAdd && (
          <div className="add-sheet" role="dialog" aria-modal="true" aria-label="添加物品">
            <button className="sheet-backdrop" aria-label="关闭" onClick={() => setShowAdd(false)} />
            <div className="sheet-card">
              <span className="sheet-handle" />
              <h2>加一件共用物品</h2>
              <p>加入后先留空，等大家来认领。</p>
              <input autoFocus value={newItem} onChange={(event) => setNewItem(event.target.value)} onKeyDown={(event) => event.key === "Enter" && addItem()} placeholder="例如：自拍杆" aria-label="物品名称" />
              <button className="primary-action" onClick={addItem}>加入待认领表格</button>
            </div>
          </div>
        )}

        {toast && <div className="toast" role="status">{toast}</div>}
      </section>

      <aside className="prototype-note">
        <p className="eyebrow">PRODUCT PROTOTYPE · V3</p>
        <h2>边聊边认，<br />随时核对。</h2>
        <p>表格记录谁负责，对话解决“没人认领怎么办”。说一句“药包我来带”，带齐助手就会把结果同步回表格。</p>
        <div className="flow-step active"><span>1</span><p><b>认领阶段</b><br />空表开始，朋友各自说“我来带”</p></div>
        <div className="flow-line" />
        <div className="flow-step"><span>⋯</span><p><b>分不下来就聊</b><br />讨论留在物品旁，不再切换群聊软件</p></div>
        <div className="flow-line" />
        <div className="flow-step"><span>2</span><p><b>核对阶段</b><br />无需等全部认领，随时进入继续处理</p></div>
        <div className="demo-note">试试：打开“物品讨论”，发送“药包我来带”。</div>
      </aside>
    </main>
  );
}
