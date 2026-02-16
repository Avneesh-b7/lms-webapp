import dotenv from "dotenv";
import express from "express";
import morgan from "morgan";
import cors from "cors";
import cookieParser from "cookie-parser";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
// 1. Logging - should be first to log all requests
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev")); // Colored output for development
} else {
  app.use(morgan("combined")); // Apache format for production
}

// 2. CORS - allow cross-origin requests
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173", // Vite default port
    credentials: true, // Allow cookies
  }),
);

// 3. Body parsers
app.use(express.json({ limit: "10kb" })); // Parse JSON bodies
app.use(express.urlencoded({ extended: true, limit: "10kb" })); // Parse URL-encoded bodies

// 4. Cookie parser
app.use(cookieParser());

// Basic test route
app.get("/", (req, res) => {
  res.json({ message: "Server is working!" });
});

// Health check route
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", timestamp: new Date().toISOString() });
});

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
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: "Internal Server Error",
    message: err.message,
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
