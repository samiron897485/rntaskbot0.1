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
} from "./persistence.js";

export const adminConfig: AdminConfig = {
  minWithdraw: 10,
  coinToMoneyRate: 10,
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

export function addEarningHistory(userId: string, amount: number, reason: string): void {
  const user = getUser(userId);
  const history = user.earningHistory || [];
  history.push({ amount, reason, date: new Date() });
  if (history.length > 100) history.splice(0, history.length - 100);
  users[userId] = { ...user, earningHistory: history };
  saveUser(userId, users[userId]);
}

export function getUserByReferralCode(code: string): string | null {
  for (const [userId, user] of Object.entries(users)) {
    if (user.referralCode === code) return userId;
  }
  return null;
}

export function getActiveTasks(): Task[] {
  const now = new Date();
  return tasks.filter((t) => t.expiresAt > now);
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
  qrFileId: string
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

export function updateWithdrawal(id: string, status: WithdrawalRequest["status"], rejectReason?: string): WithdrawalRequest | null {
  const w = withdrawals.find((x) => x.id === id);
  if (!w) return null;
  w.status = status;
  if (rejectReason) w.rejectReason = rejectReason;
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

export function getUserAnalytics(userId: string): {
  totalTasksCompleted: number;
  totalReferralCompleted: number;
  totalWithdrawCount: number;
  totalWithdrawAmount: number;
  totalAcceptedWithdraw: number;
  totalRejectedWithdraw: number;
  joinDate: Date;
} {
  const user = getUser(userId);
  const userWithdrawals = getUserWithdrawals(userId);
  const referralHistory = (user.earningHistory || []).filter((h) => h.reason === "Referral Commission");

  return {
    totalTasksCompleted: user.completedTasks.length,
    totalReferralCompleted: referralHistory.length,
    totalWithdrawCount: userWithdrawals.length,
    totalWithdrawAmount: userWithdrawals.reduce((s, w) => s + w.amount, 0),
    totalAcceptedWithdraw: userWithdrawals.filter((w) => w.status === "approved").length,
    totalRejectedWithdraw: userWithdrawals.filter((w) => w.status === "rejected").length,
    joinDate: user.joinDate || new Date(),
  };
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
  const history = user.earningHistory || [];
  const cutoff = Date.now() - hours * 60 * 60 * 1000;
  return history.filter(
    (h) => h.reason === "Task Completed" && new Date(h.date).getTime() > cutoff
  ).length;
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
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + istOffset);
  return ist.toISOString().split("T")[0];
}

export function countTasksCompletedTodayIST(userId: string): number {
  const user = getUser(userId);
  const todayIST = getISTDateString();
  const istOffset = 5.5 * 60 * 60 * 1000;
  return (user.earningHistory || []).filter((h) => {
    if (h.reason !== "Task Completed") return false;
    const ist = new Date(new Date(h.date).getTime() + istOffset);
    return ist.toISOString().split("T")[0] === todayIST;
  }).length;
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
  return (user.earningHistory || []).filter((h) => {
    if (h.reason !== "Task Completed") return false;
    const t = new Date(h.date).getTime();
    return t >= fromMs && t <= toMs;
  }).length;
}

export { tasks, users, withdrawals };
