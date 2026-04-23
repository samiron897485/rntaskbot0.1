export interface AdminConfig {
  minWithdraw: number;
  coinToMoneyRate: number;
  companyCoinRate: number;
  taskDuration: number;
  taskExpiry: number;
  referralEnabled: boolean;
  referralBonus: number;
  perTaskCommission: number;
  lifetimeCommission: boolean;
  supportLink: string;
  defaultLanguage: "en" | "bn";
  withdrawOptions: number[];
  withdrawCooldownHours: number;
  couponLink: string;
  referralTaskRequirement: number;
  policy: string;
  couponEligibility: { hours: number; tasks: number };
  withdrawEligibility: { hours: number; tasks: number };
  checkInDailyReward: number;
  checkInRequiredTasks: number;
  legacyTaskCoinOffset?: number;
  taskRewardCoins?: number;
  adsterraAdsEnabled?: boolean;
  adsterraSocialBarCode?: string;
  adsterraBanner320Code?: string;
  adsterraBanner300Code?: string;
  adsterraNativeCode?: string;
  adsterraClassicPushCode?: string;
  adsterraDynamicCode?: string;
  adsterraSocialBarSlotEnabled?: boolean;
  adsterraBanner320SlotEnabled?: boolean;
  adsterraBanner300SlotEnabled?: boolean;
  adsterraNativeSlotEnabled?: boolean;
  adsterraClassicPushSlotEnabled?: boolean;
  adsterraDynamicSlotEnabled?: boolean;
  adblockBlockEnabled?: boolean;
}

export interface Task {
  id: string;
  link: string;
  createdAt: Date;
  expiresAt: Date;
}

export interface WithdrawalRequest {
  id: string;
  userId: string;
  userName: string;
  amount: number;
  accountName: string;
  qrFileId: string;
  status: "pending" | "approved" | "rejected" | "bin";
  createdAt: Date;
  rejectReason?: string;
  coinBalance?: number;
  moneyAmount?: number;
}

export interface EarningHistoryEntry {
  amount: number;
  reason: string;
  date: Date;
}

export interface UserData {
  coins: number;
  completedTasks: string[];
  skippedTasks: string[];
  currentTaskIndex: number;
  language: "bn" | "en";
  accountName?: string;
  qrFileId?: string;
  lastMessageId?: number;
  referralCode: string;
  referredBy?: string;
  referralEarnings: number;
  totalReferrals: number;
  isBanned?: boolean;
  banReason?: string;
  joinDate: Date;
  lastWithdrawalAt?: number;
  earningHistory: EarningHistoryEntry[];
  earningsByCategory?: {
    task: number;
    referral: number;
    coupon: number;
    checkIn: number;
    adminWallet: number;
  };
  referralBonusPaid?: boolean;
  deviceId?: string;
  riskScore?: number;
  cooldownUntil?: number;
  lastAlertSentAt?: number;
  lastActive?: number;
  lastCheckInDate?: string;
  taskCompletionDates?: number[];
}

export interface CouponCode {
  code: string;
  maxUsers: number;
  usedCount: number;
  rewardCoins: number;
  usedBy: string[];
  createdAt: Date;
}

export interface SpamFlag {
  userId: string;
  types: string[];
  reasons: string[];
  detectedAt: Date;
  flagCount: number;
}

export type WithdrawStep = "amount" | "whatsapp" | "name" | "qr";
export type WalletStep = "userId" | "amount" | "reason";
export type BanStep = "userId" | "confirm";
export type CouponAdminStep = "code" | "maxUsers" | "coins";
