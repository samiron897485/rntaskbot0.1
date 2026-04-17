import TelegramBot from "node-telegram-bot-api";
import {
  getUser,
  updateUser,
  getCurrentTaskForUser,
  addTask,
  deleteTask,
  getActiveTasks,
  getAllUsers,
  addWithdrawal,
  getWithdrawals,
  updateWithdrawal,
  getWithdrawalById,
  setPendingWithdraw,
  getPendingWithdraw,
  clearPendingWithdraw,
  setPendingTaskInput,
  clearPendingTaskInput,
  isPendingTaskInput,
  getUserByReferralCode,
  getAvailableTaskCount,
  getAdminConfig,
  updateAdminConfig,
  setPendingSettingInput,
  getPendingSettingInput,
  clearPendingSettingInput,
  setPendingWalletInput,
  getPendingWalletInput,
  clearPendingWalletInput,
  banUser,
  unbanUser,
  isUserBanned,
  setPendingBanInput,
  getPendingBanInput,
  clearPendingBanInput,
  setPendingAddAdminInput,
  isPendingAddAdminInput,
  clearPendingAddAdminInput,
  flagUserAsSpam,
  getSpamFlags,
  clearSpamFlag,
  getBannedUsers,
  getRiskScore,
  getCooldownInfo,
  updateUserLastActive,
  canSendUserAlert,
  markUserAlertSent,
  isLinkDuplicate,
  getPolicy,
  setPolicy,
  addWithdrawOption,
  removeWithdrawOption,
  checkWithdrawCooldown,
  addEarningHistory,
  isPendingCouponClaimInput,
  setPendingCouponClaimInput,
  clearPendingCouponClaimInput,
  getPendingCouponAdminInput,
  setPendingCouponAdminInput,
  clearPendingCouponAdminInput,
  getUserAnalytics,
  getEarningBreakdown,
  getPaymentStats,
  getPaymentLogs,
  getUserWithdrawals,
  claimCoupon,
  createCouponCode,
  getCouponCodes,
  checkWithdrawEligibility,
  updateCouponEligibility,
  updateWithdrawEligibility,
  performCheckIn,
  countTasksCompletedTodayIST,
  getTasksCompletedBetween,
  getReferralEarningsBetween,
  countTasksInWindow,
  deleteWithdrawalById,
  runCleanup,
} from "../db/mockDb.js";
import { logger } from "../lib/logger.js";

const HARDCODED_ADMIN_IDS = ["1414414216", "7728185213"];
const _envAdminIds = (process.env.ADMIN_IDS || "").split(",").map((s) => s.trim()).filter(Boolean);
const ADMIN_IDS: string[] = [...new Set([...HARDCODED_ADMIN_IDS, ..._envAdminIds])];

export let bot: TelegramBot | null = null;
let BASE_URL = "";

const T = {
  bn: {
    welcome: (name: string) =>
      `🎉 Welcome ${name}!\n\nEarn coins by completing tasks and withdraw anytime.`,
    main_menu: "🏠 Main Menu",
    tasks_btn: "📋 Tasks",
    balance_btn: "💰 Balance",
    settings_btn: "⚙️ Settings",
    help_btn: "💬 Help",
    referral_btn: "👥 Referral",
    no_task: (avail: number, done: number) =>
      `😔 No tasks available right now.\n\n📊 Available: ${avail} | ✅ Completed: ${done}\n\nCheck back later.`,
    task_title: "📋 *Current Task*",
    task_link: "🆔 Task ID",
    task_expire: "⏰ Expires in",
    task_reward: "💰 Reward: 1 Coin",
    task_counter: (avail: number, done: number) => `📊 Available: ${avail} | ✅ Completed: ${done}`,
    start_task_btn: "✅ Start Task",
    skip_task_btn: "⏭️ Skip Task",
    next_task_btn: "⏭️ Next Task",
    task_skipped: "⏭️ Task skipped.",
    all_done: (done: number) => `✅ All tasks done! Total completed: ${done}\n\nWait for new tasks.`,
    balance_title: "💰 *Your Balance*",
    completed: "✅ Completed Tasks",
    skipped: "⏭️ Skipped",
    withdraw_btn: "💸 Withdraw",
    history_btn: "📜 History",
    back_btn: "🔙 Back",
    withdraw_ask_amount: (coins: number, minW: number, rate: number) =>
      `💸 Withdraw\n\nYour coins: ${coins}\nMinimum withdrawal: ${minW} coins\n💱 Rate: ${minW} coins = ₹${Math.round(minW / rate * 10) / 10} INR\n\nHow many coins to withdraw?`,
    withdraw_ask_name: "👤 Enter the Account Holder Name:",
    withdraw_ask_qr: "📷 Upload your Payment QR Code (send as image):",
    withdraw_insufficient: (coins: number, minW: number) =>
      `❌ Insufficient coins. You have ${coins} coins.\nMinimum ${minW} coins required.`,
    withdraw_invalid_amount: "❌ Please enter a valid number.",
    withdraw_invalid_name: "❌ Please enter a valid name:",
    withdraw_invalid_qr: "❌ Please send an image file (QR code photo):",
    withdraw_success: (amount: number, inrAmount: number) =>
      `✅ Withdrawal Request Submitted\n\n💰 Amount: ${amount} coins (₹${inrAmount})\n\n⏳ Your request will be reviewed and approved within 24 hours.\n\nPlease wait for approval.`,
    withdraw_rejected_reason: (reason: string) =>
      `❌ Your withdrawal request has been rejected.\n\nReason: ${reason}`,
    no_history: "📜 No withdrawal history.",
    history_title: "📜 *Withdrawal History*",
    settings_title: "⚙️ *Settings*",
    lang_btn: "🌐 Change Language",
    current_lang: "Current language: 🇬🇧 English",
    select_lang: "🌐 Select language:",
    lang_set: "✅ Language changed",
    help_text: (link: string) =>
      link
        ? `💬 *Help*\n\nContact support via the link below:`
        : `💬 *Help*\n\n📋 Tasks - View and complete tasks\n💰 Balance - View coins & withdraw\n⚙️ Settings - Change language`,
    help_btn_contact: "📩 Contact Support",
    task_complete: (coins: number, avail: number, done: number) =>
      `🎉 Task completed! +1 Coin!\n\n💰 Total coins: ${coins}\n📊 Available: ${avail} | ✅ Completed: ${done}`,
    min_time: "seconds left",
    withdraw_cancelled: "❌ Withdrawal cancelled.",
    withdraw_approved: (amount: number) => `✅ Your withdrawal of ${amount} coins has been approved!`,
    withdraw_rejected: "❌ Your withdrawal request was rejected.",
    cancel_btn: "❌ Cancel",
    referral_title: "👥 *Referral System*",
    referral_info: (code: string, link: string, total: number, earnings: number) =>
      `👥 *Your Referral Info*\n\n🔗 Referral Code: \`${code}\`\n📎 Referral Link:\n\`${link}\`\n\n👤 Total Referrals: ${total}\n💰 Referral Earnings: ${earnings} coins`,
    referral_disabled: "❌ Referral system is currently disabled.",
    referral_welcome: (bonus: number) => `🎁 Referral bonus: +${bonus} coins added!`,
    referral_rules_btn: "📋 Ref Rules",
    referral_rules: (bonus: number, reqTasks: number, commission: number) =>
      `📋 *Referral Rules*\n\n` +
      `🎁 *Join Bonus:* When someone joins using your referral link, they must complete *${reqTasks} task(s)* first. After that, you will receive *+${bonus} coins* as a referral bonus.\n\n` +
      `💹 *Per-Task Commission:* You earn *+${commission} coin(s)* every time your referred friend completes a task.\n\n` +
      `ℹ️ Only Level 1 referrals are counted (direct referrals only).`,
    coins_added: (amount: number, reason: string) => `🎉 +${amount} coins added to your wallet!\n📝 Reason: ${reason}`,
    coins_deducted: (amount: number, reason: string) => `⚠️ ${amount} coins deducted from your wallet.\n📝 Reason: ${reason}`,
    my_id_btn: "🪪 My ID",
    my_id_text: (id: string) => `🪪 *Your User ID*\n\n\`${id}\`\n\nSend this ID to admin if needed.`,
    banned_msg: "🚫 Your account has been banned. Contact support.",
    contact_support_btn: "📩 Contact Support",
    free_coupon_btn: "🎟️ Free Coupon",
    claim_coupon_btn: "🎁 Claim Coupon",
    coupon_ask_code: "🎁 Enter your coupon code:",
    coupon_success: (coins: number) => `✅ Coupon claimed! +${coins} coins added to your wallet!`,
    coupon_invalid: "❌ Invalid coupon code.",
    coupon_expired: "❌ Coupon expired or fully claimed.",
    coupon_already_claimed: "❌ You have already claimed this coupon.",
    withdraw_cooldown: (hours: number) => `⏳ You can request withdrawal after ${hours} hours.`,
    user_analytics_title: "📊 *User Analytics*",
    earning_history_btn: "📊 Earning Logs",
    earning_history_title: "📊 *Earning Logs*",
    earning_history_empty: "📊 *Earning Logs*\n\nNo transactions yet.",
    earning_history_nav: (from: number, to: number, total: number) => `(${from}-${to} of ${total})`,
    prev_btn: "◀️ Previous",
    next_btn: "Next ▶️",
  },
  en: {
    welcome: (name: string) =>
      `🎉 Welcome ${name}!\n\nEarn coins by completing tasks and withdraw anytime.`,
    main_menu: "🏠 Main Menu",
    tasks_btn: "📋 Tasks",
    balance_btn: "💰 Balance",
    settings_btn: "⚙️ Settings",
    help_btn: "💬 Help",
    referral_btn: "👥 Referral",
    no_task: (avail: number, done: number) =>
      `😔 No tasks available right now.\n\n📊 Available: ${avail} | ✅ Completed: ${done}\n\nCheck back later.`,
    task_title: "📋 *Current Task*",
    task_link: "🆔 Task ID",
    task_expire: "⏰ Expires in",
    task_reward: "💰 Reward: 1 Coin",
    task_counter: (avail: number, done: number) => `📊 Available: ${avail} | ✅ Completed: ${done}`,
    start_task_btn: "✅ Start Task",
    skip_task_btn: "⏭️ Skip Task",
    next_task_btn: "⏭️ Next Task",
    task_skipped: "⏭️ Task skipped.",
    all_done: (done: number) => `✅ All tasks done! Total completed: ${done}\n\nWait for new tasks.`,
    balance_title: "💰 *Your Balance*",
    completed: "✅ Completed Tasks",
    skipped: "⏭️ Skipped",
    withdraw_btn: "💸 Withdraw",
    history_btn: "📜 History",
    back_btn: "🔙 Back",
    withdraw_ask_amount: (coins: number, minW: number, rate: number) =>
      `💸 Withdraw\n\nYour coins: ${coins}\nMinimum withdrawal: ${minW} coins\n💱 Rate: ${minW} coins = ₹${Math.round(minW / rate * 10) / 10} INR\n\nHow many coins to withdraw?`,
    withdraw_ask_name: "👤 Enter the Account Holder Name:",
    withdraw_ask_qr: "📷 Upload your Payment QR Code (send as image):",
    withdraw_insufficient: (coins: number, minW: number) =>
      `❌ Insufficient coins. You have ${coins} coins.\nMinimum ${minW} coins required.`,
    withdraw_invalid_amount: "❌ Please enter a valid number.",
    withdraw_invalid_name: "❌ Please enter a valid name:",
    withdraw_invalid_qr: "❌ Please send an image file (QR code photo):",
    withdraw_success: (amount: number, inrAmount: number) =>
      `✅ Withdrawal Request Submitted\n\n💰 Amount: ${amount} coins (₹${inrAmount})\n\n⏳ Your request will be reviewed and approved within 24 hours.\n\nPlease wait for approval.`,
    withdraw_rejected_reason: (reason: string) =>
      `❌ Your withdrawal request has been rejected.\n\nReason: ${reason}`,
    no_history: "📜 No withdrawal history.",
    history_title: "📜 *Withdrawal History*",
    settings_title: "⚙️ *Settings*",
    lang_btn: "🌐 Change Language",
    current_lang: "Current language: 🇬🇧 English",
    select_lang: "🌐 Select language:",
    lang_set: "✅ Language changed",
    help_text: (link: string) =>
      link
        ? `💬 *Help*\n\nContact support via the link below:`
        : `💬 *Help*\n\n📋 Tasks - View and complete tasks\n💰 Balance - View coins & withdraw\n⚙️ Settings - Change language`,
    help_btn_contact: "📩 Contact Support",
    task_complete: (coins: number, avail: number, done: number) =>
      `🎉 Task completed! +1 Coin!\n\n💰 Total coins: ${coins}\n📊 Available: ${avail} | ✅ Completed: ${done}`,
    min_time: "seconds left",
    withdraw_cancelled: "❌ Withdrawal cancelled.",
    withdraw_approved: (amount: number) => `✅ Your withdrawal of ${amount} coins has been approved!`,
    withdraw_rejected: "❌ Your withdrawal request was rejected.",
    cancel_btn: "❌ Cancel",
    referral_title: "👥 *Referral System*",
    referral_info: (code: string, link: string, total: number, earnings: number) =>
      `👥 *Your Referral Info*\n\n🔗 Referral Code: \`${code}\`\n📎 Referral Link:\n\`${link}\`\n\n👤 Total Referrals: ${total}\n💰 Referral Earnings: ${earnings} coins`,
    referral_disabled: "❌ Referral system is currently disabled.",
    referral_welcome: (bonus: number) => `🎁 Referral bonus: +${bonus} coins added!`,
    referral_rules_btn: "📋 Ref Rules",
    referral_rules: (bonus: number, reqTasks: number, commission: number) =>
      `📋 *Referral Rules*\n\n` +
      `🎁 *Join Bonus:* When someone joins using your referral link, they must complete *${reqTasks} task(s)* first. After that, you will receive *+${bonus} coins* as a referral bonus.\n\n` +
      `💹 *Per-Task Commission:* You earn *+${commission} coin(s)* every time your referred friend completes a task.\n\n` +
      `ℹ️ Only Level 1 referrals are counted (direct referrals only).`,
    coins_added: (amount: number, reason: string) => `🎉 +${amount} coins added to your wallet!\n📝 Reason: ${reason}`,
    coins_deducted: (amount: number, reason: string) => `⚠️ ${amount} coins deducted from your wallet.\n📝 Reason: ${reason}`,
    my_id_btn: "🪪 My ID",
    my_id_text: (id: string) => `🪪 *Your User ID*\n\n\`${id}\`\n\nSend this ID to admin if needed.`,
    banned_msg: "🚫 Your account has been banned. Contact support.",
    contact_support_btn: "📩 Contact Support",
    free_coupon_btn: "🎟️ Free Coupon",
    claim_coupon_btn: "🎁 Claim Coupon",
    coupon_ask_code: "🎁 Enter your coupon code:",
    coupon_success: (coins: number) => `✅ Coupon claimed! +${coins} coins added to your wallet!`,
    coupon_invalid: "❌ Invalid coupon code.",
    coupon_expired: "❌ Coupon expired or fully claimed.",
    coupon_already_claimed: "❌ You have already claimed this coupon.",
    withdraw_cooldown: (hours: number) => `⏳ You can request withdrawal after ${hours} hours.`,
    user_analytics_title: "📊 *User Analytics*",
    earning_history_btn: "📊 Earning Logs",
    earning_history_title: "📊 *Earning Logs*",
    earning_history_empty: "📊 *Earning Logs*\n\nNo transactions yet.",
    earning_history_nav: (from: number, to: number, total: number) => `(${from}-${to} of ${total})`,
    prev_btn: "◀️ Previous",
    next_btn: "Next ▶️",
  },
};

function t(_userId: string) {
  return T.en;
}

function escMd(text: string): string {
  return String(text).replace(/[_*`\[\]]/g, (c) => `\\${c}`);
}

function isAdmin(userId: string): boolean {
  return ADMIN_IDS.includes(userId);
}

function addAdmin(userId: string): boolean {
  if (ADMIN_IDS.includes(userId)) return false;
  ADMIN_IDS.push(userId);
  return true;
}

function removeAdmin(userId: string): boolean {
  if (HARDCODED_ADMIN_IDS.includes(userId)) return false;
  const idx = ADMIN_IDS.indexOf(userId);
  if (idx === -1) return false;
  ADMIN_IDS.splice(idx, 1);
  return true;
}

function formatTimeLeft(ms: number): string {
  const totalSecs = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function persistentMenuKeyboard(userId: string) {
  const txt = t(userId);
  return {
    keyboard: [[{ text: txt.main_menu }]],
    resize_keyboard: true,
    persistent: true,
  };
}

function mainMenuKeyboard(userId: string) {
  const txt = t(userId);
  return {
    inline_keyboard: [
      [
        { text: txt.tasks_btn, callback_data: "menu_tasks" },
        { text: txt.balance_btn, callback_data: "menu_balance" },
      ],
      [
        { text: txt.help_btn, callback_data: "menu_help" },
        { text: txt.referral_btn, callback_data: "menu_referral" },
      ],
      [
        { text: txt.free_coupon_btn, callback_data: "menu_freecoupon" },
        { text: txt.claim_coupon_btn, callback_data: "menu_claimcoupon" },
      ],
      [
        { text: txt.my_id_btn, callback_data: "menu_myid" },
        { text: "📜 Policy", callback_data: "menu_policy" },
      ],
      [
        { text: "📅 Check In", callback_data: "menu_checkin" },
      ],
    ],
  };
}

function adminMenuKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "➕ Add Task", callback_data: "admin_addtask" },
        { text: "📋 Task List", callback_data: "admin_tasklist" },
      ],
      [
        { text: "👥 Users", callback_data: "admin_users" },
        { text: "📢 Broadcast", callback_data: "admin_broadcast" },
      ],
      [
        { text: "💸 Withdraw Queue", callback_data: "admin_withdrawqueue" },
        { text: "🗂 Wdrl Bin", callback_data: "admin_wdrl_bin" },
      ],
      [
        { text: "💼 Manage User Wallet", callback_data: "admin_wallet" },
        { text: "📦 Bulk Wallet Control", callback_data: "admin_bulkwallet" },
      ],
      [
        { text: "🚫 User Control", callback_data: "admin_usercontrol" },
        { text: "👑 Admin Management", callback_data: "admin_manage_admins" },
      ],
      [
        { text: "⚙️ Settings", callback_data: "admin_settings" },
        { text: "🚨 Spam Monitor", callback_data: "admin_spam" },
      ],
      [
        { text: "💰 Withdraw Options", callback_data: "admin_withdraw_opts" },
        { text: "📨 Message User", callback_data: "admin_msg_user" },
      ],
      [
        { text: "📊 User Analytics", callback_data: "admin_user_analytics" },
        { text: "⏱️ Withdraw Cooldown", callback_data: "admin_set_withdrawCooldownHours" },
      ],
      [
        { text: "🔗 Set Coupon Link", callback_data: "admin_set_couponLink" },
        { text: "🎟️ Create Coupon Code", callback_data: "admin_create_coupon" },
      ],
      [
        { text: "📋 List Coupons", callback_data: "admin_list_coupons" },
        { text: "📜 Set Policy", callback_data: "admin_setpolicy" },
      ],
      [
        { text: "🔴 Banned Users", callback_data: "admin_banned_users" },
        { text: "🚨 Suspicious Users", callback_data: "admin_suspicious_users" },
      ],
      [
        { text: "🎟️ Coupon Eligibility", callback_data: "admin_coupon_eligibility" },
        { text: "💸 Withdraw Eligibility", callback_data: "admin_withdraw_eligibility" },
      ],
      [
        { text: "📊 Stats", callback_data: "admin_stats" },
        { text: "🧹 Manual Cleanup", callback_data: "admin_manual_cleanup" },
      ],
      [
        { text: "💰 Payments", callback_data: "admin_payments" },
        { text: "👤 User Paylogs", callback_data: "admin_user_paylogs" },
      ],
    ],
  };
}

const SETTING_META: Record<string, { label: string; unit: string; type: "number" | "text" }> = {
  taskDuration:             { label: "⏱️ Task Timer",               unit: "seconds", type: "number" },
  taskExpiry:               { label: "📅 Task Expiry",               unit: "hours",   type: "number" },
  referralBonus:            { label: "🎁 Referral Bonus",            unit: "coins",   type: "number" },
  referralTaskRequirement:  { label: "🎯 Referral Task Requirement", unit: "tasks",   type: "number" },
  perTaskCommission:        { label: "💹 Per Task Commission",       unit: "coins",   type: "number" },
  minWithdraw:              { label: "💸 Min Withdraw",              unit: "coins",   type: "number" },
  coinToMoneyRate:          { label: "💱 Coin Rate (INR)",           unit: "coins/₹1", type: "number" },
  supportLink:              { label: "🔗 Support Link",              unit: "",        type: "text" },
  withdrawCooldownHours:    { label: "⏱️ Withdraw Cooldown",         unit: "hours",   type: "number" },
  couponLink:               { label: "🎟️ Free Coupon Link",          unit: "",        type: "text" },
  checkInDailyReward:       { label: "📅 Check-In Daily Reward",      unit: "coins",   type: "number" },
  checkInRequiredTasks:     { label: "📅 Check-In Required Tasks",     unit: "tasks",   type: "number" },
};

function currentSettingValue(key: string, cfg: ReturnType<typeof getAdminConfig>): string {
  const v = (cfg as Record<string, unknown>)[key];
  const meta = SETTING_META[key];
  if (v === undefined || v === null || v === "") return "Not set";
  return `${v}${meta.unit ? " " + meta.unit : ""}`;
}

async function showAdminSettingsMenu(chatId: number): Promise<void> {
  const cfg = getAdminConfig();
  const lines = Object.entries(SETTING_META)
    .map(([key, meta]) => `${meta.label}: *${currentSettingValue(key, cfg)}*`)
    .join("\n");

  const buttons = Object.entries(SETTING_META).map(([key, meta]) => [
    { text: `✏️ ${meta.label}`, callback_data: `admin_set_${key}` },
  ]);
  buttons.push([{ text: "🔙 Back", callback_data: "admin_back" }]);

  await bot!.sendMessage(
    chatId,
    `⚙️ *Current Settings*\n\n${lines}\n\nPress a button to change a setting:`,
    { parse_mode: "Markdown", reply_markup: { inline_keyboard: buttons } }
  );
}

async function sendOrEdit(
  chatId: number,
  userId: string,
  text: string,
  options: TelegramBot.SendMessageOptions
): Promise<number | null> {
  const user = getUser(userId);
  const existingMsgId = user.lastMessageId;

  if (existingMsgId) {
    try {
      await bot!.editMessageText(text, {
        chat_id: chatId,
        message_id: existingMsgId,
        parse_mode: options.parse_mode,
        reply_markup: options.reply_markup as TelegramBot.InlineKeyboardMarkup,
      });
      return existingMsgId;
    } catch (_) {
      bot!.deleteMessage(chatId, existingMsgId).catch(() => {});
    }
  }

  const msg = await bot!.sendMessage(chatId, text, options);
  updateUser(userId, { lastMessageId: msg.message_id });
  return msg.message_id;
}

async function notifyAdminsAboutSpam(userId: string, types: string[], reasons: string[]): Promise<void> {
  if (!bot) return;
  const typeMap: Record<string, string> = {
    referral_spam: "1. Excess Referrals (20+)",
    rapid_earning: "2. Rapid Coin Earning",
    same_wifi: "3. Multiple Accounts on Same WiFi/IP",
  };
  const typeLabels = types.map((tp) => typeMap[tp] || tp).join("\n");
  const detailLines = reasons.map((r, i) => `${i + 1}. ${r}`).join("\n");
  const msg =
    `🚨 *Spam Alert!*\n\n` +
    `👤 User ID: \`${userId}\`\n\n` +
    `⚠️ *Spam type:*\n${typeLabels}\n\n` +
    `📝 *Details:*\n${detailLines}`;
  for (const adminId of ADMIN_IDS) {
    bot.sendMessage(adminId, msg, { parse_mode: "Markdown" }).catch(() => {});
  }
}

async function showMainMenu(chatId: number, userId: string) {
  const txt = t(userId);
  const user = getUser(userId);

  // Delete the old menu message so the new one always appears at the bottom
  if (user.lastMessageId) {
    bot!.deleteMessage(chatId, user.lastMessageId).catch(() => {});
    updateUser(userId, { lastMessageId: undefined });
  }

  const msg = await bot!.sendMessage(chatId, txt.main_menu, {
    reply_markup: mainMenuKeyboard(userId),
  });
  updateUser(userId, { lastMessageId: msg.message_id });
}

async function showAdminMenu(chatId: number) {
  await bot!.sendMessage(chatId, "🔧 *Admin Panel*\n\nSelect a function:", {
    parse_mode: "Markdown",
    reply_markup: adminMenuKeyboard(),
  });
}

async function showTaskMenu(chatId: number, userId: string) {
  const txt = t(userId);
  const task = getCurrentTaskForUser(userId);
  const available = getAvailableTaskCount(userId);
  const done = getUser(userId).completedTasks.length;

  if (!task) {
    const msgId = await sendOrEdit(chatId, userId, txt.no_task(available, done), {
      reply_markup: { inline_keyboard: [[{ text: txt.main_menu, callback_data: "menu_main" }]] },
    });
    if (msgId) updateUser(userId, { lastMessageId: msgId });
    return;
  }

  const timeLeft = formatTimeLeft(task.expiresAt.getTime() - Date.now());
  const trackingUrl = `${BASE_URL}/task?taskId=${task.id}&userId=${userId}`;

  const text =
    `${txt.task_title}\n\n` +
    `${txt.task_link}: \`${task.id}\`\n` +
    `${txt.task_expire}: ${timeLeft}\n` +
    `${txt.task_reward}\n\n` +
    `${txt.task_counter(available, done)}`;

  const msgId = await sendOrEdit(chatId, userId, text, {
    parse_mode: "Markdown",
    disable_web_page_preview: true,
    reply_markup: {
      inline_keyboard: [
        [{ text: txt.start_task_btn, url: trackingUrl }],
        [{ text: txt.skip_task_btn, callback_data: `skip|${task.id}|${userId}` }],
        [{ text: txt.back_btn, callback_data: "menu_main" }],
      ],
    },
  });
  if (msgId) updateUser(userId, { lastMessageId: msgId });
}

async function showBalanceMenu(chatId: number, userId: string) {
  const user = getUser(userId);
  const txt = t(userId);
  const cfg = getAdminConfig();
  const inrAmount = Math.round(cfg.minWithdraw / cfg.coinToMoneyRate * 10) / 10;

  const text =
    `${txt.balance_title}\n\n` +
    `💰 Coins: ${user.coins}\n` +
    `${txt.completed}: ${user.completedTasks.length}\n` +
    `${txt.skipped}: ${user.skippedTasks.length}\n\n` +
    `💱 Rate: ${cfg.minWithdraw} coins = ₹${inrAmount} INR\n` +
    `📌 Min Withdraw: ${cfg.minWithdraw} coins`;

  const msgId = await sendOrEdit(chatId, userId, text, {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [
          { text: txt.withdraw_btn, callback_data: "balance_withdraw" },
          { text: txt.history_btn, callback_data: "balance_history" },
        ],
        [{ text: txt.earning_history_btn, callback_data: "balance_earning_history_0" }],
        [{ text: txt.back_btn, callback_data: "menu_main" }],
      ],
    },
  });
  if (msgId) updateUser(userId, { lastMessageId: msgId });
}

async function showEarningHistory(chatId: number, userId: string, page: number) {
  const txt = t(userId);
  const user = getUser(userId);
  const PAGE_SIZE = 5;
  const MAX_ITEMS = 10;

  // Get last 10 items, newest first
  const allHistory = (user.earningHistory || []).slice().reverse().slice(0, MAX_ITEMS);

  if (allHistory.length === 0) {
    const msgId = await sendOrEdit(chatId, userId, txt.earning_history_empty, {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: [[{ text: txt.back_btn, callback_data: "menu_balance" }]] },
    });
    if (msgId) updateUser(userId, { lastMessageId: msgId });
    return;
  }

  const start = page * PAGE_SIZE;
  const end = Math.min(start + PAGE_SIZE, allHistory.length);
  const pageItems = allHistory.slice(start, end);
  const totalPages = Math.ceil(allHistory.length / PAGE_SIZE);

  const lines = pageItems.map((h, i) => {
    const date = new Date(h.date).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit", month: "short",
      hour: "2-digit", minute: "2-digit",
    });
    const sign = h.amount >= 0 ? "+" : "";
    return `${start + i + 1}. *${sign}${h.amount} 🪙* — ${escMd(h.reason)}\n    📅 ${escMd(date)}`;
  }).join("\n\n");

  const navButtons: { text: string; callback_data: string }[] = [];
  if (page > 0) navButtons.push({ text: txt.prev_btn, callback_data: `balance_earning_history_${page - 1}` });
  if (page < totalPages - 1) navButtons.push({ text: txt.next_btn, callback_data: `balance_earning_history_${page + 1}` });

  const keyboard: { text: string; callback_data: string }[][] = [];
  if (navButtons.length > 0) keyboard.push(navButtons);
  keyboard.push([{ text: txt.back_btn, callback_data: "menu_balance" }]);

  const header = `${txt.earning_history_title} ${txt.earning_history_nav(start + 1, end, allHistory.length)}\n\n`;
  const msgId = await sendOrEdit(chatId, userId, header + lines, {
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: keyboard },
  });
  if (msgId) updateUser(userId, { lastMessageId: msgId });
}

async function showSettingsMenu(chatId: number, userId: string) {
  const user = getUser(userId);
  const txt = t(userId);
  const langDisplay = user.language === "bn" ? "🇧🇩 Bengali" : "🇬🇧 English";

  const msgId = await sendOrEdit(
    chatId,
    userId,
    `${txt.settings_title}\n\n🌐 Language: ${langDisplay}`,
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: txt.lang_btn, callback_data: "settings_lang" }],
          [{ text: txt.back_btn, callback_data: "menu_main" }],
        ],
      },
    }
  );
  if (msgId) updateUser(userId, { lastMessageId: msgId });
}

async function showReferralMenu(chatId: number, userId: string) {
  const txt = t(userId);
  const cfg = getAdminConfig();

  if (!cfg.referralEnabled) {
    const msgId = await sendOrEdit(chatId, userId, txt.referral_disabled, {
      reply_markup: { inline_keyboard: [[{ text: txt.back_btn, callback_data: "menu_main" }]] },
    });
    if (msgId) updateUser(userId, { lastMessageId: msgId });
    return;
  }

  const user = getUser(userId);
  const botUsername = bot ? (await bot.getMe().catch(() => null))?.username : null;
  const refLink = botUsername
    ? `https://t.me/${botUsername}?start=ref_${user.referralCode}`
    : `ref_${user.referralCode}`;

  const msgId = await sendOrEdit(
    chatId,
    userId,
    txt.referral_info(user.referralCode, refLink, user.totalReferrals, user.referralEarnings),
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: txt.referral_rules_btn, callback_data: "referral_rules" }],
          [{ text: txt.back_btn, callback_data: "menu_main" }],
        ],
      },
    }
  );
  if (msgId) updateUser(userId, { lastMessageId: msgId });
}

async function showReferralRules(chatId: number, userId: string) {
  const txt = t(userId);
  const cfg = getAdminConfig();
  const msgId = await sendOrEdit(
    chatId,
    userId,
    txt.referral_rules(cfg.referralBonus, cfg.referralTaskRequirement, cfg.perTaskCommission),
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: txt.back_btn, callback_data: "menu_referral" }],
        ],
      },
    }
  );
  if (msgId) updateUser(userId, { lastMessageId: msgId });
}

async function showWithdrawHistory(chatId: number, userId: string) {
  const txt = t(userId);
  const all = getWithdrawals()
    .filter((w) => w.userId === userId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  let text = txt.no_history;
  if (all.length > 0) {
    const cfg = getAdminConfig();
    const lines = all
      .slice(-5)
      .map((w) => {
        const statusLine =
          w.status === "approved" ? "✅ Approved" :
          w.status === "rejected" ? "❌ Rejected" :
          "🕒 Pending";
        const inrAmount = Math.round(w.amount / cfg.coinToMoneyRate);
        const date = new Date(w.createdAt).toLocaleDateString("en-CA"); // YYYY-MM-DD
        return `${statusLine}\n💰 ${w.amount} coins (₹${inrAmount})\n📅 ${date}`;
      })
      .join("\n\n---\n\n");
    text = `${txt.history_title}\n\n${lines}`;
  }

  const msgId = await sendOrEdit(chatId, userId, text, {
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: [[{ text: txt.back_btn, callback_data: "menu_balance" }]] },
  });
  if (msgId) updateUser(userId, { lastMessageId: msgId });
}

const pendingBroadcast: Record<string, boolean> = {};
const pendingAnalyticsInput: Record<string, boolean> = {};
const pendingUserPaylogsInput: Record<string, boolean> = {};
const pendingPolicyInput: Record<string, boolean> = {};
interface EligibilityState { step: "hours" | "tasks"; type: "coupon" | "withdraw"; hours?: number; }
const pendingEligibilityInput: Record<string, EligibilityState> = {};

interface BulkWalletState {
  step: "amount" | "reason" | "confirm";
  action: "add" | "deduct";
  amount?: number;
  reason?: string;
}
const pendingBulkWallet: Record<string, BulkWalletState> = {};
const pendingAddWithdrawOption: Record<string, boolean> = {};

interface MsgUserState { step: "userId" | "message"; targetUserId?: string; }
const pendingMsgUser: Record<string, MsgUserState> = {};

interface AdminQueueSession { ids: string[]; index: number; }
const adminQueueSession: Record<string, AdminQueueSession> = {};

interface AdminBinSession { ids: string[]; index: number; }
const adminBinSession: Record<string, AdminBinSession> = {};

interface PendingRejectInput { wdId: string; }
const pendingRejectInput: Record<string, PendingRejectInput> = {};

async function showQueueItem(chatId: number, adminId: string): Promise<void> {
  if (!bot) return;
  const session = adminQueueSession[adminId];
  if (!session) return;

  // Skip already processed entries
  while (session.index < session.ids.length) {
    const wr = getWithdrawalById(session.ids[session.index]);
    if (wr && wr.status === "pending") break;
    session.index++;
  }

  if (session.index >= session.ids.length) {
    delete adminQueueSession[adminId];
    await bot.sendMessage(chatId, "✅ No more pending requests.", {
      reply_markup: { inline_keyboard: [[{ text: "🔙 Back", callback_data: "admin_back" }]] },
    });
    return;
  }

  const wr = getWithdrawalById(session.ids[session.index])!;
  const pending = getWithdrawals("pending");
  const cfg = getAdminConfig();
  const inrAmount = (wr.amount / cfg.coinToMoneyRate).toFixed(2);
  const analytics = getUserAnalytics(wr.userId);
  const breakdown = getEarningBreakdown(wr.userId);
  const wrUser = getUser(wr.userId);
  const currentBalanceMoney = (wrUser.coins / cfg.coinToMoneyRate).toFixed(2);
  const approvedWds = getWithdrawals().filter((w) => w.userId === wr.userId && w.status === "approved");
  const totalWithdrawMoney = approvedWds.reduce((s, w) => s + (w.moneyAmount ?? Math.round((w.amount / cfg.coinToMoneyRate) * 100) / 100), 0);
  const allUserWds = approvedWds.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const lastWd = allUserWds[0];
  const lastWdTime = lastWd
    ? new Date(lastWd.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
    : "—";
  const currentWdTime = new Date(wr.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
  const fromTs = lastWd ? new Date(lastWd.createdAt).getTime() : 0;
  const toTs = new Date(wr.createdAt).getTime();
  const tasksSinceLastWd = lastWd
    ? getTasksCompletedBetween(wr.userId, fromTs, toTs)
    : analytics.totalTasksCompleted;
  const refEarningsSinceLastWd = getReferralEarningsBetween(wr.userId, fromTs, toTs);

  const wdText =
    `💸 *Withdrawal Request*\n` +
    `📋 Pending Requests: ${pending.length}\n\n` +
    `🆔 \`${escMd(wr.id)}\`\n` +
    `👤 Name: ${escMd(wr.userName)}\n` +
    `🔢 User ID: \`${escMd(wr.userId)}\`\n` +
    `💰 Amount: ${wr.amount} coins (₹${inrAmount} INR)\n` +
    `🏷️ Account: ${escMd(wr.accountName)}\n\n` +
    `📊 *User Stats:*\n` +
    `✅ Tasks: ${analytics.totalTasksCompleted}\n` +
    `👥 Referred: ${analytics.totalReferredUsers} | 💎 Ref Earnings: ${analytics.totalReferralEarnings} coins\n` +
    `🪙 Balance: ${wrUser.coins} coins (₹${currentBalanceMoney})\n` +
    `💸 Total Withdrawn: ${analytics.totalWithdrawAmount} coins (₹${totalWithdrawMoney.toFixed(2)})\n` +
    `✔️ Accepted: ${analytics.totalAcceptedWithdraw} | ❌ Rejected: ${analytics.totalRejectedWithdraw}\n\n` +
    `📦 *Coin Earning Breakdown:*\n` +
    `✅ Task: ${breakdown.taskEarnings} coins\n` +
    `👥 Referral: ${breakdown.referralEarnings} coins\n` +
    `🎟️ Coupon: ${breakdown.couponEarnings} coins\n` +
    `📅 Check-in: ${breakdown.checkInEarnings} coins\n` +
    `💼 Admin Wallet: ${breakdown.adminWalletEarnings} coins\n` +
    `🧮 Total Earned: ${breakdown.totalEarned} coins\n\n` +
    `🕐 Last Withdraw: ${escMd(lastWdTime)}\n` +
    `🕑 Current: ${escMd(currentWdTime)}\n` +
    `📋 Tasks Since Last: ${tasksSinceLastWd}\n` +
    `💎 Ref Earnings Since Last: ${refEarningsSinceLastWd} coins`;

  const wdKeyboard = {
    inline_keyboard: [
      [
        { text: "✅ Approve", callback_data: `admin_approve_${wr.id}` },
        { text: "❌ Reject", callback_data: `admin_reject_${wr.id}` },
        { text: "⏭ Skip", callback_data: `admin_skip_${wr.id}` },
      ],
      [
        { text: "📦 To Bin", callback_data: `admin_tobin_${wr.id}` },
      ],
    ],
  };

  if (wr.qrFileId) {
    await bot.sendPhoto(chatId, wr.qrFileId, {
      caption: wdText,
      parse_mode: "Markdown",
      reply_markup: wdKeyboard,
    }).catch(async () => {
      await bot!.sendMessage(chatId, wdText, { parse_mode: "Markdown", reply_markup: wdKeyboard }).catch(() => {});
    });
  } else {
    await bot.sendMessage(chatId, wdText, { parse_mode: "Markdown", reply_markup: wdKeyboard }).catch(() => {});
  }
}

async function showBinItem(chatId: number, adminId: string): Promise<void> {
  if (!bot) return;
  const session = adminBinSession[adminId];
  if (!session) return;

  // Filter out any that were restored/deleted
  const allBin = getWithdrawals("bin");
  const validIds = session.ids.filter((id) => allBin.some((w) => w.id === id));
  session.ids = validIds;

  if (session.index < 0) session.index = 0;
  if (session.index >= session.ids.length) session.index = Math.max(0, session.ids.length - 1);

  if (session.ids.length === 0) {
    delete adminBinSession[adminId];
    await bot.sendMessage(chatId, "📂 No more requests in bin", {
      reply_markup: { inline_keyboard: [[{ text: "🔙 Back", callback_data: "admin_back" }]] },
    });
    return;
  }

  const wr = getWithdrawalById(session.ids[session.index])!;
  const cfg = getAdminConfig();
  const inrAmount = (wr.amount / cfg.coinToMoneyRate).toFixed(2);
  const currentWdTime = new Date(wr.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
  const total = session.ids.length;
  const current = session.index + 1;

  const binText =
    `📂 Bin Requests: ${current}/${total}\n\n` +
    `🆔 \`${escMd(wr.id)}\`\n` +
    `👤 Name: ${escMd(wr.userName)}\n` +
    `🔢 User ID: \`${escMd(wr.userId)}\`\n` +
    `💰 Amount: ${wr.amount} coins (₹${inrAmount} INR)\n` +
    `🏷️ Account: ${escMd(wr.accountName)}\n` +
    `🕑 Date: ${escMd(currentWdTime)}`;

  const binKeyboard = {
    inline_keyboard: [
      [
        { text: "⬅️ Previous", callback_data: "admin_bin_prev" },
        { text: "➡️ Next", callback_data: "admin_bin_next" },
      ],
      [
        { text: "♻️ Restore", callback_data: `admin_bin_restore_${wr.id}` },
        { text: "🗑 Delete", callback_data: `admin_bin_delete_${wr.id}` },
      ],
      [{ text: "🔙 Back", callback_data: "admin_back" }],
    ],
  };

  if (wr.qrFileId) {
    await bot.sendPhoto(chatId, wr.qrFileId, {
      caption: binText,
      parse_mode: "Markdown",
      reply_markup: binKeyboard,
    }).catch(async () => {
      await bot!.sendMessage(chatId, binText, { parse_mode: "Markdown", reply_markup: binKeyboard }).catch(() => {});
    });
  } else {
    await bot.sendMessage(chatId, binText, { parse_mode: "Markdown", reply_markup: binKeyboard }).catch(() => {});
  }
}

async function showUserPaylogs(chatId: number, messageId: number, targetId: string, page: number): Promise<void> {
  if (!bot) return;
  const cfg = getAdminConfig();
  const TEN_DAYS_MS = 10 * 24 * 60 * 60 * 1000;
  const cutoff = Date.now() - TEN_DAYS_MS;
  const wds = getUserWithdrawals(targetId)
    .filter((w) => w.status !== "bin" && new Date(w.createdAt).getTime() >= cutoff)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const totalPaid = wds.filter((w) => w.status === "approved").reduce((s, w) => s + w.amount, 0);
  const totalPaidMoney = wds.filter((w) => w.status === "approved").reduce((s, w) => s + (w.moneyAmount ?? Math.round((w.amount / cfg.coinToMoneyRate) * 100) / 100), 0);

  const PAGE_SIZE = 5;
  const totalPages = Math.max(1, Math.ceil(wds.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);

  let bodyText: string;
  if (wds.length === 0) {
    bodyText = `📋 No withdrawals found in the last 10 days.`;
  } else {
    const slice = wds.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
    const statusEmoji = (s: string) => s === "approved" ? "✅" : s === "rejected" ? "❌" : "⏳";
    const lines = slice.map((w, i) => {
      const date = new Date(w.createdAt).toLocaleDateString("en-GB");
      const money = w.moneyAmount ?? Math.round((w.amount / cfg.coinToMoneyRate) * 100) / 100;
      const bal = w.coinBalance != null ? ` | Balance: ${w.coinBalance} coins` : "";
      return `${safePage * PAGE_SIZE + i + 1}. ${date} | ${statusEmoji(w.status)} ${w.status}\n   🪙 ${w.amount} coins (₹${money})${bal}`;
    }).join("\n");
    bodyText = lines;
  }

  const headerText =
    `👤 *User Paylogs*\n\n🔢 User: \`${targetId}\`\n` +
    `💰 Total Approved: ${totalPaid} coins (₹${totalPaidMoney.toFixed(2)})\n` +
    `_(Last 10 days — Page ${safePage + 1}/${totalPages})_\n\n${bodyText}`;

  const navRow: { text: string; callback_data: string }[] = [];
  if (safePage > 0) navRow.push({ text: "⬅️ Previous", callback_data: `admin_uplogs_${targetId}_${safePage - 1}` });
  if (safePage < totalPages - 1) navRow.push({ text: "➡️ Next", callback_data: `admin_uplogs_${targetId}_${safePage + 1}` });
  const keyboard: { text: string; callback_data: string }[][] = [];
  if (navRow.length > 0) keyboard.push(navRow);
  keyboard.push([{ text: "🔙 Admin Menu", callback_data: "admin_back" }]);

  await bot.editMessageText(headerText, {
    chat_id: chatId,
    message_id: messageId,
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: keyboard },
  }).catch(async () => {
    await bot!.sendMessage(chatId, headerText, { parse_mode: "Markdown", reply_markup: { inline_keyboard: keyboard } }).catch(() => {});
  });
}

export function sendTaskCompletion(userId: string, coins: number): void {
  if (!bot) return;
  const chatId = parseInt(userId);
  const txt = t(userId);
  const available = getAvailableTaskCount(userId);
  const done = getUser(userId).completedTasks.length;

  const text = txt.task_complete(coins, available, done);
  const user = getUser(userId);
  const existingMsgId = user.lastMessageId;

  const sendNew = () => {
    bot!
      .sendMessage(chatId, text, {
        reply_markup: {
          inline_keyboard: [
            [
              { text: txt.main_menu, callback_data: "menu_main" },
              { text: txt.next_task_btn, callback_data: "menu_tasks" },
            ],
          ],
        },
      })
      .then((msg) => updateUser(userId, { lastMessageId: msg.message_id }))
      .catch(() => {});
  };

  if (existingMsgId) {
    bot
      .editMessageText(text, {
        chat_id: chatId,
        message_id: existingMsgId,
        reply_markup: {
          inline_keyboard: [
            [
              { text: txt.main_menu, callback_data: "menu_main" },
              { text: txt.next_task_btn, callback_data: "menu_tasks" },
            ],
          ],
        },
      })
      .catch(() => sendNew());
  } else {
    sendNew();
  }
}

export function notifyAdminsCleanup(
  result: { removedTasks: number; removedCoupons: number; removedIPs: number; removedDevices: number },
  trigger: string
): void {
  if (!bot) return;
  const totalRemoved = result.removedTasks + result.removedCoupons + result.removedIPs + result.removedDevices;
  if (totalRemoved === 0) return;
  const msg =
    `🧹 *Auto Cleanup Done* (${trigger})\n\n` +
    `🗑️ Expired Tasks removed: *${result.removedTasks}*\n` +
    `🎟️ Old Coupons removed: *${result.removedCoupons}*\n` +
    `🌐 Old IP records removed: *${result.removedIPs}*\n` +
    `📱 Old Device records removed: *${result.removedDevices}*`;
  for (const adminId of ADMIN_IDS) {
    bot.sendMessage(adminId, msg, { parse_mode: "Markdown" }).catch(() => {});
  }
}

export function initBot(token: string, baseUrl: string): void {
  BASE_URL = baseUrl;

  // First clear any existing webhook, then start polling after a short delay
  // The delay allows any previously running instance (e.g. old Render deploy) to stop first
  bot = new TelegramBot(token, { polling: false });
  bot.deleteWebHook().catch(() => {}).finally(() => {
    setTimeout(() => {
      bot!.startPolling({ restart: false }).catch(() => {});
    }, 8000);
  });

  logger.info("Telegram bot started");

  bot.setMyCommands([
    { command: "start", description: "Start the bot" },
    { command: "menu", description: "Open Main Menu" },
  ]).catch(() => {});

  bot.onText(/\/start(.*)/, async (msg, match) => {
    const userId = String(msg.from?.id);
    const name = msg.from?.first_name || "User";
    const chatId = msg.chat.id;
    const param = (match?.[1] || "").trim();

    if (isUserBanned(userId) && !isAdmin(userId)) {
      const cfg = getAdminConfig();
      const bannedKeyboard: TelegramBot.InlineKeyboardButton[][] = [];
      bannedKeyboard.push([{ text: "🪪 My ID", callback_data: "menu_myid" }]);
      if (cfg.supportLink) {
        bannedKeyboard.push([{ text: "📩 Contact Support", url: cfg.supportLink }]);
      }
      bannedKeyboard.push([{ text: "📜 Policy", callback_data: "menu_policy" }]);
      await bot!.sendMessage(chatId, "❌ Your account has been banned. Contact support.", {
        reply_markup: { inline_keyboard: bannedKeyboard },
      });
      return;
    }

    // ── Fraud cooldown check on /start ──
    const startCooldown = getCooldownInfo(userId);
    if (startCooldown.active && !isAdmin(userId)) {
      await bot!.sendMessage(chatId,
        `⚠️ *Multiple accounts detected*\n\nPlease wait *24 hours* and try again.`,
        { parse_mode: "Markdown" }
      );
      return;
    }

    getUser(userId);
    updateUser(userId, { accountName: getUser(userId).accountName || name });
    updateUserLastActive(userId);

    if (param.startsWith("ref_")) {
      const refCode = param.replace("ref_", "");
      const referrerId = getUserByReferralCode(refCode);
      const cfg = getAdminConfig();

      if (referrerId && referrerId !== userId && cfg.referralEnabled) {
        const referredUser = getUser(userId);
        if (!referredUser.referredBy) {
          updateUser(userId, { referredBy: referrerId });
          // Count actual referrals from DB to prevent duplicate/inflated counts
          const actualReferrals = Object.values(getAllUsers()).filter((u) => u.referredBy === referrerId).length;
          const newTotalReferrals = actualReferrals;
          updateUser(referrerId, { totalReferrals: newTotalReferrals });

          // Give instant bonus only if no task requirement
          const taskReq = cfg.referralTaskRequirement || 0;
          if (taskReq === 0) {
            const bonus = cfg.referralBonus;
            const updatedReferrer = getUser(referrerId);
            updateUser(referrerId, {
              coins: updatedReferrer.coins + bonus,
              referralEarnings: updatedReferrer.referralEarnings + bonus,
            });
            addEarningHistory(referrerId, bonus, "Referral Bonus");
            bot!.sendMessage(referrerId, T.en.referral_welcome(bonus)).catch(() => {});
          }

          if (newTotalReferrals > 20) {
            const reason = `${newTotalReferrals} referrals made (limit: 20)`;
            flagUserAsSpam(referrerId, "referral_spam", reason);
            const refScore = getRiskScore(referrerId);
            // Alert user (rate limited: max 1 per 2 min)
            if (canSendUserAlert(referrerId)) {
              markUserAlertSent(referrerId);
              bot!.sendMessage(referrerId,
                `🚨 *Security Warning!*\n\n⚠️ Suspicious activity detected on your account.\n\n*Reason:*\n• Unusual activity pattern detected\n\n📊 Risk Score: *${refScore}%*\n\n❗ If you continue this activity, your account may be restricted or banned.\n\nPlease use only ONE account per device and avoid VPN or shared networks.`,
                { parse_mode: "Markdown" }
              ).catch(() => {});
            }
            // Enhanced admin alert
            notifyAdminsAboutSpam(referrerId, ["referral_spam"], [reason]);
          }
        }
      }
    }

    const txt = t(userId);
    await bot!.sendMessage(chatId, txt.welcome(name), {
      parse_mode: "Markdown",
      reply_markup: persistentMenuKeyboard(userId),
    });
    const msg2 = await bot!.sendMessage(chatId, txt.main_menu, {
      reply_markup: mainMenuKeyboard(userId),
    });
    updateUser(userId, { lastMessageId: msg2.message_id });
  });

  bot.onText(/\/admin/, async (msg) => {
    const userId = String(msg.from?.id);
    if (!isAdmin(userId)) return;
    await showAdminMenu(msg.chat.id);
  });

  bot.onText(/\/menu/, async (msg) => {
    const userId = String(msg.from?.id);
    const chatId = msg.chat.id;
    await showMainMenu(chatId, userId);
  });

  bot.on("callback_query", async (query) => {
    const data = query.data || "";
    const chatId = query.message?.chat.id;
    const msgId = query.message?.message_id;
    if (!chatId) return;

    const userId = String(query.from.id);
    try {
      await bot!.answerCallbackQuery(query.id).catch(() => {});
    } catch (_) { /* ignore */ }

    try {

    if (isUserBanned(userId) && !isAdmin(userId)) {
      const allowedWhenBanned = ["menu_myid", "menu_policy"];
      if (!allowedWhenBanned.includes(data)) {
        const cfg = getAdminConfig();
        const bannedKeyboard: TelegramBot.InlineKeyboardButton[][] = [];
        bannedKeyboard.push([{ text: "🪪 My ID", callback_data: "menu_myid" }]);
        if (cfg.supportLink) {
          bannedKeyboard.push([{ text: "📩 Contact Support", url: cfg.supportLink }]);
        }
        bannedKeyboard.push([{ text: "📜 Policy", callback_data: "menu_policy" }]);
        await bot!.sendMessage(chatId, "❌ Your account has been banned. Contact support.", {
          reply_markup: { inline_keyboard: bannedKeyboard },
        });
        return;
      }
    }

    if (msgId) updateUser(userId, { lastMessageId: msgId });

    if (data === "menu_back" || data === "menu_main") {
      await showMainMenu(chatId, userId);
      return;
    }
    if (data === "menu_tasks") {
      await showTaskMenu(chatId, userId);
      return;
    }
    if (data === "menu_balance") {
      await showBalanceMenu(chatId, userId);
      return;
    }
    if (data === "menu_settings") {
      await showSettingsMenu(chatId, userId);
      return;
    }
    if (data === "menu_referral") {
      await showReferralMenu(chatId, userId);
      return;
    }

    if (data === "referral_rules") {
      await showReferralRules(chatId, userId);
      return;
    }

    if (data === "menu_myid") {
      const txt = t(userId);
      const newMsgId = await sendOrEdit(chatId, userId, txt.my_id_text(userId), {
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: [[{ text: txt.back_btn, callback_data: "menu_main" }]] },
      });
      if (newMsgId) updateUser(userId, { lastMessageId: newMsgId });
      return;
    }

    if (data === "menu_policy") {
      const policy = getAdminConfig().policy || "";
      const policyText = policy
        ? `📜 *Policy*\n\n${policy}`
        : "📜 *Policy*\n\nNo policy has been set yet.";
      const policyKeyboard: TelegramBot.InlineKeyboardButton[][] = [];
      if (!isUserBanned(userId)) {
        policyKeyboard.push([{ text: "🔙 Back", callback_data: "menu_main" }]);
      }
      await bot!.sendMessage(chatId, policyText, {
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: policyKeyboard },
      });
      return;
    }

    if (data === "menu_checkin") {
      const cfg = getAdminConfig();
      const reward = cfg.checkInDailyReward || 1;
      const required = cfg.checkInRequiredTasks || 0;
      const result = performCheckIn(userId);
      let msgText = "";
      if (result.message === "already_checked_in") {
        msgText =
          `📅 *Daily Check-In*\n\n` +
          `✅ You have already checked in today!\n\n` +
          `🕛 Reset happens at 12:00 AM IST every day.\n` +
          `👉 Come back tomorrow to claim your reward.`;
      } else if (result.message === "not_enough_tasks") {
        const completed = result.coinsAdded ?? 0;
        msgText =
          `❌ Not checked in!\n\n` +
          `To check in today, you must complete ${required} tasks today.\n\n` +
          `📊 Your progress: ${completed} / ${required}\n\n` +
          `Complete the remaining tasks and try again.`;
      } else {
        msgText =
          `📅 *Daily Check-In Successful!*\n\n` +
          `🎉 You earned *+${result.coinsAdded} coin${(result.coinsAdded ?? 0) !== 1 ? "s" : ""}* for today's check-in!\n\n` +
          `🕛 Next check-in available tomorrow at 12:00 AM IST.`;
      }
      await bot!.sendMessage(chatId, msgText, {
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: [[{ text: "🔙 Back", callback_data: "menu_main" }]] },
      });
      return;
    }

    if (data === "menu_freecoupon") {
      const txt = t(userId);
      const cfg = getAdminConfig();
      if (cfg.couponLink) {
        const newMsgId = await sendOrEdit(chatId, userId, `🎟️ *Free Coupon*\n\nJoin the group/channel below to get free coupons:`, {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔗 Join Group / Channel", url: cfg.couponLink }],
              [{ text: txt.back_btn, callback_data: "menu_main" }],
            ],
          },
        });
        if (newMsgId) updateUser(userId, { lastMessageId: newMsgId });
      } else {
        const newMsgId = await sendOrEdit(chatId, userId, "🎟️ Free Coupon link has not been set yet.", {
          reply_markup: { inline_keyboard: [[{ text: txt.back_btn, callback_data: "menu_main" }]] },
        });
        if (newMsgId) updateUser(userId, { lastMessageId: newMsgId });
      }
      return;
    }

    if (data === "menu_claimcoupon") {
      const txt = t(userId);
      setPendingCouponClaimInput(userId);
      const newMsgId = await sendOrEdit(chatId, userId, txt.coupon_ask_code, {
        reply_markup: { inline_keyboard: [[{ text: txt.cancel_btn, callback_data: "menu_cancel_coupon" }]] },
      });
      if (newMsgId) updateUser(userId, { lastMessageId: newMsgId });
      return;
    }

    if (data === "menu_cancel_coupon") {
      clearPendingCouponClaimInput(userId);
      await showMainMenu(chatId, userId);
      return;
    }

    if (data === "menu_help") {
      const txt = t(userId);
      const cfg = getAdminConfig();
      const helpText = txt.help_text(cfg.supportLink);
      const helpKeyboard: TelegramBot.InlineKeyboardButton[][] = [];
      if (cfg.supportLink) {
        helpKeyboard.push([{ text: txt.help_btn_contact, url: cfg.supportLink }]);
      }
      helpKeyboard.push([{ text: txt.back_btn, callback_data: "menu_main" }]);
      const newMsgId = await sendOrEdit(chatId, userId, helpText, {
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: helpKeyboard },
      });
      if (newMsgId) updateUser(userId, { lastMessageId: newMsgId });
      return;
    }

    if (data.startsWith("skip|")) {
      const parts = data.split("|");
      const taskId = parts[1];
      const targetUserId = parts[2];
      const user = getUser(targetUserId);

      if (!user.skippedTasks.includes(taskId)) {
        updateUser(targetUserId, {
          skippedTasks: [...user.skippedTasks, taskId],
          currentTaskIndex: user.currentTaskIndex + 1,
        });
      }

      if (msgId) updateUser(targetUserId, { lastMessageId: msgId });
      await showTaskMenu(chatId, targetUserId);
      return;
    }

    if (data === "balance_withdraw") {
      const user = getUser(userId);
      const txt = t(userId);
      const cfg = getAdminConfig();

      const cooldown = checkWithdrawCooldown(userId);
      if (!cooldown.allowed) {
        const newMsgId = await sendOrEdit(chatId, userId, txt.withdraw_cooldown(cooldown.hoursLeft), {
          reply_markup: { inline_keyboard: [[{ text: txt.back_btn, callback_data: "menu_balance" }]] },
        });
        if (newMsgId) updateUser(userId, { lastMessageId: newMsgId });
        return;
      }

      const wdEligibility = checkWithdrawEligibility(userId);
      if (!wdEligibility.allowed) {
        const completedCount = wdEligibility.requiredHours > 0
          ? countTasksInWindow(userId, wdEligibility.requiredHours)
          : countTasksCompletedTodayIST(userId);
        const newMsgId = await sendOrEdit(
          chatId,
          userId,
          `❌ Not eligible!\n\n` +
          `You must complete at least ${wdEligibility.requiredTasks} tasks within the last ${wdEligibility.requiredHours} hours.\n\n` +
          `📊 Your progress: ${completedCount} / ${wdEligibility.requiredTasks}\n\n` +
          `Please complete the required tasks and try again.`,
          { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: txt.back_btn, callback_data: "menu_balance" }]] } }
        );
        if (newMsgId) updateUser(userId, { lastMessageId: newMsgId });
        return;
      }

      if (user.coins < cfg.minWithdraw) {
        const newMsgId = await sendOrEdit(chatId, userId, txt.withdraw_insufficient(user.coins, cfg.minWithdraw), {
          reply_markup: { inline_keyboard: [[{ text: txt.back_btn, callback_data: "menu_balance" }]] },
        });
        if (newMsgId) updateUser(userId, { lastMessageId: newMsgId });
        return;
      }
      const allOptions = (cfg.withdrawOptions || [10, 50, 100, 200]).filter((o) => o >= cfg.minWithdraw);
      if (allOptions.length === 0) {
        const newMsgId = await sendOrEdit(chatId, userId, txt.withdraw_insufficient(user.coins, cfg.minWithdraw), {
          reply_markup: { inline_keyboard: [[{ text: txt.back_btn, callback_data: "menu_balance" }]] },
        });
        if (newMsgId) updateUser(userId, { lastMessageId: newMsgId });
        return;
      }
      const optRows: { text: string; callback_data: string }[][] = [];
      const rowSize = 3;
      for (let i = 0; i < allOptions.length; i += rowSize) {
        optRows.push(
          allOptions.slice(i, i + rowSize).map((o) => ({
            text: `${o} 🪙 = ₹${Math.round(o / cfg.coinToMoneyRate)}`,
            callback_data: `withdraw_opt_${o}`,
          }))
        );
      }
      optRows.push([{ text: txt.cancel_btn, callback_data: "withdraw_cancel" }]);
      const msg =
        `💸 Withdraw\n\n` +
        `Your balance: ${user.coins} 🪙\n` +
        `Min withdrawal: ${cfg.minWithdraw} 🪙\n\n` +
        `Select an amount to withdraw:`;
      const newMsgId = await sendOrEdit(chatId, userId, msg, {
        reply_markup: { inline_keyboard: optRows },
      });
      if (newMsgId) updateUser(userId, { lastMessageId: newMsgId });
      return;
    }

    if (data.startsWith("withdraw_opt_")) {
      const amount = parseInt(data.replace("withdraw_opt_", ""), 10);
      const user = getUser(userId);
      const txt = t(userId);
      const cfg = getAdminConfig();
      if (isNaN(amount) || amount < cfg.minWithdraw) {
        await bot!.sendMessage(chatId,
          `❌ *Invalid Withdrawal Amount*\n\n` +
          `The selected amount (${amount} 🪙) is below the minimum withdrawal of ${cfg.minWithdraw} 🪙.\n\n` +
          `Please go back and choose a valid option.`,
          { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: txt.back_btn, callback_data: "balance_withdraw" }]] } }
        );
        return;
      }
      if (amount > user.coins) {
        await bot!.sendMessage(chatId,
          `❌ Insufficient Balance\n\n` +
          `You selected a withdrawal of ${amount} coins, but your current balance is only ${user.coins} coins.\n\n` +
          `You need ${amount - user.coins} more coins to use this option.\n\n` +
          `👉 Please choose an option within your available balance.`,
          { reply_markup: { inline_keyboard: [[{ text: txt.back_btn, callback_data: "balance_withdraw" }]] } }
        );
        return;
      }
      setPendingWithdraw(userId, "name", { amount });
      const wMsg = await bot!.sendMessage(chatId, txt.withdraw_ask_name, {
        reply_markup: { inline_keyboard: [[{ text: txt.cancel_btn, callback_data: "withdraw_cancel" }]] },
      });
      updateUser(userId, { lastMessageId: wMsg.message_id });
      return;
    }

    if (data === "withdraw_cancel") {
      clearPendingWithdraw(userId);
      const txt = t(userId);
      const newMsgId = await sendOrEdit(chatId, userId, txt.withdraw_cancelled, {
        reply_markup: { inline_keyboard: [[{ text: txt.back_btn, callback_data: "menu_balance" }]] },
      });
      if (newMsgId) updateUser(userId, { lastMessageId: newMsgId });
      return;
    }

    if (data === "balance_history") {
      await showWithdrawHistory(chatId, userId);
      return;
    }

    if (data.startsWith("balance_earning_history_")) {
      const page = parseInt(data.replace("balance_earning_history_", ""), 10);
      if (!isNaN(page) && page >= 0) {
        await showEarningHistory(chatId, userId, page);
      }
      return;
    }

    if (data === "settings_lang" || data === "admin_lang") {
      const newMsgId = await sendOrEdit(chatId, userId, "🌐 Select Language:", {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "🇧🇩 Bengali", callback_data: "lang_bn" },
              { text: "🇬🇧 English", callback_data: "lang_en" },
            ],
            [{ text: "🔙 Back", callback_data: data === "admin_lang" ? "admin_back" : "menu_settings" }],
          ],
        },
      });
      if (newMsgId) updateUser(userId, { lastMessageId: newMsgId });
      return;
    }

    if (data === "lang_bn" || data === "lang_en") {
      const lang = data === "lang_bn" ? "bn" : "en";
      updateUser(userId, { language: lang });
      const txt = t(userId);
      const newMsgId = await sendOrEdit(
        chatId,
        userId,
        `${txt.lang_set} ${lang === "bn" ? "🇧🇩 Bengali" : "🇬🇧 English"}`,
        {
          reply_markup: { inline_keyboard: [[{ text: txt.back_btn, callback_data: "menu_settings" }]] },
        }
      );
      if (newMsgId) updateUser(userId, { lastMessageId: newMsgId });
      return;
    }

    if (data === "admin_addtask") {
      if (!isAdmin(userId)) return;
      setPendingTaskInput(userId);
      await bot!.sendMessage(chatId, "➕ *Add New Task*\n\nSend the task URL:", {
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "admin_cancel" }]] },
      });
      return;
    }

    if (data === "admin_tasklist") {
      if (!isAdmin(userId)) return;
      const activeTasks = getActiveTasks();
      if (activeTasks.length === 0) {
        await bot!.sendMessage(chatId, "📋 No active tasks.", {
          reply_markup: { inline_keyboard: [[{ text: "🔙 Back", callback_data: "admin_back" }]] },
        });
        return;
      }

      const buttons = activeTasks.map((task) => [
        {
          text: `🗑️ ${task.id} | ${task.link.substring(0, 25)}...`,
          callback_data: `admin_deltask_${task.id}`,
        },
      ]);
      buttons.push([{ text: "🔙 Back", callback_data: "admin_back" }]);

      const taskLines = activeTasks.map(
        (t, i) =>
          `${i + 1}. \`${escMd(t.id)}\`\n🔗 \`${escMd(t.link)}\`\n⏰ ${formatTimeLeft(t.expiresAt.getTime() - Date.now())} left`
      );

      const header = `📋 *Active Tasks* (${activeTasks.length})\n\n`;
      const chunkSize = 15;
      for (let c = 0; c < taskLines.length; c += chunkSize) {
        const chunk = taskLines.slice(c, c + chunkSize).join("\n\n");
        const isLast = c + chunkSize >= taskLines.length;
        await bot!.sendMessage(
          chatId,
          (c === 0 ? header : "") + chunk,
          {
            parse_mode: "Markdown",
            reply_markup: isLast ? { inline_keyboard: buttons } : undefined,
          }
        ).catch(async () => {
          const safeChunk = taskLines.slice(c, c + chunkSize)
            .map((l, idx) => `${c + idx + 1}. (link hidden — Markdown error)\n⏰ ...`)
            .join("\n\n");
          await bot!.sendMessage(chatId, (c === 0 ? "📋 Active Tasks\n\n" : "") + safeChunk, {
            reply_markup: isLast ? { inline_keyboard: buttons } : undefined,
          }).catch(() => {});
        });
      }
      return;
    }

    if (data.startsWith("admin_deltask_")) {
      if (!isAdmin(userId)) return;
      const taskId = data.replace("admin_deltask_", "");
      const deleted = deleteTask(taskId);
      await bot!.sendMessage(
        chatId,
        deleted ? `✅ Task \`${taskId}\` deleted.` : "❌ Task not found.",
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "📋 Task List", callback_data: "admin_tasklist" }],
              [{ text: "🔙 Back", callback_data: "admin_back" }],
            ],
          },
        }
      );
      return;
    }

    if (data === "admin_users") {
      if (!isAdmin(userId)) return;
      const allUsers = getAllUsers();
      const userIds = Object.keys(allUsers);
      const totalCoins = userIds.reduce((sum, id) => sum + allUsers[id].coins, 0);
      const totalCompleted = userIds.reduce((sum, id) => sum + allUsers[id].completedTasks.length, 0);

      await bot!.sendMessage(
        chatId,
        `👥 *User Statistics*\n\n👤 Total: ${userIds.length}\n💰 Total Coins: ${totalCoins}\n✅ Total Completed: ${totalCompleted}\n\nTop 10 Users:\n${userIds
          .sort((a, b) => allUsers[b].coins - allUsers[a].coins)
          .slice(0, 10)
          .map((id, i) => `${i + 1}. \`${id}\`: ${allUsers[id].coins} coins`)
          .join("\n")}`,
        {
          parse_mode: "Markdown",
          reply_markup: { inline_keyboard: [[{ text: "🔙 Back", callback_data: "admin_back" }]] },
        }
      );
      return;
    }

    if (data === "admin_broadcast") {
      if (!isAdmin(userId)) return;
      pendingBroadcast[userId] = true;
      await bot!.sendMessage(chatId, "📢 *Broadcast Message*\n\nType your message to send to ALL users:", {
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "admin_cancel" }]] },
      });
      return;
    }

    if (data === "admin_withdrawqueue") {
      if (!isAdmin(userId)) return;
      const pending = getWithdrawals("pending");
      if (pending.length === 0) {
        await bot!.sendMessage(chatId, "💸 No pending withdrawals.", {
          reply_markup: { inline_keyboard: [[{ text: "🔙 Back", callback_data: "admin_back" }]] },
        });
        return;
      }
      const sortedIds = pending
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        .map((w) => w.id);
      adminQueueSession[userId] = { ids: sortedIds, index: 0 };
      await showQueueItem(chatId, userId);
      return;
    }

    if (data.startsWith("admin_skip_")) {
      if (!isAdmin(userId)) return;
      const session = adminQueueSession[userId];
      if (session) session.index++;
      await showQueueItem(chatId, userId);
      return;
    }

    if (data.startsWith("admin_approve_")) {
      if (!isAdmin(userId)) return;
      const wdId = data.replace("admin_approve_", "");
      const wr = getWithdrawalById(wdId);
      if (!wr) return;
      updateWithdrawal(wdId, "approved");
      const targetUser = getUser(wr.userId);
      updateUser(wr.userId, { coins: Math.max(0, targetUser.coins - wr.amount) });
      await bot!.sendMessage(chatId, `✅ Withdrawal \`${escMd(wdId)}\` approved.`, { parse_mode: "Markdown" });
      bot!.sendMessage(wr.userId, T.en.withdraw_approved(wr.amount)).catch(() => {});
      const session = adminQueueSession[userId];
      if (session) {
        session.index++;
        await showQueueItem(chatId, userId);
      }
      return;
    }

    if (data.startsWith("admin_reject_")) {
      if (!isAdmin(userId)) return;
      const wdId = data.replace("admin_reject_", "");
      const wr = getWithdrawalById(wdId);
      if (!wr) return;
      pendingRejectInput[userId] = { wdId };
      await bot!.sendMessage(chatId, `✏️ Enter reject reason for \`${escMd(wdId)}\`:`, {
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "admin_cancel" }]] },
      });
      return;
    }

    if (data.startsWith("admin_tobin_")) {
      if (!isAdmin(userId)) return;
      const wdId = data.replace("admin_tobin_", "");
      const wr = getWithdrawalById(wdId);
      if (!wr) return;
      updateWithdrawal(wdId, "bin");
      await bot!.sendMessage(chatId, `📦 Moved to bin.`);
      const session = adminQueueSession[userId];
      if (session) {
        session.index++;
        await showQueueItem(chatId, userId);
      }
      return;
    }

    if (data === "admin_wdrl_bin") {
      if (!isAdmin(userId)) return;
      const binItems = getWithdrawals("bin");
      if (binItems.length === 0) {
        await bot!.sendMessage(chatId, "📂 No more requests in bin", {
          reply_markup: { inline_keyboard: [[{ text: "🔙 Back", callback_data: "admin_back" }]] },
        });
        return;
      }
      const sortedIds = binItems
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        .map((w) => w.id);
      adminBinSession[userId] = { ids: sortedIds, index: 0 };
      await showBinItem(chatId, userId);
      return;
    }

    if (data === "admin_bin_prev") {
      if (!isAdmin(userId)) return;
      const session = adminBinSession[userId];
      if (session) session.index = Math.max(0, session.index - 1);
      await showBinItem(chatId, userId);
      return;
    }

    if (data === "admin_bin_next") {
      if (!isAdmin(userId)) return;
      const session = adminBinSession[userId];
      if (session && session.index < session.ids.length - 1) session.index++;
      await showBinItem(chatId, userId);
      return;
    }

    if (data.startsWith("admin_bin_restore_")) {
      if (!isAdmin(userId)) return;
      const wdId = data.replace("admin_bin_restore_", "");
      const wr = getWithdrawalById(wdId);
      if (!wr) return;
      updateWithdrawal(wdId, "pending");
      await bot!.sendMessage(chatId, `♻️ Restored to pending queue.`);
      await showBinItem(chatId, userId);
      return;
    }

    if (data.startsWith("admin_bin_delete_confirm_")) {
      if (!isAdmin(userId)) return;
      const wdId = data.replace("admin_bin_delete_confirm_", "");
      deleteWithdrawalById(wdId);
      await bot!.sendMessage(chatId, `✅ Withdrawal request deleted permanently`);
      await showBinItem(chatId, userId);
      return;
    }

    if (data.startsWith("admin_bin_delete_") && !data.startsWith("admin_bin_delete_confirm_")) {
      if (!isAdmin(userId)) return;
      const wdId = data.replace("admin_bin_delete_", "");
      await bot!.sendMessage(chatId,
        `⚠️ Are you sure you want to permanently delete this request?\n\nThis action cannot be undone.`,
        {
          reply_markup: {
            inline_keyboard: [
              [
                { text: "✔ Yes, Delete", callback_data: `admin_bin_delete_confirm_${wdId}` },
                { text: "❌ Cancel", callback_data: "admin_bin_delete_cancel" },
              ],
            ],
          },
        }
      );
      return;
    }

    if (data === "admin_bin_delete_cancel") {
      if (!isAdmin(userId)) return;
      await showBinItem(chatId, userId);
      return;
    }

    if (data === "admin_stats") {
      if (!isAdmin(userId)) return;
      const allU = getAllUsers();
      const allW = getWithdrawals();
      const activeTasks = getActiveTasks();
      const pendingWd = allW.filter((w) => w.status === "pending").length;
      const approvedWd = allW.filter((w) => w.status === "approved").length;

      await bot!.sendMessage(
        chatId,
        `📊 *System Stats*\n\n👥 Users: ${Object.keys(allU).length}\n📋 Active Tasks: ${activeTasks.length}\n💸 Pending Withdrawals: ${pendingWd}\n✅ Approved: ${approvedWd}\n💰 Total Coins: ${Object.values(allU).reduce((s, u) => s + u.coins, 0)}`,
        {
          parse_mode: "Markdown",
          reply_markup: { inline_keyboard: [[{ text: "🔙 Back", callback_data: "admin_back" }]] },
        }
      );
      return;
    }

    if (data === "admin_manual_cleanup") {
      if (!isAdmin(userId)) return;
      const result = runCleanup();
      const msg =
        `🧹 *Manual Cleanup Complete*\n\n` +
        `🗑️ Expired Tasks removed: *${result.removedTasks}*\n` +
        `🎟️ Old Coupons removed: *${result.removedCoupons}*\n` +
        `🌐 Old IP records removed: *${result.removedIPs}*\n` +
        `📱 Old Device records removed: *${result.removedDevices}*`;
      await bot!.sendMessage(chatId, msg, {
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: [[{ text: "🔙 Back", callback_data: "admin_back" }]] },
      });
      return;
    }

    if (data === "admin_settings") {
      if (!isAdmin(userId)) return;
      await showAdminSettingsMenu(chatId);
      return;
    }

    if (data === "admin_spam" || data === "admin_spam_high" || data === "admin_spam_all") {
      if (!isAdmin(userId)) return;
      const allFlags = getSpamFlags();
      const typeMap: Record<string, string> = {
        vpn: "VPN/Proxy",
        multi_device: "Multi-Account Device",
        same_wifi: "Same Network/IP",
        fast_timing: "Fast Return",
        referral_spam: "Excess Referrals",
        rapid_earning: "Rapid Earning",
        suspicious: "Suspicious Pattern",
      };

      const flagsWithScore = allFlags
        .map((f) => ({ ...f, score: getRiskScore(f.userId) }))
        .sort((a, b) => b.score - a.score);
      const showHighOnly = data === "admin_spam_high";
      const filtered = showHighOnly
        ? flagsWithScore.filter((f) => f.score >= 60)
        : flagsWithScore;

      if (filtered.length === 0) {
        await bot!.sendMessage(chatId,
          showHighOnly ? "✅ No high-risk users found." : "✅ No suspicious users detected.",
          {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [{ text: "📋 Show All Flagged", callback_data: "admin_spam_all" }],
                [{ text: "🔙 Back", callback_data: "admin_back" }],
              ],
            },
          }
        );
        return;
      }

      const lines = filtered.slice(0, 15).map((f, i) => {
        const typeLabels = f.types.map((tp) => typeMap[tp] || tp).join(", ");
        const riskEmoji = f.score >= 80 ? "🔴" : f.score >= 60 ? "🟠" : "🟡";
        return `${i + 1}. ${riskEmoji} \`${f.userId}\`\n   📊 Risk: ${f.score}/100 | ${typeLabels}`;
      }).join("\n\n");

      const clearButtons = filtered.slice(0, 8).map((f) => [
        { text: `🗑️ Clear ${f.userId.slice(-6)} (${f.score}/100)`, callback_data: `admin_clearspam_${f.userId}` },
      ]);

      await bot!.sendMessage(
        chatId,
        `🚨 *Spam Monitor*\n\n` +
        `📊 Total flagged: ${allFlags.length} | Showing: ${filtered.length}\n` +
        `${showHighOnly ? "🔴 High Risk Only (≥60)" : "📋 All Flagged"}\n\n` +
        `${lines}`,
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              ...clearButtons,
              [
                { text: "🔴 High Risk Only", callback_data: "admin_spam_high" },
                { text: "📋 All Flagged", callback_data: "admin_spam_all" },
              ],
              [{ text: "🔙 Back", callback_data: "admin_back" }],
            ],
          },
        }
      );
      return;
    }

    if (data.startsWith("admin_clearspam_")) {
      if (!isAdmin(userId)) return;
      const targetId = data.replace("admin_clearspam_", "");
      clearSpamFlag(targetId);
      await bot!.sendMessage(chatId, `✅ Spam flag cleared for user \`${targetId}\`.`, {
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: [[{ text: "🚨 Spam Monitor", callback_data: "admin_spam" }], [{ text: "🔙 Admin Menu", callback_data: "admin_back" }]] },
      });
      return;
    }

    if (data === "admin_banned_users") {
      if (!isAdmin(userId)) return;
      const banned = getBannedUsers();
      if (banned.length === 0) {
        await bot!.sendMessage(chatId, "✅ No banned users.", {
          reply_markup: { inline_keyboard: [[{ text: "🔙 Back", callback_data: "admin_back" }]] },
        });
        return;
      }
      const lines = banned.slice(0, 20).map((b, i) =>
        `${i + 1}. \`${b.userId}\`\n   🔴 Banned | Reason: ${b.data.banReason || "Admin ban"}`
      ).join("\n\n");
      await bot!.sendMessage(chatId,
        `🔴 *Banned Users* (${banned.length} total)\n\n${lines}`,
        {
          parse_mode: "Markdown",
          reply_markup: { inline_keyboard: [[{ text: "🔙 Back", callback_data: "admin_back" }]] },
        }
      );
      return;
    }

    if (data === "admin_suspicious_users") {
      if (!isAdmin(userId)) return;
      const flags = getSpamFlags();
      const typeMap: Record<string, string> = {
        vpn: "VPN/Proxy",
        multi_device: "Multi-Account Device",
        same_wifi: "Same Network/IP",
        fast_timing: "Fast Return",
        referral_spam: "Excess Referrals",
        rapid_earning: "Rapid Earning",
      };
      if (flags.length === 0) {
        await bot!.sendMessage(chatId, "✅ No suspicious users.", {
          reply_markup: { inline_keyboard: [[{ text: "🔙 Back", callback_data: "admin_back" }]] },
        });
        return;
      }
      const lines = flags.slice(0, 15).map((f, i) => {
        const score = getRiskScore(f.userId);
        const banned = isUserBanned(f.userId);
        const status = banned ? "🔴 Banned" : "🟡 Flagged";
        const reasons = f.types.map((tp) => typeMap[tp] || tp).join(", ");
        return `${i + 1}. \`${f.userId}\`\n   ${status} | Score: ${score}/100\n   Reason: ${reasons}`;
      }).join("\n\n");
      await bot!.sendMessage(chatId,
        `🚨 *Suspicious Users* (${flags.length} total)\n\n${lines}`,
        {
          parse_mode: "Markdown",
          reply_markup: { inline_keyboard: [[{ text: "🔙 Back", callback_data: "admin_back" }]] },
        }
      );
      return;
    }

    if (data === "admin_setpolicy") {
      if (!isAdmin(userId)) return;
      pendingPolicyInput[userId] = true;
      const currentPolicy = getAdminConfig().policy || "(not set)";
      await bot!.sendMessage(chatId,
        `📜 *Set Policy*\n\nCurrent policy:\n${currentPolicy}\n\nSend the new policy text:`,
        {
          parse_mode: "Markdown",
          reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "admin_cancel" }]] },
        }
      );
      return;
    }

    if (data === "admin_withdraw_opts") {
      if (!isAdmin(userId)) return;
      const cfg = getAdminConfig();
      const opts = cfg.withdrawOptions || [];
      const removeButtons = opts.map((o) => ({
        text: `❌ ${o} coins`,
        callback_data: `admin_rmopt_${o}`,
      }));
      const rows: { text: string; callback_data: string }[][] = [];
      for (let i = 0; i < removeButtons.length; i += 3) {
        rows.push(removeButtons.slice(i, i + 3));
      }
      rows.push([{ text: "➕ Add New Option", callback_data: "admin_addopt" }]);
      rows.push([{ text: "🔙 Admin Menu", callback_data: "admin_back" }]);
      await bot!.sendMessage(
        chatId,
        `💰 *Withdraw Options Management*\n\nCurrent options: *${opts.join(", ")} coins*\n\nPress ❌ to remove an option\nPress ➕ to add a new option`,
        {
          parse_mode: "Markdown",
          reply_markup: { inline_keyboard: rows },
        }
      );
      return;
    }

    if (data === "admin_addopt") {
      if (!isAdmin(userId)) return;
      pendingAddWithdrawOption[userId] = true;
      await bot!.sendMessage(chatId, "💰 Enter the coin amount for the new withdraw option (e.g. 150):", {
        reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "admin_withdraw_opts" }]] },
      });
      return;
    }

    if (data.startsWith("admin_rmopt_")) {
      if (!isAdmin(userId)) return;
      const amount = parseInt(data.replace("admin_rmopt_", ""), 10);
      if (!isNaN(amount)) {
        removeWithdrawOption(amount);
        await bot!.answerCallbackQuery(query.id, { text: `✅ ${amount} coin option removed.` });
      }
      const cfg = getAdminConfig();
      const opts = cfg.withdrawOptions || [];
      const removeButtons = opts.map((o) => ({
        text: `❌ ${o} coins`,
        callback_data: `admin_rmopt_${o}`,
      }));
      const rows: { text: string; callback_data: string }[][] = [];
      for (let i = 0; i < removeButtons.length; i += 3) {
        rows.push(removeButtons.slice(i, i + 3));
      }
      rows.push([{ text: "➕ Add New Option", callback_data: "admin_addopt" }]);
      rows.push([{ text: "🔙 Admin Menu", callback_data: "admin_back" }]);
      await bot!.editMessageText(
        `💰 *Withdraw Options Management*\n\nCurrent options: *${opts.length > 0 ? opts.join(", ") : "No options set"} coins*\n\nPress ❌ to remove an option\nPress ➕ to add a new option`,
        {
          chat_id: chatId,
          message_id: msgId,
          parse_mode: "Markdown",
          reply_markup: { inline_keyboard: rows },
        }
      ).catch(() => {});
      return;
    }

    if (data === "admin_msg_user") {
      if (!isAdmin(userId)) return;
      pendingMsgUser[userId] = { step: "userId" };
      await bot!.sendMessage(chatId, "📨 *Send Message to User*\n\nEnter the User ID:", {
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "admin_cancel" }]] },
      });
      return;
    }

    if (data.startsWith("admin_set_")) {
      if (!isAdmin(userId)) return;
      const key = data.replace("admin_set_", "");
      if (!SETTING_META[key]) return;
      const cfg = getAdminConfig();
      const meta = SETTING_META[key];
      const currentVal = currentSettingValue(key, cfg);
      setPendingSettingInput(userId, key);
      await bot!.sendMessage(
        chatId,
        `✏️ *Edit: ${meta.label}*\n\n📌 Current value: *${currentVal}*\n\nEnter new value${meta.unit ? ` (${meta.unit})` : ""}:`,
        {
          parse_mode: "Markdown",
          reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "admin_cancel" }]] },
        }
      );
      return;
    }

    // ── Admin Wallet Control ──
    if (data === "admin_wallet") {
      if (!isAdmin(userId)) return;
      setPendingWalletInput(userId, "userId");
      await bot!.sendMessage(
        chatId,
        `💼 *Manage User Wallet*\n\nEnter the *User ID* of the user whose wallet you want to modify:\n\n(Find User IDs in the 👥 Users menu)`,
        {
          parse_mode: "Markdown",
          reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "admin_cancel" }]] },
        }
      );
      return;
    }

    if (data.startsWith("admin_wallet_add_") || data.startsWith("admin_wallet_deduct_")) {
      if (!isAdmin(userId)) return;
      const isAdd = data.startsWith("admin_wallet_add_");
      const targetId = data.replace(isAdd ? "admin_wallet_add_" : "admin_wallet_deduct_", "");
      const action = isAdd ? "add" : "deduct";
      const targetUser = getUser(targetId);
      setPendingWalletInput(userId, "amount", { targetUserId: targetId, action });
      await bot!.sendMessage(
        chatId,
        `${isAdd ? "➕" : "➖"} *${isAdd ? "Add Coins" : "Deduct Coins"}*\n\n👤 User: \`${targetId}\`\n💰 Current Balance: ${targetUser.coins} coins\n\nEnter amount of coins to ${isAdd ? "add" : "deduct"}:`,
        {
          parse_mode: "Markdown",
          reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "admin_cancel" }]] },
        }
      );
      return;
    }

    // ── Bulk Wallet Control ──
    if (data === "admin_bulkwallet") {
      if (!isAdmin(userId)) return;
      await bot!.sendMessage(
        chatId,
        `📦 *Bulk Wallet Control*\n\nThis will apply coins to ALL users in the database.\n\nChoose an action:`,
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [
                { text: "➕ Add Coins to ALL", callback_data: "admin_bulk_add" },
                { text: "➖ Deduct from ALL", callback_data: "admin_bulk_deduct" },
              ],
              [{ text: "🔙 Back", callback_data: "admin_back" }],
            ],
          },
        }
      );
      return;
    }

    if (data === "admin_bulk_add" || data === "admin_bulk_deduct") {
      if (!isAdmin(userId)) return;
      const action = data === "admin_bulk_add" ? "add" : "deduct";
      const allUsers = getAllUsers();
      const userCount = Object.keys(allUsers).length;
      pendingBulkWallet[userId] = { step: "amount", action };
      await bot!.sendMessage(
        chatId,
        `${action === "add" ? "➕" : "➖"} *Bulk ${action === "add" ? "Add" : "Deduct"} Coins*\n\n👥 Total users: ${userCount}\n\nEnter the number of coins to ${action === "add" ? "add to" : "deduct from"} each user:`,
        {
          parse_mode: "Markdown",
          reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "admin_cancel" }]] },
        }
      );
      return;
    }

    if (data === "admin_bulk_confirm") {
      if (!isAdmin(userId)) return;
      const state = pendingBulkWallet[userId];
      if (!state || !state.amount || !state.reason) return;

      const allUsersMap = getAllUsers();
      const allUserEntries = Object.entries(allUsersMap);
      let successCount = 0;
      for (const [uid, u] of allUserEntries) {
        const current = u.coins;
        const newCoins = state.action === "add"
          ? current + state.amount
          : Math.max(0, current - state.amount);
        updateUser(uid, { coins: newCoins });

        if (bot) {
          const userTxt = t(uid);
          const notifText = state.action === "add"
            ? userTxt.coins_added(state.amount, state.reason)
            : userTxt.coins_deducted(state.amount, state.reason);
          bot.sendMessage(parseInt(uid), notifText).catch(() => {});
        }
        successCount++;
      }

      delete pendingBulkWallet[userId];
      await bot!.sendMessage(
        chatId,
        `✅ *Bulk Action Complete!*\n\n📦 Action: ${state.action === "add" ? "➕ Added" : "➖ Deducted"} *${state.amount} coins*\n👥 Applied to: ${successCount} users\n📝 Reason: ${state.reason}\n\n✉️ Notification sent to all users.`,
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "📦 Bulk Again", callback_data: "admin_bulkwallet" }],
              [{ text: "🔙 Admin Menu", callback_data: "admin_back" }],
            ],
          },
        }
      );
      return;
    }

    if (data === "admin_bulk_cancel") {
      if (!isAdmin(userId)) return;
      delete pendingBulkWallet[userId];
      await bot!.sendMessage(chatId, "❌ Bulk action cancelled.", {
        reply_markup: { inline_keyboard: [[{ text: "🔙 Admin Menu", callback_data: "admin_back" }]] },
      });
      return;
    }

    // ── User Control (Ban / Unban) ──
    if (data === "admin_usercontrol") {
      if (!isAdmin(userId)) return;
      const allU = getAllUsers();
      const totalUsers = Object.keys(allU).length;
      const bannedUsers = Object.values(allU).filter((u) => u.isBanned).length;
      await bot!.sendMessage(
        chatId,
        `🚫 *User Control*\n\n👥 Total Users: ${totalUsers}\n🔴 Banned: ${bannedUsers}\n🟢 Active: ${totalUsers - bannedUsers}\n\nSelect an action:`,
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [
                { text: "🔴 Ban User", callback_data: "admin_ban_start" },
                { text: "🟢 Unban User", callback_data: "admin_unban_start" },
              ],
              [{ text: "🔙 Back", callback_data: "admin_back" }],
            ],
          },
        }
      );
      return;
    }

    if (data === "admin_ban_start") {
      if (!isAdmin(userId)) return;
      setPendingBanInput(userId, "userId", { action: "ban" });
      await bot!.sendMessage(
        chatId,
        `🔴 *Ban User*\n\nEnter the *User ID* of the user you want to ban:`,
        {
          parse_mode: "Markdown",
          reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "admin_cancel" }]] },
        }
      );
      return;
    }

    if (data === "admin_unban_start") {
      if (!isAdmin(userId)) return;
      setPendingBanInput(userId, "userId", { action: "unban" });
      await bot!.sendMessage(
        chatId,
        `🟢 *Unban User*\n\nEnter the *User ID* of the user you want to unban:`,
        {
          parse_mode: "Markdown",
          reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "admin_cancel" }]] },
        }
      );
      return;
    }

    if (data.startsWith("admin_ban_confirm_") || data.startsWith("admin_unban_confirm_")) {
      if (!isAdmin(userId)) return;
      const isBanAction = data.startsWith("admin_ban_confirm_");
      const targetId = data.replace(isBanAction ? "admin_ban_confirm_" : "admin_unban_confirm_", "");
      clearPendingBanInput(userId);

      if (isBanAction) {
        banUser(targetId);
        await bot!.sendMessage(
          chatId,
          `✅ *User Banned!*\n\n🔢 User ID: \`${targetId}\`\n\nThis user can no longer use the bot.`,
          {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [{ text: "🚫 User Control", callback_data: "admin_usercontrol" }],
                [{ text: "🔙 Admin Menu", callback_data: "admin_back" }],
              ],
            },
          }
        );
        bot!.sendMessage(targetId, "🚫 Your account has been banned. Contact support.").catch(() => {});
      } else {
        unbanUser(targetId);
        await bot!.sendMessage(
          chatId,
          `✅ *User Unbanned!*\n\n🔢 User ID: \`${targetId}\`\n\nThis user can now use the bot again.`,
          {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [{ text: "🚫 User Control", callback_data: "admin_usercontrol" }],
                [{ text: "🔙 Admin Menu", callback_data: "admin_back" }],
              ],
            },
          }
        );
        bot!.sendMessage(targetId, "✅ Your account ban has been lifted. You can use the bot again!").catch(() => {});
      }
      return;
    }

    // ── Admin Management ──
    if (data === "admin_manage_admins") {
      if (!isAdmin(userId)) return;
      const dynamicAdmins = ADMIN_IDS.filter((id) => !HARDCODED_ADMIN_IDS.includes(id));
      const hardcodedList = HARDCODED_ADMIN_IDS.map((id) => `🔒 \`${id}\` (permanent)`).join("\n");
      const dynamicList = dynamicAdmins.length > 0
        ? dynamicAdmins.map((id) => `👑 \`${id}\``).join("\n")
        : "None";
      await bot!.sendMessage(
        chatId,
        `👑 *Admin Management*\n\n*Permanent Admins:*\n${hardcodedList}\n\n*Added Admins:*\n${dynamicList}\n\nTotal: ${ADMIN_IDS.length} admins`,
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "➕ Add New Admin", callback_data: "admin_add_admin" }],
              [{ text: "➖ Remove Admin", callback_data: "admin_remove_admin" }],
              [{ text: "🔙 Back", callback_data: "admin_back" }],
            ],
          },
        }
      );
      return;
    }

    if (data === "admin_add_admin") {
      if (!isAdmin(userId)) return;
      setPendingAddAdminInput(userId);
      await bot!.sendMessage(
        chatId,
        `➕ *Add New Admin*\n\nEnter the *Telegram User ID* of the person you want to make admin:\n\n(They can find their ID using the 🪪 My ID button in the bot)`,
        {
          parse_mode: "Markdown",
          reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "admin_cancel" }]] },
        }
      );
      return;
    }

    if (data === "admin_remove_admin") {
      if (!isAdmin(userId)) return;
      const removable = ADMIN_IDS.filter((id) => !HARDCODED_ADMIN_IDS.includes(id));
      if (removable.length === 0) {
        await bot!.sendMessage(chatId, "ℹ️ No removable admins. Permanent admins cannot be removed.", {
          reply_markup: { inline_keyboard: [[{ text: "🔙 Back", callback_data: "admin_manage_admins" }]] },
        });
        return;
      }
      const buttons = removable.map((id) => [
        { text: `❌ Remove ${id}`, callback_data: `admin_remove_admin_${id}` },
      ]);
      buttons.push([{ text: "🔙 Back", callback_data: "admin_manage_admins" }]);
      await bot!.sendMessage(chatId, `➖ *Remove Admin*\n\nSelect an admin to remove:`, {
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: buttons },
      });
      return;
    }

    if (data.startsWith("admin_remove_admin_")) {
      if (!isAdmin(userId)) return;
      const targetId = data.replace("admin_remove_admin_", "");
      const removed = removeAdmin(targetId);
      if (removed) {
        await bot!.sendMessage(chatId, `✅ Admin \`${targetId}\` removed successfully.`, {
          parse_mode: "Markdown",
          reply_markup: { inline_keyboard: [[{ text: "👑 Admin Management", callback_data: "admin_manage_admins" }]] },
        });
        bot!.sendMessage(targetId, "ℹ️ Your admin access has been removed.").catch(() => {});
      } else {
        await bot!.sendMessage(chatId, `❌ Cannot remove this admin (permanent admin or not found).`, {
          reply_markup: { inline_keyboard: [[{ text: "🔙 Back", callback_data: "admin_manage_admins" }]] },
        });
      }
      return;
    }

    if (data === "admin_user_analytics") {
      if (!isAdmin(userId)) return;
      pendingAnalyticsInput[userId] = true;
      await bot!.sendMessage(
        chatId,
        `📊 *User Analytics*\n\nEnter the User ID to view analytics:`,
        {
          parse_mode: "Markdown",
          reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "admin_cancel" }]] },
        }
      );
      return;
    }

    if (data === "admin_payments") {
      if (!isAdmin(userId)) return;
      const stats = getPaymentStats();
      const cfg = getAdminConfig();
      await bot!.sendMessage(
        chatId,
        `💰 *Payment Stats*\n\n` +
        `📅 Today's Payment:\n  🪙 ${stats.todayPayment} coins | 💵 ₹${stats.todayMoney}\n\n` +
        `📊 Total Payment (All Time):\n  🪙 ${stats.totalPayment} coins | 💵 ₹${stats.totalMoney}\n\n` +
        `💱 Current Rate: ${cfg.coinToMoneyRate} coins = ₹1`,
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "📋 Payment Logs (30 days)", callback_data: "admin_paylogs_page_0" }],
              [{ text: "🔙 Admin Menu", callback_data: "admin_back" }],
            ],
          },
        }
      );
      return;
    }

    if (data.startsWith("admin_paylogs_page_")) {
      if (!isAdmin(userId)) return;
      const page = parseInt(data.replace("admin_paylogs_page_", ""), 10) || 0;
      const logs = getPaymentLogs();
      const PAGE_SIZE = 5;
      const start = page * PAGE_SIZE;
      const slice = logs.slice(start, start + PAGE_SIZE);
      if (slice.length === 0) {
        await bot!.sendMessage(chatId, "📋 No payment logs found for the last 30 days.", {
          reply_markup: { inline_keyboard: [[{ text: "🔙 Back", callback_data: "admin_payments" }]] },
        });
        return;
      }
      const totalPages = Math.ceil(logs.length / PAGE_SIZE);
      const lines = slice.map((r) =>
        `📅 ${r.date}\n  🪙 ${r.totalAmount} coins | 💵 ₹${r.totalMoney} | 👥 ${r.userCount} users`
      ).join("\n\n");
      const nav: { text: string; callback_data: string }[][] = [];
      const navRow: { text: string; callback_data: string }[] = [];
      if (page > 0) navRow.push({ text: "⬅️ Previous", callback_data: `admin_paylogs_page_${page - 1}` });
      if (start + PAGE_SIZE < logs.length) navRow.push({ text: "➡️ Next", callback_data: `admin_paylogs_page_${page + 1}` });
      if (navRow.length > 0) nav.push(navRow);
      nav.push([{ text: "🔙 Back", callback_data: "admin_payments" }]);
      const paylogsText = `📋 *Payment Logs* (Page ${page + 1}/${totalPages})\n\n${lines}`;
      const paylogsMarkup = { inline_keyboard: nav };
      if (msgId) {
        await bot!.editMessageText(paylogsText, {
          chat_id: chatId,
          message_id: msgId,
          parse_mode: "Markdown",
          reply_markup: paylogsMarkup,
        }).catch(async () => {
          await bot!.sendMessage(chatId, paylogsText, { parse_mode: "Markdown", reply_markup: paylogsMarkup });
        });
      } else {
        await bot!.sendMessage(chatId, paylogsText, { parse_mode: "Markdown", reply_markup: paylogsMarkup });
      }
      return;
    }

    if (data.startsWith("admin_uplogs_")) {
      if (!isAdmin(userId)) return;
      const parts = data.replace("admin_uplogs_", "").split("_");
      const page = parseInt(parts[parts.length - 1], 10) || 0;
      const targetId = parts.slice(0, parts.length - 1).join("_");
      if (!targetId || !msgId) return;
      await showUserPaylogs(chatId, msgId, targetId, page);
      return;
    }

    if (data === "admin_user_paylogs") {
      if (!isAdmin(userId)) return;
      pendingUserPaylogsInput[userId] = true;
      await bot!.sendMessage(
        chatId,
        `👤 *User Payment Logs*\n\nEnter the User ID (Telegram User ID):`,
        {
          parse_mode: "Markdown",
          reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "admin_cancel" }]] },
        }
      );
      return;
    }

    if (data === "admin_create_coupon") {
      if (!isAdmin(userId)) return;
      setPendingCouponAdminInput(userId, "code");
      await bot!.sendMessage(
        chatId,
        `🎟️ *Create Coupon Code*\n\nStep 1/3: Enter the coupon code (e.g. BONUS2024):`,
        {
          parse_mode: "Markdown",
          reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "admin_cancel" }]] },
        }
      );
      return;
    }

    if (data === "admin_list_coupons") {
      if (!isAdmin(userId)) return;
      const coupons = getCouponCodes();
      if (coupons.length === 0) {
        await bot!.sendMessage(chatId, "🎟️ No coupon codes have been created yet.", {
          reply_markup: { inline_keyboard: [[{ text: "🔙 Back", callback_data: "admin_back" }]] },
        });
        return;
      }
      const lines = coupons.map((c) =>
        `\`${c.code}\` | 🎁 ${c.rewardCoins} coins | 👥 ${c.usedCount}/${c.maxUsers}`
      ).join("\n");
      await bot!.sendMessage(
        chatId,
        `🎟️ *Active Coupon Codes*\n\n${lines}`,
        {
          parse_mode: "Markdown",
          reply_markup: { inline_keyboard: [[{ text: "🔙 Back", callback_data: "admin_back" }]] },
        }
      );
      return;
    }

    if (data === "admin_coupon_eligibility" || data === "admin_withdraw_eligibility") {
      if (!isAdmin(userId)) return;
      const type = data === "admin_coupon_eligibility" ? "coupon" : "withdraw";
      const cfg = getAdminConfig();
      const current = type === "coupon" ? (cfg.couponEligibility || { hours: 0, tasks: 0 }) : (cfg.withdrawEligibility || { hours: 0, tasks: 0 });
      const label = type === "coupon" ? "🎟️ Coupon" : "💸 Withdrawal";
      const status = (current.hours === 0 && current.tasks === 0)
        ? "🟢 Disabled (all users allowed)"
        : `🔴 Enabled — ${current.tasks} tasks in last ${current.hours} hours`;
      pendingEligibilityInput[userId] = { step: "hours", type };
      await bot!.sendMessage(
        chatId,
        `${label} *Eligibility Settings*\n\n📌 Current: ${status}\n\n*Step 1/2:* Enter time window in *hours*\n(Enter 0 to disable restriction):`,
        {
          parse_mode: "Markdown",
          reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "admin_cancel" }]] },
        }
      );
      return;
    }

    if (data === "admin_back") {
      if (!isAdmin(userId)) return;
      await showAdminMenu(chatId);
      return;
    }

    if (data === "admin_cancel") {
      clearPendingTaskInput(userId);
      clearPendingSettingInput(userId);
      clearPendingWalletInput(userId);
      clearPendingBanInput(userId);
      clearPendingAddAdminInput(userId);
      clearPendingCouponAdminInput(userId);
      clearPendingCouponClaimInput(userId);
      delete pendingBroadcast[userId];
      delete pendingBulkWallet[userId];
      delete pendingAddWithdrawOption[userId];
      delete pendingMsgUser[userId];
      delete pendingAnalyticsInput[userId];
      delete pendingUserPaylogsInput[userId];
      delete pendingPolicyInput[userId];
      delete pendingEligibilityInput[userId];
      delete pendingRejectInput[userId];
      delete adminQueueSession[userId];
      clearPendingWithdraw(userId);
      await bot!.sendMessage(chatId, isAdmin(userId) ? "❌ Cancelled." : "❌ Cancelled.");
      if (isAdmin(userId)) await showAdminMenu(chatId);
      else await showMainMenu(chatId, userId);
      return;
    }
    } catch (err) {
      logger.error({ err, data, userId }, "callback_query handler error");
      bot!.sendMessage(chatId, "⚠️ An error occurred. Please try again.").catch(() => {});
    }
  });

  bot.on("message", async (msg) => {
    const userId = String(msg.from?.id);
    const chatId = msg.chat.id;
    const text = msg.text || "";

    if (text.startsWith("/")) return;

    if (isUserBanned(userId) && !isAdmin(userId)) {
      const cfg = getAdminConfig();
      const bannedKeyboard: TelegramBot.InlineKeyboardButton[][] = [];
      bannedKeyboard.push([{ text: "🪪 My ID", callback_data: "menu_myid" }]);
      if (cfg.supportLink) {
        bannedKeyboard.push([{ text: "📩 Contact Support", url: cfg.supportLink }]);
      }
      bannedKeyboard.push([{ text: "📜 Policy", callback_data: "menu_policy" }]);
      await bot!.sendMessage(chatId, "❌ Your account has been banned. Contact support.", {
        reply_markup: { inline_keyboard: bannedKeyboard },
      });
      return;
    }

    const txt = t(userId);

    if (text === T.en.main_menu || text === T.bn.main_menu) {
      await showMainMenu(chatId, userId);
      return;
    }

    // ── Coupon Claim ──
    if (isPendingCouponClaimInput(userId)) {
      clearPendingCouponClaimInput(userId);
      const code = text.trim().toUpperCase();
      const result = claimCoupon(userId, code);
      let replyText = "";
      if (result.success) {
        replyText = txt.coupon_success(result.coins!);
      } else if (result.message === "not_eligible") {
        const reqHours = result.requiredHours || 0;
        const completedCount = reqHours > 0
          ? countTasksInWindow(userId, reqHours)
          : countTasksCompletedTodayIST(userId);
        replyText =
          `❌ Not claimed!\n\n` +
          `To claim this coupon, you must complete ${result.requiredTasks} tasks within the last ${reqHours} hours.\n\n` +
          `📊 Your progress: ${completedCount} / ${result.requiredTasks}\n\n` +
          `Complete the remaining tasks and try again.`;
      } else if (result.message === "invalid") {
        replyText = txt.coupon_invalid;
      } else if (result.message === "expired") {
        replyText = txt.coupon_expired;
      } else if (result.message === "already_claimed") {
        replyText = txt.coupon_already_claimed;
      } else {
        replyText = txt.coupon_invalid;
      }
      const newMsgId = await sendOrEdit(chatId, userId, replyText, {
        reply_markup: { inline_keyboard: [[{ text: txt.back_btn, callback_data: "menu_main" }]] },
      });
      if (newMsgId) updateUser(userId, { lastMessageId: newMsgId });
      return;
    }

    // ── Admin Reject Reason Input ──
    if (isAdmin(userId) && pendingRejectInput[userId]) {
      const { wdId } = pendingRejectInput[userId];
      delete pendingRejectInput[userId];
      const reason = text.trim();
      if (!reason) {
        await bot!.sendMessage(chatId, "❌ Reason cannot be empty. Reject cancelled.");
        return;
      }
      const wr = getWithdrawalById(wdId);
      if (!wr) {
        await bot!.sendMessage(chatId, "⚠️ Withdrawal not found.");
        return;
      }
      updateWithdrawal(wdId, "rejected", reason);
      await bot!.sendMessage(chatId, `❌ Withdrawal \`${escMd(wdId)}\` rejected.\nReason: ${escMd(reason)}`, { parse_mode: "Markdown" });
      const userTxt = T.en;
      bot!.sendMessage(wr.userId, userTxt.withdraw_rejected_reason(reason)).catch(() => {});
      const session = adminQueueSession[userId];
      if (session) {
        session.index++;
        await showQueueItem(chatId, userId);
      }
      return;
    }

    // ── Admin Policy Input ──
    if (isAdmin(userId) && pendingPolicyInput[userId]) {
      delete pendingPolicyInput[userId];
      const policyText = text.trim();
      setPolicy(policyText);
      await bot!.sendMessage(chatId, "✅ Policy updated successfully!", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "📜 View Policy", callback_data: "menu_policy" }],
            [{ text: "🔙 Admin Menu", callback_data: "admin_back" }],
          ],
        },
      });
      return;
    }

    // ── Admin Eligibility Input ──
    if (isAdmin(userId) && pendingEligibilityInput[userId]) {
      const state = pendingEligibilityInput[userId];
      const label = state.type === "coupon" ? "🎟️ Coupon" : "💸 Withdrawal";
      if (state.step === "hours") {
        const hours = parseInt(text.trim(), 10);
        if (isNaN(hours) || hours < 0) {
          await bot!.sendMessage(chatId, "❌ Please enter a valid number (0 or more).", {
            reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "admin_cancel" }]] },
          });
          return;
        }
        pendingEligibilityInput[userId] = { step: "tasks", type: state.type, hours };
        await bot!.sendMessage(
          chatId,
          `${label} *Eligibility Settings*\n\n✅ Hours: *${hours}*\n\n*Step 2/2:* Enter minimum *task count*\n(Enter 0 to disable restriction):`,
          {
            parse_mode: "Markdown",
            reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "admin_cancel" }]] },
          }
        );
        return;
      }
      if (state.step === "tasks") {
        const tasks = parseInt(text.trim(), 10);
        if (isNaN(tasks) || tasks < 0) {
          await bot!.sendMessage(chatId, "❌ Please enter a valid number (0 or more).", {
            reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "admin_cancel" }]] },
          });
          return;
        }
        delete pendingEligibilityInput[userId];
        if (state.type === "coupon") {
          updateCouponEligibility(state.hours!, tasks);
        } else {
          updateWithdrawEligibility(state.hours!, tasks);
        }
        const status = (state.hours === 0 && tasks === 0)
          ? "🟢 Disabled (all users allowed)"
          : `🔴 Enabled — ${tasks} tasks in last ${state.hours} hours`;
        await bot!.sendMessage(
          chatId,
          `✅ *${label} Eligibility Saved!*\n\nStatus: ${status}`,
          {
            parse_mode: "Markdown",
            reply_markup: { inline_keyboard: [[{ text: "🔙 Admin Menu", callback_data: "admin_back" }]] },
          }
        );
        return;
      }
    }

    // ── Admin Analytics Input ──
    if (isAdmin(userId) && pendingAnalyticsInput[userId]) {
      delete pendingAnalyticsInput[userId];
      const targetId = text.trim();
      const allUsers = getAllUsers();
      if (!allUsers[targetId]) {
        await bot!.sendMessage(chatId, `❌ User \`${targetId}\` not found.`, {
          parse_mode: "Markdown",
          reply_markup: { inline_keyboard: [[{ text: "🔙 Back", callback_data: "admin_back" }]] },
        });
        return;
      }
      const analytics = getUserAnalytics(targetId);
      const breakdown = getEarningBreakdown(targetId);
      const cfg = getAdminConfig();
      const targetUser = getUser(targetId);
      const joinDateStr = analytics.joinDate.toLocaleDateString("en-GB");
      const approvedWds = getUserWithdrawals(targetId).filter((w) => w.status === "approved");
      const totalWithdrawMoney = approvedWds.reduce((s, w) => s + (w.moneyAmount ?? Math.round((w.amount / cfg.coinToMoneyRate) * 100) / 100), 0);
      const currentBalanceMoney = Math.round((targetUser.coins / cfg.coinToMoneyRate) * 100) / 100;
      await bot!.sendMessage(
        chatId,
        `📊 *User Analytics*\n\n🔢 User ID: \`${targetId}\`\n\n` +
        `💰 *Current Balance:* ${targetUser.coins} coins (₹${currentBalanceMoney})\n\n` +
        `✅ Total Tasks Completed: ${analytics.totalTasksCompleted}\n` +
        `👥 Total Users Referred: ${analytics.totalReferredUsers}\n` +
        `💎 Total Referral Earnings: ${analytics.totalReferralEarnings} coins\n` +
        `💸 Total Withdraw Count: ${analytics.totalWithdrawCount}\n` +
        `💰 Total Withdraw Amount: ${analytics.totalWithdrawAmount} coins (₹${totalWithdrawMoney.toFixed(2)})\n` +
        `✅ Total Accepted: ${analytics.totalAcceptedWithdraw} | ❌ Rejected: ${analytics.totalRejectedWithdraw}\n` +
        `📅 Join Date: ${joinDateStr}\n\n` +
        `📦 *Coin Earning Breakdown:*\n` +
        `✅ Task: ${breakdown.taskEarnings} coins\n` +
        `👥 Referral: ${breakdown.referralEarnings} coins\n` +
        `🎟️ Coupon: ${breakdown.couponEarnings} coins\n` +
        `📅 Check-in: ${breakdown.checkInEarnings} coins\n` +
        `💼 Admin Wallet: ${breakdown.adminWalletEarnings} coins\n` +
        `━━━━━━━━━━━━━━\n` +
        `🧮 Total Earned: ${breakdown.totalEarned} coins`,
        {
          parse_mode: "Markdown",
          reply_markup: { inline_keyboard: [[{ text: "🔙 Back", callback_data: "admin_back" }]] },
        }
      );
      return;
    }

    if (isAdmin(userId) && pendingUserPaylogsInput[userId]) {
      delete pendingUserPaylogsInput[userId];
      const targetId = text.trim();
      const allUsers = getAllUsers();
      if (!allUsers[targetId]) {
        await bot!.sendMessage(chatId, `❌ User \`${targetId}\` not found.`, {
          parse_mode: "Markdown",
          reply_markup: { inline_keyboard: [[{ text: "🔙 Back", callback_data: "admin_back" }]] },
        });
        return;
      }
      const sentMsg = await bot!.sendMessage(chatId, `⏳ Loading paylogs for \`${targetId}\`...`, { parse_mode: "Markdown" });
      await showUserPaylogs(chatId, sentMsg.message_id, targetId, 0);
      return;
    }

    // ── Admin Coupon Creation ──
    if (isAdmin(userId)) {
      const couponState = getPendingCouponAdminInput(userId);
      if (couponState) {
        if (couponState.step === "code") {
          const code = text.trim().toUpperCase();
          if (!code || code.length < 3) {
            await bot!.sendMessage(chatId, "❌ Coupon code must be at least 3 characters.");
            return;
          }
          setPendingCouponAdminInput(userId, "maxUsers", { code });
          await bot!.sendMessage(
            chatId,
            `✅ Code: \`${code}\`\n\nStep 2/3: How many users can claim this coupon? (e.g. 5):`,
            {
              parse_mode: "Markdown",
              reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "admin_cancel" }]] },
            }
          );
          return;
        }
        if (couponState.step === "maxUsers") {
          const maxUsers = parseInt(text.trim(), 10);
          if (isNaN(maxUsers) || maxUsers < 1) {
            await bot!.sendMessage(chatId, "❌ Please enter a valid number (minimum 1).");
            return;
          }
          setPendingCouponAdminInput(userId, "coins", { code: couponState.code, maxUsers });
          await bot!.sendMessage(
            chatId,
            `✅ Max Users: ${maxUsers}\n\nStep 3/3: How many coins per claim? (e.g. 10):`,
            {
              parse_mode: "Markdown",
              reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "admin_cancel" }]] },
            }
          );
          return;
        }
        if (couponState.step === "coins") {
          const rewardCoins = parseInt(text.trim(), 10);
          if (isNaN(rewardCoins) || rewardCoins < 1) {
            await bot!.sendMessage(chatId, "❌ Please enter a valid coin amount (minimum 1).");
            return;
          }
          clearPendingCouponAdminInput(userId);
          const coupon = createCouponCode(couponState.code!, couponState.maxUsers!, rewardCoins);
          await bot!.sendMessage(
            chatId,
            `✅ *Coupon Created!*\n\n🎟️ Code: \`${coupon.code}\`\n👥 Max Users: ${coupon.maxUsers}\n🎁 Reward: ${coupon.rewardCoins} coins`,
            {
              parse_mode: "Markdown",
              reply_markup: {
                inline_keyboard: [
                  [{ text: "📋 List Coupons", callback_data: "admin_list_coupons" }],
                  [{ text: "🔙 Admin Menu", callback_data: "admin_back" }],
                ],
              },
            }
          );
          return;
        }
      }
    }

    // ── Withdraw multi-step flow ──
    const withdrawState = getPendingWithdraw(userId);
    if (withdrawState) {
      const cfg = getAdminConfig();

      if (withdrawState.step === "name") {
        const name = text.trim();
        if (!name || name.length < 2) {
          const errMsg = await bot!.sendMessage(chatId, txt.withdraw_invalid_name, {
            reply_markup: {
              inline_keyboard: [[{ text: txt.cancel_btn, callback_data: "withdraw_cancel" }]],
            },
          });
          updateUser(userId, { lastMessageId: errMsg.message_id });
          return;
        }
        setPendingWithdraw(userId, "qr", {
          amount: withdrawState.amount,
          name,
        });
        const qrMsg = await bot!.sendMessage(chatId, txt.withdraw_ask_qr, {
          reply_markup: {
            inline_keyboard: [[{ text: txt.cancel_btn, callback_data: "withdraw_cancel" }]],
          },
        });
        updateUser(userId, { lastMessageId: qrMsg.message_id });
        return;
      }

      if (withdrawState.step === "qr") {
        if (!msg.photo || msg.photo.length === 0) {
          const errMsg = await bot!.sendMessage(chatId, txt.withdraw_invalid_qr, {
            reply_markup: {
              inline_keyboard: [[{ text: txt.cancel_btn, callback_data: "withdraw_cancel" }]],
            },
          });
          updateUser(userId, { lastMessageId: errMsg.message_id });
          return;
        }
      }
    }

    // ── QR photo handler (called separately below via photo event) ──
    // Admin inputs — settings must be checked FIRST to avoid URL being caught by other handlers
    if (isAdmin(userId) && getPendingSettingInput(userId)) {
      const key = getPendingSettingInput(userId)!;
      const meta = SETTING_META[key];
      clearPendingSettingInput(userId);

      if (meta.type === "number") {
        const num = parseFloat(text.trim());
        if (isNaN(num) || num < 0) {
          await bot!.sendMessage(chatId, "❌ Please enter a valid number.", {
            reply_markup: { inline_keyboard: [[{ text: "🔙 Settings", callback_data: "admin_settings" }]] },
          });
          return;
        }
        updateAdminConfig({ [key]: num } as Parameters<typeof updateAdminConfig>[0]);
        await bot!.sendMessage(
          chatId,
          `✅ *${meta.label}* updated!\n\n📌 New value: *${num}${meta.unit ? " " + meta.unit : ""}*`,
          {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [{ text: "⚙️ Settings Menu", callback_data: "admin_settings" }],
                [{ text: "🔙 Admin Menu", callback_data: "admin_back" }],
              ],
            },
          }
        );
      } else {
        const val = text.trim();
        updateAdminConfig({ [key]: val } as Parameters<typeof updateAdminConfig>[0]);
        await bot!.sendMessage(
          chatId,
          `✅ *${meta.label}* updated!\n\n📌 New value: ${val || "(empty)"}`,
          {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [{ text: "⚙️ Settings Menu", callback_data: "admin_settings" }],
                [{ text: "🔙 Admin Menu", callback_data: "admin_back" }],
              ],
            },
          }
        );
      }
      return;
    }

    // ── Add Admin input ──
    if (isAdmin(userId) && isPendingAddAdminInput(userId)) {
      const newAdminId = text.trim();
      clearPendingAddAdminInput(userId);
      if (!/^\d+$/.test(newAdminId)) {
        await bot!.sendMessage(chatId, "❌ Invalid User ID. Must be a number.\n\nPlease try again from Admin Management.", {
          reply_markup: { inline_keyboard: [[{ text: "👑 Admin Management", callback_data: "admin_manage_admins" }]] },
        });
        return;
      }
      const added = addAdmin(newAdminId);
      if (added) {
        await bot!.sendMessage(
          chatId,
          `✅ *Admin Added!*\n\n👑 User \`${newAdminId}\` is now an admin.\nThey can use /admin to access the admin panel.`,
          {
            parse_mode: "Markdown",
            reply_markup: { inline_keyboard: [[{ text: "👑 Admin Management", callback_data: "admin_manage_admins" }]] },
          }
        );
        bot!.sendMessage(newAdminId, "🎉 You have been granted admin access! Use /admin to open the Admin Panel.").catch(() => {});
      } else {
        await bot!.sendMessage(chatId, `ℹ️ User \`${newAdminId}\` is already an admin.`, {
          parse_mode: "Markdown",
          reply_markup: { inline_keyboard: [[{ text: "👑 Admin Management", callback_data: "admin_manage_admins" }]] },
        });
      }
      return;
    }

    // Admin wallet input ──
    if (isAdmin(userId)) {
      const walletState = getPendingWalletInput(userId);

      if (walletState) {
        if (walletState.step === "userId") {
          const targetId = text.trim();
          const allUsers = getAllUsers();
          if (!allUsers[targetId]) {
            await bot!.sendMessage(
              chatId,
              `❌ User \`${targetId}\` not found.\n\nPlease enter a valid User ID:`,
              {
                parse_mode: "Markdown",
                reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "admin_cancel" }]] },
              }
            );
            return;
          }
          const targetUser = getUser(targetId);
          clearPendingWalletInput(userId);
          await bot!.sendMessage(
            chatId,
            `👤 *User Info*\n\n🔢 ID: \`${targetId}\`\n💰 Coins: ${targetUser.coins}\n✅ Completed Tasks: ${targetUser.completedTasks.length}\n\nChoose an action:`,
            {
              parse_mode: "Markdown",
              reply_markup: {
                inline_keyboard: [
                  [
                    { text: "➕ Add Coins", callback_data: `admin_wallet_add_${targetId}` },
                    { text: "➖ Deduct Coins", callback_data: `admin_wallet_deduct_${targetId}` },
                  ],
                  [{ text: "❌ Cancel", callback_data: "admin_cancel" }],
                ],
              },
            }
          );
          return;
        }

        if (walletState.step === "amount") {
          const amount = parseInt(text.trim());
          if (isNaN(amount) || amount <= 0) {
            await bot!.sendMessage(chatId, "❌ Please enter a valid amount:", {
              reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "admin_cancel" }]] },
            });
            return;
          }
          setPendingWalletInput(userId, "reason", {
            targetUserId: walletState.targetUserId,
            action: walletState.action,
            amount,
          });
          await bot!.sendMessage(chatId, `📝 Enter reason / note for this action:`, {
            reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "admin_cancel" }]] },
          });
          return;
        }

        if (walletState.step === "reason") {
          const reason = text.trim();
          const { targetUserId, action, amount } = walletState;
          if (!targetUserId || !action || !amount) {
            clearPendingWalletInput(userId);
            await bot!.sendMessage(chatId, "❌ Something went wrong. Please try again.");
            return;
          }

          const targetUser = getUser(targetUserId);
          let newCoins: number;

          if (action === "add") {
            newCoins = targetUser.coins + amount;
          } else {
            newCoins = Math.max(0, targetUser.coins - amount);
          }

          updateUser(targetUserId, { coins: newCoins });
          clearPendingWalletInput(userId);

          const actionEmoji = action === "add" ? "➕" : "➖";
          await bot!.sendMessage(
            chatId,
            `✅ *Wallet Updated Successfully!*\n\n${actionEmoji} ${action === "add" ? "Added" : "Deducted"}: ${amount} coins\n👤 User: \`${targetUserId}\`\n💰 Previous Balance: ${targetUser.coins} coins\n💰 New Balance: ${newCoins} coins\n📝 Reason: ${reason}`,
            {
              parse_mode: "Markdown",
              reply_markup: {
                inline_keyboard: [
                  [{ text: "💼 Manage Another User", callback_data: "admin_wallet" }],
                  [{ text: "🔙 Admin Menu", callback_data: "admin_back" }],
                ],
              },
            }
          );

          const notifyMsg = action === "add"
            ? T.en.coins_added(amount, reason)
            : T.en.coins_deducted(amount, reason);
          bot!.sendMessage(targetUserId, notifyMsg).catch(() => {});
          return;
        }
      }

      // ── Bulk Wallet input ──
      const bulkState = pendingBulkWallet[userId];
      if (bulkState) {
        if (bulkState.step === "amount") {
          const amount = parseInt(text.trim());
          if (isNaN(amount) || amount <= 0) {
            await bot!.sendMessage(chatId, "❌ Please enter a valid amount:", {
              reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "admin_cancel" }]] },
            });
            return;
          }
          pendingBulkWallet[userId] = { ...bulkState, step: "reason", amount };
          await bot!.sendMessage(chatId, `📝 Enter reason / note for this bulk action:`, {
            reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "admin_cancel" }]] },
          });
          return;
        }

        if (bulkState.step === "reason") {
          const reason = text.trim();
          if (!reason) {
            await bot!.sendMessage(chatId, "❌ Please enter a reason:", {
              reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "admin_cancel" }]] },
            });
            return;
          }
          const userCount = Object.keys(getAllUsers()).length;
          pendingBulkWallet[userId] = { ...bulkState, step: "confirm", reason };
          await bot!.sendMessage(
            chatId,
            `⚠️ *Confirm Bulk Action*\n\n📦 Action: ${bulkState.action === "add" ? "➕ Add" : "➖ Deduct"} *${bulkState.amount} coins*\n👥 Affected users: ${userCount}\n📝 Reason: ${reason}\n\nAre you sure? This cannot be undone.`,
            {
              parse_mode: "Markdown",
              reply_markup: {
                inline_keyboard: [
                  [
                    { text: "✅ Yes, Apply to ALL", callback_data: "admin_bulk_confirm" },
                    { text: "❌ Cancel", callback_data: "admin_bulk_cancel" },
                  ],
                ],
              },
            }
          );
          return;
        }
      }
    }

    // ── Ban / Unban input ──
    if (isAdmin(userId) && getPendingBanInput(userId)) {
      const banState = getPendingBanInput(userId)!;

      if (banState.step === "userId") {
        const targetId = text.trim();
        const allUsers = getAllUsers();
        if (!allUsers[targetId]) {
          await bot!.sendMessage(
            chatId,
            `❌ User \`${targetId}\` not found.\n\nPlease enter a valid User ID:`,
            {
              parse_mode: "Markdown",
              reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "admin_cancel" }]] },
            }
          );
          return;
        }
        const targetUser = getUser(targetId);
        const banStatus = targetUser.isBanned ? "🔴 Banned" : "🟢 Active";
        const action = banState.action;
        setPendingBanInput(userId, "confirm", { action, targetUserId: targetId });

        await bot!.sendMessage(
          chatId,
          `${action === "ban" ? "🔴" : "🟢"} *Confirm ${action === "ban" ? "Ban" : "Unban"} User*\n\n🔢 User ID: \`${targetId}\`\n📊 Status: ${banStatus}\n💰 Coins: ${targetUser.coins}\n✅ Tasks: ${targetUser.completedTasks.length}\n\nAre you sure you want to ${action === "ban" ? "**ban**" : "**unban**"} this user?`,
          {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: action === "ban" ? "✅ Yes, Ban User" : "✅ Yes, Unban User",
                    callback_data: `admin_${action}_confirm_${targetId}`,
                  },
                  { text: "❌ Cancel", callback_data: "admin_cancel" },
                ],
              ],
            },
          }
        );
        return;
      }
    }

    if (isAdmin(userId) && isPendingTaskInput(userId)) {
      const urlRegex = /https?:\/\/[^\s]+/g;
      const urls = text.match(urlRegex);
      if (urls && urls.length > 0) {
        const link = urls[0];
        if (isLinkDuplicate(link)) {
          await bot!.sendMessage(chatId,
            "❌ *Duplicate Link*\nThis task already exists. Please add a new link.",
            {
              parse_mode: "Markdown",
              reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "admin_cancel" }]] },
            }
          );
          return;
        }
        const task = addTask(link);
        clearPendingTaskInput(userId);
        const cfg = getAdminConfig();
        logger.info({ taskId: task.id, link }, "New task added by admin");
        await bot!.sendMessage(
          chatId,
          `✅ *New Task Added!*\n\n🆔 \`${task.id}\`\n🔗 ${link}\n⏰ Expires in: ${cfg.taskExpiry} hours`,
          {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [{ text: "➕ Add Another Task", callback_data: "admin_addtask" }],
                [{ text: "🔙 Admin Menu", callback_data: "admin_back" }],
              ],
            },
          }
        );
        return;
      } else {
        await bot!.sendMessage(chatId, "❌ No URL found. Please start with http or https:", {
          reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "admin_cancel" }]] },
        });
        return;
      }
    }

    if (isAdmin(userId) && pendingMsgUser[userId]) {
      const state = pendingMsgUser[userId];
      if (state.step === "userId") {
        const targetId = text.trim();
        pendingMsgUser[userId] = { step: "message", targetUserId: targetId };
        await bot!.sendMessage(
          chatId,
          `📨 Now enter the message to send to user \`${targetId}\`:\n\n_(Supports plain text and emoji)_`,
          {
            parse_mode: "Markdown",
            reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "admin_cancel" }]] },
          }
        );
        return;
      }
      if (state.step === "message") {
        const targetId = state.targetUserId!;
        delete pendingMsgUser[userId];
        try {
          await bot!.sendMessage(parseInt(targetId), `📩 *Message from Admin:*\n\n${text}`, { parse_mode: "Markdown" });
          await bot!.sendMessage(chatId, `✅ Message sent to user \`${targetId}\` successfully.`, {
            parse_mode: "Markdown",
            reply_markup: { inline_keyboard: [[{ text: "📨 Message Another User", callback_data: "admin_msg_user" }], [{ text: "🔙 Admin Menu", callback_data: "admin_back" }]] },
          });
        } catch {
          await bot!.sendMessage(chatId, `❌ Failed to deliver message to user \`${targetId}\`.\n\nMake sure the user has started the bot.`, {
            parse_mode: "Markdown",
            reply_markup: { inline_keyboard: [[{ text: "🔙 Admin Menu", callback_data: "admin_back" }]] },
          });
        }
        return;
      }
    }

    if (isAdmin(userId) && pendingAddWithdrawOption[userId]) {
      delete pendingAddWithdrawOption[userId];
      const amount = parseInt(text.trim(), 10);
      if (isNaN(amount) || amount <= 0) {
        await bot!.sendMessage(chatId, "❌ Invalid number. Please enter a positive whole number.", {
          reply_markup: { inline_keyboard: [[{ text: "💰 Withdraw Options", callback_data: "admin_withdraw_opts" }]] },
        });
        return;
      }
      const added = addWithdrawOption(amount);
      await bot!.sendMessage(
        chatId,
        added ? `✅ *${amount} coins* option added successfully.` : `⚠️ *${amount} coins* option already exists.`,
        {
          parse_mode: "Markdown",
          reply_markup: { inline_keyboard: [[{ text: "💰 View Withdraw Options", callback_data: "admin_withdraw_opts" }]] },
        }
      );
      return;
    }

    if (isAdmin(userId) && pendingBroadcast[userId]) {
      delete pendingBroadcast[userId];
      const allUserIds = Object.keys(getAllUsers());
      let sent = 0;
      const fromChatId = chatId;
      const messageId = msg.message_id;
      for (const uid of allUserIds) {
        try {
          await (bot as any).copyMessage(uid, fromChatId, messageId);
          sent++;
        } catch (_) {}
      }
      await bot!.sendMessage(chatId, `✅ Broadcast complete. Sent to ${sent}/${allUserIds.length} users.`, {
        reply_markup: { inline_keyboard: [[{ text: "🔙 Admin Menu", callback_data: "admin_back" }]] },
      });
      return;
    }

    if (isAdmin(userId)) {
      const urlRegex = /https?:\/\/[^\s]+/g;
      const urls = text.match(urlRegex);
      if (urls && urls.length > 0) {
        const link = urls[0];
        const task = addTask(link);
        logger.info({ taskId: task.id, link }, "Task added by admin shortcut");
        await bot!.sendMessage(chatId, `✅ Task added!\n🆔 \`${task.id}\``, { parse_mode: "Markdown" });
      }
    }
  });

  // ── Photo handler for QR code upload and broadcast ──
  bot.on("photo", async (msg) => {
    const userId = String(msg.from?.id);
    const chatId = msg.chat.id;
    const txt = t(userId);

    // Handle broadcast photo
    if (isAdmin(userId) && pendingBroadcast[userId]) {
      delete pendingBroadcast[userId];
      const allUserIds = Object.keys(getAllUsers());
      let sent = 0;
      for (const uid of allUserIds) {
        try {
          await (bot as any).copyMessage(uid, chatId, msg.message_id);
          sent++;
        } catch (_) {}
      }
      await bot!.sendMessage(chatId, `✅ Broadcast complete. Sent to ${sent}/${allUserIds.length} users.`, {
        reply_markup: { inline_keyboard: [[{ text: "🔙 Admin Menu", callback_data: "admin_back" }]] },
      });
      return;
    }

    const withdrawState = getPendingWithdraw(userId);
    if (!withdrawState || withdrawState.step !== "qr") return;

    const photos = msg.photo;
    if (!photos || photos.length === 0) {
      const newMsgId = await sendOrEdit(chatId, userId, txt.withdraw_invalid_qr, {
        reply_markup: {
          inline_keyboard: [[{ text: txt.cancel_btn, callback_data: "withdraw_cancel" }]],
        },
      });
      if (newMsgId) updateUser(userId, { lastMessageId: newMsgId });
      return;
    }

    const largestPhoto = photos[photos.length - 1];
    const qrFileId = largestPhoto.file_id;
    const amount = withdrawState.amount!;
    const accountName = withdrawState.name!;
    const userName = msg.from?.first_name || userId;

    updateUser(userId, { accountName, qrFileId });
    const currentUser = getUser(userId);
    const wdCfg = getAdminConfig();
    const wdMoneyAmount = Math.round((amount / wdCfg.coinToMoneyRate) * 100) / 100;
    const wr = addWithdrawal(userId, userName, amount, accountName, qrFileId, currentUser?.coins, wdMoneyAmount);
    clearPendingWithdraw(userId);

    const cfg = getAdminConfig();
    const inrAmount = Math.round((amount / cfg.coinToMoneyRate) * 100) / 100;

    const successMsg = await bot!.sendMessage(chatId, txt.withdraw_success(amount, inrAmount), {
      reply_markup: { inline_keyboard: [[{ text: txt.back_btn, callback_data: "menu_balance" }]] },
    });
    updateUser(userId, { lastMessageId: successMsg.message_id });
    const userAfter = getUser(userId);

    const adminCaption =
      `💸 *New Withdrawal Request*\n\n` +
      `🆔 ID: \`${escMd(wr.id)}\`\n` +
      `👤 Name: ${escMd(userName)}\n` +
      `🔢 User ID: \`${escMd(userId)}\`\n` +
      `🪙 Coins: ${amount}\n` +
      `💵 Amount: ₹${inrAmount} INR\n` +
      `💰 Current Balance: ${userAfter.coins} coins\n` +
      `🏷️ Account: ${escMd(accountName)}`;

    for (const adminId of ADMIN_IDS) {
      bot!.sendPhoto(adminId, qrFileId, {
        caption: adminCaption,
        parse_mode: "Markdown",
      }).catch(() => {
        bot!.sendMessage(adminId, adminCaption, { parse_mode: "Markdown" }).catch(() => {});
      });
    }
  });

  bot.on("polling_error", (err) => {
    const is409 = err.message?.includes("409") || (err as { code?: string }).code === "ETELEGRAM";
    if (is409) {
      // 409 Conflict means another instance is still running (e.g. old Render deploy).
      // Wait 30s to let it die, then retry.
      logger.warn({ err: err.message }, "Bot polling conflict (409) — waiting 30s for old instance to stop");
      setTimeout(() => {
        if (bot) {
          bot.stopPolling().catch(() => {}).finally(() => {
            bot!.startPolling({ restart: false }).catch((e) =>
              logger.error({ e: e.message }, "Failed to restart polling after 409")
            );
          });
        }
      }, 30000);
    } else {
      logger.error({ err: err.message }, "Bot polling error — restarting in 5s");
      setTimeout(() => {
        if (bot) {
          bot.stopPolling().catch(() => {}).finally(() => {
            bot!.startPolling({ restart: false }).catch((e) =>
              logger.error({ e: e.message }, "Failed to restart polling")
            );
          });
        }
      }, 5000);
    }
  });

  bot.on("error", (err) => {
    logger.error({ err: err.message }, "Bot error");
  });

  // Keepalive: প্রতি ৩ মিনিটে bot alive কিনা check করে, না থাকলে restart
  setInterval(() => {
    if (!bot) return;
    bot.getMe().catch((e) => {
      logger.warn({ err: e.message }, "Keepalive getMe failed — restarting polling");
      bot!.stopPolling().catch(() => {}).finally(() => {
        bot!.startPolling({ restart: true }).catch(() => {});
      });
    });
  }, 3 * 60 * 1000);

  process.on("unhandledRejection", (reason) => {
    logger.warn({ reason: String(reason) }, "Unhandled rejection");
  });

  process.on("uncaughtException", (err) => {
    logger.error({ err: err.message }, "Uncaught exception");
  });
}
