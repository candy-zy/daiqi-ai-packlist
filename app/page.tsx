"use client";

import { useMemo, useState } from "react";

type Member = "我" | "阿哲" | "小雨";
type Phase = "prepare" | "verify";
type ListFilter = "all" | "mine" | "unassigned";
type Category = "一次性物品" | "护肤品" | "化妆品" | "生活用品" | "服饰" | "必需品" | "其他";

type PackItem = {
  id: number;
  name: string;
  icon: string;
  group: Category;
  owners: Member[];
  checked: Partial<Record<Member, boolean>>;
  aiReason?: string;
};

type Suggestion = {
  id: number;
  name: string;
  icon: string;
  group: Category;
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

const categories: { name: Category; icon: string; note: string }[] = [
  { name: "一次性物品", icon: "▤", note: "用完即可丢弃" },
  { name: "护肤品", icon: "◉", note: "水乳、防晒与护理" },
  { name: "化妆品", icon: "✦", note: "底妆、眼妆与唇妆" },
  { name: "生活用品", icon: "◇", note: "洗漱与日常使用" },
  { name: "服饰", icon: "♨", note: "衣物、鞋帽与配饰" },
  { name: "必需品", icon: "!", note: "证件与随身必带" },
  { name: "其他", icon: "＋", note: "拍摄、小卡与物料" },
];

const seedItems: PackItem[] = [
  { id: 1, name: "一次性内裤", icon: "▤", group: "一次性物品", owners: [], checked: {} },
  { id: 2, name: "马桶垫", icon: "○", group: "一次性物品", owners: ["小雨"], checked: {} },
  { id: 3, name: "消毒湿巾", icon: "▥", group: "一次性物品", owners: [], checked: {} },
  { id: 4, name: "水乳套装", icon: "◉", group: "护肤品", owners: ["我"], checked: {} },
  { id: 5, name: "防晒", icon: "☀", group: "护肤品", owners: [], checked: {} },
  { id: 6, name: "气垫", icon: "●", group: "化妆品", owners: ["我"], checked: {} },
  { id: 7, name: "眼影盘", icon: "◫", group: "化妆品", owners: ["小雨"], checked: {} },
  { id: 8, name: "口红", icon: "▰", group: "化妆品", owners: [], checked: {} },
  { id: 9, name: "牙膏牙刷", icon: "⌁", group: "生活用品", owners: [], checked: {} },
  { id: 10, name: "常用药", icon: "✚", group: "生活用品", owners: ["阿哲"], checked: {} },
  { id: 11, name: "长款羽绒服", icon: "♨", group: "服饰", owners: ["我"], checked: {} },
  { id: 12, name: "换洗衣物", icon: "◫", group: "服饰", owners: [], checked: {} },
  { id: 13, name: "身份证", icon: "▣", group: "必需品", owners: ["我", "阿哲", "小雨"], checked: {} },
  { id: 14, name: "充电线", icon: "⌁", group: "必需品", owners: [], checked: {} },
  { id: 15, name: "充电宝", icon: "▮", group: "必需品", owners: ["我"], checked: {}, aiReason: "你登记了大容量充电宝" },
  { id: 16, name: "花露水", icon: "◉", group: "必需品", owners: [], checked: {} },
  { id: 17, name: "相机", icon: "📷", group: "其他", owners: ["阿哲"], checked: {}, aiReason: "阿哲登记了相机" },
  { id: 18, name: "拍立得相纸", icon: "▧", group: "其他", owners: [], checked: {} },
  { id: 19, name: "小卡 / 物料", icon: "◇", group: "其他", owners: ["小雨"], checked: {} },
];

const seedSuggestions: Suggestion[] = [
  { id: 101, name: "蓝色围巾", icon: "▰", group: "服饰", reason: "北海道雪景中蓝色更显眼，AI 已将它归入服饰。", signal: "热门出片", added: false },
  { id: 103, name: "暖宝宝整包", icon: "☀", group: "生活用品", reason: "低温行程可能需要持续保暖，AI 已将它归入生活用品。", signal: "低温提醒", added: false },
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
  const [listFilter, setListFilter] = useState<ListFilter>("all");
  const [currentMember, setCurrentMember] = useState<Member>("我");
  const [showChat, setShowChat] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [addCategory, setAddCategory] = useState<Category>("必需品");
  const [newItem, setNewItem] = useState("");
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>(seedMessages);
  const [toast, setToast] = useState("");

  const unassignedItems = items.filter((item) => item.owners.length === 0);
  const unassigned = unassignedItems.length;
  const verifyItems = items.filter((item) => item.owners.includes(currentMember));
  const prepareItems = listFilter === "mine"
    ? verifyItems
    : listFilter === "unassigned"
      ? unassignedItems
      : items;
  const filterCopy = listFilter === "mine"
    ? { title: currentMember === "我" ? "我的物品" : `${currentMember}的物品`, note: "这个人已认领、准备携带" }
    : listFilter === "unassigned"
      ? { title: "待分配物品", note: "还没有任何人负责携带" }
      : { title: "全部物品", note: "按类别查看完整清单" };

  const status = useMemo(() => {
    const total = items.filter((item) => item.owners.includes(currentMember) && !item.checked[currentMember]).length;
    return { total };
  }, [currentMember, items]);

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 1800);
  }

  function claim(id: number) {
    setItems((current) => current.map((item) => item.id === id && !item.owners.includes(currentMember) ? { ...item, owners: [...item.owners, currentMember] } : item));
    notify(`${currentMember}会带这件物品`);
  }

  function release(id: number) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, owners: item.owners.filter((member) => member !== currentMember), checked: { ...item.checked, [currentMember]: false } } : item));
    notify("已取消自己的携带状态");
  }

  function togglePacked(item: PackItem) {
    if (!item.owners.includes(currentMember)) return;
    setItems((current) => current.map((entry) => entry.id === item.id ? {
      ...entry,
      checked: { ...entry.checked, [currentMember]: !entry.checked[currentMember] },
    } : entry));
  }

  function addSuggestion(suggestion: Suggestion) {
    if (suggestion.added) return;
    setItems((current) => [...current, {
      id: suggestion.id,
      name: suggestion.name,
      icon: suggestion.icon,
      group: suggestion.group,
      owners: [],
      checked: {},
      aiReason: suggestion.reason,
    }]);
    setSuggestions((current) => current.map((entry) => entry.id === suggestion.id ? { ...entry, added: true } : entry));
    notify(`已加入「${suggestion.group}」`);
  }

  function sendMessage() {
    const text = draft.trim();
    if (!text) return;
    const additions: ChatMessage[] = [{ id: Date.now(), author: currentMember, text }];
    const wantsToClaim = /(我来带|我带|我有|交给我|算我的)/.test(text);
    const matched = items.find((item) => !item.owners.includes(currentMember) && (text.includes(item.name) || text.includes(item.name.slice(0, 2))));
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
      id: Date.now(), name, icon: "◇", group: addCategory, owners: [], checked: {},
    }]);
    setNewItem("");
    setShowAdd(false);
    notify(`已加入「${addCategory}」`);
  }

  function renderItem(item: PackItem) {
    const ownerMembers = item.owners.map((owner) => members.find((member) => member.name === owner)).filter(Boolean);
    const currentWillBring = item.owners.includes(currentMember);
    const packed = Boolean(item.checked[currentMember]);
    const canCheck = currentMember === "我" && currentWillBring;

    return (
      <article className={`list-item ${packed ? "packed" : ""}`} key={item.id}>
        {phase === "verify" ? (
          <button className={`pack-check ${packed ? "checked" : ""}`} onClick={() => togglePacked(item)} disabled={!canCheck} aria-label={`${packed ? "取消" : "确认"}${item.name}已装包`}>{packed ? "✓" : ""}</button>
        ) : <span className="item-icon" aria-hidden="true">{item.icon}</span>}
        <div className="item-copy">
          <b>{item.name}</b>
          <div className="item-meta"><small>{item.aiReason ? <><i>✦</i>{item.aiReason}</> : item.group}</small></div>
        </div>
        {phase === "prepare" && (item.owners.length ? (
            <div className="shared-owner-action">
              <div className="owner-avatars" aria-label={`${item.owners.join("、")}会带`}>
                {ownerMembers.slice(0, 3).map((owner) => <button className={`owner-avatar ${owner?.className}`} key={owner?.name} onClick={() => phase === "prepare" && owner?.name === currentMember && release(item.id)} disabled={owner?.name !== currentMember} title={owner?.name === currentMember ? "取消我会带" : `${owner?.name}会带`}>{owner?.short}</button>)}
              </div>
              <button
                className={`also-bring-button ${currentWillBring ? "joined" : ""}`}
                onClick={() => phase === "prepare" && (currentWillBring ? release(item.id) : claim(item.id))}
                disabled={phase !== "prepare"}
                aria-pressed={currentWillBring}
                aria-label={currentWillBring ? `取消携带${item.name}` : `我也带${item.name}`}
                title={currentWillBring ? "再点一次取消" : "我也带"}
              >
                <span>{currentWillBring ? "✓" : "＋"}</span><small>{currentWillBring ? "已选择" : "我也带"}</small>
              </button>
            </div>
          ) : <button className="claim-button" onClick={() => phase === "prepare" && claim(item.id)}>＋ 我来带</button>)}
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
              <span>{status.total}</span><div><b>{currentMember}还有 {status.total} 件没确认</b><small>{currentMember === "我" ? `已确认 ${verifyItems.length - status.total}/${verifyItems.length} 件，只核对自己要带的` : "朋友的核对状态仅供查看"}</small></div>
            </section>
          )}

          {phase === "prepare" && <section className="ai-section">
            <header>
              <div className="ai-title"><span>✦</span><div><p className="eyebrow">AI 已自动归类</p><h2>北海道建议，加入固定分类</h2></div></div>
              <small>{suggestions.filter((item) => !item.added).length} 条建议</small>
            </header>
            <div className="suggestion-scroll">
              {suggestions.map((suggestion) => (
                <article className={`suggestion-card ${suggestion.added ? "added" : ""}`} key={suggestion.id}>
                  <div className={`suggestion-icon suggestion-${suggestion.id}`}>{suggestion.icon}</div>
                  <span className="signal">{suggestion.signal}</span>
                  <span className="category-decision">✦ AI 归类 · {suggestion.group}</span>
                  <h3>{suggestion.name}</h3>
                  <p>{suggestion.reason}</p>
                  <button onClick={() => addSuggestion(suggestion)} disabled={suggestion.added}>{suggestion.added ? "✓ 已加入对应分类" : `＋ 加入${suggestion.group}`}</button>
                </article>
              ))}
            </div>
          </section>}

          {phase === "prepare" && <button className="chat-entry" onClick={() => setShowChat(true)}>
            <span className="chat-avatars"><i className="member-me">我</i><i className="member-zhe">哲</i><i className="member-yu">雨</i></span>
            <span><b>{unassigned ? `${unassigned} 件物品没人带，聊一下` : "物品有变化？在这里聊"}</b><small>说“充电线我来带”，结果自动同步</small></span>
            <span className="chat-count">{messages.length}</span>
          </button>}

          {phase === "prepare" && <nav className="list-filters" aria-label="筛选准备清单">
            <button className={listFilter === "all" ? "active" : ""} onClick={() => setListFilter("all")}>全部 <span>{items.length}</span></button>
            <button className={listFilter === "mine" ? "active" : ""} onClick={() => setListFilter("mine")}>我的 <span>{verifyItems.length}</span></button>
            <button className={listFilter === "unassigned" ? "active" : ""} onClick={() => setListFilter("unassigned")}>待分配 <span>{unassigned}</span></button>
          </nav>}

          {phase === "prepare" ? <section className="filtered-list-section">
            <header className="filtered-list-head"><div><h2>{filterCopy.title}</h2><p>{filterCopy.note}</p></div><span>{prepareItems.length} 件</span></header>
            {prepareItems.length ? <div className="category-sections">{categories.map((category, index) => {
              const categoryItems = prepareItems.filter((item) => item.group === category.name);
              if (!categoryItems.length) return null;
              return <section className="list-section category-section" key={category.name}>
                <header className="section-head">
                  <div><span className={`scope-icon category-icon category-${index}`}>{category.icon}</span><div><h2>{category.name}</h2><p>{category.note}</p></div></div>
                  <span>{categoryItems.length} 件</span>
                </header>
                <div className="item-list">{categoryItems.map(renderItem)}</div>
              </section>;
            })}</div> : <div className="empty-list"><span>✓</span><b>这里已经清空了</b><small>暂时没有等待分配的物品</small></div>}
          </section> : <section className="list-section verify-list-section">
            <header className="section-head">
              <div><span className="scope-icon private-icon">✓</span><div><h2>{currentMember === "我" ? "我的待带清单" : `${currentMember}的待带清单`}</h2><p>这里只显示这个人自己负责的物品</p></div></div>
              <span>{verifyItems.length} 件</span>
            </header>
            <div className="item-list">{verifyItems.map(renderItem)}</div>
          </section>}
        </div>

        <footer className="action-bar">
          {phase === "prepare" && <button className="add-item" onClick={() => setShowAdd(true)} aria-label="添加物品">＋</button>}
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
              <div className="chat-context"><span>✦</span><p><b>对话会同步认领</b><small>试试发送“充电线我来带”。</small></p></div>
              <div className="chat-messages">
                {messages.map((message) => {
                  const meta = members.find((member) => member.name === message.author);
                  return <div className={`message-row ${message.author === currentMember ? "mine" : ""} ${message.system ? "system" : ""}`} key={message.id}><span className={`message-avatar ${meta?.className ?? "assistant-avatar"}`}>{meta?.short ?? "✦"}</span><div><small>{message.author}</small><p>{message.text}</p></div></div>;
                })}
              </div>
              {unassigned > 0 && <div className="chat-suggestions">{unassignedItems.map((item) => <button key={item.id} onClick={() => setDraft(`谁可以带${item.name}？`)}>问问：{item.name}</button>)}</div>}
              <div className="chat-composer"><input autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => event.key === "Enter" && sendMessage()} placeholder={`以${currentMember}身份发消息…`} /><button onClick={sendMessage}>↑</button></div>
            </section>
          </div>
        )}

        {showAdd && (
          <div className="bottom-sheet" role="dialog" aria-modal="true" aria-label="添加物品">
            <button className="sheet-backdrop" aria-label="关闭" onClick={() => setShowAdd(false)} />
            <section className="sheet-card add-card">
              <span className="sheet-handle" />
              <h2>添加物品</h2><p>选择它属于下面哪个固定分类。</p>
              <div className="category-picker">{categories.map((category) => <button className={addCategory === category.name ? "active" : ""} key={category.name} onClick={() => setAddCategory(category.name)}>{category.name}</button>)}</div>
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
        <div className="principle"><span>01</span><p><b>七个固定分类</b><br />不再区分公用或个人，只看谁负责带</p></div>
        <div className="principle"><span>02</span><p><b>AI 补充有理由</b><br />说明来自目的地特点还是热门玩法</p></div>
        <div className="principle"><span>03</span><p><b>不做旅游攻略</b><br />只回答“这次出发需要带什么”</p></div>
        <div className="demo-note">试试：认领“充电线”，再进入出发核对。</div>
      </aside>
    </main>
  );
}
