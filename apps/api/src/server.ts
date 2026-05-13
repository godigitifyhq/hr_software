import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import path from "path";
import authRouter from "./routes/auth";
import hodRouter from "./routes/hod";
import appraisalsRouter from "./routes/appraisals";
import adminRouter from "./routes/admin";
import facultyRouter from "./routes/faculty";
import departmentsRouter from "./routes/departments";
import { ensureFacultyUploadDir } from "./lib/facultyProfile";

dotenv.config();
ensureFacultyUploadDir();

const app: express.Express = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use(
  helmet({
    // Frontend and API run on different origins in dev (localhost:3000 -> localhost:4000).
    // Allow static assets like uploaded profile images to be embedded cross-origin.
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false,
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
const allowedOrigins = (
  process.env.CORS_ORIGINS ||
  process.env.FRONTEND_URL ||
  "http://localhost:3000"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origin not allowed by CORS"));
    },
    credentials: true,
  }),
);

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
app.use(limiter);
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.get("/api/health", (_req, res) =>
  res.json({ success: true, message: "API healthy" }),
);

app.get("/api/ping", (_req, res) =>
  res.json({ success: true, message: "pong" }),
);

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/departments", departmentsRouter);
app.use("/api/v1/admin", adminRouter);
app.use("/api/v1/faculty", facultyRouter);
app.use("/api/v1/hod", hodRouter);
app.use("/api/v1/appraisals", appraisalsRouter);

// Basic error handler
app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    const error =
      err instanceof Error ? err : new Error("Internal server error");
    console.error(err);
    res.status(500).json({ success: false, message: error.message });
  },
);

const port = process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(port, () => console.log(`API server listening on port ${port}`));

export default app;
