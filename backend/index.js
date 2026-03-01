import dotenv from "dotenv";
// Load environment variables BEFORE any other imports
dotenv.config();

import express from "express";
import morgan from "morgan";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import mongoSanitize from "express-mongo-sanitize";
import rateLimit from "express-rate-limit";
import logger from "./utils/logger.js";
import connectDB from "./config/db.js";
import healthCheckRouter from "./routes/health.routes.js";
import authRouter from "./routes/auth.routes.js";
import userRouter from "./routes/user.routes.js";

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
// 1. Pipe Morgan HTTP logs through Winston
app.use(
  morgan(process.env.NODE_ENV === "development" ? "dev" : "combined", {
    stream: logger.stream,
  }),
);

// 2. Security headers
app.use(helmet());

// 3. Rate limiting - max 100 requests per 15 minutes per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "Too many requests, please try again later." },
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false,
});
app.use(limiter);

// 4. CORS - allow cross-origin requests
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  }),
);

// 5. Body parsers
app.use(express.json({ limit: "10kb" })); // Parse JSON bodies
app.use(express.urlencoded({ extended: true, limit: "10kb" })); // Parse URL-encoded bodies

// 6. Cookie parser
app.use(cookieParser());

// 7. Sanitize request data against NoSQL injection
// Note: skipping req.query as Express v5 makes it read-only
app.use((req, res, next) => {
  if (req.body) req.body = mongoSanitize.sanitize(req.body);
  if (req.params) req.params = mongoSanitize.sanitize(req.params);
  next();
});

// Basic test route
app.get("/", (req, res) => {
  res.json({ message: "Server is working!" });
});

// Routes
app.use("/health", healthCheckRouter);
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/users", userRouter);

// 404 handler - must be AFTER all routes
app.use((req, res) => {
  res.status(404).json({
    error: "Not Found",
    message: "The requested resource does not exist/ route not found",
    path: req.originalUrl,
  });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error(`${err.status || 500} - ${err.message}`);
  res.status(err.status || 500).json({
    error: "Internal Server Error",
    message: err.message,
  });
});

// Connect to MongoDB first, then start the server
// This ensures no requests are accepted before the DB is ready
connectDB()
  .then(() => {
    app.listen(PORT, () => {
      logger.info(`Server is running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    // Initial connection failed - no point running without a DB
    logger.error(`Failed to connect to MongoDB: ${err.message}`);
    process.exit(1);
  });
