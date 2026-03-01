import {
  quickHealthCheck,
  runAllHealthChecks,
} from "../utils/healthCheck.js";
import logger from "../utils/logger.js";

/**
 * Basic health check endpoint
 * Returns simple status for load balancers
 * GET /health
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
export const basicHealthCheck = async (req, res) => {
  try {
    const result = await quickHealthCheck();

    // Return 503 if critical services are down
    if (result.status === "unavailable") {
      logger.warn(`Health check failed: ${result.reason}`);
      return res.status(503).json({
        statusCode: 503,
        ...result,
      });
    }

    // Return 200 if all critical services are up
    return res.status(200).json({
      statusCode: 200,
      ...result,
    });
  } catch (error) {
    logger.error("Basic health check error:", error);
    return res.status(503).json({
      statusCode: 503,
      status: "unavailable",
      reason: "unknown",
    });
  }
};

/**
 * Detailed health check endpoint (admin only)
 * Returns comprehensive diagnostics
 * GET /health/detailed
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
export const detailedHealthCheck = async (req, res) => {
  try {
    const result = await runAllHealthChecks();

    // Return 503 if any critical service is unhealthy
    if (result.status === "unhealthy") {
      logger.warn(`Detailed health check failed: ${result.failedChecks.join(", ")}`);
      return res.status(503).json({
        statusCode: 503,
        ...result,
      });
    }

    // Return 200 if all services are healthy
    return res.status(200).json({
      statusCode: 200,
      ...result,
    });
  } catch (error) {
    logger.error("Detailed health check error:", error);
    return res.status(503).json({
      statusCode: 503,
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      error: "Health check failed",
    });
  }
};
