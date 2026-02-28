import jwt from "jsonwebtoken";
import crypto from "crypto";

// JWT Configuration from environment
const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || "15m";
const REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || "7d";

/**
 * Generate Access Token
 * Short-lived token for API requests (15 minutes)
 * Contains user info needed for authorization
 *
 * @param {Object} payload - User data to encode
 * @param {string} payload.userId - User's MongoDB ObjectId
 * @param {string} payload.email - User's email
 * @param {string} payload.role - User's role (student/instructor/admin)
 * @returns {string} JWT access token
 */
export const generateAccessToken = ({ userId, email, role }) => {
  if (!ACCESS_SECRET) {
    throw new Error(
      "JWT_ACCESS_SECRET is not defined in environment variables",
    );
  }

  return jwt.sign(
    {
      userId,
      email,
      role,
      type: "access", // Token type identifier
    },
    ACCESS_SECRET,
    {
      expiresIn: ACCESS_EXPIRES_IN,
      issuer: "lms-backend",
      audience: "lms-users",
    },
  );
};

/**
 * Generate Refresh Token
 * Long-lived token for getting new access tokens (7 days)
 * Stored in DB (hashed) for revocation capability
 *
 * @param {string} userId - User's MongoDB ObjectId
 * @returns {string} JWT refresh token
 */
export const generateRefreshToken = (userId) => {
  if (!REFRESH_SECRET) {
    throw new Error(
      "JWT_REFRESH_SECRET is not defined in environment variables",
    );
  }

  // Generate unique token ID for tracking in DB
  const tokenId = crypto.randomBytes(16).toString("hex");

  return jwt.sign(
    {
      userId,
      tokenId,
      type: "refresh", // Token type identifier
    },
    REFRESH_SECRET,
    {
      expiresIn: REFRESH_EXPIRES_IN,
      issuer: "lms-backend",
      audience: "lms-users",
    },
  );
};

/**
 * Verify Access Token
 * Validates token signature and expiration
 *
 * @param {string} token - JWT access token
 * @returns {Object} Decoded token payload
 * @throws {Error} If token is invalid or expired
 */
export const verifyAccessToken = (token) => {
  if (!ACCESS_SECRET) {
    throw new Error(
      "JWT_ACCESS_SECRET is not defined in environment variables",
    );
  }

  try {
    const decoded = jwt.verify(token, ACCESS_SECRET, {
      issuer: "lms-backend",
      audience: "lms-users",
    });

    // Verify token type
    if (decoded.type !== "access") {
      throw new Error("Invalid token type");
    }

    return decoded;
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      throw new Error("Access token has expired");
    }
    if (error.name === "JsonWebTokenError") {
      throw new Error("Invalid access token");
    }
    throw error;
  }
};

/**
 * Verify Refresh Token
 * Validates token signature and expiration
 * Note: Also need to check DB to ensure token hasn't been revoked
 *
 * @param {string} token - JWT refresh token
 * @returns {Object} Decoded token payload
 * @throws {Error} If token is invalid or expired
 */
export const verifyRefreshToken = (token) => {
  if (!REFRESH_SECRET) {
    throw new Error(
      "JWT_REFRESH_SECRET is not defined in environment variables",
    );
  }

  try {
    const decoded = jwt.verify(token, REFRESH_SECRET, {
      issuer: "lms-backend",
      audience: "lms-users",
    });

    // Verify token type
    if (decoded.type !== "refresh") {
      throw new Error("Invalid token type");
    }

    return decoded;
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      throw new Error("Refresh token has expired");
    }
    if (error.name === "JsonWebTokenError") {
      throw new Error("Invalid refresh token");
    }
    throw error;
  }
};

/**
 * Extract Token from Authorization Header
 * Supports "Bearer <token>" format
 *
 * @param {Object} req - Express request object
 * @returns {string|null} Token string or null if not found
 */
export const extractTokenFromHeader = (req) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return null;
  }

  // Check for "Bearer <token>" format
  const parts = authHeader.split(" ");

  if (parts.length === 2 && parts[0] === "Bearer") {
    return parts[1];
  }

  return null;
};

/**
 * Extract Token from Cookie
 * For refresh tokens stored in HttpOnly cookies
 *
 * @param {Object} req - Express request object
 * @param {string} cookieName - Name of the cookie (default: "refreshToken")
 * @returns {string|null} Token string or null if not found
 */
export const extractTokenFromCookie = (req, cookieName = "refreshToken") => {
  return req.cookies?.[cookieName] || null;
};

/**
 * Generate Token Pair
 * Convenience function to generate both access and refresh tokens
 *
 * @param {Object} user - User object from database
 * @returns {Object} { accessToken, refreshToken }
 */
export const generateTokenPair = (user) => {
  const accessToken = generateAccessToken({
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
  });

  const refreshToken = generateRefreshToken(user._id.toString());

  return { accessToken, refreshToken };
};

/**
 * Get Token Expiry Times in Milliseconds
 * Useful for calculating when to store tokens in DB
 *
 * @returns {Object} { accessExpiresInMs, refreshExpiresInMs }
 */
export const getTokenExpiryTimes = () => {
  // Convert time strings (e.g., "15m", "7d") to milliseconds
  const parseTimeString = (timeStr) => {
    const unit = timeStr.slice(-1);
    const value = parseInt(timeStr.slice(0, -1));

    const units = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };

    return value * (units[unit] || 0);
  };

  return {
    accessExpiresInMs: parseTimeString(ACCESS_EXPIRES_IN),
    refreshExpiresInMs: parseTimeString(REFRESH_EXPIRES_IN),
  };
};

// Usage Examples:
//
// 1. Generate tokens on login:
// import { generateTokenPair } from "./utils/jwt.js";
//
// const user = await UserModel.findOne({ email });
// const { accessToken, refreshToken } = generateTokenPair(user);
//
// res.json({ accessToken, refreshToken });
//
// 2. Verify access token in middleware:
// import { extractTokenFromHeader, verifyAccessToken } from "./utils/jwt.js";
//
// const token = extractTokenFromHeader(req);
// const decoded = verifyAccessToken(token);
// req.user = decoded; // Attach user info to request
//
// 3. Refresh access token:
// import { verifyRefreshToken, generateAccessToken } from "./utils/jwt.js";
//
// const decoded = verifyRefreshToken(refreshToken);
// const user = await UserModel.findById(decoded.userId);
//
// if (!user.hasValidRefreshToken(refreshToken)) {
//   throw new Error("Token has been revoked");
// }
//
// const newAccessToken = generateAccessToken({
//   userId: user._id,
//   email: user.email,
//   role: user.role
// });
