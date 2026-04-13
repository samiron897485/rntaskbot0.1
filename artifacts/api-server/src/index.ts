import app from "./app.js";
import { logger } from "./lib/logger.js";
import { initBot, bot } from "./bot/bot.js";
import { initDb, loadAllData } from "./db/persistence.js";
import { populateFromDb, runCleanup } from "./db/mockDb.js";

process.on("unhandledRejection", (reason) => {
  logger.warn({ reason }, "Unhandled promise rejection — bot error ignored");
});

process.on("uncaughtException", (err) => {
  logger.warn({ err }, "Uncaught exception — bot error ignored");
});

// Graceful shutdown: stop polling immediately so the next deploy's instance
// can start polling without a 409 Conflict.
function gracefulShutdown(signal: string) {
  logger.info({ signal }, "Received shutdown signal — stopping bot polling");
  if (bot) {
    bot.stopPolling().catch(() => {}).finally(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000);
  } else {
    process.exit(0);
  }
}
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const telegramToken = process.env["TELEGRAM_BOT_TOKEN"];

const replitDomains = process.env["REPLIT_DOMAINS"] || "";
const primaryDomain = replitDomains.split(",")[0]?.trim();
const baseUrl = primaryDomain
  ? `https://${primaryDomain}`
  : process.env["BASE_URL"] || `http://localhost:${port}`;

function scheduleCleanup(): void {
  const SIX_HOURS = 6 * 60 * 60 * 1000;
  const ONE_DAY = 24 * 60 * 60 * 1000;
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

  const doCleanup = (trigger: string) => {
    try {
      const result = runCleanup();
      logger.info({ ...result, trigger }, "Scheduled cleanup completed");
    } catch (e) {
      logger.warn({ err: e }, "Scheduled cleanup failed");
    }
  };

  // Run once at startup to clean existing stale data
  doCleanup("startup");

  // Run every 6 hours as a safety net
  setInterval(() => doCleanup("6h-interval"), SIX_HOURS);

  // Also run exactly at midnight IST every day
  const scheduleMidnightIST = () => {
    const nowIST = Date.now() + IST_OFFSET_MS;
    const midnightTodayIST = nowIST - (nowIST % ONE_DAY);
    const nextMidnightUTC = midnightTodayIST + ONE_DAY - IST_OFFSET_MS;
    const msUntilMidnight = nextMidnightUTC - Date.now();
    setTimeout(() => {
      doCleanup("midnight-IST");
      setInterval(() => doCleanup("midnight-IST"), ONE_DAY);
    }, msUntilMidnight);
    logger.info(
      { minutesUntilMidnight: Math.round(msUntilMidnight / 60000) },
      "Midnight IST cleanup scheduled"
    );
  };

  scheduleMidnightIST();
}

async function main() {
  await initDb();
  const dbData = await loadAllData();
  populateFromDb(dbData);

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port, baseUrl }, "Server listening");

    scheduleCleanup();

    if (telegramToken) {
      try {
        initBot(telegramToken, baseUrl);
        logger.info({ baseUrl }, "Telegram bot initialized");
      } catch (e) {
        logger.warn({ err: e }, "Failed to initialize Telegram bot");
      }
    } else {
      logger.warn("TELEGRAM_BOT_TOKEN not set. Bot will not start.");
    }
  });
}

main().catch((err) => {
  logger.error({ err }, "Fatal startup error");
  process.exit(1);
});
