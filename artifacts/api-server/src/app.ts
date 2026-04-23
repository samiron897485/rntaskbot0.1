import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";
import { adminAuthMiddleware } from "./middleware/adminAuth.js";
import { validateSession } from "./middleware/session.js";
import { getAdminConfig } from "./db/mockDb.js";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const artifactRoot = path.resolve(
  globalThis.__dirname ?? new URL(".", import.meta.url).pathname,
  ".."
);
const publicDir = path.join(artifactRoot, "public");

function sessionAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  const sessionToken = req.cookies?.["admin_session"] as string | undefined;
  if (validateSession(sessionToken)) {
    next();
    return;
  }
  res.redirect("/login");
}

app.get("/", (_req, res) => {
  res.redirect("/admin");
});

app.get("/login", (_req, res) => {
  res.sendFile(path.join(publicDir, "login.html"));
});

app.get("/admin", sessionAuthMiddleware, (_req, res) => {
  res.sendFile(path.join(publicDir, "admin.html"));
});

app.get("/public/admin.html", adminAuthMiddleware, (_req, res) => {
  res.sendFile(path.join(publicDir, "admin.html"));
});

app.use("/public", express.static(publicDir, { index: false }));

app.get("/task", (_req, res) => {
  try {
    const cfg = getAdminConfig();
    const adsEnabled = cfg.adsterraAdsEnabled === true;
    let html = fs.readFileSync(path.join(publicDir, "task.html"), "utf-8");
    const slotOn = (slot: keyof typeof cfg) => cfg[slot] !== false;
    const pick = (slotKey: keyof typeof cfg, code: string | undefined) =>
      adsEnabled && slotOn(slotKey) ? (code || "") : "";
    const socialBar = pick("adsterraSocialBarSlotEnabled", cfg.adsterraSocialBarCode);
    const banner320 = pick("adsterraBanner320SlotEnabled", cfg.adsterraBanner320Code);
    const banner300 = pick("adsterraBanner300SlotEnabled", cfg.adsterraBanner300Code);
    const nativeAd  = pick("adsterraNativeSlotEnabled", cfg.adsterraNativeCode);
    const classicPush = pick("adsterraClassicPushSlotEnabled", cfg.adsterraClassicPushCode);
    const dynamicAd = pick("adsterraDynamicSlotEnabled", cfg.adsterraDynamicCode);
    const hasAnyAd =
      socialBar.trim() !== "" || banner320.trim() !== "" || banner300.trim() !== "" ||
      nativeAd.trim() !== "" || classicPush.trim() !== "" || dynamicAd.trim() !== "";
    html = html.replace("<!-- ADSTERRA_SOCIAL_BAR -->", socialBar);
    html = html.replace("<!-- ADSTERRA_BANNER_320 -->", banner320);
    html = html.replace("<!-- ADSTERRA_BANNER_300 -->", banner300);
    html = html.replace("<!-- ADSTERRA_NATIVE -->", nativeAd);
    html = html.replace("<!-- ADSTERRA_CLASSIC_PUSH -->", classicPush);
    html = html.replace("<!-- ADSTERRA_DYNAMIC -->", dynamicAd);
    html = html.replace("__ADS_ENABLED__", hasAnyAd ? "true" : "false");
    html = html.replace("__ADBLOCK_BLOCK_ENABLED__", cfg.adblockBlockEnabled !== false ? "true" : "false");
    res.setHeader("Content-Type", "text/html");
    res.send(html);
  } catch {
    res.sendFile(path.join(publicDir, "task.html"));
  }
});

app.use("/api", router);

export default app;
