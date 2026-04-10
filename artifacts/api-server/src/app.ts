import express, { type Express } from "express";
import cors from "cors";
import path from "path";
import pinoHttp from "pino-http";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";
import { adminAuthMiddleware } from "./middleware/adminAuth.js";

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

const artifactRoot = path.resolve(
  globalThis.__dirname ?? new URL(".", import.meta.url).pathname,
  ".."
);
const publicDir = path.join(artifactRoot, "public");

app.get("/", (req, res) => {
  const token = (req.query["token"] as string | undefined) || "";
  if (token) {
    res.redirect(`/admin?token=${encodeURIComponent(token)}`);
  } else {
    res.redirect("/admin");
  }
});

app.get("/admin", adminAuthMiddleware, (_req, res) => {
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
