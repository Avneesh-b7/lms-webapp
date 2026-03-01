import express from "express";
import {
  signup,
  login,
  refreshAccessToken,
  logout,
  forgotPassword,
  resetPassword,
} from "../controllers/auth.controllers.js";
import { authenticate } from "../middleware/auth.middleware.js";

const authRouter = express.Router();

// Public routes
authRouter.post("/signup", signup);
authRouter.post("/login", login);
authRouter.post("/refresh", refreshAccessToken);
authRouter.post("/forgot-password", forgotPassword);
authRouter.post("/reset-password", resetPassword);

// Protected routes (require authentication)
authRouter.post("/logout", authenticate, logout);

export default authRouter;
