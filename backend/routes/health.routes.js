import express from "express";
import {
  basicHealthCheck,
  detailedHealthCheck,
} from "../controllers/health.controllers.js";

const healthCheckRouter = express.Router();

/**
 * @route   GET /health
 * @desc    Basic health check for load balancers
 * @access  Public
 * @returns 200 if services are up, 503 if down
 */
healthCheckRouter.get("/", basicHealthCheck);

/**
 * @route   GET /health/detailed
 * @desc    Detailed health diagnostics with all service statuses
 * @access  Public
 * @returns 200 if healthy, 503 if unhealthy
 */
healthCheckRouter.get("/detailed", detailedHealthCheck);

export default healthCheckRouter;
