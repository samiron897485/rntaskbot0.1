# Workspace

## Overview

pnpm workspace monorepo using TypeScript. L1 Telegram Bot Earning System with tracking webpage.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: In-memory mock (JS objects) — Firebase Firestore ready
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (ESM bundle)
- **Telegram Bot**: node-telegram-bot-api

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   └── api-server/         # Express API server + Telegram Bot
│       ├── src/
│       │   ├── bot/bot.ts       # Telegram Bot logic
│       │   ├── db/mockDb.ts     # In-memory mock database
│       │   ├── routes/api.ts    # API routes
│       │   └── app.ts           # Express app setup
│       └── public/
│           ├── task.html        # Tracking page (20s countdown + scroll detection)
│           └── admin.html       # Admin panel
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## L1 Earning System Features

### Telegram Bot Commands
- `/start` — স্বাগত বার্তা (ব্যান হলে Contact Support + My ID বাটন)
- `/menu` — মেইন মেনু
- Main menu: Tasks, Balance, Referral, Settings, Help, Free Coupon, Claim Coupon

### Bot User Features
- **Free Coupon** — admin সেট করা coupon group/channel লিংক দেখায়
- **Claim Coupon** — coupon code দিয়ে coins claim করা যায়
- **Withdraw Cooldown** — withdrawal এর পর নির্ধারিত ঘন্টা পর্যন্ত আবার withdraw করা যায় না
- **Referral** — শুধুমাত্র Level 1 referral commission (multi-level নেই)
- **Earning History** — task, referral, coupon, admin wallet থেকে earning track হয়

### Admin Features
- Admin Panel: `/public/admin.html` (Stats, Tasks, Users, Withdraw, Broadcast, Settings, Wallet, Analytics, Coupons ট্যাব)
- Bot Admin Menu: User Analytics, Withdraw Cooldown, Coupon Link, Create Coupon Code, List Coupons
- **User Analytics** — user এর total tasks, referrals, withdrawals, join date দেখা যায়
- **Coupon Management** — admin coupon code তৈরি করতে পারে (code, maxUsers, rewardCoins সহ)
- **Withdraw Cooldown Settings** — `withdrawCooldownHours` (0 = disabled)
- **Coupon Link Settings** — free coupon Telegram group লিংক সেট করা যায়

### API Endpoints
- `GET  /api/tasks` — সক্রিয় টাস্ক তালিকা
- `GET  /api/task/:taskId` — নির্দিষ্ট টাস্কের তথ্য
- `GET  /api/config` — public config (taskDuration etc.)
- `GET  /api/user/:userId` — ব্যবহারকারীর তথ্য
- `GET  /api/current-task/:userId` — ব্যবহারকারীর বর্তমান টাস্ক
- `POST /api/complete-task` — টাস্ক সম্পন্ন করুন (taskId, userId)
- `POST /api/add-task` — নতুন টাস্ক যোগ করুন (link)
- `GET  /api/admin/user-analytics/:userId` — user analytics
- `POST /api/admin/coupon/create` — coupon তৈরি করুন
- `GET  /api/admin/coupons` — সব coupons দেখুন
- `POST /api/claim-coupon` — coupon claim করুন

### Tracking Page (task.html)
- URL: `/task?taskId=XXX&userId=YYY`
- **Mobile-only** — desktop এ "Only for Mobile User" বার্তা দেখায়
- **Flow**: Open News Page button → news page খোলে → page hidden থাকলে timer চলে → user ফিরলে claim button দেখায়
- Timer শুধু চলে যখন user অন্য পেজে থাকে (page hidden)
- Timer শেষ হলে ding sound + vibration
- সম্পন্ন হলে `/api/complete-task` কল হয়

### Task Rules
- একবারে একটি টাস্ক দেখায়
- 12 ঘন্টা পরে টাস্ক মেয়াদ শেষ
- স্কিপ করলে পরবর্তী টাস্ক দেখায়
- সম্পন্ন করলে +1 কয়েন

## Environment Variables

```
PORT=5000                        # Set in Replit env (shared)
DATABASE_URL=...                 # Auto-set by Replit PostgreSQL
TELEGRAM_BOT_TOKEN=...           # Secret: Telegram bot token from @BotFather
ADMIN_IDS=123456789,987654321    # Secret: comma-separated Telegram user IDs
ADMIN_TOKEN=...                  # Secret: token required to access admin panel (optional — falls back to ADMIN_IDS)
```

## Admin Panel Access

The admin panel is protected. Access it at:

```
https://your-domain.com/admin?token=YOUR_TOKEN
```

Where `YOUR_TOKEN` is either:
- The `ADMIN_TOKEN` secret (if set) — recommended for production
- Or your Telegram user ID (from `ADMIN_IDS` / hardcoded admin IDs) as a fallback

All `/api/admin/*` routes also require the token via `x-admin-token` header or `token` query param.

## Replit Setup

- **Workflow**: "Start application" — runs `cd artifacts/api-server && PORT=5000 pnpm run dev` on port 5000 (webview)
- **Database**: Replit PostgreSQL provisioned; schema pushed via Drizzle (`lib/db`)
- **Deployment**: VM target (always-running for Telegram bot)

## Setup

1. @BotFather থেকে Bot Token নিন
2. `TELEGRAM_BOT_TOKEN` secret সেট করুন (Replit Secrets tab)
3. `ADMIN_IDS` secret সেট করুন (optional)
4. Database is auto-provisioned by Replit

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server + Telegram Bot

- Entry: `src/index.ts`
- Bot: `src/bot/bot.ts`
- DB: `src/db/mockDb.ts`
- Routes: `src/routes/api.ts`, `src/routes/health.ts`
- Static: `public/task.html`, `public/admin.html`

### `lib/db` (`@workspace/db`)

Database layer (currently unused, Firebase/Drizzle ready)

### `lib/api-spec` (`@workspace/api-spec`)

OpenAPI spec + codegen
