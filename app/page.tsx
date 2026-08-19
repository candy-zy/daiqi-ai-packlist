"use client";

import { useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  Menu, Trash2, Wifi,
} from "lucide-react";

type Member = "我" | "阿哲" | "小雨";
type Phase = "prepare" | "verify" | "departed";
type ListFilter = "all" | "mine" | "unassigned";
type Category = "证件与钱财类" | "电子数码类" | "衣物鞋帽类" | "洗护化妆类" | "医药健康类" | "日用杂物类" | "零食饮料类";

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

const members: { name: Member; short: string; profile: string; className: string; online: boolean }[] = [
  { name: "我", short: "我", profile: "有充电宝", className: "member-me", online: true },
  { name: "阿哲", short: "哲", profile: "有相机", className: "member-zhe", online: true },
  { name: "小雨", short: "雨", profile: "有水杯", className: "member-yu", online: false },
];

const categories: { name: Category; icon: string }[] = [
  { name: "证件与钱财类", icon: "💳" },
  { name: "电子数码类", icon: "🔌" },
  { name: "衣物鞋帽类", icon: "👕" },
  { name: "洗护化妆类", icon: "🧴" },
  { name: "医药健康类", icon: "💊" },
  { name: "日用杂物类", icon: "☂️" },
  { name: "零食饮料类", icon: "🍪" },
];

const personalCategories: Category[] = ["证件与钱财类", "衣物鞋帽类"];
const personalItemNames = new Set(["牙刷", "毛巾", "流量卡"]);

const itemIcons: Record<string, string> = {
  "身份证": "🪪", "护照 / 签证": "📘", "银行卡": "💳", "现金": "💵", "驾驶证": "🪪",
  "充电器": "🔌", "充电宝": "🔋", "数据线": "🔗", "耳机": "🎧", "转换插头": "🔌",
  "相机": "📷", "自拍杆": "🤳", "SD 卡": "💾",
  "上衣": "👕", "裤子": "👖", "外套": "🧥", "内衣": "🩲", "袜子": "🧦", "睡衣": "🛌",
  "拖鞋": "🩴", "鞋子": "👟", "墨镜": "🕶️", "帽子": "🧢",
  "牙刷": "🪥", "牙膏": "🧴", "毛巾": "🧺", "洗面奶": "🫧", "卸妆油": "🧴",
  "防晒霜": "🌞", "洗发水": "🧴", "沐浴露": "🧼", "水乳": "💧", "面霜": "🫙", "面膜": "🎭",
  "皮筋": "🎀", "个人慢性病药物": "💊", "驱蚊液": "🦟", "晕车药": "💊", "过敏药": "💊",
  "雨伞": "☂️", "纸巾": "🧻", "湿巾": "🧻", "水杯": "🥤", "口罩": "😷", "耳塞": "🎧",
  "一次性马桶垫": "🚽", "零食": "🍪", "饮料": "🧃", "T-money 交通卡": "🚇", "流量卡": "📶",
};

const categoryIcons: Record<Category, string> = {
  "证件与钱财类": "💳",
  "电子数码类": "🔌",
  "衣物鞋帽类": "👕",
  "洗护化妆类": "🧴",
  "医药健康类": "💊",
  "日用杂物类": "☂️",
  "零食饮料类": "🍪",
};

const avatarVariant: Record<Member, string> = { "我": "avatar-me", "阿哲": "avatar-zhe", "小雨": "avatar-yu" };

function CharacterAvatar({ member, className = "" }: { member: Member; className?: string }) {
  return <span className={`character-avatar ${avatarVariant[member]} ${className}`} aria-hidden="true" />;
}

function ItemGraphic({ item }: { item: Pick<PackItem, "name" | "group"> }) {
  return <span className="item-sticker-emoji" aria-hidden="true">{itemIcons[item.name] ?? categoryIcons[item.group] ?? "🎒"}</span>;
}

function CategoryGraphic({ category }: { category: Category }) {
  return <span className="category-sticker-emoji" aria-hidden="true">{categoryIcons[category]}</span>;
}

function isPersonalItem(item: PackItem) {
  return personalCategories.includes(item.group) || personalItemNames.has(item.name);
}

const seedItems: PackItem[] = [
  { id: 1, name: "身份证", icon: "▣", group: "证件与钱财类", owners: ["我", "阿哲", "小雨"], checked: {} },
  { id: 2, name: "护照 / 签证", icon: "▦", group: "证件与钱财类", owners: ["我", "阿哲", "小雨"], checked: {} },
  { id: 3, name: "银行卡", icon: "▰", group: "证件与钱财类", owners: [], checked: {} },
  { id: 4, name: "现金", icon: "¥", group: "证件与钱财类", owners: [], checked: {} },
  { id: 5, name: "驾驶证", icon: "□", group: "证件与钱财类", owners: [], checked: {} },

  { id: 7, name: "充电器", icon: "▰", group: "电子数码类", owners: [], checked: {} },
  { id: 8, name: "充电宝", icon: "▮", group: "电子数码类", owners: ["我"], checked: {}, aiReason: "你登记了大容量充电宝" },
  { id: 9, name: "数据线", icon: "⌁", group: "电子数码类", owners: [], checked: {} },
  { id: 10, name: "耳机", icon: "◉", group: "电子数码类", owners: ["小雨"], checked: {} },
  { id: 11, name: "转换插头", icon: "⌁", group: "电子数码类", owners: [], checked: {} },
  { id: 12, name: "相机", icon: "📷", group: "电子数码类", owners: ["阿哲"], checked: {}, aiReason: "阿哲登记了相机" },
  { id: 13, name: "自拍杆", icon: "│", group: "电子数码类", owners: [], checked: {} },
  { id: 14, name: "SD 卡", icon: "▮", group: "电子数码类", owners: [], checked: {} },

  { id: 15, name: "上衣", icon: "◫", group: "衣物鞋帽类", owners: [], checked: {} },
  { id: 16, name: "裤子", icon: "▥", group: "衣物鞋帽类", owners: [], checked: {} },
  { id: 17, name: "外套", icon: "♨", group: "衣物鞋帽类", owners: ["我"], checked: {} },
  { id: 18, name: "内衣", icon: "▤", group: "衣物鞋帽类", owners: [], checked: {} },
  { id: 19, name: "袜子", icon: "▤", group: "衣物鞋帽类", owners: [], checked: {} },
  { id: 20, name: "睡衣", icon: "○", group: "衣物鞋帽类", owners: [], checked: {} },
  { id: 21, name: "拖鞋", icon: "◇", group: "衣物鞋帽类", owners: [], checked: {} },
  { id: 22, name: "鞋子", icon: "◇", group: "衣物鞋帽类", owners: [], checked: {} },
  { id: 23, name: "墨镜", icon: "●", group: "衣物鞋帽类", owners: [], checked: {} },
  { id: 24, name: "帽子", icon: "▰", group: "衣物鞋帽类", owners: ["小雨"], checked: {} },

  { id: 25, name: "牙刷", icon: "⌁", group: "洗护化妆类", owners: [], checked: {} },
  { id: 26, name: "牙膏", icon: "▮", group: "洗护化妆类", owners: [], checked: {} },
  { id: 27, name: "毛巾", icon: "▤", group: "洗护化妆类", owners: [], checked: {} },
  { id: 28, name: "洗面奶", icon: "◉", group: "洗护化妆类", owners: ["我"], checked: {} },
  { id: 29, name: "卸妆油", icon: "◉", group: "洗护化妆类", owners: [], checked: {} },
  { id: 30, name: "防晒霜", icon: "☀", group: "洗护化妆类", owners: [], checked: {} },
  { id: 31, name: "洗发水", icon: "◉", group: "洗护化妆类", owners: [], checked: {} },
  { id: 32, name: "沐浴露", icon: "◉", group: "洗护化妆类", owners: [], checked: {} },
  { id: 33, name: "水乳", icon: "○", group: "洗护化妆类", owners: ["小雨"], checked: {} },
  { id: 34, name: "面霜", icon: "○", group: "洗护化妆类", owners: [], checked: {} },
  { id: 35, name: "面膜", icon: "□", group: "洗护化妆类", owners: [], checked: {} },
  { id: 36, name: "皮筋", icon: "⌇", group: "洗护化妆类", owners: [], checked: {} },

  { id: 37, name: "个人慢性病药物", icon: "✚", group: "医药健康类", owners: [], checked: {} },
  { id: 38, name: "驱蚊液", icon: "◉", group: "医药健康类", owners: [], checked: {} },
  { id: 39, name: "晕车药", icon: "✚", group: "医药健康类", owners: ["阿哲"], checked: {} },
  { id: 40, name: "过敏药", icon: "✚", group: "医药健康类", owners: [], checked: {} },

  { id: 41, name: "雨伞", icon: "☂", group: "日用杂物类", owners: [], checked: {} },
  { id: 42, name: "纸巾", icon: "▤", group: "日用杂物类", owners: ["小雨"], checked: {} },
  { id: 43, name: "湿巾", icon: "▥", group: "日用杂物类", owners: [], checked: {} },
  { id: 44, name: "水杯", icon: "◉", group: "日用杂物类", owners: [], checked: {} },
  { id: 45, name: "口罩", icon: "▥", group: "日用杂物类", owners: [], checked: {} },
  { id: 46, name: "耳塞", icon: "○", group: "日用杂物类", owners: [], checked: {} },
  { id: 49, name: "一次性马桶垫", icon: "▤", group: "日用杂物类", owners: [], checked: {} },

  { id: 47, name: "零食", icon: "●", group: "零食饮料类", owners: [], checked: {} },
  { id: 48, name: "饮料", icon: "◉", group: "零食饮料类", owners: [], checked: {} },
];

const seedSuggestions: Suggestion[] = [
  { id: 101, name: "T-money 交通卡", icon: "▣", group: "证件与钱财类", reason: "首尔公交、地铁和便利店都能使用，落地后出行会顺手很多。", signal: "交通必备", added: false },
  { id: 102, name: "流量卡", icon: "⌁", group: "电子数码类", reason: "提前准备韩国流量卡，落地即可查地图、联系朋友和叫车。", signal: "容易漏带", added: false },
];

const seedMessages: ChatMessage[] = [
  { id: 1, author: "我", text: "自拍杆谁能带？首尔街拍和合照可能会用。" },
  { id: 2, author: "阿哲", text: "我带相机，箱子空间可能不太够。" },
  { id: 3, author: "小雨", text: "流量卡要不要提前一起买？" },
];

const seedItemMessages: Record<number, ChatMessage[]> = {
  11: [{ id: 1101, author: "阿哲", text: "韩国插座和国内一样吗？这个还要不要带？" }],
  13: [
    { id: 1301, author: "我", text: "自拍杆谁能带？首尔街拍和合照可能会用。" },
    { id: 1302, author: "小雨", text: "我那个太短了，看看阿哲有没有长一点的。" },
  ],
  41: [{ id: 4101, author: "小雨", text: "天气预报有雨，要不要带两把伞？" }],
};

export default function Home() {
  const [teamReady, setTeamReady] = useState(false);
  const [teamName, setTeamName] = useState("首尔逛拍小队");
  const [destination, setDestination] = useState("韩国 · 首尔");
  const [items, setItems] = useState(seedItems);
  const [suggestions, setSuggestions] = useState(seedSuggestions);
  const [suggestionStatus, setSuggestionStatus] = useState<"idle" | "loading" | "model" | "fallback">("idle");
  const [phase, setPhase] = useState<Phase>("prepare");
  const [editMode, setEditMode] = useState(false);
  const [listFilter, setListFilter] = useState<ListFilter>("all");
  const [viewedMember, setViewedMember] = useState<Member>("我");
  const [showChat, setShowChat] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [addCategory, setAddCategory] = useState<Category>("日用杂物类");
  const [newItem, setNewItem] = useState("");
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>(seedMessages);
  const [itemMessages, setItemMessages] = useState<Record<number, ChatMessage[]>>(seedItemMessages);
  const [activeItemId, setActiveItemId] = useState<number | null>(null);
  const [itemDraft, setItemDraft] = useState("");
  const [unreadItemIds, setUnreadItemIds] = useState<Set<number>>(() => new Set([11, 13, 41]));
  const [draggingItemId, setDraggingItemId] = useState<number | null>(null);
  const [toast, setToast] = useState("");
  const listStartRef = useRef<HTMLElement>(null);
  const draggingItemRef = useRef<number | null>(null);

  const unassignedItems = items.filter((item) => !isPersonalItem(item) && item.owners.length === 0);
  const unassigned = unassignedItems.length;
  const teamItems = items.filter((item) => !isPersonalItem(item));
  const assignedTeamItems = teamItems.filter((item) => item.owners.length > 0);
  const assignmentProgress = teamItems.length ? Math.round((assignedTeamItems.length / teamItems.length) * 100) : 100;
  const myItems = items.filter((item) => isPersonalItem(item) || item.owners.includes("我"));
  const verifyItems = items.filter((item) => isPersonalItem(item) || item.owners.includes(viewedMember));
  const prepareItems = listFilter === "mine"
    ? myItems
    : listFilter === "unassigned"
      ? unassignedItems
      : items;
  const teamPrepareItems = prepareItems.filter((item) => !isPersonalItem(item));
  const personalPrepareItems = prepareItems.filter(isPersonalItem);
  const filterCopy = listFilter === "mine"
    ? { title: "我的物品", note: "个人自备＋我已认领的团队物品" }
    : listFilter === "unassigned"
      ? { title: "待分配物品", note: "还没有任何人负责携带" }
      : { title: "全部物品", note: "团队物品在前，个人物品在底部" };

  const status = useMemo(() => {
    const total = items.filter((item) => (isPersonalItem(item) || item.owners.includes(viewedMember)) && !item.checked[viewedMember]).length;
    return { total };
  }, [viewedMember, items]);
  const myRemaining = items.filter((item) => (isPersonalItem(item) || item.owners.includes("我")) && !item.checked["我"]).length;
  const destinationLabel = destination.trim().split(/[·,，]/).pop()?.trim() || "目的地";
  const activeItem = activeItemId === null ? null : items.find((item) => item.id === activeItemId) ?? null;

  async function createTeam() {
    if (!teamName.trim() || !destination.trim()) return;
    setTeamReady(true);
    setSuggestionStatus("loading");

    try {
      const response = await fetch("/api/suggestions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ destination: destination.trim(), existingItems: items.map((item) => item.name) }),
      });
      if (!response.ok) throw new Error("AI suggestions request failed");

      const result = await response.json() as { suggestions?: Omit<Suggestion, "id" | "icon" | "added">[]; source?: "model" | "fallback" };
      const existingNames = new Set(items.map((item) => item.name.trim().toLowerCase()));
      const uniqueSuggestions = (result.suggestions ?? [])
        .filter((item, index, all) => !existingNames.has(item.name.trim().toLowerCase()) && all.findIndex((candidate) => candidate.name.trim().toLowerCase() === item.name.trim().toLowerCase()) === index)
        .slice(0, 2)
        .map((item, index) => ({ ...item, id: 101 + index, icon: index === 0 ? "▣" : "⌁", added: false }));

      if (uniqueSuggestions.length === 2) setSuggestions(uniqueSuggestions);
      setSuggestionStatus(result.source === "model" ? "model" : "fallback");
    } catch {
      setSuggestions(seedSuggestions);
      setSuggestionStatus("fallback");
    }
  }

  if (!teamReady) {
    return (
      <main className="app-shell setup-shell">
        <section className="phone-frame setup-frame" aria-label="创建旅行队伍">
          <header className="topbar setup-topbar">
            <div className="brand-mark" aria-hidden="true"><span></span><span></span><span></span></div>
            <div className="brand-name">带齐</div>
            <span className="setup-step">创建队伍</span>
          </header>
          <div className="setup-content">
            <div className="setup-illustration"><CharacterAvatar member="我" /><CharacterAvatar member="阿哲" /><CharacterAvatar member="小雨" /><i>＋</i></div>
            <p className="eyebrow">先把朋友聚到一起</p>
            <h1>一起准备，<br />这次别漏带。</h1>
            <p className="setup-intro">创建旅行队伍并填写目的地，AI 会生成一份团队分工和个人准备都清楚的清单。</p>
            <label className="setup-field"><span>队伍名称</span><input value={teamName} onChange={(event) => setTeamName(event.target.value)} placeholder="例如：首尔逛拍小队" /></label>
            <label className="setup-field"><span>目的地</span><input value={destination} onChange={(event) => setDestination(event.target.value)} placeholder="例如：韩国 · 首尔" /></label>
            <div className="setup-members"><div><b>队伍成员</b><small>进入后可继续邀请朋友</small></div><div className="setup-member-dots"><CharacterAvatar member="我" /><CharacterAvatar member="阿哲" /><CharacterAvatar member="小雨" /></div></div>
            <button className="setup-submit" onClick={createTeam}>创建队伍并生成清单 <span>→</span></button>
          </div>
        </section>
      </main>
    );
  }

  if (phase === "departed") {
    return (
      <main className="app-shell departure-shell">
        <section className="phone-frame departure-frame" aria-label="旅行准备完成">
          <header className="topbar">
            <div className="brand-mark" aria-hidden="true"><span></span><span></span><span></span></div>
            <div className="brand-name">带齐</div>
            <span className="trip-chip">{destinationLabel} · 5天</span>
            <button className="departure-back" onClick={() => setPhase("verify")}>← 返回清单</button>
          </header>
          <section className="departure-page">
            <div className="departure-copy">
              <span className="departure-badge">✓ {myItems.length} 件全部确认</span>
              <p className="eyebrow">READY TO GO · {teamName}</p>
              <h1>东西带齐了，<br />出发！</h1>
              <p>{destinationLabel}在等你们。放心关上行李箱，带着朋友和好心情出门吧。</p>
            </div>
            <div className="departure-illustration">
              <div className="departure-character" role="img" aria-label="背着相机、拉着行李箱准备出发的女孩" />
            </div>
            <div className="departure-team-card">
              <div className="departure-avatars"><CharacterAvatar member="我" /><CharacterAvatar member="阿哲" /><CharacterAvatar member="小雨" /></div>
              <div><b>首尔逛拍小队已就绪</b><small>3 个人，行李都带齐</small></div>
              <span>GO!</span>
            </div>
          </section>
          <footer className="departure-footer"><button onClick={() => setPhase("verify")}>返回核对清单</button></footer>
        </section>
      </main>
    );
  }

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 1800);
  }

  function claim(id: number) {
    setItems((current) => current.map((item) => item.id === id && !isPersonalItem(item) && !item.owners.includes("我") ? { ...item, owners: [...item.owners, "我"] } : item));
  }

  function release(id: number) {
    setItems((current) => current.map((item) => item.id === id && !isPersonalItem(item) ? { ...item, owners: item.owners.filter((member) => member !== "我"), checked: { ...item.checked, "我": false } } : item));
  }

  function togglePacked(item: PackItem) {
    if (viewedMember !== "我" || (!isPersonalItem(item) && !item.owners.includes("我"))) return;
    setItems((current) => current.map((entry) => entry.id === item.id ? {
      ...entry,
      checked: { ...entry.checked, "我": !entry.checked["我"] },
    } : entry));
  }

  function selectAllPacked() {
    if (viewedMember !== "我") return;
    setItems((current) => current.map((item) => isPersonalItem(item) || item.owners.includes("我") ? {
      ...item,
      checked: { ...item.checked, "我": true },
    } : item));
    notify("我的待带物品已全部勾选");
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

  function removeItem(item: PackItem) {
    if (!editMode) return;
    setItems((current) => current.filter((entry) => entry.id !== item.id));
    setSuggestions((current) => current.map((suggestion) => suggestion.name === item.name ? { ...suggestion, added: false } : suggestion));
    setItemMessages((current) => {
      const next = { ...current };
      delete next[item.id];
      return next;
    });
    setUnreadItemIds((current) => {
      const next = new Set(current);
      next.delete(item.id);
      return next;
    });
  }

  function swapItems(id: number, targetId: number) {
    if (id === targetId) return;
    setItems((current) => {
      const next = [...current];
      const itemIndex = next.findIndex((item) => item.id === id);
      const targetIndex = next.findIndex((item) => item.id === targetId);
      if (itemIndex < 0 || targetIndex < 0) return current;
      [next[itemIndex], next[targetIndex]] = [next[targetIndex], next[itemIndex]];
      return next;
    });
  }

  function startDragging(event: ReactPointerEvent<HTMLButtonElement>, itemId: number) {
    if (!editMode || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    draggingItemRef.current = itemId;
    setDraggingItemId(itemId);
  }

  function dragItem(event: ReactPointerEvent<HTMLButtonElement>, itemId: number, visiblePeerIds: number[]) {
    if (draggingItemRef.current !== itemId) return;
    event.preventDefault();
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-sort-item-id]");
    const targetId = Number(target?.dataset.sortItemId);
    if (!Number.isFinite(targetId) || targetId === itemId || !visiblePeerIds.includes(targetId)) return;
    swapItems(itemId, targetId);
  }

  function finishDragging(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    draggingItemRef.current = null;
    setDraggingItemId(null);
  }

  function changeItemCategory(id: number, group: Category) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, group } : item));
  }

  function sendMessage() {
    const text = draft.trim();
    if (!text) return;
    const additions: ChatMessage[] = [{ id: Date.now(), author: "我", text }];
    const wantsToClaim = /(我来带|我带|我有|交给我|算我的)/.test(text);
    const matched = items.find((item) => !isPersonalItem(item) && !item.owners.includes("我") && (text.includes(item.name) || text.includes(item.name.slice(0, 2))));
    if (wantsToClaim && matched) {
      setItems((current) => current.map((item) => item.id === matched.id ? { ...item, owners: [...item.owners, "我"] } : item));
      additions.push({ id: Date.now() + 1, author: "带齐助手", text: `已同步：我会带${matched.name}`, system: true });
    }
    setMessages((current) => [...current, ...additions]);
    setDraft("");
  }

  function openItemChat(itemId: number) {
    if (editMode) return;
    setActiveItemId(itemId);
    setUnreadItemIds((current) => {
      const next = new Set(current);
      next.delete(itemId);
      return next;
    });
  }

  function sendItemMessage() {
    const text = itemDraft.trim();
    if (!text || !activeItem) return;
    const additions: ChatMessage[] = [{ id: Date.now(), author: "我", text }];
    if (!isPersonalItem(activeItem) && !activeItem.owners.includes("我") && /(我来带|我带|我有|交给我|算我的)/.test(text)) {
      claim(activeItem.id);
      additions.push({ id: Date.now() + 1, author: "带齐助手", text: `已同步：我会带${activeItem.name}`, system: true });
    }
    setItemMessages((current) => ({ ...current, [activeItem.id]: [...(current[activeItem.id] ?? []), ...additions] }));
    setItemDraft("");
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

  function focusUnassigned() {
    setListFilter("unassigned");
    window.requestAnimationFrame(() => listStartRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function renderItem(item: PackItem) {
    const personal = isPersonalItem(item);
    const ownerMembers = item.owners.map((owner) => members.find((member) => member.name === owner)).filter(Boolean);
    const currentWillBring = item.owners.includes("我");
    const packed = Boolean(item.checked[viewedMember]);
    const canCheck = viewedMember === "我" && (personal || currentWillBring);
    const visiblePeerIds = (personal ? personalPrepareItems : prepareItems.filter((entry) => entry.group === item.group)).map((entry) => entry.id);
    const peerPosition = visiblePeerIds.indexOf(item.id);
    const discussionCount = itemMessages[item.id]?.length ?? 0;
    const hasUnreadDiscussion = unreadItemIds.has(item.id);

    return (
      <article className={`list-item ${packed ? "packed" : ""} ${editMode && phase === "prepare" ? "editing" : ""} ${draggingItemId === item.id ? "dragging" : ""}`} data-sort-item-id={item.id} key={item.id}>
        {phase === "prepare" && editMode && <button
          className="drag-handle"
          onPointerDown={(event) => startDragging(event, item.id)}
          onPointerMove={(event) => dragItem(event, item.id, visiblePeerIds)}
          onPointerUp={finishDragging}
          onPointerCancel={finishDragging}
          onKeyDown={(event) => {
            if (event.key === "ArrowUp" && peerPosition > 0) { event.preventDefault(); swapItems(item.id, visiblePeerIds[peerPosition - 1]); }
            if (event.key === "ArrowDown" && peerPosition < visiblePeerIds.length - 1) { event.preventDefault(); swapItems(item.id, visiblePeerIds[peerPosition + 1]); }
          }}
          aria-label={`拖动调整${item.name}的顺序`}
          title="按住拖动排序"
        ><Menu aria-hidden="true" /></button>}
        {phase === "verify" ? (
          <button className={`pack-check ${packed ? "checked" : ""}`} onClick={() => togglePacked(item)} disabled={!canCheck} aria-label={`${packed ? "取消" : "确认"}${item.name}已装包`}>{packed ? "✓" : ""}</button>
        ) : <span className={`item-icon item-group-${categories.findIndex((category) => category.name === item.group)}`}><ItemGraphic item={item} /></span>}
        <button className="item-copy item-chat-trigger" onClick={() => openItemChat(item.id)} disabled={editMode} aria-label={`打开${item.name}的讨论`}>
          <span className="item-title-row"><b>{item.name}</b>{hasUnreadDiscussion && <i className="unread-dot" aria-label="有未读消息" />}</span>
          <small>{hasUnreadDiscussion ? "有新消息，点开聊聊" : discussionCount ? `${discussionCount} 条讨论` : "点击讨论"}</small>
        </button>
        {phase === "prepare" && !editMode && (personal ? <span className="personal-pill">每人自备</span> : item.owners.length ? (
            <div className="shared-owner-action">
              <div className="owner-avatars" aria-label={`${item.owners.join("、")}会带`}>
                {ownerMembers.slice(0, 3).map((owner) => <button className="owner-avatar" key={owner?.name} onClick={() => phase === "prepare" && owner?.name === "我" && release(item.id)} disabled={owner?.name !== "我"} title={owner?.name === "我" ? "取消我会带" : `${owner?.name}会带`}>{owner && <CharacterAvatar member={owner.name} />}</button>)}
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
        {phase === "prepare" && editMode && <div className="item-edit-panel">
          <label><span>分类</span><select value={item.group} onChange={(event) => changeItemCategory(item.id, event.target.value as Category)} aria-label={`修改${item.name}的分类`}>{categories.map((category) => <option key={category.name} value={category.name}>{category.name}</option>)}</select></label>
          <button className="edit-delete-button" onClick={() => removeItem(item)} aria-label={`删除${item.name}`}><Trash2 aria-hidden="true" /></button>
        </div>}
      </article>
    );
  }

  return (
    <main className="app-shell">
      <section className="phone-frame" aria-label="带齐旅行物品清单原型">
        <header className="topbar">
          <div className="brand-mark" aria-hidden="true"><span></span><span></span><span></span></div>
          <div className="brand-name">带齐</div>
          <span className="trip-chip">{destinationLabel} · 5天</span>
          <span className="topbar-presence"><i />2 人在线</span>
        </header>

        <div className="scroll-area">
          <section className="trip-hero">
            <div>
              <p className="eyebrow">{destination} · {teamName} · 3 人</p>
              <h1>{phase === "prepare" ? "这次，带什么？" : "出发前，逐件确认"}</h1>
            </div>
            <div className="presence-panel">
              <div className={`member-switch ${phase === "verify" ? "switchable" : ""}`} aria-label={phase === "verify" ? "切换查看成员清单" : "成员在线状态"}>
                {members.map((member) => phase === "verify" ? <button key={member.name} className={viewedMember === member.name ? "selected" : ""} onClick={() => setViewedMember(member.name)} title={`查看${member.name}的清单`}><CharacterAvatar member={member.name} /><i className={member.online ? "online" : "offline"} /></button> : <span className="member-presence" key={member.name} title={`${member.name}${member.online ? "在线" : "离线"}`}><CharacterAvatar member={member.name} /><i className={member.online ? "online" : "offline"} /></span>)}
              </div>
              <small>{phase === "verify" ? "点头像查看队友" : "正在一起编辑"}</small>
            </div>
          </section>

          <div className="phase-tabs" role="tablist" aria-label="准备阶段">
            <button className={phase === "prepare" ? "active" : ""} onClick={() => setPhase("prepare")}><span>1</span>准备清单</button>
            <button className={phase === "verify" ? "active" : ""} onClick={() => { setEditMode(false); setPhase("verify"); }}><span>2</span>出发核对</button>
          </div>

          {phase === "verify" && (
            <section className="verify-banner">
              <span>{status.total}</span><div><b>{viewedMember}还有 {status.total} 件没确认</b><small>{viewedMember === "我" ? `已确认 ${verifyItems.length - status.total}/${verifyItems.length} 件，只核对自己要带的` : "朋友的核对状态仅供查看，可以提醒但不能代勾"}</small></div>
            </section>
          )}

          {phase === "prepare" && <section className="assignment-overview">
            <div className="assignment-copy"><p className="eyebrow">团队分工</p><b>{assignedTeamItems.length}/{teamItems.length} 件已有同伴负责</b><small>{unassigned ? `还剩 ${unassigned} 件待认领，先把分工定下来` : "分工完成，可以进入出发核对"}</small></div>
            <button className="assignment-chat" onClick={() => setShowChat(true)}>讨论 <span>{messages.length}</span></button>
            <div className="assignment-progress" aria-label={`团队物品分工完成 ${assignmentProgress}%`}><i style={{ width: `${assignmentProgress}%` }} /></div>
            {unassigned > 0 && <button className="assignment-focus" onClick={focusUnassigned}>只看待分配 →</button>}
          </section>}

          {phase === "prepare" && <section className="ai-section">
            <header>
              <div className="ai-title"><span>{suggestionStatus === "loading" ? <Wifi aria-hidden="true" /> : "✦"}</span><h2>{suggestionStatus === "loading" ? "AI 正在检查清单有没有漏项" : "AI 帮你补充了 2 件容易漏带的物品"}</h2></div>
            </header>
            <div className={`suggestion-scroll ${suggestionStatus === "loading" ? "loading" : ""}`}>
              {suggestions.slice(0, 2).map((suggestion) => (
                <article className={`suggestion-card ${suggestion.added ? "added" : ""}`} key={suggestion.id}>
                  <div className="suggestion-main"><div className={`suggestion-icon suggestion-${suggestion.id}`}><ItemGraphic item={suggestion} /></div><h3>{suggestion.name}</h3></div>
                  <p title={suggestion.reason}>{suggestion.reason}</p>
                  <button onClick={() => addSuggestion(suggestion)} disabled={suggestion.added}>{suggestion.added ? "✓ 已加入" : "＋ 加入清单"}</button>
                </article>
              ))}
            </div>
          </section>}

          {phase === "prepare" && <nav className="list-filters" aria-label="筛选准备清单">
            <button className={listFilter === "all" ? "active" : ""} onClick={() => setListFilter("all")}>全部 <span>{items.length}</span></button>
            <button className={listFilter === "mine" ? "active" : ""} onClick={() => setListFilter("mine")}>我的 <span>{myItems.length}</span></button>
            <button className={listFilter === "unassigned" ? "active" : ""} onClick={() => setListFilter("unassigned")}>待分配 <span>{unassigned}</span></button>
          </nav>}

          {phase === "prepare" ? <section className="filtered-list-section" ref={listStartRef}>
            <header className="filtered-list-head"><div><h2>{filterCopy.title}</h2><p>{editMode ? "调整顺序、分类，或删除不需要的物品" : filterCopy.note}</p></div><div className="list-head-actions"><span>{prepareItems.length} 件</span><button className={editMode ? "active" : ""} onClick={() => setEditMode((current) => !current)}>{editMode ? "✓ 完成" : "✎ 编辑清单"}</button></div></header>
            {prepareItems.length ? <div className="category-sections">{categories.filter((category) => !personalCategories.includes(category.name)).map((category, index) => {
              const categoryItems = teamPrepareItems.filter((item) => item.group === category.name);
              if (!categoryItems.length) return null;
              return <section className="list-section category-section" key={category.name}>
                <header className="section-head">
                  <div><span className={`scope-icon category-icon category-${index}`}><CategoryGraphic category={category.name} /></span><div><h2>{category.name}</h2></div></div>
                  <span>{categoryItems.length} 件</span>
                </header>
                <div className="item-list">{categoryItems.map(renderItem)}</div>
              </section>;
            })}
              {personalPrepareItems.length > 0 && <section className="personal-zone">
                <header className="personal-zone-head">
                  <div><span><span className="category-sticker-emoji" aria-hidden="true">🎒</span></span><div><h2>个人自备物品</h2></div></div>
                  <small>队友可见</small>
                </header>
                <div className="item-list">{personalPrepareItems.map(renderItem)}</div>
              </section>}
            </div> : <div className="empty-list"><span>✓</span><b>这里已经清空了</b><small>暂时没有等待分配的物品</small></div>}
          </section> : <section className="list-section verify-list-section">
            <header className="section-head">
              <div><span className="scope-icon private-icon">✓</span><div><h2>{viewedMember === "我" ? "我的待带清单" : `${viewedMember}的待带清单`}</h2><p>{viewedMember === "我" ? "个人自备物品＋我认领的团队物品" : "仅查看队友进度，不能替他确认"}</p></div></div>
              <div className="verify-list-actions">
                <span>{verifyItems.length} 件</span>
                {viewedMember === "我" ? <button className="select-all-button" onClick={selectAllPacked} disabled={status.total === 0}>{status.total === 0 ? "✓ 已全选" : "✓ 一键全选"}</button> : <button className="remind-button" onClick={() => notify(`已提醒${viewedMember}尽快收拾`)}>提醒TA</button>}
              </div>
            </header>
            <div className="item-list">{verifyItems.map(renderItem)}</div>
          </section>}
        </div>

        <footer className="action-bar">
          {phase === "prepare" && <button className="add-item" onClick={() => setShowAdd(true)} aria-label="添加物品">＋</button>}
          {phase === "prepare" ? (
            <button className="primary-action" onClick={() => { setEditMode(false); setPhase("verify"); }}>进入出发核对 <span>→</span></button>
          ) : viewedMember !== "我" ? (
            <button className="primary-action" onClick={() => setViewedMember("我")}>返回我的核对清单 <span>→</span></button>
          ) : (
            <button className={`primary-action ${myRemaining === 0 ? "ready" : ""}`} onClick={() => myRemaining ? notify(`还有 ${myRemaining} 项需要处理`) : setPhase("departed")}>{myRemaining ? `继续核对 · 还有 ${myRemaining} 项` : "全部带齐 · 出发"}<span>{myRemaining ? "↑" : "→"}</span></button>
          )}
        </footer>

        {showChat && (
          <div className="bottom-sheet" role="dialog" aria-modal="true" aria-label="物品讨论">
            <button className="sheet-backdrop" aria-label="关闭" onClick={() => setShowChat(false)} />
            <section className="sheet-card chat-card">
              <span className="sheet-handle" />
              <header className="chat-header"><div><p className="eyebrow">{destinationLabel} · 3 人</p><h2>物品讨论</h2></div><button onClick={() => setShowChat(false)}>×</button></header>
              <div className="chat-context"><span>✦</span><p><b>对话会同步认领</b><small>试试发送“充电线我来带”。</small></p></div>
              <div className="chat-messages">
                {messages.map((message) => {
                  const meta = members.find((member) => member.name === message.author);
                  return <div className={`message-row ${message.author === "我" ? "mine" : ""} ${message.system ? "system" : ""}`} key={message.id}>{meta ? <CharacterAvatar member={meta.name} className="message-avatar" /> : <span className="message-avatar assistant-avatar">✦</span>}<div><small>{message.author}</small><p>{message.text}</p></div></div>;
                })}
              </div>
              {unassigned > 0 && <div className="chat-suggestions">{unassignedItems.map((item) => <button key={item.id} onClick={() => setDraft(`谁可以带${item.name}？`)}>问问：{item.name}</button>)}</div>}
              <div className="chat-composer"><input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => event.key === "Enter" && sendMessage()} placeholder="说点什么，或试试‘充电线我来带’…" /><button onClick={sendMessage}>↑</button></div>
            </section>
          </div>
        )}

        {activeItem && (
          <div className="bottom-sheet" role="dialog" aria-modal="true" aria-label={`${activeItem.name}讨论`}>
            <button className="sheet-backdrop" aria-label="关闭" onClick={() => setActiveItemId(null)} />
            <section className="sheet-card chat-card item-chat-card">
              <span className="sheet-handle" />
              <header className="chat-header"><div><p className="eyebrow">{activeItem.group}</p><h2>{activeItem.name}</h2></div><button onClick={() => setActiveItemId(null)}>×</button></header>
              <div className="chat-context"><span>↗</span><p><b>围绕这件物品聊</b><small>说“我来带”，认领状态会自动同步。</small></p></div>
              <div className="chat-messages">
                {(itemMessages[activeItem.id] ?? []).length ? (itemMessages[activeItem.id] ?? []).map((message) => {
                  const meta = members.find((member) => member.name === message.author);
                  return <div className={`message-row ${message.author === "我" ? "mine" : ""} ${message.system ? "system" : ""}`} key={message.id}>{meta ? <CharacterAvatar member={meta.name} className="message-avatar" /> : <span className="message-avatar assistant-avatar">✦</span>}<div><small>{message.author}</small><p>{message.text}</p></div></div>;
                }) : <div className="item-discussion-empty"><span>•••</span><b>还没有人讨论</b><small>发第一条消息，问问谁带这件物品。</small></div>}
              </div>
              <div className="chat-composer"><input value={itemDraft} onChange={(event) => setItemDraft(event.target.value)} onKeyDown={(event) => event.key === "Enter" && sendItemMessage()} placeholder={`聊聊${activeItem.name}…`} /><button onClick={sendItemMessage}>↑</button></div>
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
              <input value={newItem} onChange={(event) => setNewItem(event.target.value)} onKeyDown={(event) => event.key === "Enter" && addCustomItem()} placeholder="例如：自拍杆" />
              <button className="primary-action" onClick={addCustomItem}>加入清单</button>
            </section>
          </div>
        )}

        {toast && <div className="toast" role="status">{toast}</div>}
      </section>

    </main>
  );
}
