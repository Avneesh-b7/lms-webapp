import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const UserSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        "Please provide a valid email",
      ],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [8, "Password must be at least 8 characters"],
      select: false, // Never return password in queries by default
    },
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    avatar: {
      type: String,
      default: "https://via.placeholder.com/150", // Default placeholder image
    },
    bio: {
      type: String,
      maxlength: [500, "Bio cannot exceed 500 characters"],
      default: "",
    },
    role: {
      type: String,
      enum: {
        values: ["student", "instructor", "admin"],
        message: "{VALUE} is not a valid role",
      },
      default: "student",
    },
    enrolledCourses: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Course", // References Course model (to be created)
      },
    ],
    isPaid: {
      type: Boolean,
      default: false,
      // Tracks whether user has a paid subscription/premium access
    },
    isActive: {
      type: Boolean,
      default: true,
      select: false, // Don't return by default (for privacy)
    },
    passwordResetToken: {
      type: String,
      select: false, // Sensitive - never return in queries
    },
    passwordResetExpires: {
      type: Date,
      select: false, // Sensitive - never return in queries
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
  },
);

// Pre-save hook: Hash password before saving
// Only runs if password is new or has been modified
UserSchema.pre("save", async function (next) {
  // If password wasn't modified, skip hashing (e.g., updating email)
  if (!this.isModified("password")) return next();

  // Hash password with cost factor of 12
  // Higher = more secure but slower (10-12 is standard)
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Instance method: Compare password for login
// Returns true if candidatePassword matches hashed password
UserSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Instance method: Generate password reset token
// Creates a random token, hashes it, saves to DB, and returns plain token
UserSchema.methods.createPasswordResetToken = function () {
  // Generate random token (32 bytes = 64 hex characters)
  const resetToken = crypto.randomBytes(32).toString("hex");

  // Hash the token before saving to DB (in case DB is compromised)
  this.passwordResetToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  // Token expires in 10 minutes
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;

  // Return plain token to send via email
  // (DB stores hashed version, email gets plain version)
  return resetToken;
};

// Transform toJSON: Remove sensitive fields from JSON responses
// This runs automatically when res.json(user) is called
UserSchema.set("toJSON", {
  virtuals: true, // Include virtual fields like fullName
  transform: (doc, ret) => {
    delete ret.password;
    delete ret.passwordResetToken;
    delete ret.passwordResetExpires;
    delete ret.__v;
    return ret;
  },
});

// Indexes for Performance
// Single field indexes
UserSchema.index({ role: 1 }); // Filter users by role (admin: "show all instructors")
UserSchema.index({ isActive: 1 }); // Find active/inactive users

// Compound indexes for common queries
UserSchema.index({ role: 1, isActive: 1 }); // Find active instructors/students

const UserModel = mongoose.model("User", UserSchema);

export default UserModel;
