import { pgTable, text, integer, jsonb, timestamp } from "drizzle-orm/pg-core";

export const usersStore = pgTable("users_store", {
  id: text("id").primaryKey(),
  data: jsonb("data").notNull(),
});

export const tasksStore = pgTable("tasks_store", {
  id: text("id").primaryKey(),
  link: text("link").notNull(),
  createdAt: timestamp("created_at").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
});

export const withdrawalsStore = pgTable("withdrawals_store", {
  id: text("id").primaryKey(),
  data: jsonb("data").notNull(),
});

export const couponsStore = pgTable("coupons_store", {
  code: text("code").primaryKey(),
  data: jsonb("data").notNull(),
});

export const adminConfigStore = pgTable("admin_config_store", {
  id: integer("id").primaryKey().default(1),
  data: jsonb("data").notNull(),
});

export const ipUsersStore = pgTable("ip_users_store", {
  ip: text("ip").primaryKey(),
  userIds: jsonb("user_ids").notNull(),
});

export const deviceUsersStore = pgTable("device_users_store", {
  deviceId: text("device_id").primaryKey(),
  userIds: jsonb("user_ids").notNull(),
});

export const taskTimestampsStore = pgTable("task_timestamps_store", {
  userId: text("user_id").primaryKey(),
  timestamps: jsonb("timestamps").notNull(),
});

export const spamFlagsStore = pgTable("spam_flags_store", {
  userId: text("user_id").primaryKey(),
  data: jsonb("data").notNull(),
});
