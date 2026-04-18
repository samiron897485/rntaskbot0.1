import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { eq } from "drizzle-orm";
import {
  usersStore,
  tasksStore,
  withdrawalsStore,
  couponsStore,
  adminConfigStore,
  ipUsersStore,
  deviceUsersStore,
  taskTimestampsStore,
  spamFlagsStore,
} from "@workspace/db/schema";
import { logger } from "../lib/logger.js";
import type {
  UserData,
  Task,
  WithdrawalRequest,
  CouponCode,
  AdminConfig,
  SpamFlag,
} from "./types.js";

const { Pool } = pg;

type DrizzleDb = ReturnType<typeof drizzle>;
let db: DrizzleDb | null = null;

const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS users_store (id TEXT PRIMARY KEY, data JSONB NOT NULL);
CREATE TABLE IF NOT EXISTS tasks_store (id TEXT PRIMARY KEY, link TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL, expires_at TIMESTAMPTZ NOT NULL);
CREATE TABLE IF NOT EXISTS withdrawals_store (id TEXT PRIMARY KEY, data JSONB NOT NULL);
CREATE TABLE IF NOT EXISTS coupons_store (code TEXT PRIMARY KEY, data JSONB NOT NULL);
CREATE TABLE IF NOT EXISTS admin_config_store (id INTEGER PRIMARY KEY DEFAULT 1, data JSONB NOT NULL);
CREATE TABLE IF NOT EXISTS ip_users_store (ip TEXT PRIMARY KEY, user_ids JSONB NOT NULL);
CREATE TABLE IF NOT EXISTS device_users_store (device_id TEXT PRIMARY KEY, user_ids JSONB NOT NULL);
CREATE TABLE IF NOT EXISTS task_timestamps_store (user_id TEXT PRIMARY KEY, timestamps JSONB NOT NULL);
CREATE TABLE IF NOT EXISTS spam_flags_store (user_id TEXT PRIMARY KEY, data JSONB NOT NULL);
`;

export async function initDb(): Promise<void> {
  const url = process.env["DATABASE_URL"];
  if (!url) {
    logger.warn("DATABASE_URL not set — running in memory-only mode. Data will NOT persist across restarts.");
    return;
  }
  const needsSsl = !url.includes("sslmode=disable") && !url.includes("localhost") && !url.includes("127.0.0.1");
  try {
    const pool = new Pool({
      connectionString: url,
      ssl: needsSsl ? { rejectUnauthorized: false } : false,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 15000,
    });
    await pool.query("SELECT 1");
    await pool.query(CREATE_TABLES_SQL);
    db = drizzle(pool);
    logger.info("Database connected and tables ready");
  } catch (e) {
    logger.error({ err: e }, "Failed to connect to database — falling back to memory-only mode");
    db = null;
  }
}

export function isDbReady(): boolean {
  return db !== null;
}

function save(fn: () => Promise<void>): void {
  if (!db) return;
  fn().catch((err) => {
    const msg = String(err?.message ?? "");
    if (msg.includes("timeout") || msg.includes("connect")) {
      setTimeout(() => {
        if (!db) return;
        fn().catch((e2) => logger.error({ err: e2 }, "DB write error (retry failed)"));
      }, 3000);
    } else {
      logger.error({ err }, "DB write error");
    }
  });
}

export async function loadAllData(): Promise<{
  users: Record<string, UserData>;
  tasks: Task[];
  withdrawals: WithdrawalRequest[];
  coupons: Record<string, CouponCode>;
  adminConfig: AdminConfig | null;
  ipToUsers: Record<string, string[]>;
  deviceToUsers: Record<string, string[]>;
  taskTimestamps: Record<string, number[]>;
  spamFlags: Record<string, SpamFlag>;
}> {
  const empty = {
    users: {} as Record<string, UserData>,
    tasks: [] as Task[],
    withdrawals: [] as WithdrawalRequest[],
    coupons: {} as Record<string, CouponCode>,
    adminConfig: null,
    ipToUsers: {} as Record<string, string[]>,
    deviceToUsers: {} as Record<string, string[]>,
    taskTimestamps: {} as Record<string, number[]>,
    spamFlags: {} as Record<string, SpamFlag>,
  };
  if (!db) return empty;

  try {
    const [
      usersRows, tasksRows, withdrawalsRows, couponsRows,
      adminRows, ipRows, deviceRows, tsRows, spamRows,
    ] = await Promise.all([
      db.select().from(usersStore),
      db.select().from(tasksStore),
      db.select().from(withdrawalsStore),
      db.select().from(couponsStore),
      db.select().from(adminConfigStore),
      db.select().from(ipUsersStore),
      db.select().from(deviceUsersStore),
      db.select().from(taskTimestampsStore),
      db.select().from(spamFlagsStore),
    ]);

    const users: Record<string, UserData> = {};
    for (const row of usersRows) {
      const d = row.data as UserData;
      users[row.id] = {
        ...d,
        joinDate: new Date(d.joinDate),
        earningHistory: (d.earningHistory || []).map((h: { amount: number; reason: string; date: string | Date }) => ({
          ...h,
          date: new Date(h.date),
        })),
      };
    }

    const tasks: Task[] = tasksRows.map((r) => ({
      id: r.id,
      link: r.link,
      createdAt: new Date(r.createdAt),
      expiresAt: new Date(r.expiresAt),
    }));

    const withdrawals: WithdrawalRequest[] = withdrawalsRows.map((r) => {
      const d = r.data as WithdrawalRequest;
      return { ...d, createdAt: new Date(d.createdAt) };
    });

    const coupons: Record<string, CouponCode> = {};
    for (const row of couponsRows) {
      const d = row.data as CouponCode;
      coupons[row.code] = { ...d, createdAt: new Date(d.createdAt) };
    }

    const adminConfig: AdminConfig | null = adminRows[0]
      ? (adminRows[0].data as AdminConfig)
      : null;

    const ipToUsers: Record<string, string[]> = {};
    for (const r of ipRows) ipToUsers[r.ip] = r.userIds as string[];

    const deviceToUsers: Record<string, string[]> = {};
    for (const r of deviceRows) deviceToUsers[r.deviceId] = r.userIds as string[];

    const taskTimestamps: Record<string, number[]> = {};
    for (const r of tsRows) taskTimestamps[r.userId] = r.timestamps as number[];

    const spamFlags: Record<string, SpamFlag> = {};
    for (const r of spamRows) {
      const d = r.data as SpamFlag;
      spamFlags[r.userId] = { ...d, detectedAt: new Date(d.detectedAt) };
    }

    logger.info(
      { users: Object.keys(users).length, tasks: tasks.length, withdrawals: withdrawals.length },
      "Data loaded from database"
    );
    return { users, tasks, withdrawals, coupons, adminConfig, ipToUsers, deviceToUsers, taskTimestamps, spamFlags };
  } catch (e) {
    logger.error({ err: e }, "Failed to load data from database");
    return empty;
  }
}

export function saveUser(userId: string, data: UserData): void {
  save(async () => {
    await db!.insert(usersStore).values({ id: userId, data: data as never })
      .onConflictDoUpdate({ target: usersStore.id, set: { data: data as never } });
  });
}

export function saveTask(task: Task): void {
  save(async () => {
    await db!.insert(tasksStore)
      .values({ id: task.id, link: task.link, createdAt: task.createdAt, expiresAt: task.expiresAt })
      .onConflictDoUpdate({ target: tasksStore.id, set: { link: task.link, expiresAt: task.expiresAt } });
  });
}

export function removeTask(taskId: string): void {
  save(async () => {
    await db!.delete(tasksStore).where(eq(tasksStore.id, taskId));
  });
}

export function saveWithdrawal(wr: WithdrawalRequest): void {
  save(async () => {
    await db!.insert(withdrawalsStore).values({ id: wr.id, data: wr as never })
      .onConflictDoUpdate({ target: withdrawalsStore.id, set: { data: wr as never } });
  });
}

export function deleteWithdrawalFromDb(id: string): void {
  save(async () => {
    await db!.delete(withdrawalsStore).where(eq(withdrawalsStore.id, id));
  });
}

export function saveCoupon(coupon: CouponCode): void {
  save(async () => {
    await db!.insert(couponsStore).values({ code: coupon.code, data: coupon as never })
      .onConflictDoUpdate({ target: couponsStore.code, set: { data: coupon as never } });
  });
}

export function saveAdminConfig(config: AdminConfig): void {
  save(async () => {
    await db!.insert(adminConfigStore).values({ id: 1, data: config as never })
      .onConflictDoUpdate({ target: adminConfigStore.id, set: { data: config as never } });
  });
}

export function saveIpUsers(ip: string, userIds: string[]): void {
  save(async () => {
    await db!.insert(ipUsersStore).values({ ip, userIds: userIds as never })
      .onConflictDoUpdate({ target: ipUsersStore.ip, set: { userIds: userIds as never } });
  });
}

export function saveDeviceUsers(deviceId: string, userIds: string[]): void {
  save(async () => {
    await db!.insert(deviceUsersStore).values({ deviceId, userIds: userIds as never })
      .onConflictDoUpdate({ target: deviceUsersStore.deviceId, set: { userIds: userIds as never } });
  });
}

export function saveTaskTimestamps(userId: string, timestamps: number[]): void {
  save(async () => {
    await db!.insert(taskTimestampsStore).values({ userId, timestamps: timestamps as never })
      .onConflictDoUpdate({ target: taskTimestampsStore.userId, set: { timestamps: timestamps as never } });
  });
}

export function saveSpamFlag(userId: string, flag: SpamFlag): void {
  save(async () => {
    await db!.insert(spamFlagsStore).values({ userId, data: flag as never })
      .onConflictDoUpdate({ target: spamFlagsStore.userId, set: { data: flag as never } });
  });
}

export function removeSpamFlag(userId: string): void {
  save(async () => {
    await db!.delete(spamFlagsStore).where(eq(spamFlagsStore.userId, userId));
  });
}

export function deleteCoupon(code: string): void {
  save(async () => {
    await db!.delete(couponsStore).where(eq(couponsStore.code, code));
  });
}

export function deleteIpRecord(ip: string): void {
  save(async () => {
    await db!.delete(ipUsersStore).where(eq(ipUsersStore.ip, ip));
  });
}

export function deleteDeviceRecord(deviceId: string): void {
  save(async () => {
    await db!.delete(deviceUsersStore).where(eq(deviceUsersStore.deviceId, deviceId));
  });
}
