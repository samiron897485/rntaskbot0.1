export type {
  AdminConfig,
  Task,
  WithdrawalRequest,
  EarningHistoryEntry,
  UserData,
  CouponCode,
  SpamFlag,
  WithdrawStep,
  WalletStep,
  BanStep,
  CouponAdminStep,
} from "./types.js";

import type {
  AdminConfig,
  Task,
  WithdrawalRequest,
  UserData,
  CouponCode,
  SpamFlag,
} from "./types.js";

import {
  saveUser,
  saveTask,
  removeTask as dbRemoveTask,
  saveWithdrawal,
  saveCoupon,
  saveAdminConfig,
  saveIpUsers,
  saveDeviceUsers,
  saveTaskTimestamps,
  saveSpamFlag,
  removeSpamFlag,
  deleteWithdrawalFromDb,
  deleteIpRecord,
  deleteDeviceRecord,
  deleteCoupon,
} from "./persistence.js";

export const adminConfig: AdminConfig = {
  minWithdraw: 10,
  coinToMoneyRate: 10,
  companyCoinRate: 100,
  taskDuration: 20,
  taskExpiry: 12,
  referralEnabled: true,
  referralBonus: 2,
  perTaskCommission: 0,
  lifetimeCommission: false,
  supportLink: "",
  defaultLanguage: "en",
  withdrawOptions: [10, 50, 100, 200],
  withdrawCooldownHours: 0,
  couponLink: "",
  referralTaskRequirement: 0,
  policy: "",
  couponEligibility: { hours: 0, tasks: 0 },
  withdrawEligibility: { hours: 0, tasks: 0 },
  checkInDailyReward: 1,
  checkInRequiredTasks: 0,
  legacyTaskCoinOffset: 0,
  taskRewardCoins: 1,
  interstitialAdEnabled: false,
  interstitialAdCode: "",
  interstitialAdDurationSec: 7,
  interstitialAdMinWaitSec: 3,
};

export function addWithdrawOption(amount: number): boolean {
  if (adminConfig.withdrawOptions.includes(amount)) return false;
  adminConfig.withdrawOptions.push(amount);
  adminConfig.withdrawOptions.sort((a, b) => a - b);
  saveAdminConfig(adminConfig);
  return true;
}

export function removeWithdrawOption(amount: number): boolean {
  const idx = adminConfig.withdrawOptions.indexOf(amount);
  if (idx === -1) return false;
  adminConfig.withdrawOptions.splice(idx, 1);
  saveAdminConfig(adminConfig);
  return true;
}

export function getAdminConfig(): AdminConfig {
  return adminConfig;
}

export function updateAdminConfig(data: Partial<AdminConfig>): void {
  Object.assign(adminConfig, data);
  saveAdminConfig(adminConfig);
}

const tasks: Task[] = [];
const users: Record<string, UserData> = {};
const withdrawals: WithdrawalRequest[] = [];
const couponCodes: Record<string, CouponCode> = {};
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function getISTDayWindow(dateMs = Date.now()): { fromMs: number; toMs: number; date: string } {
  const istMs = dateMs + IST_OFFSET_MS;
  const startIST = istMs - (istMs % DAY_MS);
  const fromMs = startIST - IST_OFFSET_MS;
  const toMs = fromMs + DAY_MS - 1;
  const date = new Date(startIST).toISOString().split("T")[0]!;
  return { fromMs, toMs, date };
}

function toISTDateKey(dateMs: number): string {
  const startIST = dateMs + IST_OFFSET_MS;
  return new Date(startIST).toISOString().split("T")[0]!;
}

export type WithdrawStep = "amount" | "name" | "qr";
const pendingWithdrawInput: Record<string, {
  step: WithdrawStep;
  amount?: number;
  name?: string;
}> = {};

const pendingTaskInput: Record<string, boolean> = {};

function generateReferralCode(userId: string): string {
  return `REF${userId.slice(-6).toUpperCase()}`;
}

export function populateFromDb(data: {
  users: Record<string, UserData>;
  tasks: Task[];
  withdrawals: WithdrawalRequest[];
  coupons: Record<string, CouponCode>;
  adminConfig: AdminConfig | null;
  ipToUsers: Record<string, string[]>;
  deviceToUsers: Record<string, string[]>;
  taskTimestamps: Record<string, number[]>;
  spamFlags: Record<string, SpamFlag>;
}): void {
  Object.assign(users, data.users);
  tasks.push(...data.tasks);
  withdrawals.push(...data.withdrawals);
  Object.assign(couponCodes, data.coupons);
  if (data.adminConfig) Object.assign(adminConfig, data.adminConfig);
  Object.assign(ipToUsers, data.ipToUsers);
  Object.assign(deviceToUsers, data.deviceToUsers);
  Object.assign(taskTimestamps, data.taskTimestamps);
  Object.assign(spamFlags, data.spamFlags);
}

export function getUser(userId: string): UserData {
  if (!users[userId]) {
    users[userId] = {
      coins: 0,
      completedTasks: [],
      skippedTasks: [],
      currentTaskIndex: 0,
      language: adminConfig.defaultLanguage,
      referralCode: generateReferralCode(userId),
      referralEarnings: 0,
      totalReferrals: 0,
      joinDate: new Date(),
      earningHistory: [],
    };
    saveUser(userId, users[userId]);
  }
  return users[userId];
}

export function updateUser(userId: string, data: Partial<UserData>): void {
  const user = getUser(userId);
  users[userId] = { ...user, ...data };
  saveUser(userId, users[userId]);
}

function categoryFromReason(reason: string): keyof NonNullable<UserData["earningsByCategory"]> {
  if (reason === "Task Completed") return "task";
  if (reason.startsWith("Referral")) return "referral";
  if (reason.startsWith("Coupon:")) return "coupon";
  if (reason === "Daily Check-In") return "checkIn";
  return "adminWallet";
}

export function addEarningHistory(userId: string, amount: number, reason: string): void {
  const user = getUser(userId);
  const history = user.earningHistory || [];
  history.push({ amount, reason, date: new Date() });
  if (history.length > 100) history.splice(0, history.length - 100);

  const cat = categoryFromReason(reason);
  const prev = user.earningsByCategory ?? { task: 0, referral: 0, coupon: 0, checkIn: 0, adminWallet: 0 };
  const earningsByCategory = { ...prev, [cat]: (prev[cat] || 0) + amount };

  users[userId] = { ...user, earningHistory: history, earningsByCategory };
  saveUser(userId, users[userId]);
}

export function getUserByReferralCode(code: string): string | null {
  for (const [userId, user] of Object.entries(users)) {
    if (user.referralCode === code) return userId;
  }
  return null;
}

// Tasks that will expire within this many milliseconds are NOT given out to
// users, so nobody starts a task they cannot finish in time.
const EXPIRY_SAFETY_MARGIN_MS = 30 * 1000;

export function getActiveTasks(): Task[] {
  const cutoff = new Date(Date.now() + EXPIRY_SAFETY_MARGIN_MS);
  return tasks.filter((t) => t.expiresAt > cutoff);
}

export function getTaskById(taskId: string): Task | undefined {
  return tasks.find((t) => t.id === taskId);
}

export function isLinkDuplicate(link: string): boolean {
  const normalized = link.trim().toLowerCase();
  return tasks.some((t) => t.link.trim().toLowerCase() === normalized);
}

export function addTask(link: string): Task {
  const expiryHours = adminConfig.taskExpiry;
  const newTask: Task = {
    id: `task_${Date.now()}`,
    link,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + expiryHours * 60 * 60 * 1000),
  };
  tasks.push(newTask);
  saveTask(newTask);
  return newTask;
}

export function deleteTask(taskId: string): boolean {
  const idx = tasks.findIndex((t) => t.id === taskId);
  if (idx === -1) return false;
  tasks.splice(idx, 1);
  dbRemoveTask(taskId);
  return true;
}

export function getCurrentTaskForUser(userId: string): Task | null {
  const user = getUser(userId);
  const activeTasks = getActiveTasks();
  const available = activeTasks.filter(
    (t) => !user.completedTasks.includes(t.id) && !user.skippedTasks.includes(t.id)
  );
  if (available.length === 0) return null;
  const idx = user.currentTaskIndex % available.length;
  return available[idx] || available[0];
}

export function getAvailableTaskCount(userId: string): number {
  const user = getUser(userId);
  const activeTasks = getActiveTasks();
  return activeTasks.filter(
    (t) => !user.completedTasks.includes(t.id) && !user.skippedTasks.includes(t.id)
  ).length;
}

export function getAllUsers(): Record<string, UserData> {
  return users;
}

export function addWithdrawal(
  userId: string,
  userName: string,
  amount: number,
  accountName: string,
  qrFileId: string,
  coinBalance?: number,
  moneyAmount?: number
): WithdrawalRequest {
  const wr: WithdrawalRequest = {
    id: `wd_${Date.now()}`,
    userId,
    userName,
    amount,
    accountName,
    qrFileId,
    status: "pending",
    createdAt: new Date(),
    coinBalance,
    moneyAmount,
  };
  withdrawals.push(wr);
  saveWithdrawal(wr);
  updateUser(userId, { lastWithdrawalAt: Date.now() });
  return wr;
}

export function getWithdrawals(status?: WithdrawalRequest["status"]): WithdrawalRequest[] {
  if (status) return withdrawals.filter((w) => w.status === status);
  return [...withdrawals];
}

export function updateWithdrawal(id: string, status: WithdrawalRequest["status"], rejectReason?: string, lockedMoneyAmount?: number, lockedCoinBalance?: number): WithdrawalRequest | null {
  const w = withdrawals.find((x) => x.id === id);
  if (!w) return null;
  w.status = status;
  if (rejectReason) w.rejectReason = rejectReason;
  if (status === "approved") {
    if (lockedMoneyAmount != null) w.moneyAmount = lockedMoneyAmount;
    if (lockedCoinBalance != null && w.coinBalance == null) w.coinBalance = lockedCoinBalance;
  }
  saveWithdrawal(w);
  return w;
}

export function getWithdrawalById(id: string): WithdrawalRequest | undefined {
  return withdrawals.find((w) => w.id === id);
}

export function deleteWithdrawalById(id: string): boolean {
  const idx = withdrawals.findIndex((w) => w.id === id);
  if (idx === -1) return false;
  withdrawals.splice(idx, 1);
  deleteWithdrawalFromDb(id);
  return true;
}

export function getUserWithdrawals(userId: string): WithdrawalRequest[] {
  return withdrawals.filter((w) => w.userId === userId);
}

export function checkWithdrawCooldown(userId: string): { allowed: boolean; hoursLeft: number } {
  const user = getUser(userId);
  const cfg = adminConfig;
  if (!cfg.withdrawCooldownHours || cfg.withdrawCooldownHours <= 0) return { allowed: true, hoursLeft: 0 };
  if (!user.lastWithdrawalAt) return { allowed: true, hoursLeft: 0 };
  const cooldownMs = cfg.withdrawCooldownHours * 60 * 60 * 1000;
  const elapsed = Date.now() - user.lastWithdrawalAt;
  if (elapsed >= cooldownMs) return { allowed: true, hoursLeft: 0 };
  const hoursLeft = Math.ceil((cooldownMs - elapsed) / (60 * 60 * 1000));
  return { allowed: false, hoursLeft };
}

export function getReferralEarningsBetween(userId: string, fromTs: number, toTs: number): number {
  const user = getUser(userId);
  return (user.earningHistory || [])
    .filter((h) => {
      const date = new Date(h.date).getTime();
      return date >= fromTs && date <= toTs && h.reason.includes("Referral");
    })
    .reduce((sum, h) => sum + h.amount, 0);
}

export function getUserAnalytics(userId: string): {
  totalTasksCompleted: number;
  totalReferredUsers: number;
  totalReferralEarnings: number;
  totalWithdrawCount: number;
  totalWithdrawAmount: number;
  totalAcceptedWithdraw: number;
  totalRejectedWithdraw: number;
  joinDate: Date;
} {
  const user = getUser(userId);
  const userWithdrawals = getUserWithdrawals(userId);

  return {
    totalTasksCompleted: user.completedTasks.length,
    totalReferredUsers: user.totalReferrals || 0,
    totalReferralEarnings: user.referralEarnings || 0,
    totalWithdrawCount: userWithdrawals.length,
    totalWithdrawAmount: userWithdrawals.reduce((s, w) => s + w.amount, 0),
    totalAcceptedWithdraw: userWithdrawals.filter((w) => w.status === "approved").length,
    totalRejectedWithdraw: userWithdrawals.filter((w) => w.status === "rejected").length,
    joinDate: user.joinDate || new Date(),
  };
}

export function getEarningBreakdown(userId: string): {
  taskEarnings: number;
  referralEarnings: number;
  couponEarnings: number;
  adminWalletEarnings: number;
  checkInEarnings: number;
  totalEarned: number;
} {
  const user = getUser(userId);

  const taskEarnings = user.completedTasks.length;
  const referralEarnings = user.referralEarnings || 0;

  let couponEarnings = 0, adminWalletEarnings = 0, checkInEarnings = 0;
  const history = user.earningHistory || [];
  for (const h of history) {
    if (h.reason === "Task Completed") continue;
    if (h.reason.startsWith("Referral")) continue;
    if (h.reason.startsWith("Coupon:")) { couponEarnings += h.amount; continue; }
    if (h.reason === "Daily Check-In" || h.reason === "Daily Check-in") { checkInEarnings += h.amount; continue; }
    adminWalletEarnings += h.amount;
  }
  const byCategory = user.earningsByCategory;
  if (byCategory) {
    couponEarnings = Math.max(couponEarnings, byCategory.coupon || 0);
    adminWalletEarnings = Math.max(adminWalletEarnings, byCategory.adminWallet || 0);
    checkInEarnings = Math.max(checkInEarnings, byCategory.checkIn || 0);
  }

  return {
    taskEarnings,
    referralEarnings,
    couponEarnings,
    adminWalletEarnings,
    checkInEarnings,
    totalEarned: taskEarnings + referralEarnings + couponEarnings + adminWalletEarnings + checkInEarnings,
  };
}

export function getBalanceBreakdown(userId: string): {
  taskBalance: number;
  referralBalance: number;
  couponBalance: number;
  checkInBalance: number;
  adminWalletBalance: number;
  currentBalance: number;
  totalEarned: number;
} {
  const user = getUser(userId);
  const bd = getEarningBreakdown(userId);
  return {
    taskBalance: bd.taskEarnings,
    referralBalance: bd.referralEarnings,
    couponBalance: bd.couponEarnings,
    checkInBalance: bd.checkInEarnings,
    adminWalletBalance: bd.adminWalletEarnings,
    currentBalance: user.coins,
    totalEarned: bd.totalEarned,
  };
}

export function getCCRStats(): {
  totalCoinsEarned: number;
  totalTaskCoinsEarned: number;
  extraCoinsEarned: number;
  companyIncomeINR: number;
  totalPaidINR: number;
  profitLossINR: number;
  todayCoinsEarned: number;
  todayTaskCoinsEarned: number;
  todayExtraCoinsEarned: number;
  todayIncomeINR: number;
  todayPaidINR: number;
  todayProfitLossINR: number;
  companyCoinRate: number;
} {
  const cfg = adminConfig;
  const ccr = cfg.companyCoinRate || 100;

  // Total coins ever earned by all users (all sources + task-only)
  let totalCoinsEarned = 0;
  let totalTaskCoinsEarned = 0;
  for (const [userId] of Object.entries(users)) {
    const bd = getEarningBreakdown(userId);
    totalCoinsEarned += bd.totalEarned;
    totalTaskCoinsEarned += bd.taskEarnings;
  }

  // One-time legacy adjustment for historical over-counting (applies to all-time
  // totals only; today's stats and per-day stats are unaffected). Typically a
  // negative number set by admin once.
  const legacyOffset = cfg.legacyTaskCoinOffset || 0;
  totalTaskCoinsEarned = Math.max(0, totalTaskCoinsEarned + legacyOffset);
  totalCoinsEarned = Math.max(0, totalCoinsEarned + legacyOffset);

  // IST midnight today
  const today = getISTDayWindow();

  // Today's earnings by source
  // todayTaskCoinsEarned uses unlimited taskCompletionDates (same as getDateRangeTaskStats)
  // to avoid the 100-item earningHistory cap causing under-counting.
  let todayCoinsEarned = 0;
  let todayTaskCoinsEarned = 0;
  for (const [, user] of Object.entries(users)) {
    // Task coins: use unlimited taskCompletionDates, 1 coin per task
    todayTaskCoinsEarned += countTasksInDateWindow(user, today.fromMs, today.toMs);

    // Non-task coins: still read from earningHistory (referral, coupon, admin wallet, etc.)
    const history = user.earningHistory || [];
    for (const h of history) {
      const t = new Date(h.date).getTime();
      if (t >= today.fromMs && t <= today.toMs && h.reason !== "Task Completed") {
        todayCoinsEarned += h.amount;
      }
    }
  }
  todayCoinsEarned += todayTaskCoinsEarned;

  // Approved withdrawals (all time and today)
  const approved = getWithdrawals("approved");
  let totalPaidINR = 0;
  let todayPaidINR = 0;
  for (const w of approved) {
    const money = w.moneyAmount ?? Math.round((w.amount / cfg.coinToMoneyRate) * 100) / 100;
    totalPaidINR += money;
    if (new Date(w.createdAt).getTime() >= today.fromMs && new Date(w.createdAt).getTime() <= today.toMs) {
      todayPaidINR += money;
    }
  }
  totalPaidINR = Math.round(totalPaidINR * 100) / 100;
  todayPaidINR = Math.round(todayPaidINR * 100) / 100;

  // Company income is based on TASK coins only (revenue from task views)
  const companyIncomeINR = Math.round((totalTaskCoinsEarned / ccr) * 100) / 100;
  const todayIncomeINR = Math.round((todayTaskCoinsEarned / ccr) * 100) / 100;

  return {
    totalCoinsEarned,
    totalTaskCoinsEarned,
    extraCoinsEarned: Math.round((totalCoinsEarned - totalTaskCoinsEarned) * 100) / 100,
    companyIncomeINR,
    totalPaidINR,
    profitLossINR: Math.round((companyIncomeINR - totalPaidINR) * 100) / 100,
    todayCoinsEarned,
    todayTaskCoinsEarned,
    todayExtraCoinsEarned: Math.round((todayCoinsEarned - todayTaskCoinsEarned) * 100) / 100,
    todayIncomeINR,
    todayPaidINR,
    todayProfitLossINR: Math.round((todayIncomeINR - todayPaidINR) * 100) / 100,
    companyCoinRate: ccr,
  };
}

// Count tasks a user completed within an absolute date window.
// Uses taskCompletionDates (unlimited, no cap) for new entries, and supplements
// with earningHistory for historical entries that predate taskCompletionDates.
function countTasksInDateWindow(user: UserData, fromMs: number, toMs: number): number {
  const dates = user.taskCompletionDates ?? [];
  const firstNewDate = dates.length > 0 ? Math.min(...dates) : Infinity;

  // 1) Count from taskCompletionDates (no 100-item cap, exact timestamps)
  const fromDates = dates.filter(ts => ts >= fromMs && ts <= toMs).length;

  // 2) Count from earningHistory only for entries that predate taskCompletionDates
  //    (avoids double-counting tasks recorded in both after the fix)
  const historyTaskEntries = (user.earningHistory ?? []).filter(h => {
    if (h.reason !== "Task Completed") return false;
    return new Date(h.date).getTime() < firstNewDate;
  });
  const fromHistory = historyTaskEntries.filter(h => {
    const t = new Date(h.date).getTime();
    return t >= fromMs && t <= toMs;
  }).length;

  // 3) Legacy completions: present in completedTasks but with NO timestamp at all
  //    (older data predates both taskCompletionDates AND fell outside the 100-item
  //    earningHistory cap). Allocate them to the user's joinDate so cumulative
  //    totals match getCCRStats and any date window stays internally consistent.
  const accountedFor = dates.length + historyTaskEntries.length;
  const legacyCount = Math.max(0, user.completedTasks.length - accountedFor);
  let fromLegacy = 0;
  if (legacyCount > 0) {
    const joinMs = user.joinDate ? new Date(user.joinDate).getTime() : 0;
    if (joinMs >= fromMs && joinMs <= toMs) fromLegacy = legacyCount;
  }

  return fromDates + fromHistory + fromLegacy;
}

export function getTasksCompletedAllUsersBetween(fromMs: number, toMs: number): { totalTasks: number; uniqueUsers: number } {
  let totalTasks = 0;
  let uniqueUsers = 0;
  for (const user of Object.values(users)) {
    const completedInWindow = countTasksInDateWindow(user, fromMs, toMs);
    if (completedInWindow > 0) {
      totalTasks += completedInWindow;
      uniqueUsers++;
    }
  }
  return { totalTasks, uniqueUsers };
}

export function getDateRangeTaskStats(fromMs: number, toMs: number): {
  totalTasks: number;
  uniqueUsers: number;
  totalCoinsEarned: number;
  topUsers: { userId: string; tasksCompleted: number }[];
  ccrStats: {
    taskCoins: number;
    allCoins: number;
    extraCoins: number;
    companyIncomeINR: number;
    paidINR: number;
    profitLossINR: number;
    companyCoinRate: number;
  };
} {
  const cfg = adminConfig;
  const ccr = cfg.companyCoinRate || 100;

  const perUser: { userId: string; tasksCompleted: number }[] = [];
  let totalTasks = 0;
  let totalCoinsEarned = 0;
  let taskCoins = 0;
  let allCoins = 0;

  for (const [userId, user] of Object.entries(users)) {
    // countTasksInDateWindow now handles all three sources accurately:
    //   1) taskCompletionDates (new entries, exact timestamps)
    //   2) earningHistory (older entries that predate taskCompletionDates)
    //   3) legacy completions with no timestamp — allocated to user.joinDate
    // Sum across all-time will equal user.completedTasks.length (matches getCCRStats).
    const tasksInWindowCount = countTasksInDateWindow(user, fromMs, toMs);

    // 1 coin earned per task
    const taskCoinsInWindow = tasksInWindowCount;

    // Non-task coins from earningHistory (referral, coupon, admin wallet, etc.)
    const nonTaskCoins = (user.earningHistory ?? [])
      .filter(h => {
        if (h.reason === "Task Completed") return false;
        const t = new Date(h.date).getTime();
        return t >= fromMs && t <= toMs;
      })
      .reduce((s, h) => s + h.amount, 0);

    if (tasksInWindowCount > 0) {
      totalTasks += tasksInWindowCount;
      totalCoinsEarned += taskCoinsInWindow;
      perUser.push({ userId, tasksCompleted: tasksInWindowCount });
    }
    taskCoins += taskCoinsInWindow;
    allCoins += taskCoinsInWindow + nonTaskCoins;
  }

  // Withdrawals approved in this date range
  let paidINR = 0;
  for (const w of getWithdrawals("approved")) {
    const t = new Date(w.createdAt).getTime();
    if (t >= fromMs && t <= toMs) {
      paidINR += w.moneyAmount ?? Math.round((w.amount / cfg.coinToMoneyRate) * 100) / 100;
    }
  }
  paidINR = Math.round(paidINR * 100) / 100;

  // Apply legacy adjustment to cumulative-since-beginning windows only.
  // Per-day or specific-range windows reflect actual recorded activity for that period.
  if (fromMs === 0) {
    const legacyOffset = cfg.legacyTaskCoinOffset || 0;
    taskCoins = Math.max(0, taskCoins + legacyOffset);
    allCoins = Math.max(0, allCoins + legacyOffset);
  }

  const companyIncomeINR = Math.round((taskCoins / ccr) * 100) / 100;

  return {
    totalTasks,
    uniqueUsers: perUser.length,
    totalCoinsEarned,
    topUsers: perUser.sort((a, b) => b.tasksCompleted - a.tasksCompleted),
    ccrStats: {
      taskCoins,
      allCoins: Math.round(allCoins * 100) / 100,
      extraCoins: Math.round((allCoins - taskCoins) * 100) / 100,
      companyIncomeINR,
      paidINR,
      profitLossINR: Math.round((companyIncomeINR - paidINR) * 100) / 100,
      companyCoinRate: ccr,
    },
  };
}

export function getJoiningStats(fromMs: number, toMs: number): {
  totalUsers: number;
  joinedUsers: {
    userId: string;
    joinDate: Date;
    currentBalance: number;
    totalTasksCompleted: number;
    todayTasksCompleted: number;
    periodTasksCompleted: number;
    totalReferrals: number;
  }[];
} {
  const today = getISTDayWindow();
  const joinedUsers = Object.entries(users)
    .filter(([, user]) => {
      const joinedAt = new Date(user.joinDate).getTime();
      return joinedAt >= fromMs && joinedAt <= toMs;
    })
    .map(([userId, user]) => ({
      userId,
      joinDate: user.joinDate,
      currentBalance: user.coins,
      totalTasksCompleted: user.completedTasks.length,
      todayTasksCompleted: countTasksInDateWindow(user, today.fromMs, today.toMs),
      periodTasksCompleted: countTasksInDateWindow(user, fromMs, toMs),
      totalReferrals: user.totalReferrals || 0,
    }))
    .sort((a, b) => new Date(b.joinDate).getTime() - new Date(a.joinDate).getTime());

  return {
    totalUsers: Object.keys(users).length,
    joinedUsers,
  };
}

export function getActiveUsers(days = 30): { userId: string; coins: number; completedTasks: number; lastActive: number }[] {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return Object.entries(users)
    .filter(([, u]) => u.lastActive !== undefined && u.lastActive >= cutoff)
    .map(([userId, u]) => ({
      userId,
      coins: u.coins,
      completedTasks: u.completedTasks.length,
      lastActive: u.lastActive!,
    }))
    .sort((a, b) => b.lastActive - a.lastActive);
}

export function getInactiveUsers(days = 30): { userId: string; coins: number; completedTasks: number; lastActive: number | null }[] {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return Object.entries(users)
    .filter(([, u]) => u.lastActive === undefined || u.lastActive < cutoff)
    .map(([userId, u]) => ({
      userId,
      coins: u.coins,
      completedTasks: u.completedTasks.length,
      lastActive: u.lastActive ?? null,
    }))
    .sort((a, b) => (b.lastActive ?? 0) - (a.lastActive ?? 0));
}

export function getPaymentStats(): {
  todayPayment: number;
  totalPayment: number;
  todayMoney: number;
  totalMoney: number;
} {
  const allWithdrawals = getWithdrawals("approved");
  const cfg = adminConfig;
  const today = getISTDayWindow();
  let todayPayment = 0, totalPayment = 0, todayMoney = 0, totalMoney = 0;
  for (const w of allWithdrawals) {
    const money = w.moneyAmount ?? Math.round((w.amount / cfg.coinToMoneyRate) * 100) / 100;
    totalPayment += w.amount;
    totalMoney += money;
    const createdAt = new Date(w.createdAt).getTime();
    if (createdAt >= today.fromMs && createdAt <= today.toMs) {
      todayPayment += w.amount;
      todayMoney += money;
    }
  }
  return {
    todayPayment,
    totalPayment,
    todayMoney: Math.round(todayMoney * 100) / 100,
    totalMoney: Math.round(totalMoney * 100) / 100,
  };
}

export function getPaymentLogs(): { date: string; totalAmount: number; totalMoney: number; userCount: number }[] {
  const allWithdrawals = getWithdrawals("approved");
  const cfg = adminConfig;
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const byDate: Record<string, { totalAmount: number; totalMoney: number; userIds: Set<string> }> = {};
  for (const w of allWithdrawals) {
    const ts = new Date(w.createdAt).getTime();
    if (ts < thirtyDaysAgo) continue;
    const money = w.moneyAmount ?? Math.round((w.amount / cfg.coinToMoneyRate) * 100) / 100;
    const key = toISTDateKey(new Date(w.createdAt).getTime());
    if (!byDate[key]) byDate[key] = { totalAmount: 0, totalMoney: 0, userIds: new Set() };
    byDate[key].totalAmount += w.amount;
    byDate[key].totalMoney += money;
    byDate[key].userIds.add(w.userId);
  }
  return Object.entries(byDate)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, v]) => ({ date, totalAmount: v.totalAmount, totalMoney: Math.round(v.totalMoney * 100) / 100, userCount: v.userIds.size }));
}

export function setPendingWithdraw(
  userId: string,
  step: WithdrawStep,
  data?: { amount?: number; name?: string }
): void {
  pendingWithdrawInput[userId] = { step, ...data };
}

export function getPendingWithdraw(userId: string) {
  return pendingWithdrawInput[userId];
}

export function clearPendingWithdraw(userId: string): void {
  delete pendingWithdrawInput[userId];
}

export function setPendingTaskInput(userId: string): void {
  pendingTaskInput[userId] = true;
}

export function clearPendingTaskInput(userId: string): void {
  delete pendingTaskInput[userId];
}

export function isPendingTaskInput(userId: string): boolean {
  return !!pendingTaskInput[userId];
}

const pendingSettingInput: Record<string, string> = {};

export function setPendingSettingInput(userId: string, key: string): void {
  pendingSettingInput[userId] = key;
}

export function getPendingSettingInput(userId: string): string | undefined {
  return pendingSettingInput[userId];
}

export function clearPendingSettingInput(userId: string): void {
  delete pendingSettingInput[userId];
}

export type WalletStep = "userId" | "amount" | "reason";
const pendingWalletInput: Record<string, {
  step: WalletStep;
  targetUserId?: string;
  action?: "add" | "deduct";
  amount?: number;
}> = {};

export function setPendingWalletInput(
  adminId: string,
  step: WalletStep,
  data?: { targetUserId?: string; action?: "add" | "deduct"; amount?: number }
): void {
  pendingWalletInput[adminId] = { step, ...data };
}

export function getPendingWalletInput(adminId: string) {
  return pendingWalletInput[adminId];
}

export function clearPendingWalletInput(adminId: string): void {
  delete pendingWalletInput[adminId];
}

export function banUser(userId: string, reason?: string): void {
  const user = getUser(userId);
  users[userId] = { ...user, isBanned: true, banReason: reason || "Admin ban" };
  saveUser(userId, users[userId]);
}

export function unbanUser(userId: string): void {
  const user = getUser(userId);
  users[userId] = { ...user, isBanned: false, banReason: undefined };
  saveUser(userId, users[userId]);
}

export function isUserBanned(userId: string): boolean {
  return !!(users[userId]?.isBanned);
}

export function getBannedUsers(): { userId: string; data: UserData }[] {
  return Object.entries(users)
    .filter(([, u]) => u.isBanned)
    .map(([userId, data]) => ({ userId, data }));
}

export function getPolicy(): string {
  return adminConfig.policy || "";
}

export function setPolicy(text: string): void {
  adminConfig.policy = text;
  saveAdminConfig(adminConfig);
}

export type BanStep = "userId" | "confirm";
const pendingBanInput: Record<string, {
  step: BanStep;
  action: "ban" | "unban";
  targetUserId?: string;
}> = {};

export function setPendingBanInput(
  adminId: string,
  step: BanStep,
  data?: { action: "ban" | "unban"; targetUserId?: string }
): void {
  pendingBanInput[adminId] = { step, action: data?.action ?? "ban", targetUserId: data?.targetUserId };
}

export function getPendingBanInput(adminId: string) {
  return pendingBanInput[adminId];
}

export function clearPendingBanInput(adminId: string): void {
  delete pendingBanInput[adminId];
}

const pendingAddAdminInput: Record<string, boolean> = {};

export function setPendingAddAdminInput(adminId: string): void {
  pendingAddAdminInput[adminId] = true;
}

export function isPendingAddAdminInput(adminId: string): boolean {
  return !!pendingAddAdminInput[adminId];
}

export function clearPendingAddAdminInput(adminId: string): void {
  delete pendingAddAdminInput[adminId];
}

const pendingCouponClaimInput: Record<string, boolean> = {};

export function setPendingCouponClaimInput(userId: string): void {
  pendingCouponClaimInput[userId] = true;
}

export function isPendingCouponClaimInput(userId: string): boolean {
  return !!pendingCouponClaimInput[userId];
}

export function clearPendingCouponClaimInput(userId: string): void {
  delete pendingCouponClaimInput[userId];
}

export type CouponAdminStep = "code" | "maxUsers" | "coins";
const pendingCouponAdminInput: Record<string, {
  step: CouponAdminStep;
  code?: string;
  maxUsers?: number;
}> = {};

export function setPendingCouponAdminInput(
  adminId: string,
  step: CouponAdminStep,
  data?: { code?: string; maxUsers?: number }
): void {
  pendingCouponAdminInput[adminId] = { step, ...data };
}

export function getPendingCouponAdminInput(adminId: string) {
  return pendingCouponAdminInput[adminId];
}

export function clearPendingCouponAdminInput(adminId: string): void {
  delete pendingCouponAdminInput[adminId];
}

export function createCouponCode(code: string, maxUsers: number, rewardCoins: number): CouponCode {
  const coupon: CouponCode = {
    code: code.toUpperCase(),
    maxUsers,
    usedCount: 0,
    rewardCoins,
    usedBy: [],
    createdAt: new Date(),
  };
  couponCodes[code.toUpperCase()] = coupon;
  saveCoupon(coupon);
  return coupon;
}

export function getCouponCodes(): CouponCode[] {
  return Object.values(couponCodes);
}

export function claimCoupon(userId: string, code: string): { success: boolean; message: string; coins?: number; requiredTasks?: number; requiredHours?: number } {
  const coupon = couponCodes[code.toUpperCase()];
  if (!coupon) {
    return { success: false, message: "invalid" };
  }
  // Check if coupon has expired — created before today's midnight IST
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const nowIST = Date.now() + IST_OFFSET_MS;
  const midnightTodayIST = nowIST - (nowIST % (24 * 60 * 60 * 1000));
  const cutoffUTC = midnightTodayIST - IST_OFFSET_MS;
  if (coupon.createdAt.getTime() < cutoffUTC) {
    return { success: false, message: "expired" };
  }
  if (coupon.usedBy.includes(userId)) {
    return { success: false, message: "already_claimed" };
  }
  if (coupon.usedCount >= coupon.maxUsers) {
    return { success: false, message: "expired" };
  }
  // Eligibility check
  const eligibility = adminConfig.couponEligibility || { hours: 0, tasks: 0 };
  if (eligibility.hours > 0 || eligibility.tasks > 0) {
    const recentTasks = countTasksInWindow(userId, eligibility.hours);
    if (recentTasks < eligibility.tasks) {
      return { success: false, message: "not_eligible", requiredTasks: eligibility.tasks, requiredHours: eligibility.hours };
    }
  }
  coupon.usedBy.push(userId);
  coupon.usedCount++;
  saveCoupon(coupon);
  const user = getUser(userId);
  updateUser(userId, { coins: user.coins + coupon.rewardCoins });
  addEarningHistory(userId, coupon.rewardCoins, `Coupon: ${code.toUpperCase()}`);
  return { success: true, message: "success", coins: coupon.rewardCoins };
}

const spamFlags: Record<string, SpamFlag> = {};
const ipToUsers: Record<string, string[]> = {};
const deviceToUsers: Record<string, string[]> = {};
const taskTimestamps: Record<string, number[]> = {};

export function flagUserAsSpam(userId: string, type: string, reason: string): boolean {
  const isNew = !spamFlags[userId];
  if (!spamFlags[userId]) {
    spamFlags[userId] = { userId, types: [], reasons: [], detectedAt: new Date(), flagCount: 0 };
  }
  const flag = spamFlags[userId];
  if (!flag.types.includes(type)) {
    flag.types.push(type);
    flag.reasons.push(reason);
  }
  flag.flagCount++;
  flag.detectedAt = new Date();
  saveSpamFlag(userId, flag);
  return isNew;
}

export function getSpamFlags(): SpamFlag[] {
  return Object.values(spamFlags).sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime());
}

export function clearSpamFlag(userId: string): void {
  delete spamFlags[userId];
  removeSpamFlag(userId);
}

export function getRiskScore(userId: string): number {
  const flag = spamFlags[userId];
  if (!flag) return 0;
  let score = 0;
  if (flag.types.includes("vpn"))           score += 30;
  if (flag.types.includes("multi_device"))  score += 40;
  if (flag.types.includes("same_wifi"))     score += 25;
  if (flag.types.includes("fast_timing"))   score += 15;
  if (flag.types.includes("session"))       score += 10;
  if (flag.types.includes("referral_spam")) score += 30;
  if (flag.types.includes("rapid_earning")) score += 25;
  score = Math.min(100, score + Math.floor(flag.flagCount * 1.5));
  return score;
}

export function setCooldown(userId: string, hours: number): void {
  const until = Date.now() + hours * 60 * 60 * 1000;
  const user = getUser(userId);
  users[userId] = { ...user, cooldownUntil: until };
  saveUser(userId, users[userId]);
}

export function getCooldownInfo(userId: string): { active: boolean; hoursLeft: number } {
  const user = getUser(userId);
  if (!user.cooldownUntil || Date.now() >= user.cooldownUntil) return { active: false, hoursLeft: 0 };
  const hoursLeft = Math.ceil((user.cooldownUntil - Date.now()) / (60 * 60 * 1000));
  return { active: true, hoursLeft };
}

export function clearFraudCooldown(userId: string): void {
  const user = getUser(userId);
  users[userId] = { ...user, cooldownUntil: undefined, riskScore: 0 };
  saveUser(userId, users[userId]);
  clearSpamFlag(userId);
}

export function canSendUserAlert(userId: string): boolean {
  const user = getUser(userId);
  if (!user.lastAlertSentAt) return true;
  return Date.now() - user.lastAlertSentAt > 2 * 60 * 1000;
}

export function markUserAlertSent(userId: string): void {
  const user = getUser(userId);
  users[userId] = { ...user, lastAlertSentAt: Date.now() };
  saveUser(userId, users[userId]);
}

export function updateUserLastActive(userId: string): void {
  const user = getUser(userId);
  users[userId] = { ...user, lastActive: Date.now() };
  saveUser(userId, users[userId]);
}

export function registerUserIP(ip: string, userId: string): string[] {
  if (!ipToUsers[ip]) ipToUsers[ip] = [];
  if (!ipToUsers[ip].includes(userId)) ipToUsers[ip].push(userId);
  saveIpUsers(ip, ipToUsers[ip]);
  // Only return accounts active within the last 24 hours (ignore stale accounts)
  const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
  return ipToUsers[ip].filter((uid) => {
    if (uid === userId) return true;
    const u = users[uid];
    return u && u.lastActive !== undefined && u.lastActive > twentyFourHoursAgo;
  });
}

export function registerDevice(deviceId: string, userId: string): string[] {
  if (!deviceToUsers[deviceId]) deviceToUsers[deviceId] = [];
  if (!deviceToUsers[deviceId].includes(userId)) deviceToUsers[deviceId].push(userId);
  saveDeviceUsers(deviceId, deviceToUsers[deviceId]);
  const user = getUser(userId);
  users[userId] = { ...user, deviceId, lastActive: Date.now() };
  saveUser(userId, users[userId]);
  // Only return accounts active within the last 24 hours (ignore stale accounts)
  const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
  return deviceToUsers[deviceId].filter((uid) => {
    if (uid === userId) return true;
    const u = users[uid];
    return u && u.lastActive !== undefined && u.lastActive > twentyFourHoursAgo;
  });
}

export function checkRapidEarning(userId: string): { isRapid: boolean; count: number } {
  if (!taskTimestamps[userId]) taskTimestamps[userId] = [];
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;
  taskTimestamps[userId] = taskTimestamps[userId].filter((t) => t > oneHourAgo);
  taskTimestamps[userId].push(now);
  saveTaskTimestamps(userId, taskTimestamps[userId]);
  const count = taskTimestamps[userId].length;
  return { isRapid: count > 20, count };
}

export function countTasksInWindow(userId: string, hours: number): number {
  if (hours <= 0) return 0;
  const user = getUser(userId);
  const cutoff = Date.now() - hours * 60 * 60 * 1000;
  return countTasksInDateWindow(user, cutoff, Date.now());
}

export function checkWithdrawEligibility(userId: string): { allowed: boolean; requiredTasks: number; requiredHours: number } {
  const eligibility = adminConfig.withdrawEligibility || { hours: 0, tasks: 0 };
  if (!eligibility.hours && !eligibility.tasks) return { allowed: true, requiredTasks: 0, requiredHours: 0 };
  const recentTasks = countTasksInWindow(userId, eligibility.hours);
  return {
    allowed: recentTasks >= eligibility.tasks,
    requiredTasks: eligibility.tasks,
    requiredHours: eligibility.hours,
  };
}

export function updateCouponEligibility(hours: number, tasks: number): void {
  adminConfig.couponEligibility = { hours, tasks };
  saveAdminConfig(adminConfig);
}

export function updateWithdrawEligibility(hours: number, tasks: number): void {
  adminConfig.withdrawEligibility = { hours, tasks };
  saveAdminConfig(adminConfig);
}

export function getISTDateString(): string {
  return getISTDayWindow().date;
}

export function countTasksCompletedTodayIST(userId: string): number {
  const user = getUser(userId);
  const today = getISTDayWindow();
  return countTasksInDateWindow(user, today.fromMs, today.toMs);
}

export function performCheckIn(userId: string): { success: boolean; message: string; coinsAdded?: number } {
  const todayIST = getISTDateString();
  const user = getUser(userId);
  if (user.lastCheckInDate === todayIST) {
    return { success: false, message: "already_checked_in" };
  }
  const requiredTasks = adminConfig.checkInRequiredTasks || 0;
  if (requiredTasks > 0) {
    const completedToday = countTasksCompletedTodayIST(userId);
    if (completedToday < requiredTasks) {
      return { success: false, message: "not_enough_tasks", coinsAdded: completedToday };
    }
  }
  const reward = adminConfig.checkInDailyReward || 1;
  updateUser(userId, {
    coins: user.coins + reward,
    lastCheckInDate: todayIST,
  });
  addEarningHistory(userId, reward, "Daily Check-In");
  return { success: true, message: "success", coinsAdded: reward };
}

export function getTasksCompletedBetween(userId: string, fromMs: number, toMs: number): number {
  const user = getUser(userId);
  return countTasksInDateWindow(user, fromMs, toMs);
}

export function runCleanup(): {
  removedTasks: number;
  removedIPs: number;
  removedDevices: number;
  removedCoupons: number;
} {
  const now = Date.now();
  const threeDaysAgo = now - 3 * 24 * 60 * 60 * 1000;

  // IST = UTC+5:30. Keep only coupons created today (IST).
  // Anything created before midnight of today (IST) gets deleted.
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const nowIST = now + IST_OFFSET_MS;
  const midnightTodayIST = nowIST - (nowIST % (24 * 60 * 60 * 1000)); // 00:00 today IST
  const cutoffUTC = midnightTodayIST - IST_OFFSET_MS;

  // 1. Remove expired tasks from memory and database
  let removedTasks = 0;
  for (let i = tasks.length - 1; i >= 0; i--) {
    if (tasks[i]!.expiresAt.getTime() < now) {
      const taskId = tasks[i]!.id;
      tasks.splice(i, 1);
      dbRemoveTask(taskId);
      removedTasks++;
    }
  }

  // 2. Remove coupon codes older than 2 days (IST)
  let removedCoupons = 0;
  for (const code of Object.keys(couponCodes)) {
    const coupon = couponCodes[code]!;
    if (coupon.createdAt.getTime() < cutoffUTC) {
      delete couponCodes[code];
      deleteCoupon(code);
      removedCoupons++;
    }
  }

  // 3. Remove IP records where no associated user has been active in the last 3 days
  let removedIPs = 0;
  for (const ip of Object.keys(ipToUsers)) {
    const userIds = ipToUsers[ip] ?? [];
    const hasRecentUser = userIds.some((uid) => {
      const u = users[uid];
      return u !== undefined && u.lastActive !== undefined && u.lastActive > threeDaysAgo;
    });
    if (!hasRecentUser) {
      delete ipToUsers[ip];
      deleteIpRecord(ip);
      removedIPs++;
    }
  }

  // 4. Remove device records where no associated user has been active in the last 3 days
  let removedDevices = 0;
  for (const deviceId of Object.keys(deviceToUsers)) {
    const userIds = deviceToUsers[deviceId] ?? [];
    const hasRecentUser = userIds.some((uid) => {
      const u = users[uid];
      return u !== undefined && u.lastActive !== undefined && u.lastActive > threeDaysAgo;
    });
    if (!hasRecentUser) {
      delete deviceToUsers[deviceId];
      deleteDeviceRecord(deviceId);
      removedDevices++;
    }
  }

  return { removedTasks, removedCoupons, removedIPs, removedDevices };
}

export { tasks, users, withdrawals };
