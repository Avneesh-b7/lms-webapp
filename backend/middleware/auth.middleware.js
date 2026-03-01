import { verifyAccessToken } from "../utils/jwt.js";
import UserModel from "../models/user.model.js";
import logger from "../utils/logger.js";

/**
 * Middleware to authenticate user via JWT access token
 * Attaches user object to req.user if valid
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Express next middleware
 */
export const authenticate = async (req, res, next) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        statusCode: 401,
        message: "Access token is required",
      });
    }

    const token = authHeader.split(" ")[1];

    // Verify the access token
    const decoded = verifyAccessToken(token);

    if (!decoded) {
      return res.status(401).json({
        success: false,
        statusCode: 401,
        message: "Invalid or expired access token",
      });
    }

    // Fetch user from database (excluding sensitive fields)
    const user = await UserModel.findById(decoded.userId).select(
      "-password -refreshTokens -passwordResetToken -passwordResetExpires",
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        statusCode: 401,
        message: "User not found",
      });
    }

    // Check if user account is active
    if (user.isActive === false) {
      return res.status(403).json({
        success: false,
        statusCode: 403,
        message: "Account is deactivated",
      });
    }

    // Attach user to request object
    req.user = user;
    next();
  } catch (error) {
    logger.error("Authentication error:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
    return res.status(401).json({
      success: false,
      statusCode: 401,
      message: process.env.NODE_ENV === "development" ? error.message : "Authentication failed",
    });
  }
};

/**
 * Middleware to require admin role
 * Must be used AFTER authenticate middleware
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Express next middleware
 */
export const requireAdmin = (req, res, next) => {
  // Check if user is attached (authenticate middleware should run first)
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  // Check if user has admin role
  if (req.user.role !== "admin") {
    logger.warn(`Unauthorized admin access attempt by user: ${req.user._id}`);
    return res.status(403).json({
      success: false,
      message: "Admin access required",
    });
  }

  next();
};

/**
 * Middleware factory to require specific roles
 * Usage: requireRoles(['admin', 'instructor'])
 * @param {Array<string>} allowedRoles - Array of allowed roles
 * @returns {Function} Express middleware
 */
export const requireRoles = (allowedRoles) => {
  return (req, res, next) => {
    // Check if user is attached
    if (!req.user) {
      return res.status(401).json({
        success: false,
        statusCode: 401,
        message: "Authentication required",
      });
    }

    // Check if user's role is in allowed roles
    if (!allowedRoles.includes(req.user.role)) {
      logger.warn(
        `Unauthorized access attempt by user: ${req.user._id} (role: ${req.user.role})`,
      );
      return res.status(403).json({
        success: false,
        statusCode: 403,
        message: `Access denied. Required roles: ${allowedRoles.join(", ")}`,
      });
    }

    next();
  };
};

/**
 * Middleware to require instructor role
 * Must be used AFTER authenticate middleware
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Express next middleware
 */
export const requireInstructor = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  // Allow both admin and instructor roles
  if (req.user.role !== "instructor" && req.user.role !== "admin") {
    logger.warn(
      `Unauthorized instructor access attempt by user: ${req.user._id}`,
    );
    return res.status(403).json({
      success: false,
      message: "Instructor access required",
    });
  }

  next();
};
