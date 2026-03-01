import UserModel from "../models/user.model.js";
import CourseModel from "../models/courses.model.js"; // Import to register model for populate
import { uploadToS3, deleteFromS3ByUrl, S3_FOLDERS } from "../config/s3.js";
import logger from "../utils/logger.js";

/**
 * @desc    Get current user profile
 * @route   GET /api/v1/users/me
 * @access  Private
 */
export const getCurrentUser = async (req, res) => {
  try {
    const user = await UserModel.findById(req.user._id)
      .select("-password -refreshTokens")
      .populate("enrolledCourses", "title thumbnail price");

    if (!user) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      statusCode: 200,
      data: {
        user,
      },
    });
  } catch (error) {
    logger.error("Get current user error:", {
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
 * @desc    Update user profile
 * @route   PUT /api/v1/users/me
 * @access  Private
 */
export const updateProfile = async (req, res) => {
  try {
    const { name, bio } = req.body;

    // Find user
    const user = await UserModel.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        message: "User not found",
      });
    }

    // Update fields
    if (name !== undefined) user.name = name;
    if (bio !== undefined) user.bio = bio;

    await user.save();

    logger.info(`Profile updated for user: ${user.email}`);

    res.status(200).json({
      success: true,
      statusCode: 200,
      message: "Profile updated successfully",
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          bio: user.bio,
          avatar: user.avatar,
          role: user.role,
        },
      },
    });
  } catch (error) {
    logger.error("Update profile error:", {
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
 * @desc    Upload/update user avatar
 * @route   PUT /api/v1/users/me/avatar
 * @access  Private
 */
export const updateAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Avatar file is required",
      });
    }

    const user = await UserModel.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        message: "User not found",
      });
    }

    // Delete old avatar from S3 (if exists)
    if (user.avatar) {
      try {
        await deleteFromS3ByUrl(user.avatar);
      } catch (error) {
        logger.warn(`Failed to delete old avatar: ${error.message}`);
      }
    }

    // Upload new avatar to S3
    const s3Result = await uploadToS3(
      req.file.buffer,
      req.file.originalname,
      S3_FOLDERS.AVATARS
    );

    // Update user avatar URL
    user.avatar = s3Result.url;
    await user.save();

    logger.info(`Avatar updated for user: ${user.email}`);

    res.status(200).json({
      success: true,
      statusCode: 200,
      message: "Avatar updated successfully",
      data: {
        avatar: user.avatar,
      },
    });
  } catch (error) {
    logger.error("Update avatar error:", {
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
 * @desc    Change password
 * @route   PUT /api/v1/users/me/password
 * @access  Private
 */
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Current password and new password are required",
      });
    }

    // Find user with password field
    const user = await UserModel.findById(req.user._id).select("+password");

    if (!user) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        message: "User not found",
      });
    }

    // Verify current password
    const isPasswordValid = await user.comparePassword(currentPassword);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        statusCode: 401,
        message: "Current password is incorrect",
      });
    }

    // Update password
    user.password = newPassword; // Will be hashed by pre-save hook

    // Invalidate all refresh tokens (force re-login on all devices)
    await user.removeAllRefreshTokens();

    await user.save();

    logger.info(`Password changed for user: ${user.email}`);

    res.status(200).json({
      success: true,
      statusCode: 200,
      message: "Password changed successfully. Please login again.",
    });
  } catch (error) {
    logger.error("Change password error:", {
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
 * @desc    Get public instructor profile
 * @route   GET /api/v1/users/:id
 * @access  Public
 */
export const getInstructorProfile = async (req, res) => {
  try {
    const { id } = req.params;

    // Find user (only instructors)
    const user = await UserModel.findOne({
      _id: id,
      role: "instructor",
      isActive: true,
    }).select("name bio avatar email createdAt");

    if (!user) {
      return res.status(404).json({
        success: false,
        statusCode: 404,
        message: "Instructor not found",
      });
    }

    // TODO: Add course stats (total courses, total students, average rating)
    // This will be implemented when we have Course model populated

    res.status(200).json({
      success: true,
      statusCode: 200,
      data: {
        instructor: {
          id: user._id,
          name: user.name,
          bio: user.bio,
          avatar: user.avatar,
          memberSince: user.createdAt,
          // TODO: Add these fields later
          // totalCourses: 0,
          // totalStudents: 0,
          // averageRating: 0,
        },
      },
    });
  } catch (error) {
    logger.error("Get instructor profile error:", {
      message: error.message,
      stack: error.stack,
      instructorId: req.params?.id,
    });
    return res.status(500).json({
      success: false,
      statusCode: 500,
      message: process.env.NODE_ENV === "development" ? error.message : "Internal server error",
    });
  }
};
