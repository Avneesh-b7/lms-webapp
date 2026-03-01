import express from "express";
import {
  getCurrentUser,
  updateProfile,
  updateAvatar,
  changePassword,
  getInstructorProfile,
} from "../controllers/user.controllers.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { uploadAvatar } from "../config/multer.js";

const userRouter = express.Router();

// Protected routes (require authentication) - must come BEFORE /:id route
userRouter.get("/me", authenticate, getCurrentUser);
userRouter.put("/me", authenticate, updateProfile);
userRouter.put("/me/avatar", authenticate, uploadAvatar.single("avatar"), updateAvatar);
userRouter.put("/me/password", authenticate, changePassword);

// Public routes
userRouter.get("/:id", getInstructorProfile); // Public instructor profile

export default userRouter;
