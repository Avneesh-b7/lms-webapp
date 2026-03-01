import UserModel from "../models/user.model.js";
import { generateTokenPair, verifyRefreshToken } from "../utils/jwt.js";
import logger from "../utils/logger.js";
import crypto from "crypto";

/**
 * @desc    Register a new user
 * @route   POST /api/v1/auth/signup
 * @access  Public
 */
export const signup = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Name, email, and password are required",
      });
    }

    // Check if user already exists
    const existingUser = await UserModel.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        statusCode: 409,
        message: "User with this email already exists",
      });
    }

    // Validate role (if provided)
    const validRoles = ["student", "instructor"];
    const userRole = role && validRoles.includes(role) ? role : "student";

    // Create user
    const user = await UserModel.create({
      name,
      email: email.toLowerCase(),
      password, // Will be hashed by pre-save hook
      role: userRole,
    });

    // Generate tokens
    const { accessToken, refreshToken } = generateTokenPair(user);

    // Store refresh token in database
    const userAgent = req.headers["user-agent"] || "unknown";
    const ip = req.ip || req.connection.remoteAddress;
    await user.addRefreshToken(
      refreshToken,
      process.env.JWT_REFRESH_EXPIRES_IN || "7d",
      userAgent,
      ip
    );

    logger.info(`New user registered: ${user.email} (${user.role})`);

    // Set refresh token as HTTP-only cookie
    const isProduction = process.env.NODE_ENV === "production";
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true, // Can't be accessed by JavaScript
      secure: isProduction, // HTTPS only in production
      sameSite: "strict", // CSRF protection
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
    });

    // Return user data and access token (NOT refresh token)
    res.status(201).json({
      success: true,
      statusCode: 201,
      message: "User registered successfully",
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
        },
        accessToken,
        // refreshToken is in HTTP-only cookie, not in response body
      },
    });
  } catch (error) {
    logger.error("Signup error:", {
      message: error.message,
      stack: error.stack,
      email: req.body?.email,
    });
    return res.status(500).json({
      success: false,
      statusCode: 500,
      message: process.env.NODE_ENV === "development" ? error.message : "Internal server error",
    });
  }
};

/**
 * @desc    Login user
 * @route   POST /api/v1/auth/login
 * @access  Public
 */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Email and password are required",
      });
    }

    // Find user by email (include password and isActive for verification)
    const user = await UserModel.findOne({
      email: email.toLowerCase(),
    }).select("+password +isActive");

    if (!user) {
      return res.status(401).json({
        success: false,
        statusCode: 401,
        message: "Invalid email or password",
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        statusCode: 403,
        message: "Account is deactivated. Please contact support.",
      });
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        statusCode: 401,
        message: "Invalid email or password",
      });
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokenPair(user);

    // Store refresh token in database
    const userAgent = req.headers["user-agent"] || "unknown";
    const ip = req.ip || req.connection.remoteAddress;
    await user.addRefreshToken(
      refreshToken,
      process.env.JWT_REFRESH_EXPIRES_IN || "7d",
      userAgent,
      ip
    );

    logger.info(`User logged in: ${user.email}`);

    // Set refresh token as HTTP-only cookie
    const isProduction = process.env.NODE_ENV === "production";
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Return user data and access token (NOT refresh token)
    res.status(200).json({
      success: true,
      statusCode: 200,
      message: "Login successful",
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
        },
        accessToken,
        // refreshToken is in HTTP-only cookie
      },
    });
  } catch (error) {
    logger.error("Login error:", {
      message: error.message,
      stack: error.stack,
      email: req.body?.email,
    });
    return res.status(500).json({
      success: false,
      statusCode: 500,
      message: process.env.NODE_ENV === "development" ? error.message : "Internal server error",
    });
  }
};

/**
 * @desc    Refresh access token
 * @route   POST /api/v1/auth/refresh
 * @access  Public (requires refresh token)
 */
export const refreshAccessToken = async (req, res) => {
  try {
    // Get refresh token from HTTP-only cookie
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        statusCode: 401,
        message: "Refresh token not found. Please login again.",
      });
    }

    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken);

    // Find user (include isActive field)
    const user = await UserModel.findById(decoded.userId).select("+isActive");
    if (!user) {
      return res.status(401).json({
        success: false,
        statusCode: 401,
        message: "Invalid refresh token",
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        statusCode: 403,
        message: "Account is deactivated",
      });
    }

    // Verify token exists in database
    const isValidToken = await user.hasValidRefreshToken(refreshToken);
    if (!isValidToken) {
      return res.status(401).json({
        success: false,
        statusCode: 401,
        message: "Invalid or expired refresh token",
      });
    }

    // Generate new access token (keep same refresh token)
    const { accessToken } = generateTokenPair(user);

    logger.info(`Access token refreshed for user: ${user.email}`);

    res.status(200).json({
      success: true,
      statusCode: 200,
      message: "Token refreshed successfully",
      data: {
        accessToken,
      },
    });
  } catch (error) {
    logger.error("Token refresh error:", {
      message: error.message,
      stack: error.stack,
      errorName: error.name,
    });

    // Handle JWT errors
    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        statusCode: 401,
        message: "Invalid or expired refresh token",
      });
    }

    return res.status(500).json({
      success: false,
      statusCode: 500,
      message: process.env.NODE_ENV === "development" ? error.message : "Internal server error",
    });
  }
};

/**
 * @desc    Logout user (invalidate refresh token)
 * @route   POST /api/v1/auth/logout
 * @access  Private
 */
export const logout = async (req, res) => {
  try {
    // Get refresh token from HTTP-only cookie
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Already logged out",
      });
    }

    // Find user (from auth middleware)
    const user = await UserModel.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        message: "User not found",
      });
    }

    // Remove refresh token from database
    await user.removeRefreshToken(refreshToken);

    // Clear the HTTP-only cookie
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    logger.info(`User logged out: ${user.email}`);

    res.status(200).json({
      success: true,
      statusCode: 200,
      message: "Logout successful",
    });
  } catch (error) {
    logger.error("Logout error:", {
      message: error.message,
      stack: error.stack,
      userId: req.user?._id,
    });
    return res.status(500).json({
      success: false,
      statusCode: 500,
      message: process.env.NODE_ENV === "development" ? error.message : "Internal server error",
    });
  }
};

/**
 * @desc    Request password reset email
 * @route   POST /api/v1/auth/forgot-password
 * @access  Public
 */
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Email is required",
      });
    }

    // Find user
    const user = await UserModel.findOne({ email: email.toLowerCase() });

    // Always return success (don't reveal if email exists)
    if (!user) {
      logger.warn(`Password reset requested for non-existent email: ${email}`);
      return res.status(200).json({
        success: true,
        statusCode: 200,
        message: "If the email exists, a password reset link has been sent",
      });
    }

    // Generate reset token
    const resetToken = user.createPasswordResetToken();
    await user.save({ validateBeforeSave: false });

    // TODO: Send email with reset token
    // For now, we'll just log it (will implement email service next)
    logger.info(`Password reset token generated for ${user.email}: ${resetToken}`);

    // In development, return the token (REMOVE IN PRODUCTION)
    const responseData =
      process.env.NODE_ENV === "development"
        ? { resetToken }
        : undefined;

    res.status(200).json({
      success: true,
      statusCode: 200,
      message: "If the email exists, a password reset link has been sent",
      data: responseData,
    });
  } catch (error) {
    logger.error("Forgot password error:", {
      message: error.message,
      stack: error.stack,
      email: req.body?.email,
    });
    return res.status(500).json({
      success: false,
      statusCode: 500,
      message: process.env.NODE_ENV === "development" ? error.message : "Internal server error",
    });
  }
};

/**
 * @desc    Reset password with token
 * @route   POST /api/v1/auth/reset-password
 * @access  Public
 */
export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Token and new password are required",
      });
    }

    // Hash the token to match stored version
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    // Find user with valid reset token
    const user = await UserModel.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Invalid or expired reset token",
      });
    }

    // Update password
    user.password = newPassword; // Will be hashed by pre-save hook
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;

    // Invalidate all refresh tokens (force re-login)
    await user.removeAllRefreshTokens();

    await user.save();

    logger.info(`Password reset successful for user: ${user.email}`);

    res.status(200).json({
      success: true,
      statusCode: 200,
      message: "Password reset successful. Please login with your new password.",
    });
  } catch (error) {
    logger.error("Reset password error:", {
      message: error.message,
      stack: error.stack,
    });
    return res.status(500).json({
      success: false,
      statusCode: 500,
      message: process.env.NODE_ENV === "development" ? error.message : "Internal server error",
    });
  }
};
