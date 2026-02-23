import mongoose from "mongoose";
import logger from "../utils/logger.js";

const connectDB = async () => {
  // Guard: fail immediately with a clear message if the URI is missing
  // rather than getting a cryptic mongoose error
  if (!process.env.MONGO_URI) {
    logger.error("MONGO_URI is not defined in environment variables");
    process.exit(1);
  }

  // Listen to mongoose connection events so we always know
  // what the DB is doing at runtime - all piped through Winston
  mongoose.connection.on("connected", () => {
    logger.info(`MongoDB connected: ${mongoose.connection.host}`);
  });

  mongoose.connection.on("error", (err) => {
    // This fires for errors AFTER the initial connection
    // (e.g. network blip, auth expiry)
    logger.error(`MongoDB error: ${err.message}`);
  });

  mongoose.connection.on("disconnected", () => {
    // Mongoose will automatically try to reconnect after this
    logger.warn("MongoDB disconnected - attempting to reconnect...");
  });

  mongoose.connection.on("reconnected", () => {
    logger.info("MongoDB reconnected");
  });

  // Attempt the initial connection
  await mongoose.connect(process.env.MONGO_URI, {
    dbName: process.env.DB_NAME,

    // --- Connection Pool ---
    // Keep up to 5 connections open for concurrent requests
    maxPoolSize: 5,
    // Always keep at least 2 connections alive to avoid cold-start
    // latency on the first requests after a quiet period
    minPoolSize: 2,

    // --- Timeouts ---
    // How long to wait when finding an available MongoDB server
    // before throwing an error (e.g. wrong URI, network issue)
    serverSelectionTimeoutMS: 5000,
    // How long an idle socket stays open before being closed
    socketTimeoutMS: 45000,
    // How long to wait for the initial TCP connection to MongoDB
    connectTimeoutMS: 10000,

    // --- Keep-alive ---
    // Ping MongoDB every 10s to detect dropped connections early
    heartbeatFrequencyMS: 10000,

    // --- Indexing ---
    // Never auto-create indexes in production - it locks the collection
    // and causes slowdowns under traffic. Run index creation as a
    // controlled migration instead.
    autoIndex: process.env.NODE_ENV !== "production",
  });
};

// Shared shutdown logic used by both SIGINT and SIGTERM handlers
const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received - closing MongoDB connection`);

  // Close the mongoose connection cleanly so in-flight writes
  // can complete and no data is left in an inconsistent state
  await mongoose.connection.close();

  logger.info("MongoDB connection closed - exiting");

  // Note: there is a known race condition here where the last log entry
  // may not always flush to disk before process.exit() is called.
  // This is acceptable for shutdown logging - the important logs
  // (errors, business events) happen during normal operation.
  process.exit(0);
};

// SIGINT  → Ctrl+C in terminal (local development)
// SIGTERM → sent by Docker, Kubernetes, PM2 during deploys/restarts
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

export default connectDB;

// this connection is not ENTIRELY production grade ... but does the job
