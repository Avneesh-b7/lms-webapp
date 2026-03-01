import mongoose from "mongoose";
import { HeadBucketCommand } from "@aws-sdk/client-s3";
import { s3Client } from "../config/s3.js";
import logger from "./logger.js";

// Track server start time for uptime calculation
const serverStartTime = Date.now();

/**
 * Check MongoDB connection health
 * @returns {Promise<Object>} { status: 'up' | 'down', responseTime: string, error?: string }
 */
export const checkDatabaseHealth = async () => {
  const startTime = Date.now();

  try {
    // Check if mongoose is connected
    if (mongoose.connection.readyState !== 1) {
      throw new Error(
        `MongoDB not connected. ReadyState: ${mongoose.connection.readyState} (0=disconnected, 1=connected, 2=connecting, 3=disconnecting)`,
      );
    }

    // Ping the database to check connectivity
    const adminDb = mongoose.connection.db.admin();
    await adminDb.ping();

    const responseTime = Date.now() - startTime;

    return {
      status: "up",
      responseTime: `${responseTime}ms`,
      connection: "connected",
      database: mongoose.connection.db.databaseName,
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorDetails = {
      status: "down",
      error: error.message,
      errorCode: error.code,
      readyState: mongoose.connection.readyState,
      responseTime: `${responseTime}ms`,
    };
    logger.error(
      "Database health check failed:",
      JSON.stringify(errorDetails, null, 2),
    );
    return errorDetails;
  }
};

/**
 * Check AWS S3 connection health
 * @returns {Promise<Object>} { status: 'up' | 'down', responseTime: string, error?: string }
 */
export const checkS3Health = async () => {
  const startTime = Date.now();
  const bucketName = process.env.AWS_S3_BUCKET_NAME;
  const region = process.env.AWS_REGION;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  try {
    // Check if AWS credentials are configured
    if (!accessKeyId) {
      throw new Error("AWS_ACCESS_KEY_ID not configured in .env");
    }

    if (!secretAccessKey) {
      throw new Error("AWS_SECRET_ACCESS_KEY not configured in .env");
    }

    // Debug: Check if credentials are strings and not empty
    if (typeof accessKeyId !== "string" || accessKeyId.trim() === "") {
      throw new Error(
        `AWS_ACCESS_KEY_ID is invalid (type: ${typeof accessKeyId}, value: "${accessKeyId}")`,
      );
    }

    if (typeof secretAccessKey !== "string" || secretAccessKey.trim() === "") {
      throw new Error(
        `AWS_SECRET_ACCESS_KEY is invalid (type: ${typeof secretAccessKey})`,
      );
    }

    if (!bucketName) {
      throw new Error("AWS_S3_BUCKET_NAME not configured in .env");
    }

    if (!region) {
      throw new Error("AWS_REGION not configured in .env");
    }

    // HeadBucket is lightweight and just checks if bucket exists and is accessible
    const command = new HeadBucketCommand({
      Bucket: bucketName,
    });

    await s3Client.send(command);

    const responseTime = Date.now() - startTime;

    return {
      status: "up",
      responseTime: `${responseTime}ms`,
      bucket: bucketName,
      region,
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;

    // Provide detailed error information
    let errorDetails = {
      status: "down",
      error: error.message,
      errorName: error.name,
      errorCode: error.$metadata?.httpStatusCode || error.code,
      responseTime: `${responseTime}ms`,
      bucket: bucketName || "NOT_CONFIGURED",
      region: region || "NOT_CONFIGURED",
      hasCredentials: !!accessKeyId && !!secretAccessKey,
      accessKeyIdLength: accessKeyId?.length || 0,
      secretKeyLength: secretAccessKey?.length || 0,
    };

    // Add specific error hints based on error type
    if (error.name === "NotFound" || error.$metadata?.httpStatusCode === 404) {
      errorDetails.hint = `Bucket '${bucketName}' does not exist in region '${region}'`;
    } else if (
      error.name === "Forbidden" ||
      error.$metadata?.httpStatusCode === 403
    ) {
      errorDetails.hint =
        "Access denied. Check AWS credentials and bucket permissions.";
    } else if (error.name === "InvalidAccessKeyId") {
      errorDetails.hint = "AWS_ACCESS_KEY_ID is invalid or expired.";
    } else if (error.name === "SignatureDoesNotMatch") {
      errorDetails.hint = "AWS_SECRET_ACCESS_KEY is incorrect.";
    } else if (error.code === "NetworkingError" || error.code === "ENOTFOUND") {
      errorDetails.hint =
        "Network error. Check internet connection or AWS service status.";
    }

    logger.error("S3 health check failed:", JSON.stringify(errorDetails, null, 2));
    return errorDetails;
  }
};

/**
 * Get memory usage statistics
 * @returns {Object} { used: string, total: string, percentage: string, free: string }
 */
export const getMemoryUsage = () => {
  const memoryUsage = process.memoryUsage();

  // Convert bytes to MB for readability
  const formatMemory = (bytes) => `${Math.round(bytes / 1024 / 1024)}MB`;

  // RSS (Resident Set Size) - total memory allocated for the process
  const used = memoryUsage.rss;
  const heapUsed = memoryUsage.heapUsed;
  const heapTotal = memoryUsage.heapTotal;

  return {
    used: formatMemory(used),
    heapUsed: formatMemory(heapUsed),
    heapTotal: formatMemory(heapTotal),
    percentage: `${Math.round((heapUsed / heapTotal) * 100)}%`,
  };
};

/**
 * Get server uptime in seconds
 * @returns {number} Uptime in seconds
 */
export const getUptime = () => {
  return Math.floor((Date.now() - serverStartTime) / 1000);
};

/**
 * Format uptime into human-readable string
 * @param {number} uptimeSeconds - Uptime in seconds
 * @returns {string} Formatted uptime (e.g., "2d 3h 45m 12s")
 */
export const formatUptime = (uptimeSeconds) => {
  const days = Math.floor(uptimeSeconds / 86400);
  const hours = Math.floor((uptimeSeconds % 86400) / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  const seconds = uptimeSeconds % 60;

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);

  return parts.join(" ");
};

/**
 * Get application version from package.json
 * @returns {string} Application version
 */
export const getAppVersion = () => {
  // In production, you might want to read this from package.json
  // For now, we'll use environment variable or default
  return process.env.APP_VERSION || "1.0.0";
};

/**
 * Get current environment
 * @returns {string} Environment (development, production, etc.)
 */
export const getEnvironment = () => {
  return process.env.NODE_ENV || "development";
};

/**
 * Run all health checks and aggregate results
 * @returns {Promise<Object>} Aggregated health check results
 */
export const runAllHealthChecks = async () => {
  const [database, s3] = await Promise.all([
    checkDatabaseHealth(),
    checkS3Health(),
  ]);

  const memory = getMemoryUsage();
  const uptime = getUptime();

  // Determine overall status
  const isHealthy = database.status === "up" && s3.status === "up";
  const failedChecks = [];

  if (database.status === "down") failedChecks.push("database");
  if (s3.status === "down") failedChecks.push("s3");

  return {
    status: isHealthy ? "healthy" : "unhealthy",
    timestamp: new Date().toISOString(),
    uptime,
    uptimeFormatted: formatUptime(uptime),
    version: getAppVersion(),
    environment: getEnvironment(),
    checks: {
      database,
      s3,
      memory,
    },
    failedChecks: failedChecks.length > 0 ? failedChecks : undefined,
  };
};

/**
 * Quick health check (just critical dependencies)
 * @returns {Promise<Object>} { status: 'ok' | 'unavailable', reason?: string }
 */
export const quickHealthCheck = async () => {
  try {
    const [database, s3] = await Promise.all([
      checkDatabaseHealth(),
      checkS3Health(),
    ]);

    const failedServices = [];
    const errors = {};

    if (database.status === "down") {
      failedServices.push("database");
      errors.database = database;
    }
    if (s3.status === "down") {
      failedServices.push("s3");
      errors.s3 = s3;
    }

    if (failedServices.length > 0) {
      return {
        status: "unavailable",
        reason: failedServices.join(","),
        errors, // Include detailed error information
      };
    }

    return {
      status: "ok",
    };
  } catch (error) {
    logger.error("Quick health check failed:", error);
    return {
      status: "unavailable",
      reason: "unknown",
      error: error.message,
    };
  }
};
