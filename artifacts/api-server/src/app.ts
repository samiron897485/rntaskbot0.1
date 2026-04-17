import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import path from "path";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";
import { adminAuthMiddleware } from "./middleware/adminAuth.js";
import { validateSession } from "./middleware/session.js";

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
  res.sendFile(path.join(publicDir, "task.html"));
});

app.use("/api", router);

export default app;
