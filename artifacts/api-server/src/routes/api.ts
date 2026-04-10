import { Router, type IRouter, type Request, type Response } from "express";
import { adminAuthMiddleware } from "../middleware/adminAuth.js";
import {
  getUser,
  getTaskById,
  updateUser,
  getCurrentTaskForUser,
  getActiveTasks,
  addTask,
  deleteTask,
  getAllUsers,
  addWithdrawal,
  getWithdrawals,
  updateWithdrawal,
  getWithdrawalById,
  getAdminConfig,
  updateAdminConfig,
  getAvailableTaskCount,
  flagUserAsSpam,
  registerUserIP,
  registerDevice,
  getRiskScore,
  getBannedUsers,
  getSpamFlags,
  addEarningHistory,
  claimCoupon,
  createCouponCode,
  getCouponCodes,
  getUserAnalytics,
  checkWithdrawCooldown,
  isLinkDuplicate,
  getPolicy,
  setPolicy,
  banUser,
  setCooldown,
  getCooldownInfo,
  canSendUserAlert,
  markUserAlertSent,
  updateUserLastActive,
} from "../db/mockDb.js";
import { sendTaskCompletion } from "../bot/bot.js";
import { bot } from "../bot/bot.js";

const router: IRouter = Router();

router.get("/config", (_req: Request, res: Response) => {
  const cfg = getAdminConfig();
  res.json({
    success: true,
    taskDuration: cfg.taskDuration,
    taskExpiry: cfg.taskExpiry,
    minWithdraw: cfg.minWithdraw,
    coinToMoneyRate: cfg.coinToMoneyRate,
  });
});

router.get("/admin/config", adminAuthMiddleware, (_req: Request, res: Response) => {
  res.json({ success: true, config: getAdminConfig() });
});

router.post("/admin/config", adminAuthMiddleware, (req: Request, res: Response) => {
  const data = req.body;
  const allowed = [
    "minWithdraw", "coinToMoneyRate", "taskDuration", "taskExpiry",
    "referralEnabled", "referralBonus", "perTaskCommission",
    "lifetimeCommission", "supportLink", "defaultLanguage",
    "withdrawCooldownHours", "couponLink", "referralTaskRequirement", "policy",
  ];
  const update: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in data) update[key] = data[key];
  }
  updateAdminConfig(update as Parameters<typeof updateAdminConfig>[0]);
  req.log.info({ update }, "Admin config updated");
  res.json({ success: true, config: getAdminConfig() });
});

router.post("/complete-task", (req: Request, res: Response) => {
  const { taskId, userId, deviceId, startTime, hasVpnHeaders } = req.body as {
    taskId: string;
    userId: string;
    deviceId?: string;
    startTime?: number;
    hasVpnHeaders?: boolean;
  };
  if (!taskId || !userId) {
    res.status(400).json({ success: false, message: "taskId and userId are required" });
    return;
  }
  const task = getTaskById(taskId);
  if (!task) {
    res.status(404).json({ success: false, message: "Task not found" });
    return;
  }
  if (task.expiresAt < new Date()) {
    res.status(400).json({ success: false, message: "This task has expired" });
    return;
  }
  const user = getUser(userId);
  if (user.completedTasks.includes(taskId)) {
    res.status(400).json({ success: false, message: "Task already completed" });
    return;
  }

  const ADMIN_IDS: string[] = ["1414414216", "7728185213", ...((process.env.ADMIN_IDS || "").split(",").map((s) => s.trim()).filter(Boolean))];
  const cfg = getAdminConfig();

  // ── Check existing fraud cooldown ──
  const cooldownInfo = getCooldownInfo(userId);
  if (cooldownInfo.active) {
    if (bot) {
      bot.sendMessage(userId,
        `⚠️ *Temporary Restriction Applied*\n\nDue to suspicious activity, your account is temporarily restricted.\n\nPlease wait *${cooldownInfo.hoursLeft} hour(s)* before trying again.`,
        { parse_mode: "Markdown" }
      ).catch(() => {});
    }
    res.status(403).json({
      success: false,
      fraud: true,
      fraudType: "cooldown",
      message: `⚠️ Account temporarily restricted. Please wait ${cooldownInfo.hoursLeft} hour(s).`,
    });
    return;
  }

  // ── Fraud Detection ──
  const fraudReasons: { type: string; message: string; userMsg: string }[] = [];

  // 1. VPN/Proxy Detection
  // NOTE: Only use hasVpnHeaders (sent from browser-side detection) and very specific
  // proxy-only headers. Do NOT check via, x-forwarded-for hop count, x-forwarded-host,
  // or forwarded — Replit's own infrastructure adds all of these for every request,
  // causing false positives for all legitimate users.
  const forwardedFor = req.headers["x-forwarded-for"]?.toString() || "";
  const hasStrictProxyHeader = !!(req.headers["x-proxy-id"] || req.headers["x-anonymizer"]);
  if (hasVpnHeaders === true || hasStrictProxyHeader) {
    const reason = hasVpnHeaders ? "VPN detected by browser (WebRTC/DNS leak)" : "Proxy-specific header found";
    flagUserAsSpam(userId, "vpn", reason);
    fraudReasons.push({
      type: "vpn",
      message: "VPN/Proxy detected",
      userMsg: "VPN/Proxy detected",
    });
  }

  // 2. Same Device Multi-Account Detection (inactive accounts > 12h are ignored)
  if (deviceId && deviceId.length > 5) {
    const sameDeviceUsers = registerDevice(deviceId, userId);
    if (sameDeviceUsers.length > 1) {
      const others = sameDeviceUsers.filter((u) => u !== userId).join(", ");
      const reason = `Same device used by multiple accounts: ${others}`;
      flagUserAsSpam(userId, "multi_device", reason);
      fraudReasons.push({
        type: "multi_device",
        message: "Multiple accounts on same device",
        userMsg: "Multiple accounts detected on same device",
      });
    }
  }

  // 3. Same Network (IP) Multi-Account Detection (inactive accounts > 12h are ignored)
  const ip = (forwardedFor.split(",")[0]?.trim()) || req.ip || "unknown";
  if (ip !== "unknown") {
    const sameIpUsers = registerUserIP(ip, userId);
    if (sameIpUsers.length > 1) {
      const others = sameIpUsers.filter((u) => u !== userId).join(", ");
      const reason = `Multiple accounts from same IP (${ip}): ${others}`;
      flagUserAsSpam(userId, "same_wifi", reason);
      fraudReasons.push({
        type: "same_wifi",
        message: "Multiple accounts on same network",
        userMsg: "Multiple accounts detected on same network",
      });
    }
  }

  // 4. Fast Timing Detection
  if (startTime && typeof startTime === "number") {
    const elapsed = Date.now() - startTime;
    const minRequired = cfg.taskDuration * 1000 * 0.7;
    if (elapsed < minRequired) {
      flagUserAsSpam(userId, "fast_timing", `Task completed in ${Math.round(elapsed / 1000)}s (required: ${cfg.taskDuration}s)`);
      fraudReasons.push({
        type: "fast_timing",
        message: "Unusual activity pattern detected",
        userMsg: "Unusual activity pattern detected",
      });
    }
  }

  // ── Risk Score + Action ──
  const score = getRiskScore(userId);

  // Dynamic reason map for user-facing messages
  const reasonUserMsg: Record<string, string> = {
    vpn: "VPN/Proxy detected",
    multi_device: "Multiple accounts on same device",
    same_wifi: "Multiple accounts on same network",
    fast_timing: "Unusual activity pattern detected",
    session: "Invalid session behavior detected",
  };

  if (fraudReasons.length > 0) {
    const reasonsList = fraudReasons.map((f) => `• ${f.userMsg}`).join("\n");

    // ── Send user alert (max 1 per 2 minutes) ──
    if (bot && canSendUserAlert(userId)) {
      markUserAlertSent(userId);
      const userAlertMsg =
        `🚨 *Security Warning!*\n\n` +
        `⚠️ Suspicious activity detected on your account.\n\n` +
        `*Reason:*\n${reasonsList}\n\n` +
        `📊 Risk Score: *${score}%*\n\n` +
        `❗ If you continue this activity, your account may be restricted or banned.\n\n` +
        `Please use only ONE account per device and avoid VPN or shared networks.`;
      bot.sendMessage(userId, userAlertMsg, { parse_mode: "Markdown" }).catch(() => {});
    }

    // ── Determine action based on score ──
    let actionLabel = "Warning";
    if (score >= 90) {
      // Auto ban
      actionLabel = "Auto Ban";
      banUser(userId, `Auto-banned: risk score ${score}%`);
      if (bot) {
        bot.sendMessage(userId, "🚫 Your account has been banned due to repeated suspicious activity. Contact support.").catch(() => {});
        const adminMsg =
          `🚨 *Fraud Detection Alert*\n\n` +
          `👤 User ID: \`${userId}\`\n` +
          `📊 Risk Score: *${score}%*\n\n` +
          `*Reasons:*\n${fraudReasons.map((f) => `• ${f.message}`).join("\n")}\n\n` +
          `🔴 *Action: Auto Ban Applied*`;
        for (const adminId of ADMIN_IDS) {
          bot.sendMessage(adminId, adminMsg, { parse_mode: "Markdown" }).catch(() => {});
        }
      }
      res.status(403).json({ success: false, fraud: true, fraudType: "banned", message: "🚫 Account banned due to repeated suspicious activity." });
      return;
    } else if (score >= 70) {
      // 24h cooldown
      actionLabel = "24h Cooldown Applied";
      setCooldown(userId, 24);
      if (bot) {
        bot.sendMessage(userId,
          `⚠️ *Multiple accounts detected*\n\nPlease wait *24 hours* and try again.`,
          { parse_mode: "Markdown" }
        ).catch(() => {});
      }
    } else if (score >= 40) {
      // 12h cooldown
      actionLabel = "12h Cooldown Applied";
      setCooldown(userId, 12);
      if (bot) {
        bot.sendMessage(userId,
          `⚠️ *Multiple accounts detected*\n\nPlease wait *24 hours* and try again.`,
          { parse_mode: "Markdown" }
        ).catch(() => {});
      }
    }

    // ── Send enhanced admin alert ──
    if (bot) {
      const adminMsg =
        `🚨 *Fraud Detection Alert*\n\n` +
        `👤 User ID: \`${userId}\`\n` +
        `📊 Risk Score: *${score}%*\n\n` +
        `*Reasons:*\n${fraudReasons.map((f) => `• ${f.message}`).join("\n")}\n\n` +
        `⚡ *Action: ${actionLabel}*`;
      for (const adminId of ADMIN_IDS) {
        bot.sendMessage(adminId, adminMsg, { parse_mode: "Markdown" }).catch(() => {});
      }
    }

    // Block if cooldown was applied
    if (score >= 40 && score < 90) {
      const hoursApplied = score >= 70 ? 24 : 12;
      res.status(403).json({
        success: false,
        fraud: true,
        fraudType: "cooldown",
        message: `⚠️ Multiple accounts detected. Please wait 24 hours and try again.`,
      });
      return;
    }
  }

  // Mark user as active
  updateUserLastActive(userId);

  const newCoins = user.coins + 1;
  const newCompleted = [...user.completedTasks, taskId];
  updateUser(userId, {
    coins: newCoins,
    completedTasks: newCompleted,
  });
  addEarningHistory(userId, 1, "Task Completed");

  // Level 1 referral commission only — no multi-level
  if (user.referredBy && cfg.referralEnabled) {
    // Per-task commission (no notification — only shows in history)
    if (cfg.perTaskCommission > 0) {
      const referrer = getUser(user.referredBy);
      updateUser(user.referredBy, {
        coins: referrer.coins + cfg.perTaskCommission,
        referralEarnings: referrer.referralEarnings + cfg.perTaskCommission,
      });
      addEarningHistory(user.referredBy, cfg.perTaskCommission, "Referral Commission");
    }

    // Referral bonus after X tasks completed (Feature 7)
    const taskReq = cfg.referralTaskRequirement || 0;
    const updatedUser = getUser(userId);
    if (taskReq > 0 && !updatedUser.referralBonusPaid && newCompleted.length >= taskReq) {
      const bonus = cfg.referralBonus;
      const referrer = getUser(user.referredBy);
      updateUser(user.referredBy, {
        coins: referrer.coins + bonus,
        referralEarnings: referrer.referralEarnings + bonus,
      });
      addEarningHistory(user.referredBy, bonus, "Referral Bonus (Task Requirement Met)");
      updateUser(userId, { referralBonusPaid: true });
      if (bot) {
        bot.sendMessage(user.referredBy,
          `🎁 Referral bonus: +${bonus} coins!\nYour referral completed ${taskReq} task(s).`
        ).catch(() => {});
      }
    }
  }

  sendTaskCompletion(userId, newCoins);
  req.log.info({ userId, taskId, coins: newCoins }, "Task completed");
  res.json({
    success: true,
    message: "Task completed! +1 Coin!",
    coins: newCoins,
    available: getAvailableTaskCount(userId),
    completed: newCompleted.length,
  });
});

router.post("/cancel-task", (req: Request, res: Response) => {
  const { taskId, userId } = req.body as { taskId: string; userId: string };
  if (!taskId || !userId) {
    res.status(400).json({ success: false, message: "taskId and userId are required" });
    return;
  }
  if (bot) {
    bot.sendMessage(userId,
      "❌ *Task Cancelled*\n\nYou returned before completing the required time.\nNo coins added.\n\nYou can retry the task anytime. 🔄"
    , { parse_mode: "Markdown" }).catch(() => {});
  }
  req.log.info({ userId, taskId }, "Task cancelled by user (early return)");
  res.json({ success: true, message: "Task cancelled" });
});

router.get("/user/:userId", (req: Request, res: Response) => {
  const user = getUser(req.params.userId);
  res.json({ success: true, user });
});

router.get("/tasks", (_req: Request, res: Response) => {
  res.json({ success: true, tasks: getActiveTasks() });
});

router.get("/task/:taskId", (req: Request, res: Response) => {
  const task = getTaskById(req.params.taskId);
  if (!task) {
    res.status(404).json({ success: false, message: "Task not found" });
    return;
  }
  res.json({ success: true, task });
});

router.get("/current-task/:userId", (req: Request, res: Response) => {
  const { userId } = req.params;
  const task = getCurrentTaskForUser(userId);
  const user = getUser(userId);
  res.json({ success: true, task, user });
});

router.post("/add-task", adminAuthMiddleware, (req: Request, res: Response) => {
  const { link } = req.body as { link: string };
  if (!link || !link.startsWith("http")) {
    res.status(400).json({ success: false, message: "Please provide a valid URL" });
    return;
  }
  if (isLinkDuplicate(link)) {
    res.status(400).json({ success: false, message: "❌ Duplicate Link\nThis task already exists. Please add a new link." });
    return;
  }
  const task = addTask(link);
  req.log.info({ taskId: task.id, link }, "Task added via API");
  res.json({ success: true, task });
});

router.get("/admin/users", adminAuthMiddleware, (_req: Request, res: Response) => {
  const allUsers = getAllUsers();
  const users = Object.entries(allUsers)
    .map(([id, u]) => ({ id, ...u }))
    .sort((a, b) => b.coins - a.coins);
  const totalCoins = users.reduce((s, u) => s + u.coins, 0);
  const totalCompleted = users.reduce((s, u) => s + u.completedTasks.length, 0);
  res.json({ success: true, users, count: users.length, totalCoins, totalCompleted });
});

router.get("/admin/user-analytics/:userId", adminAuthMiddleware, (req: Request, res: Response) => {
  const { userId } = req.params;
  const allUsers = getAllUsers();
  if (!allUsers[userId]) {
    res.status(404).json({ success: false, message: "User not found" });
    return;
  }
  const analytics = getUserAnalytics(userId);
  res.json({ success: true, analytics });
});

router.get("/admin/withdrawals", adminAuthMiddleware, (_req: Request, res: Response) => {
  const withdrawals = getWithdrawals();
  res.json({ success: true, withdrawals });
});

router.post("/admin/delete-task", adminAuthMiddleware, (req: Request, res: Response) => {
  const { taskId } = req.body as { taskId: string };
  if (!taskId) {
    res.status(400).json({ success: false, message: "taskId is required" });
    return;
  }
  const deleted = deleteTask(taskId);
  if (!deleted) {
    res.status(404).json({ success: false, message: "Task not found" });
    return;
  }
  req.log.info({ taskId }, "Task deleted");
  res.json({ success: true, message: "Task deleted successfully" });
});

router.post("/admin/process-withdrawal", adminAuthMiddleware, async (req: Request, res: Response) => {
  const { withdrawalId, action } = req.body as { withdrawalId: string; action: "approve" | "reject" };
  if (!withdrawalId || !action) {
    res.status(400).json({ success: false, message: "withdrawalId and action are required" });
    return;
  }
  const wr = getWithdrawalById(withdrawalId);
  if (!wr) {
    res.status(404).json({ success: false, message: "Withdrawal not found" });
    return;
  }
  const status = action === "approve" ? "approved" : "rejected";
  updateWithdrawal(withdrawalId, status);

  if (action === "approve") {
    const user = getUser(wr.userId);
    updateUser(wr.userId, { coins: Math.max(0, user.coins - wr.amount) });
  }

  if (bot) {
    const msgText =
      action === "approve"
        ? `✅ Your withdrawal of ${wr.amount} coins has been approved!`
        : "❌ Your withdrawal request was rejected.";
    bot.sendMessage(wr.userId, msgText).catch(() => {});
  }

  req.log.info({ withdrawalId, action }, "Withdrawal processed");
  res.json({ success: true, message: `Withdrawal ${status}` });
});

router.post("/admin/wallet", adminAuthMiddleware, async (req: Request, res: Response) => {
  const { targetUserId, action, amount, reason } = req.body as {
    targetUserId: string;
    action: "add" | "deduct";
    amount: number;
    reason: string;
  };

  if (!targetUserId || !action || !amount || !reason) {
    res.status(400).json({ success: false, message: "All fields are required" });
    return;
  }
  if (action !== "add" && action !== "deduct") {
    res.status(400).json({ success: false, message: "action must be 'add' or 'deduct'" });
    return;
  }
  if (typeof amount !== "number" || amount <= 0) {
    res.status(400).json({ success: false, message: "Please enter a valid amount" });
    return;
  }

  const allUsers = getAllUsers();
  if (!allUsers[targetUserId]) {
    res.status(404).json({ success: false, message: "User not found" });
    return;
  }

  const targetUser = getUser(targetUserId);
  const prevCoins = targetUser.coins;
  const newCoins = action === "add"
    ? prevCoins + amount
    : Math.max(0, prevCoins - amount);

  updateUser(targetUserId, { coins: newCoins });
  if (action === "add") addEarningHistory(targetUserId, amount, reason);

  if (bot) {
    const notifyMsg = action === "add"
      ? `🎉 +${amount} coins added to your wallet!\n📝 Reason: ${reason}`
      : `⚠️ ${amount} coins deducted from your wallet.\n📝 Reason: ${reason}`;
    bot.sendMessage(targetUserId, notifyMsg).catch(() => {});
  }

  req.log.info({ targetUserId, action, amount, reason, prevCoins, newCoins }, "Admin wallet updated");
  res.json({ success: true, prevCoins, newCoins, targetUserId });
});

router.post("/admin/broadcast", adminAuthMiddleware, async (req: Request, res: Response) => {
  const { message } = req.body as { message: string };
  if (!message) {
    res.status(400).json({ success: false, message: "Message is required" });
    return;
  }
  if (!bot) {
    res.status(503).json({ success: false, message: "Bot is not running" });
    return;
  }
  const allUsers = getAllUsers();
  const userIds = Object.keys(allUsers);
  let sent = 0;
  for (const uid of userIds) {
    try {
      await bot.sendMessage(uid, `📢 *Broadcast:*\n\n${message}`, { parse_mode: "Markdown" });
      sent++;
    } catch (_) {}
  }
  req.log.info({ sent, total: userIds.length }, "Broadcast sent");
  res.json({ success: true, sent, total: userIds.length });
});

router.post("/admin/coupon/create", adminAuthMiddleware, (req: Request, res: Response) => {
  const { code, maxUsers, rewardCoins } = req.body as {
    code: string;
    maxUsers: number;
    rewardCoins: number;
  };
  if (!code || !maxUsers || !rewardCoins) {
    res.status(400).json({ success: false, message: "code, maxUsers, rewardCoins are required" });
    return;
  }
  const coupon = createCouponCode(code, Number(maxUsers), Number(rewardCoins));
  res.json({ success: true, coupon });
});

router.get("/admin/coupons", adminAuthMiddleware, (_req: Request, res: Response) => {
  res.json({ success: true, coupons: getCouponCodes() });
});

router.post("/claim-coupon", (req: Request, res: Response) => {
  const { userId, code } = req.body as { userId: string; code: string };
  if (!userId || !code) {
    res.status(400).json({ success: false, message: "userId and code are required" });
    return;
  }
  const result = claimCoupon(userId, code);
  res.json(result);
});

router.get("/withdraw-cooldown/:userId", (req: Request, res: Response) => {
  const { userId } = req.params;
  const result = checkWithdrawCooldown(userId);
  res.json({ success: true, ...result });
});

router.get("/admin/policy", adminAuthMiddleware, (_req: Request, res: Response) => {
  res.json({ success: true, policy: getPolicy() });
});

router.post("/admin/policy", adminAuthMiddleware, (req: Request, res: Response) => {
  const { policy } = req.body as { policy: string };
  if (typeof policy !== "string") {
    res.status(400).json({ success: false, message: "policy text is required" });
    return;
  }
  setPolicy(policy);
  res.json({ success: true, message: "Policy updated successfully" });
});

router.get("/policy", (_req: Request, res: Response) => {
  res.json({ success: true, policy: getPolicy() });
});

router.get("/admin/banned-users", adminAuthMiddleware, (_req: Request, res: Response) => {
  const banned = getBannedUsers().map(({ userId, data }) => ({
    userId,
    coins: data.coins,
    completedTasks: data.completedTasks.length,
    banReason: data.banReason || "Admin ban",
    joinDate: data.joinDate,
  }));
  res.json({ success: true, banned, count: banned.length });
});

router.get("/admin/suspicious-users", adminAuthMiddleware, (_req: Request, res: Response) => {
  const flags = getSpamFlags().map((f) => ({
    userId: f.userId,
    types: f.types,
    reasons: f.reasons,
    flagCount: f.flagCount,
    detectedAt: f.detectedAt,
    riskScore: getRiskScore(f.userId),
  }));
  res.json({ success: true, flags, count: flags.length });
});

router.post("/admin/ban-user", adminAuthMiddleware, (req: Request, res: Response) => {
  const { userId, reason } = req.body as { userId: string; reason?: string };
  if (!userId) {
    res.status(400).json({ success: false, message: "userId is required" });
    return;
  }
  banUser(userId, reason);
  if (bot) {
    bot.sendMessage(userId, "🚫 Your account has been banned. Contact support.").catch(() => {});
  }
  res.json({ success: true, message: `User ${userId} banned` });
});

export default router;
