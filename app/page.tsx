"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { LucideIcon } from "lucide-react";
import Image from "next/image";
import {
  ArrowLeft, Banknote, BookOpenCheck, Bug, CupSoda, GlassWater, MemoryStick,
  Check, Download, Menu, MessageCircle, MoonStar, Package, Share2, Sparkles, Trash2, X,
} from "lucide-react";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import {
  BaseballCap, BatteryCharging, Camera, Cards, CircleNotch, CreditCard,
  DeviceMobileCamera, Drop, Ear, Eyedropper, FaceMask, FirstAid, Footprints,
  HandSoap, HandSwipeRight, Headphones, Hoodie, IdentificationCard, Jar,
  MaskHappy, Pants, Pill, PlugsConnected, PlugCharging, Popcorn, Prescription,
  ShirtFolded, Shower, SimCard, Sock, SprayBottle, Sun, TestTube, Toilet,
  ToiletPaper, Tooth, Towel, TShirt, Umbrella,
} from "@phosphor-icons/react";

type Member = "我" | "阿哲" | "小雨" | "小安";
type Phase = "prepare" | "verify" | "departed";
type ListFilter = "all" | "mine" | "unassigned";
type Category = "证件与钱财类" | "电子数码类" | "衣物鞋帽类" | "洗护化妆类" | "医药健康类" | "日用杂物类" | "零食饮料类";
type HabitPreference = "photo" | "makeup" | "skincare" | "motion" | "allergy" | "hypoglycemia";
type GearPreference = "camera" | "instant-camera" | "selfie-stick";

type TravelProfile = {
  displayName: string;
  habits: HabitPreference[];
  gear: GearPreference[];
};

type PreferenceOption<T extends string> = {
  id: T;
  label: string;
  items: string[];
};

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

type ItemNote = {
  id: number;
  itemId: number;
  author: Member;
  text: string;
  time: string;
};

type AssignmentProposal = {
  id?: string;
  itemId: number;
  requester: Member;
  target: Member;
  afterMessageId: number;
  confidence?: number;
};

type DeletedItemSnapshot = {
  item: PackItem;
  index: number;
  notes: ItemNote[];
  wasUnread: boolean;
  proposals: AssignmentProposal[];
  suggestionStates: { id: number; added: boolean }[];
};

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type PersistedAppState = {
  teamReady: boolean;
  destination: string;
  items: PackItem[];
  suggestions: Suggestion[];
  phase: Phase;
  listFilter: ListFilter;
  viewedMember: Member;
  profile: TravelProfile;
  messages: ChatMessage[];
  itemNotes: ItemNote[];
  assignmentProposals: AssignmentProposal[];
  assignmentProposal?: AssignmentProposal | null;
  unreadItemIds: number[];
  expandedCategories: Category[];
  personalExpanded: boolean;
};

type MemberRecord = { name: Member; short: string; profile: string; className: string; online: boolean };
type TripSummary = { id: string; name: string; destination: string; inviteCode: string; version: number; currentMember: Member; role: "owner" | "member" };
type ServerTripPayload = { trip: TripSummary; state: { items: PackItem[]; suggestions: Suggestion[]; messages: ChatMessage[]; itemNotes: ItemNote[]; assignmentProposals: AssignmentProposal[] }; members: MemberRecord[]; version: number };

const demoMembers: MemberRecord[] = [
  { name: "我", short: "我", profile: "想出片", className: "member-me", online: true },
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

const habitOptions: PreferenceOption<HabitPreference>[] = [
  { id: "photo", label: "想出片", items: ["自拍杆", "手机稳定器", "三脚架"] },
  { id: "makeup", label: "会化妆", items: ["卸妆油", "防晒霜"] },
  { id: "skincare", label: "重视护肤", items: ["水乳", "面霜", "面膜", "防晒霜"] },
];

const healthOptions: PreferenceOption<HabitPreference>[] = [
  { id: "motion", label: "容易晕车", items: ["晕车药"] },
  { id: "allergy", label: "容易过敏", items: ["过敏药"] },
  { id: "hypoglycemia", label: "容易低血糖", items: ["葡萄糖"] },
];

const gearOptions: PreferenceOption<GearPreference>[] = [
  { id: "camera", label: "有相机", items: ["相机", "内存卡"] },
  { id: "instant-camera", label: "有拍立得", items: ["拍立得", "拍立得相纸"] },
  { id: "selfie-stick", label: "有自拍杆", items: ["自拍杆"] },
];

const defaultProfile: TravelProfile = {
  displayName: "小林",
  habits: ["photo"],
  gear: ["camera"],
};

const personalCategories: Category[] = ["证件与钱财类", "衣物鞋帽类"];
const personalItemNames = new Set([
  "牙刷", "毛巾", "流量卡",
  "卸妆油", "防晒霜", "水乳", "面霜", "面膜",
  "个人慢性病药物", "晕车药", "过敏药", "葡萄糖",
  "运动鞋", "水壶", "护膝", "护膝 / 护腕", "手套", "泳衣 / 潜水服", "泳衣 / 浴衣",
]);
const claimIntentPattern = /(我来带|我带|我有|交给我|算我的)/;
const releaseIntentPattern = /(我不带|我带不了|我没法带|不算我|别算我|我先不带|不用我带|算了.{0,10}(不带|你带|你们带|别人带)|还是.{0,10}(你带|你们带|别人带)|要不.{0,10}(你带|你们带|别人带))/;
const departureImageSrc = "/departure-team-v2.webp?v=3";
const localStateKey = "daiqi-app-state-v2";
const cloudTripKey = "daiqi-active-trip-v1";

function hasReleaseIntent(text: string) {
  return releaseIntentPattern.test(text);
}

function hasClaimIntent(text: string) {
  return !hasReleaseIntent(text) && claimIntentPattern.test(text);
}

const phosphorItemIcons: Record<string, PhosphorIcon> = {
  "身份证": IdentificationCard, "银行卡": CreditCard,
  "充电器": PlugCharging, "充电宝": BatteryCharging, "耳机": Headphones, "转换插头": PlugsConnected,
  "相机": Camera, "自拍杆": DeviceMobileCamera,
  "备用电池": BatteryCharging, "手机稳定器": DeviceMobileCamera, "三脚架": Camera,
  "登山杖": Footprints, "防潮垫": Towel, "睡袋": Towel, "防风外套": Hoodie,
  "冲锋衣": Hoodie, "户外急救包": FirstAid, "保温毯": Towel, "保暖冲锋衣": Hoodie,
  "运动服": TShirt, "运动鞋": Footprints, "护膝": FirstAid, "运动相机": Camera,
  "急救包": FirstAid, "保暖外套": Hoodie, "儿童证件": IdentificationCard, "儿童常用药": Prescription,
  "备用衣物": ShirtFolded, "宠物证件": IdentificationCard, "宠物粮": Popcorn,
  "牵引绳": CircleNotch, "宠物常用药": Prescription, "防晒帽": BaseballCap,
  "滑雪服": Hoodie, "护膝 / 护腕": FirstAid, "手套": HandSwipeRight, "暖宝宝": Sun,
  "泳衣 / 潜水服": TShirt, "泳衣 / 浴衣": TShirt, "补水喷雾": SprayBottle,
  "上衣": TShirt, "裤子": Pants, "外套": Hoodie, "内衣": ShirtFolded, "袜子": Sock,
  "拖鞋": Footprints, "帽子": BaseballCap,
  "牙刷": Tooth, "牙膏": TestTube, "毛巾": Towel, "洗面奶": HandSoap, "卸妆油": Eyedropper,
  "防晒霜": Sun, "洗发水": SprayBottle, "沐浴露": Shower, "水乳": Drop, "面霜": Jar,
  "面膜": MaskHappy, "皮筋": CircleNotch,
  "个人慢性病药物": Prescription, "晕车药": Pill, "过敏药": FirstAid, "葡萄糖": Pill,
  "雨伞": Umbrella, "纸巾": ToiletPaper, "湿巾": HandSwipeRight, "口罩": FaceMask, "耳塞": Ear,
  "一次性马桶垫": Toilet, "零食": Popcorn, "T-money 交通卡": Cards, "流量卡": SimCard,
};

const lucideItemIcons: Record<string, LucideIcon> = {
  "护照 / 签证": BookOpenCheck, "现金": Banknote,
  "内存卡": MemoryStick, "手电筒": Sparkles, "红光手电": Sparkles, "头灯": Sparkles, "望远镜": Sparkles, "睡衣": MoonStar,
  "水壶": GlassWater, "水碗": GlassWater, "玩具": Package, "钓具": Package, "鱼线 / 鱼钩": Package, "折叠椅": Package, "防水袋": Package,
  "驱蚊液": Bug, "水杯": GlassWater, "饮料": CupSoda,
};

const avatarVariant: Record<Member, string> = { "我": "avatar-me", "阿哲": "avatar-zhe", "小雨": "avatar-yu", "小安": "avatar-an" };

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
  return personalCategories.includes(item.group) || personalItemNames.has(item.name);
}

const presetItemCatalog: Record<string, Omit<PackItem, "owners" | "checked" | "aiReason">> = {
  "充电宝": { id: 8, name: "充电宝", icon: "▮", group: "电子数码类" },
  "转换插头": { id: 11, name: "转换插头", icon: "⌁", group: "电子数码类" },
  "相机": { id: 12, name: "相机", icon: "📷", group: "电子数码类" },
  "自拍杆": { id: 13, name: "自拍杆", icon: "│", group: "电子数码类" },
  "内存卡": { id: 14, name: "内存卡", icon: "▮", group: "电子数码类" },
  "拍立得": { id: 50, name: "拍立得", icon: "◇", group: "电子数码类" },
  "拍立得相纸": { id: 51, name: "拍立得相纸", icon: "□", group: "电子数码类" },
  "备用电池": { id: 60, name: "备用电池", icon: "▮", group: "电子数码类" },
  "手机稳定器": { id: 61, name: "手机稳定器", icon: "│", group: "电子数码类" },
  "三脚架": { id: 62, name: "三脚架", icon: "△", group: "电子数码类" },
  "登山杖": { id: 63, name: "登山杖", icon: "│", group: "日用杂物类" },
  "防潮垫": { id: 64, name: "防潮垫", icon: "▤", group: "日用杂物类" },
  "睡袋": { id: 65, name: "睡袋", icon: "▰", group: "日用杂物类" },
  "手电筒": { id: 66, name: "手电筒", icon: "✦", group: "电子数码类" },
  "防风外套": { id: 67, name: "防风外套", icon: "♨", group: "衣物鞋帽类" },
  "冲锋衣": { id: 68, name: "冲锋衣", icon: "♨", group: "衣物鞋帽类" },
  "户外急救包": { id: 69, name: "户外急救包", icon: "✚", group: "医药健康类" },
  "保温毯": { id: 70, name: "保温毯", icon: "▤", group: "医药健康类" },
  "望远镜": { id: 71, name: "望远镜", icon: "◉", group: "电子数码类" },
  "红光手电": { id: 72, name: "红光手电", icon: "✦", group: "电子数码类" },
  "保暖冲锋衣": { id: 73, name: "保暖冲锋衣", icon: "♨", group: "衣物鞋帽类" },
  "葡萄糖": { id: 74, name: "葡萄糖", icon: "✚", group: "医药健康类" },
  "运动服": { id: 80, name: "运动服", icon: "◫", group: "衣物鞋帽类" },
  "运动鞋": { id: 81, name: "运动鞋", icon: "◇", group: "衣物鞋帽类" },
  "水壶": { id: 82, name: "水壶", icon: "◉", group: "日用杂物类" },
  "护膝": { id: 83, name: "护膝", icon: "✚", group: "医药健康类" },
  "运动相机": { id: 84, name: "运动相机", icon: "📷", group: "电子数码类" },
  "急救包": { id: 85, name: "急救包", icon: "✚", group: "医药健康类" },
  "头灯": { id: 86, name: "头灯", icon: "✦", group: "电子数码类" },
  "保暖外套": { id: 87, name: "保暖外套", icon: "♨", group: "衣物鞋帽类" },
  "儿童证件": { id: 88, name: "儿童证件", icon: "▣", group: "证件与钱财类" },
  "儿童常用药": { id: 89, name: "儿童常用药", icon: "✚", group: "医药健康类" },
  "备用衣物": { id: 90, name: "备用衣物", icon: "▤", group: "衣物鞋帽类" },
  "玩具": { id: 91, name: "玩具", icon: "◇", group: "日用杂物类" },
  "宠物证件": { id: 92, name: "宠物证件", icon: "▣", group: "证件与钱财类" },
  "宠物粮": { id: 93, name: "宠物粮", icon: "●", group: "零食饮料类" },
  "水碗": { id: 94, name: "水碗", icon: "◉", group: "日用杂物类" },
  "牵引绳": { id: 95, name: "牵引绳", icon: "⌇", group: "日用杂物类" },
  "宠物常用药": { id: 96, name: "宠物常用药", icon: "✚", group: "医药健康类" },
  "钓具": { id: 97, name: "钓具", icon: "⌁", group: "日用杂物类" },
  "鱼线 / 鱼钩": { id: 98, name: "鱼线 / 鱼钩", icon: "⌇", group: "日用杂物类" },
  "防晒帽": { id: 99, name: "防晒帽", icon: "▰", group: "衣物鞋帽类" },
  "折叠椅": { id: 100, name: "折叠椅", icon: "▤", group: "日用杂物类" },
  "防水袋": { id: 103, name: "防水袋", icon: "▰", group: "日用杂物类" },
  "滑雪服": { id: 104, name: "滑雪服", icon: "♨", group: "衣物鞋帽类" },
  "护膝 / 护腕": { id: 105, name: "护膝 / 护腕", icon: "✚", group: "医药健康类" },
  "手套": { id: 106, name: "手套", icon: "▤", group: "衣物鞋帽类" },
  "暖宝宝": { id: 107, name: "暖宝宝", icon: "☀", group: "医药健康类" },
  "泳衣 / 潜水服": { id: 108, name: "泳衣 / 潜水服", icon: "▤", group: "衣物鞋帽类" },
  "泳衣 / 浴衣": { id: 109, name: "泳衣 / 浴衣", icon: "▤", group: "衣物鞋帽类" },
  "补水喷雾": { id: 110, name: "补水喷雾", icon: "◉", group: "洗护化妆类" },
};

const validHabitPreferences = new Set<HabitPreference>([...habitOptions, ...healthOptions].map((option) => option.id));
const validGearPreferences = new Set<GearPreference>(gearOptions.map((option) => option.id));

function normalizeTravelProfile(savedProfile: Partial<TravelProfile>): TravelProfile {
  return {
    displayName: typeof savedProfile.displayName === "string" ? savedProfile.displayName : defaultProfile.displayName,
    habits: Array.isArray(savedProfile.habits) ? savedProfile.habits.filter((id): id is HabitPreference => validHabitPreferences.has(id as HabitPreference)) : [],
    gear: Array.isArray(savedProfile.gear) ? savedProfile.gear.filter((id): id is GearPreference => validGearPreferences.has(id as GearPreference)) : [],
  };
}

const mainlandDestinationMarkers = [
  "中国", "北京", "上海", "广州", "深圳", "杭州", "成都", "重庆", "南京", "苏州", "武汉", "西安", "长沙", "厦门", "青岛", "天津", "郑州", "昆明", "三亚", "哈尔滨", "沈阳", "大连", "济南", "福州", "南昌", "合肥", "太原", "石家庄", "贵阳", "南宁", "海口", "拉萨", "乌鲁木齐", "呼和浩特", "兰州", "银川", "西宁",
];

function isInternationalDestination(destination: string) {
  const normalized = destination.trim();
  if (!normalized) return false;
  return !mainlandDestinationMarkers.some((marker) => normalized.includes(marker));
}

function applyPresetItems(current: PackItem[], profile: TravelProfile, destination: string) {
  const reasons = new Map<string, string>();
  habitOptions
    .filter((option) => profile.habits.includes(option.id))
    .forEach((option) => option.items.forEach((name) => reasons.set(name, "根据你的出行偏好预设")));
  healthOptions
    .filter((option) => profile.habits.includes(option.id))
    .forEach((option) => option.items.forEach((name) => reasons.set(name, "根据你的身体情况预设")));
  gearOptions
    .filter((option) => profile.gear.includes(option.id))
    .forEach((option) => option.items.forEach((name) => reasons.set(name, "根据你的设备信息预设")));
  if (isInternationalDestination(destination)) reasons.set("转换插头", "境外目的地预设");

  const next = [...current];
  const existingNames = new Set(next.map((item) => item.name));
  reasons.forEach((aiReason, name) => {
    const catalogItem = presetItemCatalog[name];
    if (!catalogItem || existingNames.has(name)) return;
    next.push({ ...catalogItem, owners: [], checked: {}, aiReason });
    existingNames.add(name);
  });
  return next;
}

const seedItems: PackItem[] = [
  { id: 1, name: "身份证", icon: "▣", group: "证件与钱财类", owners: ["我", "阿哲", "小雨"], checked: {} },
  { id: 2, name: "护照 / 签证", icon: "▦", group: "证件与钱财类", owners: ["我", "阿哲", "小雨"], checked: {} },
  { id: 3, name: "银行卡", icon: "▰", group: "证件与钱财类", owners: [], checked: {} },
  { id: 4, name: "现金", icon: "¥", group: "证件与钱财类", owners: [], checked: {} },

  { id: 7, name: "充电器", icon: "▰", group: "电子数码类", owners: [], checked: {} },
  { id: 10, name: "耳机", icon: "◉", group: "电子数码类", owners: ["小雨"], checked: {} },

  { id: 15, name: "上衣", icon: "◫", group: "衣物鞋帽类", owners: [], checked: {} },
  { id: 16, name: "裤子", icon: "▥", group: "衣物鞋帽类", owners: [], checked: {} },
  { id: 17, name: "外套", icon: "♨", group: "衣物鞋帽类", owners: ["我"], checked: {} },
  { id: 18, name: "内衣", icon: "▤", group: "衣物鞋帽类", owners: [], checked: {} },
  { id: 19, name: "袜子", icon: "▤", group: "衣物鞋帽类", owners: [], checked: {} },
  { id: 20, name: "睡衣", icon: "○", group: "衣物鞋帽类", owners: [], checked: {} },
  { id: 21, name: "拖鞋", icon: "◇", group: "衣物鞋帽类", owners: [], checked: {} },
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
  { id: 1, author: "阿哲", text: "转换插头你来带吧。" },
  { id: 2, author: "我", text: "好。" },
  { id: 3, author: "小雨", text: "流量卡要不要提前一起买？" },
  { id: 4, author: "阿哲", text: "可以，落地前买好更方便。" },
];

const seedItemNotes: ItemNote[] = [
  { id: 1101, itemId: 11, author: "阿哲", text: "韩国插座和国内一样吗？这个还要不要带？", time: "10:00" },
  { id: 1102, itemId: 11, author: "小雨", text: "酒店可以借，但带一个更放心。", time: "10:05" },
  { id: 1103, itemId: 11, author: "我", text: "那我放进随身包。", time: "10:06" },
  { id: 1301, itemId: 13, author: "我", text: "首尔街拍和合照可能会用，谁有长一点的？", time: "10:12" },
  { id: 1302, itemId: 13, author: "小雨", text: "我那个太短了，看看阿哲有没有。", time: "10:15" },
  { id: 4101, itemId: 41, author: "小雨", text: "天气预报有雨，要不要带两把伞？", time: "10:20" },
];

export default function Home() {
  const [teamReady, setTeamReady] = useState(false);
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
  const [showProfile, setShowProfile] = useState(false);
  const [profile, setProfile] = useState<TravelProfile>(defaultProfile);
  const [profileDraft, setProfileDraft] = useState<TravelProfile>(defaultProfile);
  const [addCategory, setAddCategory] = useState<Category>("日用杂物类");
  const [newItem, setNewItem] = useState("");
  const [draft, setDraft] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>(seedMessages);
  const [itemNotes, setItemNotes] = useState<ItemNote[]>(seedItemNotes);
  const [assignmentProposals, setAssignmentProposals] = useState<AssignmentProposal[]>([]);
  const [members, setMembers] = useState<MemberRecord[]>(demoMembers);
  const [currentMember, setCurrentMember] = useState<Member>("我");
  const [activeTripId, setActiveTripId] = useState<string | null>(null);
  const [tripVersion, setTripVersion] = useState(0);
  const [inviteCode, setInviteCode] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [showJoin, setShowJoin] = useState(false);
  const [availableTrips, setAvailableTrips] = useState<TripSummary[]>([]);
  const [accountReady, setAccountReady] = useState(false);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [cloudError, setCloudError] = useState("");
  const [syncStatus, setSyncStatus] = useState<"idle" | "saving" | "saved" | "conflict" | "offline">("idle");
  const [activeItemId, setActiveItemId] = useState<number | null>(null);
  const [unreadItemIds, setUnreadItemIds] = useState<Set<number>>(() => new Set([11, 13, 41]));
  const [expandedCategories, setExpandedCategories] = useState<Set<Category>>(() => new Set(["电子数码类"]));
  const [personalExpanded, setPersonalExpanded] = useState(false);
  const [draggingItemId, setDraggingItemId] = useState<number | null>(null);
  const [toast, setToast] = useState<{ message: string; canUndo: boolean } | null>(null);
  const [storageReady, setStorageReady] = useState(false);
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const draggingItemRef = useRef<number | null>(null);
  const deletedItemRef = useRef<DeletedItemSnapshot | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const activeTripIdRef = useRef<string | null>(null);
  const tripVersionRef = useRef(0);
  const currentMemberRef = useRef<Member>("我");
  const lastSyncedStateRef = useRef("");
  const applyingRemoteRef = useRef(false);
  const syncInFlightRef = useRef(false);
  const syncTimerRef = useRef<number | null>(null);
  const pendingSharedStateRef = useRef<ServerTripPayload["state"] | null>(null);
  const openCloudTripRef = useRef(openCloudTrip);
  const flushCloudStateRef = useRef(flushCloudState);

  const myItems = [
    ...items.filter((item) => !isPersonalItem(item) && item.owners.includes(currentMember)),
    ...items.filter(isPersonalItem),
  ];
  const unassignedItems = items.filter((item) => !isPersonalItem(item) && item.owners.length === 0);
  const verifyItems = items.filter((item) => isPersonalItem(item) || item.owners.includes(viewedMember));
  const prepareItems = listFilter === "mine" ? myItems : listFilter === "unassigned" ? unassignedItems : items;
  const teamPrepareItems = prepareItems.filter((item) => !isPersonalItem(item));
  const personalPrepareItems = prepareItems.filter(isPersonalItem);
  const status = useMemo(() => {
    const total = items.filter((item) => (isPersonalItem(item) || item.owners.includes(viewedMember)) && !item.checked[viewedMember]).length;
    return { total };
  }, [viewedMember, items]);
  const verifiedCount = verifyItems.length - status.total;
  const myRemaining = items.filter((item) => (isPersonalItem(item) || item.owners.includes(currentMember)) && !item.checked[currentMember]).length;
  const activeItem = activeItemId === null ? null : items.find((item) => item.id === activeItemId) ?? null;
  const activeItemNotes = activeItem ? itemNotes.filter((note) => note.itemId === activeItem.id) : [];
  useEffect(() => {
    const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
    const installedTimer = window.setTimeout(() => setIsInstalled(window.matchMedia("(display-mode: standalone)").matches || navigatorWithStandalone.standalone === true), 0);

    if ("serviceWorker" in navigator && window.location.protocol === "https:") {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }

    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      setDeferredInstallPrompt(null);
      setShowInstallGuide(false);
      setIsInstalled(true);
    };
    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    const restoreTimer = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(localStateKey);
        if (raw) {
          const saved = JSON.parse(raw) as Partial<PersistedAppState>;
          if (typeof saved.destination === "string") setDestination(saved.destination);
          if (typeof saved.teamReady === "boolean") setTeamReady(saved.teamReady);
          if (Array.isArray(saved.items)) setItems(saved.items.map((item) => item.name === "SD 卡" ? { ...item, name: "内存卡" } : item));
          if (Array.isArray(saved.suggestions)) setSuggestions(saved.suggestions);
          if (saved.phase === "prepare" || saved.phase === "verify" || saved.phase === "departed") setPhase(saved.phase);
          if (saved.listFilter === "all" || saved.listFilter === "mine" || saved.listFilter === "unassigned") setListFilter(saved.listFilter);
          if (saved.viewedMember === "我" || saved.viewedMember === "阿哲" || saved.viewedMember === "小雨" || saved.viewedMember === "小安") setViewedMember(saved.viewedMember);
          if (saved.profile) {
            const normalizedProfile = normalizeTravelProfile(saved.profile);
            setProfile(normalizedProfile);
            setProfileDraft(normalizedProfile);
          }
          if (Array.isArray(saved.messages)) setMessages(saved.messages);
          if (Array.isArray(saved.itemNotes)) setItemNotes(saved.itemNotes);
          if (Array.isArray(saved.assignmentProposals)) setAssignmentProposals(saved.assignmentProposals);
          else if (saved.assignmentProposal) setAssignmentProposals([saved.assignmentProposal]);
          if (Array.isArray(saved.unreadItemIds)) setUnreadItemIds(new Set(saved.unreadItemIds));
          if (Array.isArray(saved.expandedCategories)) setExpandedCategories(new Set(saved.expandedCategories));
          if (typeof saved.personalExpanded === "boolean") setPersonalExpanded(saved.personalExpanded);
        }
      } catch {
        window.localStorage.removeItem(localStateKey);
      } finally {
        setStorageReady(true);
      }
    }, 0);

    return () => {
      window.clearTimeout(installedTimer);
      window.clearTimeout(restoreTimer);
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    const state: PersistedAppState = {
      teamReady,
      destination,
      items,
      suggestions,
      phase,
      listFilter,
      viewedMember,
      profile,
      messages,
      itemNotes,
      assignmentProposals,
      unreadItemIds: [...unreadItemIds],
      expandedCategories: [...expandedCategories],
      personalExpanded,
    };
    window.localStorage.setItem(localStateKey, JSON.stringify(state));
  }, [assignmentProposals, destination, expandedCategories, itemNotes, items, listFilter, messages, personalExpanded, phase, profile, storageReady, suggestions, teamReady, unreadItemIds, viewedMember]);

  useEffect(() => { activeTripIdRef.current = activeTripId; }, [activeTripId]);
  useEffect(() => { tripVersionRef.current = tripVersion; }, [tripVersion]);
  useEffect(() => { currentMemberRef.current = currentMember; }, [currentMember]);

  useEffect(() => {
    if (!storageReady) return;
    let cancelled = false;
    async function bootAccount() {
      try {
        const sessionResponse = await fetch("/api/session", { cache: "no-store" });
        if (sessionResponse.status === 401) {
          if (!cancelled) { setNeedsSignIn(true); setTeamReady(false); setAccountReady(true); }
          return;
        }
        if (!sessionResponse.ok) throw new Error("账号服务暂不可用");
        const session = await sessionResponse.json() as { trips?: TripSummary[] };
        if (cancelled) return;
        const trips = Array.isArray(session.trips) ? session.trips : [];
        setAvailableTrips(trips);
        setNeedsSignIn(false);
        const profileResponse = await fetch("/api/profile", { cache: "no-store" });
        if (profileResponse.ok) {
          const result = await profileResponse.json() as { profile?: Partial<TravelProfile> };
          if (result.profile) {
            const cloudProfile = normalizeTravelProfile(result.profile);
            setProfile(cloudProfile);
            setProfileDraft(cloudProfile);
          }
        }
        const storedTripId = window.localStorage.getItem(cloudTripKey);
        const tripToOpen = trips.find((trip) => trip.id === storedTripId) ?? null;
        if (tripToOpen) await openCloudTripRef.current(tripToOpen.id);
        else setTeamReady(false);
      } catch (error) {
        if (!cancelled) {
          setCloudError(error instanceof Error ? error.message : "云端服务暂不可用");
          setSyncStatus("offline");
          setTeamReady(false);
        }
      } finally {
        if (!cancelled) setAccountReady(true);
      }
    }
    void bootAccount();
    return () => { cancelled = true; };
  }, [storageReady]);

  useEffect(() => {
    if (!activeTripId || !teamReady || !accountReady) return;
    pendingSharedStateRef.current = { items, suggestions, messages, itemNotes, assignmentProposals };
    const serialized = JSON.stringify(pendingSharedStateRef.current);
    if (serialized === lastSyncedStateRef.current || syncInFlightRef.current || syncTimerRef.current !== null) return;
    syncTimerRef.current = window.setTimeout(() => void flushCloudStateRef.current(), 450);
    return () => {
      if (syncTimerRef.current !== null && !syncInFlightRef.current) {
        window.clearTimeout(syncTimerRef.current);
        syncTimerRef.current = null;
      }
    };
  }, [accountReady, activeTripId, assignmentProposals, itemNotes, items, messages, suggestions, teamReady]);

  useEffect(() => {
    if (!activeTripId || !teamReady || !accountReady) return;
    const poll = async () => {
      try {
        const response = await fetch(`/api/trips/${activeTripIdRef.current}/state?since=${tripVersionRef.current}`, { cache: "no-store" });
        if (!response.ok) return;
        const payload = await response.json() as ServerTripPayload & { unchanged?: boolean; currentMember?: Member };
        if (payload.unchanged) {
          if (Array.isArray(payload.members)) setMembers(payload.members);
          return;
        }
        applyCloudPayload(payload);
      } catch {
        setSyncStatus("offline");
      }
    };
    const timer = window.setInterval(() => void poll(), 2500);
    return () => window.clearInterval(timer);
  }, [accountReady, activeTripId, teamReady]);

  useEffect(() => {
    if (!teamReady || phase !== "verify") return;
    const departureImage = new window.Image();
    departureImage.decoding = "async";
    departureImage.src = departureImageSrc;
  }, [phase, teamReady]);

  function applyCloudPayload(payload: ServerTripPayload) {
    if (!payload?.trip || !payload.state) return;
    applyingRemoteRef.current = true;
    const serialized = JSON.stringify(payload.state);
    lastSyncedStateRef.current = serialized;
    pendingSharedStateRef.current = payload.state;
    setItems(payload.state.items ?? []);
    setSuggestions(payload.state.suggestions ?? []);
    setMessages(payload.state.messages ?? []);
    setItemNotes(payload.state.itemNotes ?? []);
    setAssignmentProposals(payload.state.assignmentProposals ?? []);
    setMembers(Array.isArray(payload.members) && payload.members.length ? payload.members : demoMembers.slice(0, 1));
    setDestination(payload.trip.destination);
    setInviteCode(payload.trip.inviteCode);
    setCurrentMember(payload.trip.currentMember);
    setViewedMember(payload.trip.currentMember);
    setActiveTripId(payload.trip.id);
    activeTripIdRef.current = payload.trip.id;
    setTripVersion(payload.version ?? payload.trip.version);
    tripVersionRef.current = payload.version ?? payload.trip.version;
    currentMemberRef.current = payload.trip.currentMember;
    window.localStorage.setItem(cloudTripKey, payload.trip.id);
    setTeamReady(true);
    setCloudError("");
    setSyncStatus("saved");
    window.setTimeout(() => { applyingRemoteRef.current = false; }, 0);
  }

  async function openCloudTrip(tripId: string) {
    const response = await fetch(`/api/trips/${tripId}/state`, { cache: "no-store" });
    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as { error?: string };
      throw new Error(body.error || "无法打开队伍");
    }
    applyCloudPayload(await response.json() as ServerTripPayload);
  }

  async function flushCloudState() {
    if (syncTimerRef.current !== null) {
      window.clearTimeout(syncTimerRef.current);
      syncTimerRef.current = null;
    }
    const tripId = activeTripIdRef.current;
    const state = pendingSharedStateRef.current;
    if (!tripId || !state || syncInFlightRef.current) return;
    const serialized = JSON.stringify(state);
    if (serialized === lastSyncedStateRef.current) return;
    syncInFlightRef.current = true;
    setSyncStatus("saving");
    try {
      const response = await fetch(`/api/trips/${tripId}/state`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ expectedVersion: tripVersionRef.current, state }),
      });
      const result = await response.json().catch(() => ({})) as ServerTripPayload & { error?: string; ok?: boolean; state?: ServerTripPayload["state"] };
      if (response.status === 409 && result.trip && result.state) {
        setSyncStatus("conflict");
        applyCloudPayload(result as ServerTripPayload);
        notify("朋友刚更新了清单，请重试刚才的操作", 3000);
        return;
      }
      if (!response.ok) throw new Error(result.error || "保存失败");
      const savedState = result.state ?? state;
      lastSyncedStateRef.current = JSON.stringify(savedState);
      setTripVersion(result.version);
      tripVersionRef.current = result.version;
      setSyncStatus("saved");
    } catch (error) {
      setCloudError(error instanceof Error ? error.message : "保存失败");
      setSyncStatus("offline");
    } finally {
      syncInFlightRef.current = false;
      const pending = pendingSharedStateRef.current;
      if (pending && JSON.stringify(pending) !== lastSyncedStateRef.current && activeTripIdRef.current) {
        syncTimerRef.current = window.setTimeout(() => void flushCloudState(), 250);
      }
    }
  }

  async function joinTeam() {
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    setCloudError("");
    try {
      const response = await fetch("/api/trips/join", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ inviteCode: code }) });
      const result = await response.json().catch(() => ({})) as ServerTripPayload & { error?: string };
      if (!response.ok) throw new Error(result.error || "加入队伍失败");
      applyCloudPayload({ ...result, version: result.trip.version });
      setShowJoin(false);
      setJoinCode("");
    } catch (error) {
      setCloudError(error instanceof Error ? error.message : "加入队伍失败");
    }
  }

  async function copyInviteCode() {
    if (!inviteCode) return;
    await navigator.clipboard?.writeText(inviteCode);
    notify("邀请码已复制");
  }

  async function installApp() {
    if (!deferredInstallPrompt) {
      setShowInstallGuide(true);
      return;
    }
    await deferredInstallPrompt.prompt();
    const choice = await deferredInstallPrompt.userChoice;
    if (choice.outcome === "accepted") setIsInstalled(true);
    setDeferredInstallPrompt(null);
  }

  function renderInstallGuide() {
    if (!showInstallGuide) return null;
    return <div className="install-guide-modal" role="dialog" aria-modal="true" aria-label="安装带齐到手机">
      <button className="sheet-backdrop" aria-label="关闭安装说明" onClick={() => setShowInstallGuide(false)} />
      <section className="install-guide-card">
        <header><span><Download aria-hidden="true" /></span><div><small>安装到手机</small><h2>把「带齐」放到桌面</h2></div><button onClick={() => setShowInstallGuide(false)} aria-label="关闭"><X aria-hidden="true" /></button></header>
        <div className="install-guide-step"><b>iPhone · Safari</b><p>点击底部的 <Share2 aria-hidden="true" /> 分享，再选择“添加到主屏幕”。</p></div>
        <div className="install-guide-step"><b>Android · Chrome</b><p>点击右上角菜单，再选择“安装应用”或“添加到主屏幕”。</p></div>
        <p className="install-guide-note">安装后会独立全屏打开；当前设备上的清单和偏好也会自动保留。</p>
        <button className="install-guide-done" onClick={() => setShowInstallGuide(false)}>知道了</button>
      </section>
    </div>;
  }

  async function createTeam() {
    const cleanDestination = destination.trim();
    if (!cleanDestination) return;
    const preparedItems = applyPresetItems(items, profile, cleanDestination);
    const cleanItems = preparedItems.map((item) => ({ ...item, owners: item.owners.filter((owner) => owner === "我"), checked: {} }));
    setSuggestionStatus("loading");
    setCloudError("");

    try {
      const createResponse = await fetch("/api/trips", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          destination: cleanDestination,
          name: `${cleanDestination.replaceAll(" · ", "")}小队`,
          state: { items: cleanItems, suggestions: seedSuggestions, messages: [], itemNotes: [], assignmentProposals: [] },
        }),
      });
      const created = await createResponse.json().catch(() => ({})) as ServerTripPayload & { error?: string };
      if (!createResponse.ok) throw new Error(created.error || "创建队伍失败");
      applyCloudPayload(created);
      setUnreadItemIds(new Set());
      setAvailableTrips((current) => [created.trip, ...current.filter((trip) => trip.id !== created.trip.id)]);
    } catch (error) {
      setCloudError(error instanceof Error ? error.message : "创建队伍失败");
      setSuggestionStatus("idle");
      return;
    }

    try {
      const response = await fetch("/api/suggestions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          destination: cleanDestination,
          existingItems: cleanItems.map((item) => item.name),
          preferences: [
            ...habitOptions.filter((option) => profile.habits.includes(option.id)).map((option) => option.label),
          ],
        }),
      });
      if (!response.ok) throw new Error("AI suggestions request failed");

      const result = await response.json() as { suggestions?: Omit<Suggestion, "id" | "icon" | "added">[]; source?: "model" | "fallback" };
      const existingNames = new Set(cleanItems.map((item) => item.name.trim().toLowerCase()));
      const uniqueSuggestions = (result.suggestions ?? [])
        .filter((item, index, all) => !existingNames.has(item.name.trim().toLowerCase()) && all.findIndex((candidate) => candidate.name.trim().toLowerCase() === item.name.trim().toLowerCase()) === index)
        .slice(0, 2)
        .map((item, index) => ({ ...item, id: 101 + index, icon: index === 0 ? "▣" : "⌁", added: false }));

      setSuggestions(uniqueSuggestions);
      setSuggestionStatus(result.source === "model" ? "model" : "fallback");
    } catch {
      setSuggestions(seedSuggestions);
      setSuggestionStatus("fallback");
    }
  }

  function openProfile() {
    setProfileDraft({ ...profile, habits: [...profile.habits], gear: [...profile.gear] });
    setShowProfile(true);
  }

  function toggleHabit(id: HabitPreference) {
    setProfileDraft((current) => ({
      ...current,
      habits: current.habits.includes(id) ? current.habits.filter((entry) => entry !== id) : [...current.habits, id],
    }));
  }

  function toggleGear(id: GearPreference) {
    setProfileDraft((current) => ({
      ...current,
      gear: current.gear.includes(id) ? current.gear.filter((entry) => entry !== id) : [...current.gear, id],
    }));
  }

  async function saveProfile() {
    const nextProfile = { ...profileDraft, displayName: profileDraft.displayName.trim() || "我" };
    setItems((current) => applyPresetItems(current, nextProfile, destination));
    setProfile(nextProfile);
    setShowProfile(false);
    try {
      const response = await fetch("/api/profile", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(nextProfile) });
      if (!response.ok) throw new Error("偏好保存失败");
    } catch {
      notify("偏好已保存在本机，云端稍后重试", 3000);
    }
  }

  function goBackOneStep() {
    setEditMode(false);
    if (phase === "verify") {
      setViewedMember(currentMember);
      setPhase("prepare");
      return;
    }
    setTeamReady(false);
  }

  function renderProfileCenter() {
    if (!showProfile) return null;
    return <div className="profile-modal" role="dialog" aria-modal="true" aria-label="个人中心">
      <button className="sheet-backdrop" aria-label="关闭个人中心" onClick={() => setShowProfile(false)} />
      <section className="profile-card">
        <header className="profile-header">
          <div className="profile-identity"><CharacterAvatar member={currentMember} /><div><small>个人中心</small><h2>{profileDraft.displayName.trim() || "我"}的出行偏好</h2></div></div>
          <button className="profile-close" onClick={() => setShowProfile(false)} aria-label="关闭"><X aria-hidden="true" /></button>
        </header>
        <div className="profile-scroll">
          <label className="profile-name-field"><span>昵称</span><input value={profileDraft.displayName} onChange={(event) => setProfileDraft((current) => ({ ...current, displayName: event.target.value.slice(0, 12) }))} placeholder="朋友会看到这个名字" /></label>

          <section className="profile-section">
            <div className="profile-section-head"><div><h3>旅行时，我更在意</h3><p>可多选，帮助补充更适合你的物品。</p></div><span>{habitOptions.filter((option) => profileDraft.habits.includes(option.id)).length} 项</span></div>
            <div className="preference-grid">{habitOptions.map((option) => {
              const selected = profileDraft.habits.includes(option.id);
              return <button key={option.id} className={selected ? "selected" : ""} aria-pressed={selected} onClick={() => toggleHabit(option.id)}><span>{selected && <Check aria-hidden="true" />}</span><b>{option.label}</b></button>;
            })}</div>
          </section>

          <section className="profile-section">
            <div className="profile-section-head"><div><h3>出行时，我容易</h3><p>可多选，只用于你的个人清单。</p></div><span>{healthOptions.filter((option) => profileDraft.habits.includes(option.id)).length} 项</span></div>
            <div className="preference-grid">{healthOptions.map((option) => {
              const selected = profileDraft.habits.includes(option.id);
              return <button key={option.id} className={selected ? "selected" : ""} aria-pressed={selected} onClick={() => toggleHabit(option.id)}><span>{selected && <Check aria-hidden="true" />}</span><b>{option.label}</b></button>;
            })}</div>
          </section>

          <section className="profile-section">
            <div className="profile-section-head"><div><h3>我有这些设备</h3><p>系统会把相关物品预设进清单，但不会替你认领。</p></div><span>{profileDraft.gear.length} 项</span></div>
            <div className="preference-grid">{gearOptions.map((option) => {
              const selected = profileDraft.gear.includes(option.id);
              return <button key={option.id} className={selected ? "selected" : ""} aria-pressed={selected} onClick={() => toggleGear(option.id)}><span>{selected && <Check aria-hidden="true" />}</span><b>{option.label}</b></button>;
            })}</div>
          </section>

          <p className="profile-privacy">身体情况仅用于你的个人清单；设备信息只用于预设物品。</p>
        </div>
        <footer className="profile-footer"><button onClick={saveProfile}>保存并更新清单 <span>→</span></button></footer>
      </section>
    </div>;
  }

  if (!teamReady) {
    return (
      <main className="app-shell setup-shell">
        <section className="phone-frame setup-frame" aria-label="创建旅行队伍">
          <header className="topbar setup-topbar">
            <Image className="brand-mark" src="/app-icon-192.png?v=2" alt="" width={32} height={32} priority />
            <div className="brand-name">带齐</div>
            {!isInstalled && <button className="install-app-button" onClick={installApp}><Download aria-hidden="true" />安装</button>}
          </header>
          <div className="setup-content">
            <div className="setup-illustration"><CharacterAvatar member="我" /><CharacterAvatar member="阿哲" /><CharacterAvatar member="小雨" /></div>
            <h1>和朋友一起，<br />把行李带齐。</h1>
            <p className="setup-intro">输入目的地，马上生成一份可以共同认领的清单。</p>
            <button className="setup-profile-entry" onClick={openProfile}>
              <CharacterAvatar member="我" />
              <span><b>我的出行偏好</b><small>已设置 {profile.habits.length + profile.gear.length} 项，点击调整</small></span>
              <span aria-hidden="true">›</span>
            </button>
            <label className="setup-field"><span>这次去哪儿？</span><input value={destination} onChange={(event) => setDestination(event.target.value)} placeholder="例如：韩国 · 首尔" /></label>
            {cloudError && <p className="cloud-error" role="alert">{cloudError}</p>}
            {needsSignIn ? <a className="setup-submit setup-signin" href="/signin-with-chatgpt?return_to=%2F">登录后创建或加入队伍 <span>→</span></a> : <button className="setup-submit" onClick={createTeam} disabled={!accountReady} aria-busy={!accountReady}>生成清单 <span>→</span></button>}
            {!needsSignIn && accountReady && <button className="join-team-entry" onClick={() => setShowJoin((current) => !current)}>有邀请码？加入朋友的队伍</button>}
            {!needsSignIn && showJoin && <div className="join-team-form"><input value={joinCode} onChange={(event) => setJoinCode(event.target.value.toUpperCase())} onKeyDown={(event) => event.key === "Enter" && void joinTeam()} maxLength={6} placeholder="输入 6 位邀请码" /><button onClick={() => void joinTeam()}>加入</button></div>}
            {!needsSignIn && availableTrips.length > 0 && <section className="saved-trips"><small>我的队伍</small>{availableTrips.slice(0, 3).map((trip) => <button key={trip.id} onClick={() => void openCloudTrip(trip.id)}><span><b>{trip.name}</b><small>{trip.destination}</small></span><i>›</i></button>)}</section>}
          </div>
          {renderProfileCenter()}
          {renderInstallGuide()}
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
            <div className="departure-illustration-shell">
              <Image className="departure-illustration" src={departureImageSrc} alt="三位朋友带着行李一起出发" width={700} height={700} priority unoptimized />
            </div>
            <h1>带上好心情，出发！</h1>
          </section>
          {renderInstallGuide()}
        </section>
      </main>
    );
  }

  function notify(message: string, duration = 1800, canUndo = false) {
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    if (!canUndo) deletedItemRef.current = null;
    setToast({ message, canUndo });
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      if (canUndo) deletedItemRef.current = null;
      toastTimerRef.current = null;
    }, duration);
  }

  function claim(id: number) {
    setItems((current) => current.map((item) => item.id === id && !isPersonalItem(item) && !item.owners.includes(currentMember) ? { ...item, owners: [...item.owners, currentMember] } : item));
  }

  function release(id: number) {
    setItems((current) => current.map((item) => item.id === id && !isPersonalItem(item) ? { ...item, owners: item.owners.filter((member) => member !== currentMember), checked: { ...item.checked, [currentMember]: false } } : item));
  }

  function togglePacked(item: PackItem) {
    if (viewedMember !== currentMember || (!isPersonalItem(item) && !item.owners.includes(currentMember))) return;
    setItems((current) => current.map((entry) => entry.id === item.id ? {
      ...entry,
      checked: { ...entry.checked, [currentMember]: !entry.checked[currentMember] },
    } : entry));
  }

  function selectAllPacked() {
    if (viewedMember !== currentMember) return;
    setItems((current) => current.map((item) => isPersonalItem(item) || item.owners.includes(currentMember) ? {
      ...item,
      checked: { ...item.checked, [currentMember]: true },
    } : item));
    notify("我的待带物品已全部勾选");
  }

  function focusNextUnchecked() {
    document.querySelector<HTMLElement>('[data-unchecked="true"]')?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function toggleSuggestion(suggestion: Suggestion) {
    if (suggestion.added) {
      const addedItem = items.find((item) => item.id === suggestion.id);
      if (addedItem) {
        removeItem(addedItem, true);
      } else {
        setSuggestions((current) => current.map((entry) => entry.id === suggestion.id ? { ...entry, added: false } : entry));
      }
      return;
    }
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

  function removeItem(item: PackItem, fromNotes = false) {
    if (!editMode && !fromNotes) return;
    deletedItemRef.current = {
      item,
      index: items.findIndex((entry) => entry.id === item.id),
      notes: itemNotes.filter((note) => note.itemId === item.id),
      wasUnread: unreadItemIds.has(item.id),
      proposals: assignmentProposals.filter((proposal) => proposal.itemId === item.id),
      suggestionStates: suggestions.filter((suggestion) => suggestion.name === item.name).map((suggestion) => ({ id: suggestion.id, added: suggestion.added })),
    };
    setItems((current) => current.filter((entry) => entry.id !== item.id));
    setSuggestions((current) => current.map((suggestion) => suggestion.name === item.name ? { ...suggestion, added: false } : suggestion));
    setItemNotes((current) => current.filter((note) => note.itemId !== item.id));
    setUnreadItemIds((current) => {
      const next = new Set(current);
      next.delete(item.id);
      return next;
    });
    setAssignmentProposals((current) => current.filter((proposal) => proposal.itemId !== item.id));
    if (fromNotes) {
      setActiveItemId(null);
    }
    notify(`已删除「${item.name}」`, 3000, true);
  }

  function undoDelete() {
    const snapshot = deletedItemRef.current;
    if (!snapshot) return;
    setItems((current) => {
      if (current.some((entry) => entry.id === snapshot.item.id)) return current;
      const next = [...current];
      next.splice(Math.max(0, Math.min(snapshot.index, next.length)), 0, snapshot.item);
      return next;
    });
    setItemNotes((current) => [...current, ...snapshot.notes]);
    if (snapshot.wasUnread) setUnreadItemIds((current) => new Set(current).add(snapshot.item.id));
    if (snapshot.proposals.length) setAssignmentProposals((current) => [...current, ...snapshot.proposals.filter((proposal) => !current.some((entry) => entry.id === proposal.id && entry.itemId === proposal.itemId))]);
    setSuggestions((current) => current.map((suggestion) => {
      const previous = snapshot.suggestionStates.find((entry) => entry.id === suggestion.id);
      return previous ? { ...suggestion, added: previous.added } : suggestion;
    }));
    deletedItemRef.current = null;
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = null;
    setToast(null);
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
      if (!current) {
        setExpandedCategories(new Set(categories.map((category) => category.name)));
      }
      return !current;
    });
  }

  async function sendMessage() {
    const text = draft.trim();
    if (!text) return;
    const messageId = Date.now();
    const message: ChatMessage = { id: messageId, author: currentMember, text };
    const nextMessages = [...messages, message];
    setMessages(nextMessages);
    setDraft("");
    const mentionedItem = (item: PackItem) => text.includes(item.name) || text.includes(item.name.slice(0, 2));
    const releasedItem = items.find((item) => !isPersonalItem(item) && item.owners.includes(currentMember) && mentionedItem(item));
    const claimedItem = items.find((item) => !isPersonalItem(item) && !item.owners.includes(currentMember) && mentionedItem(item));
    if (hasReleaseIntent(text) && releasedItem) {
      release(releasedItem.id);
    } else if (hasClaimIntent(text) && claimedItem) {
      claim(claimedItem.id);
    }
    if (!activeTripId) return;
    try {
      const response = await fetch(`/api/trips/${activeTripId}/intent`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: nextMessages, items: items.map((item) => ({ id: item.id, name: item.name })) }),
      });
      if (!response.ok) return;
      const result = await response.json() as { assignments?: Array<{ itemId: number; requester: Member; assignee: Member; intent: "claim" | "release" | "request"; confidence: number; evidenceMessageIds: number[] }> };
      const detected = result.assignments ?? [];
      detected.forEach((intent) => {
        if (intent.assignee !== currentMember) return;
        if (intent.intent === "release") release(intent.itemId);
        if (intent.intent === "claim" && intent.requester === currentMember && intent.evidenceMessageIds.length === 1) claim(intent.itemId);
      });
      const proposals = detected.filter((intent) => intent.intent === "claim" && intent.assignee === currentMember && intent.requester !== currentMember).map((intent) => ({
        id: `${messageId}:${intent.itemId}:${intent.assignee}`,
        itemId: intent.itemId,
        requester: intent.requester,
        target: intent.assignee,
        afterMessageId: messageId,
        confidence: intent.confidence,
      }));
      if (proposals.length) setAssignmentProposals((current) => [...current.filter((proposal) => !proposals.some((next) => next.id === proposal.id)), ...proposals]);
    } catch {
      // 聊天本身仍可发送；AI 识别失败不会阻塞朋友交流。
    }
  }

  function resolveAssignmentProposal(proposal: AssignmentProposal, accepted: boolean) {
    const proposalItem = items.find((item) => item.id === proposal.itemId);
    if (!proposalItem) { setAssignmentProposals((current) => current.filter((entry) => entry.id !== proposal.id)); return; }
    if (accepted) claim(proposalItem.id);
    setAssignmentProposals((current) => current.filter((entry) => entry.id !== proposal.id));
  }

  function renderAssignmentProposal(proposal: AssignmentProposal) {
    const proposalItem = items.find((item) => item.id === proposal.itemId);
    if (!proposalItem) return null;
    return <article className="assignment-proposal">
      <div className="proposal-label"><span>✦</span>AI 识别到一项分工</div>
      <div className="proposal-main"><span className="proposal-icon"><ItemGraphic item={proposalItem} /></span><div><b>{proposal.requester}请你带「{proposalItem.name}」</b><small>你刚刚表示同意，要同步到清单吗？</small></div></div>
      <div className="proposal-actions"><button onClick={() => resolveAssignmentProposal(proposal, false)}>我不带</button><button onClick={() => resolveAssignmentProposal(proposal, true)}>我来带</button></div>
    </article>;
  }

  function openItemNotes(itemId: number) {
    if (editMode) return;
    setActiveItemId(itemId);
    setUnreadItemIds((current) => {
      const next = new Set(current);
      next.delete(itemId);
      return next;
    });
  }

  function addItemNote() {
    const text = noteDraft.trim();
    if (!text || !activeItem) return;
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    setItemNotes((current) => [...current, { id: Date.now(), itemId: activeItem.id, author: currentMember, text, time }]);
    setNoteDraft("");
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
    const packed = Boolean(item.checked[viewedMember]);
    const canCheck = viewedMember === currentMember && (personal || currentWillBring);
    const visiblePeerIds = (personal ? personalPrepareItems : prepareItems.filter((entry) => entry.group === item.group)).map((entry) => entry.id);
    const peerPosition = visiblePeerIds.indexOf(item.id);
    const noteCount = itemNotes.filter((note) => note.itemId === item.id).length;
    const hasUnreadDiscussion = unreadItemIds.has(item.id);

    return (
      <article className={`list-item ${packed ? "packed" : ""} ${editMode && phase === "prepare" ? "editing" : ""} ${draggingItemId === item.id ? "dragging" : ""}`} data-sort-item-id={item.id} data-unchecked={phase === "verify" && canCheck && !packed ? "true" : undefined} key={item.id}>
        {phase === "verify" ? (
          <button className={`pack-check ${packed ? "checked" : ""}`} onClick={() => togglePacked(item)} disabled={!canCheck} aria-label={`${packed ? "取消" : "确认"}${item.name}已装包`}>{packed ? "✓" : ""}</button>
        ) : <button className={`item-icon item-icon-button item-group-${categories.findIndex((category) => category.name === item.group)}`} onClick={() => openItemNotes(item.id)} disabled={editMode} aria-label={`打开${item.name}的留言`}><ItemGraphic item={item} /></button>}
        <div className="item-copy">
          {phase === "verify" ? <div className="verify-item-name">
            <span className="item-title-row"><b>{item.name}</b></span>
          </div> : <button className="item-note-trigger" onClick={() => openItemNotes(item.id)} disabled={editMode} aria-label={`打开${item.name}的留言`}>
            <span className="item-title-row"><b>{item.name}</b>{hasUnreadDiscussion && <i className="unread-dot" aria-label="有未读消息" />}</span>
            {(hasUnreadDiscussion || noteCount > 0) && <small>{hasUnreadDiscussion ? "有新留言" : "有留言"}</small>}
          </button>}
          {phase === "prepare" && editMode && <button className="edit-delete-button" onClick={() => removeItem(item)} aria-label={`删除${item.name}`} title="删除"><Trash2 aria-hidden="true" /></button>}
        </div>
        {phase === "verify" && viewedMember === currentMember && !personal && currentWillBring && <button className="verify-release-button" onClick={() => release(item.id)} aria-label={`不再携带${item.name}`}>我不带了</button>}
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
        {phase === "prepare" && !editMode && (personal ? <span className="personal-pill">每人自备</span> : item.owners.length ? (
            <div className="shared-owner-action">
              <div className="owner-avatars" aria-label={`${item.owners.join("、")}会带`}>
                {ownerMembers.slice(0, 4).map((owner) => <button className="owner-avatar" key={owner?.name} onClick={() => phase === "prepare" && owner?.name === currentMember && release(item.id)} disabled={owner?.name !== currentMember} title={owner?.name === currentMember ? "取消我会带" : `${owner?.profile ?? owner?.name}会带`}>{owner && <CharacterAvatar member={owner.name} />}</button>)}
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
      <section className="phone-frame" aria-label="带齐旅行物品协作应用">
        <div className="scroll-area main-scroll-area">
          <section className="trip-hero compact-trip-hero">
            <button className="main-back-button" onClick={goBackOneStep} aria-label="返回上一步" title="返回上一步"><ArrowLeft aria-hidden="true" /></button>
            <h1>{phase === "prepare" ? "这次带什么？" : "出发前逐件确认"}</h1>
            <div className="presence-panel">
              <div className={`member-switch ${phase === "verify" ? "switchable" : ""}`} aria-label={phase === "verify" ? "切换查看成员清单" : "成员在线状态"}>
                {members.map((member) => phase === "verify" ? <button key={member.name} className={viewedMember === member.name ? "selected" : ""} onClick={() => setViewedMember(member.name)} title={`查看${member.profile}的清单`}><CharacterAvatar member={member.name} /><i className={member.online ? "online" : "offline"} /></button> : member.name === currentMember ? <button className="profile-avatar-button" key={member.name} onClick={openProfile} aria-label="打开我的出行偏好" title="我的出行偏好"><CharacterAvatar member={member.name} /><i className="online" /></button> : <span className="member-presence" key={member.name} title={`${member.profile}${member.online ? "在线" : "离线"}`}><CharacterAvatar member={member.name} /><i className={member.online ? "online" : "offline"} /></span>)}
              </div>
              {phase === "prepare" && <button className="invite-friends-button" onClick={() => setShowInvite(true)} aria-label="邀请朋友加入队伍" title="邀请朋友"><Share2 aria-hidden="true" /></button>}
            </div>
          </section>

          <div className="phase-tabs" role="tablist" aria-label="准备阶段">
            <button className={phase === "prepare" ? "active" : ""} onClick={() => setPhase("prepare")}><span>1</span>准备清单</button>
            <button className={phase === "verify" ? "active" : ""} onClick={() => { setEditMode(false); setPhase("verify"); }}><span>2</span>出发核对</button>
          </div>

          {phase === "prepare" && (suggestionStatus === "loading" || suggestions.length > 0) && <section className="ai-section">
            <header>
              <div className="ai-title"><span><Sparkles aria-hidden="true" /></span><h2>{suggestionStatus === "loading" ? "AI 正在检查清单有没有漏项" : `AI 帮你补充了 ${suggestions.length} 件容易漏带的物品`}</h2></div>
            </header>
            <div className={`suggestion-scroll ${suggestionStatus === "loading" ? "loading" : ""}`}>
              {suggestions.slice(0, 2).map((suggestion) => (
                <article className={`suggestion-card ${suggestion.added ? "added" : ""}`} key={suggestion.id}>
                  <div className="suggestion-main"><div className={`suggestion-icon suggestion-${suggestion.id}`}><ItemGraphic item={suggestion} /></div><h3>{suggestion.name}</h3></div>
                  <p title={suggestion.reason}>{suggestion.reason}</p>
                  <button className={suggestion.added ? "remove-suggestion" : ""} onClick={() => toggleSuggestion(suggestion)} aria-label={suggestion.added ? `从清单移出${suggestion.name}` : `将${suggestion.name}加入清单`}>{suggestion.added ? "－ 移出清单" : "＋ 加入清单"}</button>
                </article>
              ))}
            </div>
          </section>}

          {phase === "prepare" && <div className="list-controls">
            <nav className="list-filters" aria-label="筛选准备清单">
              <button className={listFilter === "all" ? "active" : ""} onClick={() => setListFilter("all")}>全部 <span>{items.length}</span></button>
              <button className={listFilter === "mine" ? "active" : ""} onClick={() => { setEditMode(false); setListFilter("mine"); }}>我的 <span>{myItems.length}</span></button>
              <button className={listFilter === "unassigned" ? "active" : ""} onClick={() => { setEditMode(false); setListFilter("unassigned"); }}>待分工 <span>{unassignedItems.length}</span></button>
            </nav>
            <button className={`edit-list-button ${editMode ? "active" : ""}`} onClick={toggleEditMode}>{editMode ? "完成" : "编辑"}</button>
          </div>}

          {phase === "prepare" ? <section className="filtered-list-section">
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
              <b>{viewedMember === currentMember ? "我的物品" : members.find((member) => member.name === viewedMember)?.profile ?? viewedMember} · {verifiedCount}/{verifyItems.length}</b>
              {viewedMember === currentMember ? <button className="select-all-button" onClick={selectAllPacked} disabled={status.total === 0}>{status.total === 0 ? "✓ 已完成" : "全选"}</button> : <button className="remind-button" onClick={() => notify(`已提醒${members.find((member) => member.name === viewedMember)?.profile ?? viewedMember}尽快收拾`)}>提醒TA</button>}
            </header>
            <div className="item-list">{verifyItems.map(renderItem)}</div>
          </section>}
        </div>

        <footer className="action-bar">
          {phase === "prepare" && <button className="add-item" onClick={() => setShowAdd(true)} aria-label="添加物品">＋</button>}
          {phase === "prepare" && <button className="team-chat-action" onClick={() => setShowChat(true)} aria-label={assignmentProposals.length ? `团队聊天，有${assignmentProposals.length}项分工待确认` : "团队聊天"} title="团队聊天"><MessageCircle aria-hidden="true" />{assignmentProposals.length > 0 && <i>{assignmentProposals.length}</i>}</button>}
          {phase === "prepare" ? (
            <button className="primary-action" onClick={() => { setEditMode(false); setPhase("verify"); }}>进入出发核对 <span>→</span></button>
          ) : viewedMember !== currentMember ? (
            <button className="primary-action" onClick={() => setViewedMember(currentMember)}>返回我的核对清单 <span>→</span></button>
          ) : (
            <button className={`primary-action ${myRemaining === 0 ? "ready" : ""}`} onClick={() => myRemaining ? focusNextUnchecked() : setPhase("departed")}>{myRemaining ? "下一件未确认" : "东西带齐 · 出发"}<span>{myRemaining ? "↑" : "→"}</span></button>
          )}
        </footer>

        {showChat && (
          <div className="bottom-sheet" role="dialog" aria-modal="true" aria-label="团队聊天">
            <button className="sheet-backdrop" aria-label="关闭" onClick={() => setShowChat(false)} />
            <section className="sheet-card chat-card">
              <span className="sheet-handle" />
              <header className="chat-header"><div><h2>团队聊天</h2></div><button onClick={() => setShowChat(false)}>×</button></header>
              <div className="chat-messages">
                {messages.length ? messages.map((message) => {
                  const meta = members.find((member) => member.name === message.author);
                  return <Fragment key={message.id}>
                    <div className={`message-row ${message.author === currentMember ? "mine" : ""} ${message.system ? "system" : ""}`}>{meta ? <CharacterAvatar member={meta.name} className="message-avatar" /> : <span className="message-avatar assistant-avatar">✦</span>}<div><small>{message.author === currentMember ? "我" : meta?.profile ?? message.author}</small><p>{message.text}</p></div></div>
                    {assignmentProposals.filter((proposal) => proposal.afterMessageId === message.id && proposal.target === currentMember).map((proposal) => <Fragment key={proposal.id ?? `${proposal.afterMessageId}:${proposal.itemId}`}>{renderAssignmentProposal(proposal)}</Fragment>)}
                  </Fragment>;
                }) : <div className="chat-empty"><span>•••</span><b>还没有消息</b><small>和朋友聊聊谁带什么。</small></div>}
              </div>
              <div className="chat-composer"><input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => event.key === "Enter" && sendMessage()} placeholder="聊聊谁带什么…" /><button onClick={sendMessage} aria-label="发送消息">↑</button></div>
            </section>
          </div>
        )}

        {showInvite && (
          <div className="invite-modal" role="dialog" aria-modal="true" aria-label="邀请朋友加入队伍">
            <button className="sheet-backdrop" aria-label="关闭" onClick={() => setShowInvite(false)} />
            <section className="invite-card">
              <button className="profile-close" onClick={() => setShowInvite(false)} aria-label="关闭"><X aria-hidden="true" /></button>
              <span className="invite-spark"><Sparkles aria-hidden="true" /></span>
              <h2>邀请朋友一起准备</h2>
              <p>让朋友登录「带齐」，输入这个邀请码即可加入。</p>
              <button className="invite-code" onClick={() => void copyInviteCode()}><b>{inviteCode}</b><small>点击复制</small></button>
              <small className="sync-state" aria-live="polite">{syncStatus === "saving" ? "正在同步…" : syncStatus === "offline" ? "当前离线，恢复后会重试" : "清单已云端同步"}</small>
            </section>
          </div>
        )}

        {activeItem && phase === "prepare" && (
          <div className="item-note-modal" role="dialog" aria-modal="true" aria-label={`${activeItem.name}的留言`}>
            <button className="sheet-backdrop" aria-label="关闭" onClick={() => setActiveItemId(null)} />
            <div className="item-note-dialog-stack">
              <section className="item-notes-card">
                <header className="item-notes-header">
                  <span className={`item-icon item-group-${categories.findIndex((category) => category.name === activeItem.group)}`}><ItemGraphic item={activeItem} /></span>
                  <div><small>物品留言</small><h2>{activeItem.name}</h2></div>
                </header>
                <div className="item-note-list">
                  {activeItemNotes.length ? activeItemNotes.map((note) => <article className="item-note-row" key={note.id}>
                    <CharacterAvatar member={note.author} className="item-note-avatar" />
                    <div><header><b>{note.author}</b><time>{note.time}</time></header><p>{note.text}</p></div>
                  </article>) : <div className="item-note-empty"><span>＋</span><b>还没有留言</b><small>写下第一条，朋友打开这件物品就能看到。</small></div>}
                </div>
                <div className="item-note-composer"><input value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} onKeyDown={(event) => event.key === "Enter" && addItemNote()} placeholder="写一条留言…" /><button onClick={addItemNote} aria-label="发布留言">↑</button></div>
              </section>
              <footer className="item-note-actions">
                <button className="note-delete-action" onClick={() => removeItem(activeItem, true)}><span><Trash2 aria-hidden="true" /></span><small>删除</small></button>
                {!isPersonalItem(activeItem) && <>
                  <button className={`note-bring-action ${activeItem.owners.includes(currentMember) ? "is-selected" : ""}`} aria-pressed={activeItem.owners.includes(currentMember)} onClick={() => { claim(activeItem.id); setActiveItemId(null); }}><span aria-hidden="true">＋</span><small>我来带</small></button>
                  <button className={`note-release-action ${activeItem.owners.includes(currentMember) ? "" : "is-selected"}`} aria-pressed={!activeItem.owners.includes(currentMember)} onClick={() => { release(activeItem.id); setActiveItemId(null); }}><span aria-hidden="true">−</span><small>我不带</small></button>
                </>}
                <button className="note-close-action" onClick={() => setActiveItemId(null)}><span aria-hidden="true">×</span><small>关闭</small></button>
              </footer>
            </div>
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

        {renderProfileCenter()}

        {renderInstallGuide()}

        {toast && <div className="toast" role="status"><span>{toast.message}</span>{toast.canUndo && <button onClick={undoDelete}>撤回</button>}</div>}
      </section>

    </main>
  );
}
