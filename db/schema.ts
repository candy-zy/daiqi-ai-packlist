import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("idx_users_email").on(table.email)]);

export const profiles = sqliteTable("profiles", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull(),
  habitsJson: text("habits_json").notNull().default("[]"),
  gearJson: text("gear_json").notNull().default("[]"),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const trips = sqliteTable("trips", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  destination: text("destination").notNull(),
  ownerId: text("owner_id").notNull().references(() => users.id),
  inviteCode: text("invite_code").notNull(),
  version: integer("version").notNull().default(1),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("idx_trips_invite_code").on(table.inviteCode), index("idx_trips_owner").on(table.ownerId)]);

export const tripMembers = sqliteTable("trip_members", {
  tripId: text("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  slotName: text("slot_name").notNull(),
  role: text("role", { enum: ["owner", "member"] }).notNull().default("member"),
  joinedAt: text("joined_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  lastSeenAt: text("last_seen_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  primaryKey({ columns: [table.tripId, table.userId] }),
  uniqueIndex("idx_trip_members_slot").on(table.tripId, table.slotName),
  index("idx_trip_members_user").on(table.userId),
]);

export const tripSnapshots = sqliteTable("trip_snapshots", {
  tripId: text("trip_id").primaryKey().references(() => trips.id, { onDelete: "cascade" }),
  stateJson: text("state_json").notNull(),
  version: integer("version").notNull().default(1),
  updatedBy: text("updated_by").notNull().references(() => users.id),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const tripItems = sqliteTable("trip_items", {
  id: text("id").primaryKey(),
  tripId: text("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
  clientId: integer("client_id").notNull(),
  name: text("name").notNull(),
  icon: text("icon").notNull().default(""),
  category: text("category").notNull(),
  aiReason: text("ai_reason"),
  position: integer("position").notNull().default(0),
  createdBy: text("created_by").notNull().references(() => users.id),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("idx_trip_items_client").on(table.tripId, table.clientId), index("idx_trip_items_trip_position").on(table.tripId, table.position)]);

export const itemOwners = sqliteTable("item_owners", {
  itemId: text("item_id").notNull().references(() => tripItems.id, { onDelete: "cascade" }),
  tripId: text("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
  memberSlot: text("member_slot").notNull(),
  checked: integer("checked", { mode: "boolean" }).notNull().default(false),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [primaryKey({ columns: [table.itemId, table.memberSlot] }), index("idx_item_owners_trip_member").on(table.tripId, table.memberSlot)]);

export const itemNotes = sqliteTable("item_notes", {
  id: text("id").primaryKey(),
  tripId: text("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
  itemClientId: integer("item_client_id").notNull(),
  authorSlot: text("author_slot").notNull(),
  body: text("body").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_item_notes_trip_item").on(table.tripId, table.itemClientId, table.createdAt)]);

export const chatMessages = sqliteTable("chat_messages", {
  id: text("id").primaryKey(),
  tripId: text("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
  authorSlot: text("author_slot").notNull(),
  body: text("body").notNull(),
  isSystem: integer("is_system", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_chat_messages_trip_time").on(table.tripId, table.createdAt)]);

export const assignmentProposals = sqliteTable("assignment_proposals", {
  id: text("id").primaryKey(),
  tripId: text("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
  messageId: text("message_id").notNull(),
  itemClientId: integer("item_client_id").notNull(),
  requesterSlot: text("requester_slot").notNull(),
  targetSlot: text("target_slot").notNull(),
  intent: text("intent").notNull(),
  confidence: integer("confidence").notNull(),
  status: text("status", { enum: ["pending", "accepted", "rejected"] }).notNull().default("pending"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  resolvedAt: text("resolved_at"),
}, (table) => [index("idx_assignment_proposals_trip_status").on(table.tripId, table.status)]);

export const tripEvents = sqliteTable("trip_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tripId: text("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
  actorId: text("actor_id").notNull().references(() => users.id),
  eventType: text("event_type").notNull(),
  version: integer("version").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_trip_events_trip_version").on(table.tripId, table.version)]);
