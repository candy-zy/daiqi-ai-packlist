"use client";

import { useMemo, useState } from "react";

type Member = "我" | "阿哲" | "小雨";
type Author = Member | "AI";
type Phase = "discuss" | "verify";
type CategoryId = "disposable" | "skincare" | "life" | "makeup" | "other" | "perfume" | "essential" | "clothes";
type Scope = "共享" | "各自";

type Note = { id: number; author: Author; text: string };
type PackItem = {
  id: number;
  name: string;
  category: CategoryId;
  scope: Scope;
  notes: Note[];
  owner?: Member;
  checkedBy: Partial<Record<Member, boolean>>;
  aiReason?: string;
};

const members: { name: Member; short: string; color: string }[] = [
  { name: "我", short: "我", color: "member-me" },
  { name: "阿哲", short: "哲", color: "member-zhe" },
  { name: "小雨", short: "雨", color: "member-yu" },
];

const categories: { id: CategoryId; name: string; tone: string }[] = [
  { id: "disposable", name: "一次性用品", tone: "coral" },
  { id: "skincare", name: "护肤品", tone: "amber" },
  { id: "life", name: "生活用品", tone: "green" },
  { id: "makeup", name: "化妆品", tone: "blue" },
  { id: "other", name: "其他用品", tone: "purple" },
  { id: "perfume", name: "香水", tone: "pink" },
  { id: "essential", name: "必需品", tone: "charcoal" },
  { id: "clothes", name: "服饰类", tone: "cyan" },
];

const itemGroups: Record<CategoryId, string[]> = {
  disposable: ["内裤", "袜子", "马桶垫", "浴巾", "消毒湿巾", "小包纸巾？"],
  skincare: ["水", "乳", "喷雾", "精华"],
  life: ["卫生巾", "洗面奶", "卫生纸", "洗脸巾", "化妆棉", "卸妆", "防晒", "牙膏牙刷", "拖鞋", "药", "梳子", "伞", "洗发水", "护发素", "护发精油"],
  makeup: ["气垫", "粉底液", "眼线胶笔", "修容", "化妆刷", "眼线膏", "睫毛夹", "眼影盘", "妆前乳", "贴贴霜", "眉笔", "染眉膏", "口红", "唇线笔", "遮瑕", "美瞳", "面膜", "睫毛胶水", "假睫毛", "腮红", "散粉", "高光", "双眼皮贴"],
  other: ["拍立得", "拍立得相纸", "冰凉贴", "清凉喷雾", "小卡？这个可带可不带吧"],
  perfume: ["香水小样"],
  essential: ["充电线", "充电宝", "应援棒", "应援棒电池", "娃娃", "大王扇", "身份证", "交通卡", "手机（虽然但是我还是写上吧）"],
  clothes: ["连衣裙", "裤子", "半身裙", "上衣短袖", "项链", "耳夹", "发箍", "头巾", "外套", "睡衣", "墨镜？", "帽子"],
};

const notesByItem: Record<string, [Author, string][]> = {
  内裤: [["我", "7"], ["小雨", "7"]],
  袜子: [["我", "4"], ["小雨", "7"]],
  马桶垫: [["小雨", "1"]],
  浴巾: [["小雨", "6？"]],
  水: [["小雨", "1"]],
  乳: [["小雨", "1"]],
  喷雾: [["我", "1（雅漾的其实是纯水）"], ["小雨", "fixx定妆的"]],
  精华: [["小雨", "我没带"]],
  洗面奶: [["我", "我带了小样，你们不用带了"], ["小雨", "ok 那我不带了"]],
  卫生纸: [["小雨", "1抽"]],
  洗脸巾: [["我", "那我用你们的"], ["小雨", "半包"]],
  化妆棉: [["我", "1"], ["小雨", "我没有"]],
  卸妆: [["我", "我带了卸妆水小样和垃圾袋一包"], ["小雨", "我没有卸妆的，只有大瓶的"]],
  防晒: [["我", "一个固体防晒棒"], ["小雨", "你之前买的卸妆湿巾用完了😭 没事凑合用我们的"]],
  牙膏牙刷: [["我", "1"], ["小雨", "我带了牙膏"]],
  拖鞋: [["我", "我准备穿洞洞鞋"], ["小雨", "洞洞鞋 +1"]],
  药: [["我", "不带，勇闯天涯"], ["小雨", "我带了布洛芬"]],
  梳子: [["我", "1"]],
  伞: [["我", "能不带吗。那不带了"]],
  护发精油: [["小雨", "1"]],
  粉底液: [["我", "1"], ["小雨", "1"]],
  修容: [["我", "2"], ["小雨", "1"]],
  化妆刷: [["我", "n"], ["小雨", "n"]],
  眼线膏: [["我", "1"]],
  染眉膏: [["我", "2"]],
  口红: [["我", "3+"], ["小雨", "2"]],
  "小卡？这个可带可不带吧": [["我", "这个可带可不带吧"]],
  香水小样: [["我", "我准备带一个小样，喷完就扔"]],
  "手机（虽然但是我还是写上吧）": [["我", "虽然但是我还是写上吧"]],
};

const sharedItems = new Set(["马桶垫", "消毒湿巾", "小包纸巾？", "喷雾", "洗面奶", "卫生纸", "洗脸巾", "卸妆", "防晒", "牙膏牙刷", "药", "伞", "洗发水", "护发素", "护发精油", "拍立得", "拍立得相纸", "冰凉贴", "清凉喷雾", "香水小样", "充电宝", "应援棒电池", "大王扇"]);

let itemSequence = 1;
const seedItems: PackItem[] = categories.flatMap((category) =>
  itemGroups[category.id].map((name) => ({
    id: itemSequence++,
    name,
    category: category.id,
    scope: sharedItems.has(name) ? "共享" as const : "各自" as const,
    notes: (notesByItem[name] ?? []).map(([author, text], index) => ({ id: itemSequence * 100 + index, author, text })),
    checkedBy: {},
  })),
);

const aiItems: PackItem[] = [
  { id: 9001, name: "蓝色围巾", category: "clothes", scope: "各自", notes: [{ id: 9101, author: "AI", text: "北海道雪地留白多，蓝色围巾更出片。" }], checkedBy: {}, aiReason: "热门出片" },
  { id: 9002, name: "防滑鞋套", category: "life", scope: "各自", notes: [{ id: 9102, author: "AI", text: "冬季路面可能结冰，建议放进随身包。" }], checkedBy: {}, aiReason: "目的地特点" },
  { id: 9003, name: "暖宝宝", category: "life", scope: "共享", notes: [{ id: 9103, author: "AI", text: "一人带整包，同行人按需分用。" }], checkedBy: {}, aiReason: "避免重复" },
];

const defaultOpenId = seedItems.find((item) => item.name === "防晒")?.id ?? 1;

export default function Home() {
  const [items, setItems] = useState(seedItems);
  const [phase, setPhase] = useState<Phase>("discuss");
  const [currentMember, setCurrentMember] = useState<Member>("我");
  const [filter, setFilter] = useState<"all" | CategoryId>("all");
  const [openId, setOpenId] = useState<number | null>(defaultOpenId);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [aiAdded, setAiAdded] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newItem, setNewItem] = useState("");
  const [newCategory, setNewCategory] = useState<CategoryId>("life");
  const [newScope, setNewScope] = useState<Scope>("共享");
  const [toast, setToast] = useState("");

  const visibleCategories = useMemo(() => categories.filter((category) => filter === "all" || filter === category.id), [filter]);
  const noteCount = items.reduce((sum, item) => sum + item.notes.length, 0);
  const checkedCount = items.filter((item) => item.checkedBy[currentMember]).length;

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 1700);
  }

  function sendNote(itemId: number, quickText?: string) {
    const text = (quickText ?? drafts[itemId] ?? "").trim();
    if (!text) return;
    setItems((current) => current.map((item) => item.id === itemId ? {
      ...item,
      owner: /(我来带|我带|交给我)/.test(text) ? currentMember : item.owner,
      notes: [...item.notes, { id: Date.now(), author: currentMember, text }],
    } : item));
    setDrafts((current) => ({ ...current, [itemId]: "" }));
    notify("已写在这件物品下面");
  }

  function toggleChecked(itemId: number) {
    setItems((current) => current.map((item) => item.id === itemId ? {
      ...item,
      checkedBy: { ...item.checkedBy, [currentMember]: !item.checkedBy[currentMember] },
    } : item));
  }

  function addAiItems() {
    if (aiAdded) return;
    setItems((current) => [...current, ...aiItems]);
    setAiAdded(true);
    setFilter("clothes");
    setOpenId(9001);
    notify("AI 建议已放进对应分类");
  }

  function addCustomItem() {
    const name = newItem.trim();
    if (!name) return;
    const id = Date.now();
    setItems((current) => [...current, { id, name, category: newCategory, scope: newScope, notes: [], checkedBy: {} }]);
    setFilter(newCategory);
    setOpenId(id);
    setNewItem("");
    setShowAdd(false);
    notify(`已加入${categories.find((category) => category.id === newCategory)?.name}`);
  }

  function renderItem(item: PackItem) {
    const expanded = openId === item.id;
    const preview = item.notes.at(-1);
    const checked = Boolean(item.checkedBy[currentMember]);

    return (
      <article className={`item-row ${expanded ? "expanded" : ""} ${checked ? "checked" : ""}`} key={item.id}>
        <button className="row-main" onClick={() => setOpenId(expanded ? null : item.id)} aria-expanded={expanded}>
          {phase === "verify" && (
            <span className={`row-check ${checked ? "done" : ""}`} onClick={(event) => { event.stopPropagation(); toggleChecked(item.id); }}>{checked ? "✓" : ""}</span>
          )}
          <span className="item-name">
            <b>{item.name}</b>
            <span className={`scope-tag ${item.scope === "共享" ? "shared" : "private"}`}>{item.scope}</span>
            {item.aiReason && <span className="ai-tag">✦ {item.aiReason}</span>}
          </span>
          <span className="note-preview">
            {preview ? <><i className={preview.author === "AI" ? "ai-avatar" : members.find((member) => member.name === preview.author)?.color}>{preview.author === "AI" ? "AI" : members.find((member) => member.name === preview.author)?.short}</i><em>{preview.text}</em></> : <em className="empty-note">还没人写，点开说一句</em>}
          </span>
          {item.notes.length > 0 && <span className="note-count">{item.notes.length}</span>}
          <span className="row-arrow">{expanded ? "⌃" : "⌄"}</span>
        </button>

        {expanded && (
          <div className="inline-thread">
            <div className="thread-label"><span>这一行的讨论</span><small>{item.scope === "共享" ? "谁带、带多少、用谁的，都写这里" : "每个人写自己的数量或备注"}</small></div>
            {item.notes.length ? <div className="note-stack">
              {item.notes.map((note) => {
                const member = members.find((entry) => entry.name === note.author);
                return <div className="note-line" key={note.id}>
                  <span className={`note-avatar ${note.author === "AI" ? "ai-avatar" : member?.color}`}>{note.author === "AI" ? "AI" : member?.short}</span>
                  <div><small>{note.author}</small><p>{note.text}</p></div>
                </div>;
              })}
            </div> : <p className="thread-empty">暂时没人写。你可以先说数量，也可以直接认领。</p>}

            {phase === "discuss" ? <>
              <div className="quick-replies">
                <button onClick={() => sendNote(item.id, "我来带")}>＋ 我来带</button>
                <button onClick={() => sendNote(item.id, "我不带，用你们的")}>我不带</button>
                <button onClick={() => setDrafts((current) => ({ ...current, [item.id]: "我带 1 个" }))}>写数量</button>
              </div>
              <div className="row-composer">
                <span className={members.find((member) => member.name === currentMember)?.color}>{members.find((member) => member.name === currentMember)?.short}</span>
                <input value={drafts[item.id] ?? ""} onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: event.target.value }))} onKeyDown={(event) => event.key === "Enter" && sendNote(item.id)} placeholder={`在「${item.name}」这一行写…`} />
                <button onClick={() => sendNote(item.id)}>↑</button>
              </div>
            </> : <button className={`verify-item-button ${checked ? "done" : ""}`} onClick={() => toggleChecked(item.id)}>{checked ? "✓ 已放进行李" : `确认${currentMember}已经带上`}</button>}
          </div>
        )}
      </article>
    );
  }

  return (
    <main className="app-shell">
      <section className="phone-frame" aria-label="带齐共享旅行清单原型">
        <header className="topbar">
          <div className="brand-mark" aria-hidden="true"><span></span><span></span><span></span></div>
          <strong>带齐</strong>
          <button className="trip-chip">小韩之旅 · 北海道⌄</button>
          <button className="more-button" aria-label="更多">•••</button>
        </header>

        <div className="scroll-area">
          <section className="hero">
            <div><p>2月12日出发 · 5天 · 3人</p><h1>{phase === "discuss" ? "一起把行李说清楚" : "出发前，再过一遍"}</h1></div>
            <div className="member-switch" aria-label="切换正在操作的成员">
              {members.map((member) => <button key={member.name} className={`${member.color} ${currentMember === member.name ? "active" : ""}`} onClick={() => setCurrentMember(member.name)} title={`切换为${member.name}`}>{member.short}</button>)}
            </div>
          </section>

          <div className="phase-tabs">
            <button className={phase === "discuss" ? "active" : ""} onClick={() => setPhase("discuss")}><span>1</span>准备沟通</button>
            <button className={phase === "verify" ? "active" : ""} onClick={() => setPhase("verify")}><span>2</span>出发核对</button>
          </div>

          <section className="sheet-summary">
            <div><span>{items.length}</span><small>物品</small></div>
            <div><span>{noteCount}</span><small>行内留言</small></div>
            <p>{phase === "discuss" ? <>不必先分完。<b>想到什么，就写在对应物品那一行。</b></> : <><b>{currentMember}已确认 {checkedCount} 件。</b> 点圆框继续核对。</>}</p>
          </section>

          <section className="ai-strip">
            <span className="ai-spark">✦</span>
            <div><b>AI 根据北海道补了 3 项</b><small>蓝色围巾 · 防滑鞋套 · 暖宝宝</small></div>
            <button onClick={addAiItems} disabled={aiAdded}>{aiAdded ? "已加入" : "加入3项"}</button>
          </section>

          <nav className="category-tabs" aria-label="物品分类">
            <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>全部</button>
            {categories.map((category) => <button key={category.id} className={`${category.tone} ${filter === category.id ? "active" : ""}`} onClick={() => setFilter(category.id)}>{category.name}</button>)}
          </nav>

          <div className="category-list">
            {visibleCategories.map((category) => {
              const categoryItems = items.filter((item) => item.category === category.id);
              if (!categoryItems.length) return null;
              const discussionCount = categoryItems.filter((item) => item.notes.length).length;
              return <section className={`category-block tone-${category.tone}`} key={category.id}>
                <header>
                  <span className="category-color"></span>
                  <h2>{category.name}</h2>
                  <small>{discussionCount}/{categoryItems.length} 行有内容</small>
                </header>
                <div className="rows">{categoryItems.map(renderItem)}</div>
              </section>;
            })}
          </div>
        </div>

        <footer className="action-bar">
          <button className="add-button" onClick={() => setShowAdd(true)}>＋</button>
          <button className={`primary-action ${phase === "verify" ? "verify" : ""}`} onClick={() => setPhase(phase === "discuss" ? "verify" : "discuss")}>
            {phase === "discuss" ? <><span>进入出发前核对</span><b>→</b></> : <><span>{currentMember}已确认 {checkedCount}/{items.length}</span><b>回到讨论</b></>}
          </button>
        </footer>

        {showAdd && <div className="bottom-sheet">
          <button className="sheet-backdrop" onClick={() => setShowAdd(false)} aria-label="关闭"></button>
          <section className="sheet-card">
            <span className="sheet-handle"></span>
            <p className="sheet-kicker">新增一行</p>
            <h2>把物品放进对应分类</h2>
            <input autoFocus value={newItem} onChange={(event) => setNewItem(event.target.value)} placeholder="例如：隐形眼镜护理液" />
            <div className="form-label">分类</div>
            <div className="sheet-categories">{categories.map((category) => <button key={category.id} className={newCategory === category.id ? "active" : ""} onClick={() => setNewCategory(category.id)}>{category.name}</button>)}</div>
            <div className="scope-picker">
              <button className={newScope === "共享" ? "active" : ""} onClick={() => setNewScope("共享")}><b>共享物品</b><small>一个人带，大家用</small></button>
              <button className={newScope === "各自" ? "active" : ""} onClick={() => setNewScope("各自")}><b>各自物品</b><small>每个人分别准备</small></button>
            </div>
            <button className="sheet-submit" onClick={addCustomItem}>加入清单</button>
          </section>
        </div>}

        {toast && <div className="toast">{toast}</div>}
      </section>

      <aside className="prototype-note">
        <p className="version">PROTOTYPE 05 · ROW THREAD</p>
        <h2>像共享表格，<br />但更适合手机。</h2>
        <p>保留共享表格最有用的部分：物品是一行，所有人的话都落在这一行。分类负责定位，讨论负责把事情说清楚。</p>
        <div className="principle"><span>01</span><p><b>一件物品，一条讨论线</b><br />不用在群聊里翻找上下文</p></div>
        <div className="principle"><span>02</span><p><b>可以先聊，不必全部认领</b><br />数量、替代品、用谁的都能写</p></div>
        <div className="principle"><span>03</span><p><b>AI 建议也回到清单里</b><br />不另起一个攻略信息流</p></div>
        <div className="try-card">试试看：点开「防晒」，切换右上角头像，直接在这一行留言。</div>
      </aside>
    </main>
  );
}
