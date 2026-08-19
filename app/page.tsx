"use client";

import { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Backpack, BadgeCheck, Banknote, Bath, BatteryCharging, BookOpenCheck, Bug,
  Cable, Camera, Car, CircleDotDashed, Cookie, Cpu, CreditCard, CupSoda,
  Droplets, Ear, FileText, Footprints, Glasses, GlassWater, Headphones,
  HeartPulse, Layers3, MoonStar, Package, Paintbrush, Pill, Plug, ScanLine,
  ShieldCheck, Shirt, Sparkles, Sun, Toilet, TowelRack, Trash2,
  Umbrella, Unplug, Utensils, Wallet, Waves, Wifi,
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

const categories: { name: Category; icon: string; note: string }[] = [
  { name: "证件与钱财类", icon: "▣", note: "证件、票务、订单与支付" },
  { name: "电子数码类", icon: "⌁", note: "充电、存储与拍摄设备" },
  { name: "衣物鞋帽类", icon: "♨", note: "换洗衣物、鞋帽与配饰" },
  { name: "洗护化妆类", icon: "✦", note: "洗漱、护肤与化妆" },
  { name: "医药健康类", icon: "✚", note: "常用药物与健康防护" },
  { name: "日用杂物类", icon: "◇", note: "雨具、纸巾与舒适用品" },
  { name: "零食饮料类", icon: "◉", note: "路途补给与饮品" },
];

const personalCategories: Category[] = ["证件与钱财类", "衣物鞋帽类"];
const personalItemNames = new Set(["牙刷", "毛巾", "流量卡"]);

const itemIcons: Record<string, LucideIcon> = {
  "身份证": BadgeCheck, "护照 / 签证": BookOpenCheck, "银行卡": CreditCard, "现金": Banknote, "驾驶证": Car,
  "充电器": Plug, "充电宝": BatteryCharging, "数据线": Cable, "耳机": Headphones, "转换插头": Unplug,
  "相机": Camera, "自拍杆": ScanLine, "SD 卡": Cpu,
  "上衣": Shirt, "裤子": Layers3, "外套": Shirt, "内衣": ShieldCheck, "袜子": Footprints, "睡衣": MoonStar,
  "拖鞋": Footprints, "鞋子": Footprints, "墨镜": Glasses, "帽子": CircleDotDashed,
  "牙刷": Paintbrush, "牙膏": Droplets, "毛巾": TowelRack, "洗面奶": Droplets, "卸妆油": Droplets,
  "防晒霜": Sun, "洗发水": Waves, "沐浴露": Bath, "水乳": Droplets, "面霜": Sparkles, "面膜": ShieldCheck,
  "皮筋": CircleDotDashed, "个人慢性病药物": HeartPulse, "驱蚊液": Bug, "晕车药": Pill, "过敏药": Pill,
  "雨伞": Umbrella, "纸巾": FileText, "湿巾": FileText, "水杯": GlassWater, "口罩": ShieldCheck, "耳塞": Ear,
  "一次性马桶垫": Toilet, "零食": Cookie, "饮料": CupSoda, "T-money 交通卡": CreditCard, "流量卡": Cpu,
};

const categoryIcons: Record<Category, LucideIcon> = {
  "证件与钱财类": Wallet,
  "电子数码类": Cpu,
  "衣物鞋帽类": Shirt,
  "洗护化妆类": Sparkles,
  "医药健康类": HeartPulse,
  "日用杂物类": Backpack,
  "零食饮料类": Utensils,
};

const avatarVariant: Record<Member, string> = { "我": "avatar-me", "阿哲": "avatar-zhe", "小雨": "avatar-yu" };

function CharacterAvatar({ member, className = "" }: { member: Member; className?: string }) {
  return <span className={`character-avatar ${avatarVariant[member]} ${className}`} aria-hidden="true" />;
}

function ItemGraphic({ item }: { item: Pick<PackItem, "name" | "group"> }) {
  const Icon = itemIcons[item.name] ?? categoryIcons[item.group] ?? Package;
  return <Icon aria-hidden="true" strokeWidth={2.4} />;
}

function CategoryGraphic({ category }: { category: Category }) {
  const Icon = categoryIcons[category];
  return <Icon aria-hidden="true" strokeWidth={2.5} />;
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

export default function Home() {
  const [teamReady, setTeamReady] = useState(false);
  const [teamName, setTeamName] = useState("首尔逛拍小队");
  const [destination, setDestination] = useState("韩国 · 首尔");
  const [items, setItems] = useState(seedItems);
  const [suggestions, setSuggestions] = useState(seedSuggestions);
  const [suggestionStatus, setSuggestionStatus] = useState<"idle" | "loading" | "model" | "fallback">("idle");
  const [phase, setPhase] = useState<Phase>("prepare");
  const [listFilter, setListFilter] = useState<ListFilter>("all");
  const [currentMember, setCurrentMember] = useState<Member>("我");
  const [showChat, setShowChat] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [addCategory, setAddCategory] = useState<Category>("日用杂物类");
  const [newItem, setNewItem] = useState("");
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>(seedMessages);
  const [toast, setToast] = useState("");

  const unassignedItems = items.filter((item) => !isPersonalItem(item) && item.owners.length === 0);
  const unassigned = unassignedItems.length;
  const verifyItems = items.filter((item) => isPersonalItem(item) || item.owners.includes(currentMember));
  const prepareItems = listFilter === "mine"
    ? verifyItems
    : listFilter === "unassigned"
      ? unassignedItems
      : items;
  const teamPrepareItems = prepareItems.filter((item) => !isPersonalItem(item));
  const personalPrepareItems = prepareItems.filter(isPersonalItem);
  const filterCopy = listFilter === "mine"
    ? { title: currentMember === "我" ? "我的物品" : `${currentMember}的物品`, note: "个人自备＋已认领的团队物品" }
    : listFilter === "unassigned"
      ? { title: "待分配物品", note: "还没有任何人负责携带" }
      : { title: "全部物品", note: "团队物品在前，个人物品在底部" };

  const status = useMemo(() => {
    const total = items.filter((item) => (isPersonalItem(item) || item.owners.includes(currentMember)) && !item.checked[currentMember]).length;
    return { total };
  }, [currentMember, items]);
  const destinationLabel = destination.trim().split(/[·,，]/).pop()?.trim() || "目的地";

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
              <span className="departure-badge">✓ {verifyItems.length} 件全部确认</span>
              <p className="eyebrow">READY TO GO · {teamName}</p>
              <h1>东西带齐了，<br />出发！</h1>
              <p>{destinationLabel}在等你们。放心关上行李箱，带着朋友和好心情出门吧。</p>
            </div>
            <div className="departure-illustration">
              <div className="departure-character" role="img" aria-label="背着相机、拉着行李箱准备出发的女孩" />
              <span className="departure-route" aria-hidden="true">· · · ✦</span>
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
    setItems((current) => current.map((item) => item.id === id && !isPersonalItem(item) && !item.owners.includes(currentMember) ? { ...item, owners: [...item.owners, currentMember] } : item));
    notify(`${currentMember}会带这件物品`);
  }

  function release(id: number) {
    setItems((current) => current.map((item) => item.id === id && !isPersonalItem(item) ? { ...item, owners: item.owners.filter((member) => member !== currentMember), checked: { ...item.checked, [currentMember]: false } } : item));
    notify("已取消自己的携带状态");
  }

  function togglePacked(item: PackItem) {
    if (!isPersonalItem(item) && !item.owners.includes(currentMember)) return;
    setItems((current) => current.map((entry) => entry.id === item.id ? {
      ...entry,
      checked: { ...entry.checked, [currentMember]: !entry.checked[currentMember] },
    } : entry));
  }

  function selectAllPacked() {
    if (currentMember !== "我") return;
    setItems((current) => current.map((item) => isPersonalItem(item) || item.owners.includes(currentMember) ? {
      ...item,
      checked: { ...item.checked, [currentMember]: true },
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
    setItems((current) => current.filter((entry) => entry.id !== item.id));
    setSuggestions((current) => current.map((suggestion) => suggestion.name === item.name ? { ...suggestion, added: false } : suggestion));
    notify(`已从清单移除「${item.name}」`);
  }

  function sendMessage() {
    const text = draft.trim();
    if (!text) return;
    const additions: ChatMessage[] = [{ id: Date.now(), author: currentMember, text }];
    const wantsToClaim = /(我来带|我带|我有|交给我|算我的)/.test(text);
    const matched = items.find((item) => !isPersonalItem(item) && !item.owners.includes(currentMember) && (text.includes(item.name) || text.includes(item.name.slice(0, 2))));
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
    const personal = isPersonalItem(item);
    const ownerMembers = item.owners.map((owner) => members.find((member) => member.name === owner)).filter(Boolean);
    const currentWillBring = item.owners.includes(currentMember);
    const packed = Boolean(item.checked[currentMember]);
    const canCheck = currentMember === "我" && (personal || currentWillBring);

    return (
      <article className={`list-item ${packed ? "packed" : ""}`} key={item.id}>
        {phase === "verify" ? (
          <button className={`pack-check ${packed ? "checked" : ""}`} onClick={() => togglePacked(item)} disabled={!canCheck} aria-label={`${packed ? "取消" : "确认"}${item.name}已装包`}>{packed ? "✓" : ""}</button>
        ) : <span className={`item-icon item-group-${categories.findIndex((category) => category.name === item.group)}`}><ItemGraphic item={item} /></span>}
        <div className="item-copy">
          <b>{item.name}</b>
          {phase === "prepare" && <button className="remove-item-button" onClick={() => removeItem(item)} aria-label={`从清单移除${item.name}`}><Trash2 aria-hidden="true" />不需要，移除</button>}
        </div>
        {phase === "prepare" && (personal ? <span className="personal-pill">每人自备</span> : item.owners.length ? (
            <div className="shared-owner-action">
              <div className="owner-avatars" aria-label={`${item.owners.join("、")}会带`}>
                {ownerMembers.slice(0, 3).map((owner) => <button className="owner-avatar" key={owner?.name} onClick={() => phase === "prepare" && owner?.name === currentMember && release(item.id)} disabled={owner?.name !== currentMember} title={owner?.name === currentMember ? "取消我会带" : `${owner?.name}会带`}>{owner && <CharacterAvatar member={owner.name} />}</button>)}
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
          <button className="trip-chip">{destinationLabel} · 5天⌄</button>
          <button className="icon-button" aria-label="更多选项">•••</button>
        </header>

        <div className="scroll-area">
          <section className="trip-hero">
            <div>
              <p className="eyebrow">{destination} · {teamName} · 3 人</p>
              <h1>{phase === "prepare" ? "这次，带什么？" : "出发前，逐件确认"}</h1>
            </div>
            <div className="presence-panel">
              <div className="member-switch" aria-label="成员在线状态与清单切换">
                {members.map((member) => <button key={member.name} className={currentMember === member.name ? "selected" : ""} onClick={() => setCurrentMember(member.name)} title={`${member.name}${member.online ? "在线" : "离线"}`}><CharacterAvatar member={member.name} /><i className={member.online ? "online" : "offline"} /></button>)}
              </div>
              <small>{members.filter((member) => member.online).length} 人在线</small>
            </div>
          </section>

          <div className="context-tags"><span>▦ 城市漫游</span><span>◇ 逛街</span><span>◉ 想拍照</span></div>

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
              <div className="ai-title"><span>{suggestionStatus === "loading" ? <Wifi aria-hidden="true" /> : "✦"}</span><div><p className="eyebrow">{suggestionStatus === "model" ? "大模型实时生成" : suggestionStatus === "loading" ? "正在结合当前清单思考" : "AI 建议示例"}</p><h2>{destinationLabel}容易漏带</h2></div></div>
              <small>{suggestionStatus === "loading" ? "生成中…" : "左右滑动 · 2 条"}</small>
            </header>
            <div className={`suggestion-scroll ${suggestionStatus === "loading" ? "loading" : ""}`}>
              {suggestions.map((suggestion) => (
                <article className={`suggestion-card ${suggestion.added ? "added" : ""}`} key={suggestion.id}>
                  <div className={`suggestion-icon suggestion-${suggestion.id}`}><ItemGraphic item={suggestion} /></div>
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
            <span className="chat-avatars"><CharacterAvatar member="我" /><CharacterAvatar member="阿哲" /><CharacterAvatar member="小雨" /></span>
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
            {prepareItems.length ? <div className="category-sections">{categories.filter((category) => !personalCategories.includes(category.name)).map((category, index) => {
              const categoryItems = teamPrepareItems.filter((item) => item.group === category.name);
              if (!categoryItems.length) return null;
              return <section className="list-section category-section" key={category.name}>
                <header className="section-head">
                  <div><span className={`scope-icon category-icon category-${index}`}><CategoryGraphic category={category.name} /></span><div><h2>{category.name}</h2><p>{category.note}</p></div></div>
                  <span>{categoryItems.length} 件</span>
                </header>
                <div className="item-list">{categoryItems.map(renderItem)}</div>
              </section>;
            })}
              {personalPrepareItems.length > 0 && <section className="personal-zone">
                <header className="personal-zone-head">
                  <div><span><Backpack strokeWidth={2.5} /></span><div><h2>个人自备物品</h2><p>每个人各自带一份，所有成员都能看到</p></div></div>
                  <small>队友可见</small>
                </header>
                <div className="item-list">{personalPrepareItems.map(renderItem)}</div>
              </section>}
            </div> : <div className="empty-list"><span>✓</span><b>这里已经清空了</b><small>暂时没有等待分配的物品</small></div>}
          </section> : <section className="list-section verify-list-section">
            <header className="section-head">
              <div><span className="scope-icon private-icon">✓</span><div><h2>{currentMember === "我" ? "我的待带清单" : `${currentMember}的待带清单`}</h2><p>个人自备物品＋自己认领的团队物品</p></div></div>
              <div className="verify-list-actions">
                <span>{verifyItems.length} 件</span>
                {currentMember === "我" && <button className="select-all-button" onClick={selectAllPacked} disabled={status.total === 0}>{status.total === 0 ? "✓ 已全选" : "✓ 一键全选"}</button>}
              </div>
            </header>
            <div className="item-list">{verifyItems.map(renderItem)}</div>
          </section>}
        </div>

        <footer className="action-bar">
          {phase === "prepare" && <button className="add-item" onClick={() => setShowAdd(true)} aria-label="添加物品">＋</button>}
          {phase === "prepare" ? (
            <button className="primary-action" onClick={() => setPhase("verify")}>进入出发核对 <span>→</span></button>
          ) : (
            <button className={`primary-action ${status.total === 0 ? "ready" : ""}`} onClick={() => status.total ? notify(`还有 ${status.total} 项需要处理`) : setPhase("departed")}>{status.total ? `继续核对 · 还有 ${status.total} 项` : "全部带齐 · 出发"}<span>{status.total ? "↑" : "→"}</span></button>
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
                  return <div className={`message-row ${message.author === currentMember ? "mine" : ""} ${message.system ? "system" : ""}`} key={message.id}>{meta ? <CharacterAvatar member={meta.name} className="message-avatar" /> : <span className="message-avatar assistant-avatar">✦</span>}<div><small>{message.author}</small><p>{message.text}</p></div></div>;
                })}
              </div>
              {unassigned > 0 && <div className="chat-suggestions">{unassignedItems.map((item) => <button key={item.id} onClick={() => setDraft(`谁可以带${item.name}？`)}>问问：{item.name}</button>)}</div>}
              <div className="chat-composer"><input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => event.key === "Enter" && sendMessage()} placeholder={`以${currentMember}身份发消息…`} /><button onClick={sendMessage}>↑</button></div>
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

      <aside className="prototype-note">
        <p className="eyebrow">PRODUCT PROTOTYPE · V4</p>
        <h2>目的地懂你，<br />清单依然简单。</h2>
        <div className="prototype-crew" aria-hidden="true" />
        <p>手机端不再复制表格，而是回到最自然的纵向 List。AI 负责理解首尔逛街、街拍等旅行特点，用户只需要决定是否加入清单。</p>
        <div className="principle"><span>01</span><p><b>团队与个人各归其位</b><br />个人物品全员可见并默认自备，其他物品一起认领</p></div>
        <div className="principle"><span>02</span><p><b>AI 补充有理由</b><br />说明来自目的地特点还是热门玩法</p></div>
        <div className="principle"><span>03</span><p><b>不做旅游攻略</b><br />只回答“这次出发需要带什么”</p></div>
        <div className="demo-note">试试：认领“充电线”，再进入出发核对。</div>
      </aside>
    </main>
  );
}
