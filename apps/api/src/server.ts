import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import path from "path";
import authRouter from "./routes/auth";
import hodRouter from "./routes/hod";
import hrRouter from "./routes/hr";
import appraisalsRouter from "./routes/appraisals";
import adminRouter from "./routes/admin";
import facultyRouter from "./routes/faculty";
import departmentsRouter from "./routes/departments";
import uploadsRouter from "./routes/uploads";
import driveRouter from "./routes/drive";

dotenv.config();

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

// Rate limiting disabled in development to avoid 429 errors during testing
// In production, apply a more conservative limit
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === "production" ? 200 : 10000, // 10k in dev, 200 in prod
  skip: (_req, _res) => process.env.NODE_ENV !== "production", // Skip rate limiting entirely in dev
});
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
app.use("/api/v1/hr", hrRouter);
app.use("/api/v1/appraisals", appraisalsRouter);
app.use("/api/v1/uploads", uploadsRouter);
app.use("/api/v1/drive", driveRouter);

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
