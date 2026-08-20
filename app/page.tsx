"use client";

import { useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { LucideIcon } from "lucide-react";
import Image from "next/image";
import {
  Banknote, BookOpenCheck, Bug, Cable, CupSoda, GlassWater, MemoryStick,
  Menu, MessageCircle, MoonStar, Package, Trash2, Wifi,
} from "lucide-react";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import {
  BaseballCap, BatteryCharging, Camera, Cards, CircleNotch, CreditCard,
  DeviceMobileCamera, Drop, Ear, Eyedropper, FaceMask, FirstAid, Footprints,
  HandSoap, HandSwipeRight, Headphones, Hoodie, IdentificationBadge,
  IdentificationCard, Jar, MaskHappy, Pants, Pill, PlugsConnected, PlugCharging,
  Popcorn, Prescription, ShirtFolded, Shower, SimCard, Sneaker, Sock, SprayBottle,
  Sun, Sunglasses, TestTube, Toilet, ToiletPaper, Tooth, Towel, TShirt, Umbrella,
} from "@phosphor-icons/react";

type Member = "我" | "阿哲" | "小雨";
type Phase = "prepare" | "verify" | "departed";
type ListFilter = "mine" | "all";
type Category = "证件与钱财类" | "电子数码类" | "衣物鞋帽类" | "洗护化妆类" | "医药健康类" | "日用杂物类" | "零食饮料类";

type PackItem = {
  id: number;
  name: string;
  icon: string;
  group: Category;
  owners: Member[];
  checked: Partial<Record<Member, boolean>>;
  personal?: boolean;
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
  itemId?: number;
};

type AssignmentProposal = {
  itemId: number;
  requester: Member;
  target: Member;
};

const members: { name: Member; short: string; profile: string; className: string; online: boolean }[] = [
  { name: "我", short: "我", profile: "有充电宝", className: "member-me", online: true },
  { name: "阿哲", short: "哲", profile: "有相机", className: "member-zhe", online: true },
  { name: "小雨", short: "雨", profile: "有水杯", className: "member-yu", online: false },
];

const categories: { name: Category }[] = [
  { name: "证件与钱财类" },
  { name: "电子数码类" },
  { name: "衣物鞋帽类" },
  { name: "洗护化妆类" },
  { name: "医药健康类" },
  { name: "日用杂物类" },
  { name: "零食饮料类" },
];

const personalCategories: Category[] = ["证件与钱财类", "衣物鞋帽类"];
const personalItemNames = new Set(["牙刷", "毛巾", "流量卡"]);

const phosphorItemIcons: Record<string, PhosphorIcon> = {
  "身份证": IdentificationCard, "银行卡": CreditCard, "驾驶证": IdentificationBadge,
  "充电器": PlugCharging, "充电宝": BatteryCharging, "耳机": Headphones, "转换插头": PlugsConnected,
  "相机": Camera, "自拍杆": DeviceMobileCamera,
  "上衣": TShirt, "裤子": Pants, "外套": Hoodie, "内衣": ShirtFolded, "袜子": Sock,
  "拖鞋": Footprints, "鞋子": Sneaker, "墨镜": Sunglasses, "帽子": BaseballCap,
  "牙刷": Tooth, "牙膏": TestTube, "毛巾": Towel, "洗面奶": HandSoap, "卸妆油": Eyedropper,
  "防晒霜": Sun, "洗发水": SprayBottle, "沐浴露": Shower, "水乳": Drop, "面霜": Jar,
  "面膜": MaskHappy, "皮筋": CircleNotch,
  "个人慢性病药物": Prescription, "晕车药": Pill, "过敏药": FirstAid,
  "雨伞": Umbrella, "纸巾": ToiletPaper, "湿巾": HandSwipeRight, "口罩": FaceMask, "耳塞": Ear,
  "一次性马桶垫": Toilet, "零食": Popcorn, "T-money 交通卡": Cards, "流量卡": SimCard,
};

const lucideItemIcons: Record<string, LucideIcon> = {
  "护照 / 签证": BookOpenCheck, "现金": Banknote,
  "充电线": Cable, "SD 卡": MemoryStick, "睡衣": MoonStar,
  "驱蚊液": Bug, "水杯": GlassWater, "饮料": CupSoda,
};

const avatarVariant: Record<Member, string> = { "我": "avatar-me", "阿哲": "avatar-zhe", "小雨": "avatar-yu" };

function CharacterAvatar({ member, className = "" }: { member: Member; className?: string }) {
  return <span className={`character-avatar ${avatarVariant[member]} ${className}`} aria-hidden="true" />;
}

function ItemGraphic({ item }: { item: Pick<PackItem, "name" | "group"> }) {
  const PhosphorItemIcon = phosphorItemIcons[item.name];
  if (PhosphorItemIcon) return <PhosphorItemIcon aria-hidden="true" weight="duotone" />;

  const LucideItemIcon = lucideItemIcons[item.name] ?? Package;
  return <LucideItemIcon aria-hidden="true" strokeWidth={2.15} />;
}

function isPersonalItem(item: PackItem) {
  return Boolean(item.personal) || personalCategories.includes(item.group) || personalItemNames.has(item.name);
}

function canChoosePersonal(item: PackItem) {
  return !personalCategories.includes(item.group) && !personalItemNames.has(item.name);
}

const seedItems: PackItem[] = [
  { id: 1, name: "身份证", icon: "▣", group: "证件与钱财类", owners: ["我", "阿哲", "小雨"], checked: {} },
  { id: 2, name: "护照 / 签证", icon: "▦", group: "证件与钱财类", owners: ["我", "阿哲", "小雨"], checked: {} },
  { id: 3, name: "银行卡", icon: "▰", group: "证件与钱财类", owners: [], checked: {} },
  { id: 4, name: "现金", icon: "¥", group: "证件与钱财类", owners: [], checked: {} },
  { id: 5, name: "驾驶证", icon: "□", group: "证件与钱财类", owners: [], checked: {} },

  { id: 7, name: "充电器", icon: "▰", group: "电子数码类", owners: [], checked: {} },
  { id: 8, name: "充电宝", icon: "▮", group: "电子数码类", owners: ["我"], checked: {}, aiReason: "你登记了大容量充电宝" },
  { id: 9, name: "充电线", icon: "⌁", group: "电子数码类", owners: [], checked: {} },
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
  { id: 1, author: "小雨", text: "流量卡要不要提前一起买？" },
  { id: 2, author: "阿哲", text: "充电线你来带吧，我带相机。" },
  { id: 3, author: "我", text: "好。" },
  { id: 1101, author: "阿哲", text: "韩国插座和国内一样吗？这个还要不要带？", itemId: 11 },
  { id: 1301, author: "我", text: "自拍杆谁能带？首尔街拍和合照可能会用。", itemId: 13 },
  { id: 1302, author: "小雨", text: "我那个太短了，看看阿哲有没有长一点的。", itemId: 13 },
  { id: 4101, author: "小雨", text: "天气预报有雨，要不要带两把伞？", itemId: 41 },
];

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
  const [assignmentProposal, setAssignmentProposal] = useState<AssignmentProposal | null>({ itemId: 9, requester: "阿哲", target: "我" });
  const [activeItemId, setActiveItemId] = useState<number | null>(null);
  const [unreadItemIds, setUnreadItemIds] = useState<Set<number>>(() => new Set([11, 13, 41]));
  const [expandedCategories, setExpandedCategories] = useState<Set<Category>>(() => new Set(["电子数码类"]));
  const [personalExpanded, setPersonalExpanded] = useState(false);
  const [draggingItemId, setDraggingItemId] = useState<number | null>(null);
  const [toast, setToast] = useState("");
  const draggingItemRef = useRef<number | null>(null);

  const myItems = items.filter((item) => isPersonalItem(item) || item.owners.includes("我"));
  const verifyItems = items.filter((item) => isPersonalItem(item) || item.owners.includes(viewedMember));
  const prepareItems = listFilter === "mine" ? myItems : items;
  const teamPrepareItems = prepareItems.filter((item) => !isPersonalItem(item));
  const personalPrepareItems = prepareItems.filter(isPersonalItem);
  const status = useMemo(() => {
    const total = items.filter((item) => (isPersonalItem(item) || item.owners.includes(viewedMember)) && !item.checked[viewedMember]).length;
    return { total };
  }, [viewedMember, items]);
  const verifiedCount = verifyItems.length - status.total;
  const myRemaining = items.filter((item) => (isPersonalItem(item) || item.owners.includes("我")) && !item.checked["我"]).length;
  const destinationLabel = destination.trim().split(/[·,，]/).pop()?.trim() || "目的地";
  const activeItem = activeItemId === null ? null : items.find((item) => item.id === activeItemId) ?? null;
  const activeChatMessages = activeItem
    ? messages.filter((message) => message.system || message.itemId === activeItem.id || message.text.includes(activeItem.name) || (activeItem.name === "充电线" && message.text.includes("数据线")))
    : messages;
  const proposalItem = assignmentProposal ? items.find((item) => item.id === assignmentProposal.itemId) ?? null : null;

  async function createTeam() {
    if (!destination.trim()) return;
    const place = destination.trim().split(/[·,，]/).pop()?.trim() || "旅行";
    setTeamName(`${place}逛拍小队`);
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
          </header>
          <div className="setup-content">
            <div className="setup-illustration"><CharacterAvatar member="我" /><CharacterAvatar member="阿哲" /><CharacterAvatar member="小雨" /></div>
            <h1>和朋友一起，<br />把行李带齐。</h1>
            <p className="setup-intro">输入目的地，马上生成一份可以共同认领的清单。</p>
            <label className="setup-field"><span>这次去哪儿？</span><input value={destination} onChange={(event) => setDestination(event.target.value)} placeholder="例如：韩国 · 首尔" /></label>
            <button className="setup-submit" onClick={createTeam}>生成清单 <span>→</span></button>
          </div>
        </section>
      </main>
    );
  }

  if (phase === "departed") {
    return (
      <main className="app-shell departure-shell">
        <section className="phone-frame departure-frame" aria-label="旅行准备完成">
          <button className="departure-back" onClick={() => setPhase("verify")} aria-label="返回核对清单">←</button>
          <section className="departure-page">
            <Image className="departure-illustration" src="/departure-team-v2.png" alt="三位朋友带着行李一起出发" width={1254} height={1254} priority />
            <h1>带上好心情，出发！</h1>
          </section>
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

  function togglePersonal(item: PackItem) {
    if (!canChoosePersonal(item)) return;
    setItems((current) => current.map((entry) => entry.id === item.id ? {
      ...entry,
      personal: !entry.personal,
      owners: entry.personal ? entry.owners : [],
    } : entry));
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

  function focusNextUnchecked() {
    document.querySelector<HTMLElement>('[data-unchecked="true"]')?.scrollIntoView({ behavior: "smooth", block: "center" });
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
    setMessages((current) => current.filter((message) => message.itemId !== item.id));
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

  function toggleCategory(category: Category) {
    setExpandedCategories((current) => {
      const next = new Set(current);
      if (next.has(category)) next.delete(category); else next.add(category);
      return next;
    });
  }

  function toggleEditMode() {
    setEditMode((current) => {
      if (!current) setExpandedCategories(new Set(categories.map((category) => category.name)));
      return !current;
    });
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
    const agrees = /^(好|好的|可以|行|没问题|ok|okay)[。！!,.， ]*$/i.test(text);
    const request = [...messages].reverse().find((message) => message.author !== "我" && message.author !== "带齐助手" && /(你来带|你带|交给你)/.test(message.text));
    const requestedItem = request ? items.find((item) => !isPersonalItem(item) && (request.text.includes(item.name) || (item.name === "充电线" && request.text.includes("数据线")))) : null;
    if (agrees && request && requestedItem) {
      setAssignmentProposal({ itemId: requestedItem.id, requester: request.author as Member, target: "我" });
    }
    setMessages((current) => [...current, ...additions]);
    setDraft("");
  }

  function resolveAssignmentProposal(accepted: boolean) {
    if (!assignmentProposal) return;
    const proposalItem = items.find((item) => item.id === assignmentProposal.itemId);
    if (!proposalItem) { setAssignmentProposal(null); return; }
    if (accepted) claim(proposalItem.id);
    setMessages((current) => [...current, {
      id: Date.now(),
      author: "带齐助手",
      text: accepted ? `已确认：我会带${proposalItem.name}` : `未加入：${proposalItem.name}仍待认领`,
      system: true,
    }]);
    setAssignmentProposal(null);
  }

  function openItemChat(itemId: number) {
    if (editMode) return;
    setActiveItemId(itemId);
    setShowChat(true);
    setUnreadItemIds((current) => {
      const next = new Set(current);
      next.delete(itemId);
      return next;
    });
  }

  function sendItemMessage() {
    const text = draft.trim();
    if (!text || !activeItem) return;
    const additions: ChatMessage[] = [{ id: Date.now(), author: "我", text, itemId: activeItem.id }];
    if (!isPersonalItem(activeItem) && !activeItem.owners.includes("我") && /(我来带|我带|我有|交给我|算我的)/.test(text)) {
      claim(activeItem.id);
      additions.push({ id: Date.now() + 1, author: "带齐助手", text: `已同步：我会带${activeItem.name}`, system: true, itemId: activeItem.id });
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
    const currentWillBring = item.owners.includes("我");
    const packed = Boolean(item.checked[viewedMember]);
    const canCheck = viewedMember === "我" && (personal || currentWillBring);
    const visiblePeerIds = (personal ? personalPrepareItems : prepareItems.filter((entry) => entry.group === item.group)).map((entry) => entry.id);
    const peerPosition = visiblePeerIds.indexOf(item.id);
    const discussionCount = messages.filter((message) => message.itemId === item.id).length;
    const hasUnreadDiscussion = unreadItemIds.has(item.id);
    const fixedPersonal = personal && !item.personal;

    return (
      <article className={`list-item ${packed ? "packed" : ""} ${editMode && phase === "prepare" ? "editing" : ""} ${draggingItemId === item.id ? "dragging" : ""}`} data-sort-item-id={item.id} data-unchecked={phase === "verify" && canCheck && !packed ? "true" : undefined} key={item.id}>
        {phase === "verify" ? (
          <button className={`pack-check ${packed ? "checked" : ""}`} onClick={() => togglePacked(item)} disabled={!canCheck} aria-label={`${packed ? "取消" : "确认"}${item.name}已装包`}>{packed ? "✓" : ""}</button>
        ) : <span className={`item-icon item-group-${categories.findIndex((category) => category.name === item.group)}`}><ItemGraphic item={item} /></span>}
        <div className="item-copy">
          <button className="item-chat-trigger" onClick={() => openItemChat(item.id)} disabled={editMode} aria-label={`打开${item.name}的讨论`}>
            <span className="item-title-row"><b>{item.name}</b>{hasUnreadDiscussion && <i className="unread-dot" aria-label="有未读消息" />}</span>
            {(hasUnreadDiscussion || discussionCount > 0) && <small>{hasUnreadDiscussion ? "有新消息" : `${discussionCount} 条讨论`}</small>}
          </button>
          {phase === "prepare" && !editMode && canChoosePersonal(item) && <button className={`make-personal-button ${item.personal ? "active" : ""}`} onClick={() => togglePersonal(item)} aria-pressed={Boolean(item.personal)}>{item.personal ? "✓ 各带各的" : "各带各的"}</button>}
          {phase === "prepare" && editMode && <button className="edit-delete-button" onClick={() => removeItem(item)} aria-label={`删除${item.name}`} title="删除"><Trash2 aria-hidden="true" /></button>}
        </div>
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
        {phase === "prepare" && !editMode && (fixedPersonal ? <span className="personal-pill">每人自备</span> : personal ? null : item.owners.length ? (
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
        </header>

        <div className="scroll-area">
          <section className="trip-hero">
            <div>
              <p className="eyebrow">{teamName} · 3 人</p>
              <h1>{phase === "prepare" ? "这次，带什么？" : "出发前，逐件确认"}</h1>
            </div>
            <div className="presence-panel">
              <div className={`member-switch ${phase === "verify" ? "switchable" : ""}`} aria-label={phase === "verify" ? "切换查看成员清单" : "成员在线状态"}>
                {members.map((member) => phase === "verify" ? <button key={member.name} className={viewedMember === member.name ? "selected" : ""} onClick={() => setViewedMember(member.name)} title={`查看${member.name}的清单`}><CharacterAvatar member={member.name} /><i className={member.online ? "online" : "offline"} /></button> : <span className="member-presence" key={member.name} title={`${member.name}${member.online ? "在线" : "离线"}`}><CharacterAvatar member={member.name} /><i className={member.online ? "online" : "offline"} /></span>)}
              </div>
              {phase === "verify" && <small>点头像查看队友</small>}
            </div>
            <div className="editorial-motif" aria-hidden="true"><span /><span /><span /><span /></div>
          </section>

          <div className="phase-tabs" role="tablist" aria-label="准备阶段">
            <button className={phase === "prepare" ? "active" : ""} onClick={() => setPhase("prepare")}><span>1</span>准备清单</button>
            <button className={phase === "verify" ? "active" : ""} onClick={() => { setEditMode(false); setPhase("verify"); }}><span>2</span>出发核对</button>
          </div>

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
            <button className={listFilter === "mine" ? "active" : ""} onClick={() => { setEditMode(false); setListFilter("mine"); }}>我的 <span>{myItems.length}</span></button>
          </nav>}

          {phase === "prepare" ? <section className="filtered-list-section">
            <header className="list-toolbar"><span>{editMode ? "拖动排序，或删除不需要的物品" : ""}</span>{listFilter === "all" && <button className={editMode ? "active" : ""} onClick={toggleEditMode}>{editMode ? "✓ 完成" : "✎ 编辑"}</button>}</header>
            {prepareItems.length ? listFilter !== "all" ? <div className="focus-list"><div className="item-list">{prepareItems.map(renderItem)}</div></div> : <div className="category-sections">{categories.filter((category) => !personalCategories.includes(category.name)).map((category) => {
              const categoryItems = teamPrepareItems.filter((item) => item.group === category.name);
              if (!categoryItems.length) return null;
              return <section className="list-section category-section" key={category.name}>
                <button className="section-head section-toggle" onClick={() => toggleCategory(category.name)} aria-expanded={expandedCategories.has(category.name)}>
                  <h2>{category.name}</h2>
                  <span>{categoryItems.length} 件 <i>{expandedCategories.has(category.name) ? "⌃" : "⌄"}</i></span>
                </button>
                {expandedCategories.has(category.name) && <div className="item-list">{categoryItems.map(renderItem)}</div>}
              </section>;
            })}
              {personalPrepareItems.length > 0 && <section className="personal-zone">
                <button className="personal-zone-head personal-toggle" onClick={() => setPersonalExpanded((current) => !current)} aria-expanded={personalExpanded}>
                  <h2>个人自备物品</h2>
                  <small>{personalPrepareItems.length} 件 <i>{personalExpanded ? "⌃" : "⌄"}</i></small>
                </button>
                {personalExpanded && <div className="item-list">{personalPrepareItems.map(renderItem)}</div>}
              </section>}
            </div> : <div className="empty-list"><span>✓</span><b>这里已经处理好了</b><small>暂时没有需要处理的物品</small></div>}
          </section> : <section className="list-section verify-list-section">
            <header className="verify-toolbar">
              <b>{viewedMember === "我" ? "我的物品" : viewedMember} · {verifiedCount}/{verifyItems.length}</b>
              {viewedMember === "我" ? <button className="select-all-button" onClick={selectAllPacked} disabled={status.total === 0}>{status.total === 0 ? "✓ 已完成" : "全选"}</button> : <button className="remind-button" onClick={() => notify(`已提醒${viewedMember}尽快收拾`)}>提醒TA</button>}
            </header>
            <div className="item-list">{verifyItems.map(renderItem)}</div>
          </section>}
        </div>

        <footer className="action-bar">
          {phase === "prepare" && <button className="add-item" onClick={() => setShowAdd(true)} aria-label="添加物品">＋</button>}
          {phase === "prepare" && <button className="team-chat-action" onClick={() => { setActiveItemId(null); setShowChat(true); }} aria-label={assignmentProposal ? "团队讨论，有一项分工待确认" : "团队讨论"} title="团队讨论"><MessageCircle aria-hidden="true" />{assignmentProposal && <i>1</i>}</button>}
          {phase === "prepare" ? (
            <button className="primary-action" onClick={() => { setEditMode(false); setPhase("verify"); }}>进入出发核对 <span>→</span></button>
          ) : viewedMember !== "我" ? (
            <button className="primary-action" onClick={() => setViewedMember("我")}>返回我的核对清单 <span>→</span></button>
          ) : (
            <button className={`primary-action ${myRemaining === 0 ? "ready" : ""}`} onClick={() => myRemaining ? focusNextUnchecked() : setPhase("departed")}>{myRemaining ? "下一件未确认" : "东西带齐 · 出发"}<span>{myRemaining ? "↑" : "→"}</span></button>
          )}
        </footer>

        {showChat && (
          <div className="bottom-sheet" role="dialog" aria-modal="true" aria-label="团队讨论">
            <button className="sheet-backdrop" aria-label="关闭" onClick={() => { setShowChat(false); setActiveItemId(null); }} />
            <section className="sheet-card chat-card">
              <span className="sheet-handle" />
              <header className="chat-header"><div><h2>团队讨论</h2>{activeItem && <p>{`正在查看与「${activeItem.name}」有关的消息`}</p>}</div><button onClick={() => { setShowChat(false); setActiveItemId(null); }}>×</button></header>
              <div className="chat-messages">
                {activeItem && <button className="chat-filter-clear" onClick={() => setActiveItemId(null)}>查看全部消息</button>}
                {activeChatMessages.length ? activeChatMessages.map((message) => {
                  const meta = members.find((member) => member.name === message.author);
                  return <div className={`message-row ${message.author === "我" ? "mine" : ""} ${message.system ? "system" : ""}`} key={message.id}>{meta ? <CharacterAvatar member={meta.name} className="message-avatar" /> : <span className="message-avatar assistant-avatar">✦</span>}<div><small>{message.author}</small><p>{message.text}</p></div></div>;
                }) : <div className="item-discussion-empty"><span>•••</span><b>还没有相关消息</b><small>发第一条消息，问问谁带这件物品。</small></div>}
                {assignmentProposal && proposalItem && (!activeItem || activeItem.id === proposalItem.id) && <article className="assignment-proposal">
                  <div className="proposal-label"><span>✦</span>AI 识别到一项分工</div>
                  <div className="proposal-main"><span className="proposal-icon"><ItemGraphic item={proposalItem} /></span><div><b>{assignmentProposal.requester}请你带「{proposalItem.name}」</b><small>你刚刚回复了“好”，要同步到清单吗？</small></div></div>
                  <div className="proposal-actions"><button onClick={() => resolveAssignmentProposal(false)}>我不带</button><button onClick={() => resolveAssignmentProposal(true)}>我来带</button></div>
                </article>}
              </div>
              <div className="chat-composer"><input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => event.key === "Enter" && (activeItem ? sendItemMessage() : sendMessage())} placeholder={activeItem ? `聊聊${activeItem.name}…` : "聊聊谁带什么…"} /><button onClick={() => activeItem ? sendItemMessage() : sendMessage()} aria-label="发送消息">↑</button></div>
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
