import mongoose from "mongoose";

// Nested schema for individual lecture progress
// No _id needed for sub-documents (saves space)
const lectureProgressSchema = new mongoose.Schema(
  {
    lectureId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lecture",
      required: true,
    },
    isWatched: {
      type: Boolean,
      default: false,
      // True when user completes this lecture
    },
    watchedDuration: {
      type: Number,
      default: 0,
      min: [0, "Watched duration cannot be negative"],
      // Seconds watched (optional - for resume feature)
      // Can track partial progress within a lecture
    },
    lastWatchedAt: {
      type: Date,
      // Timestamp when user last accessed this lecture
    },
  },
  { _id: false } // Don't create _id for nested documents
);

const CourseProgressSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: [true, "Course ID is required"],
    },
    lectureProgress: [lectureProgressSchema],
    isCompleted: {
      type: Boolean,
      default: false,
      // True when user completes all lectures in the course
    },
    enrolledAt: {
      type: Date,
      default: Date.now,
      // When user enrolled in the course
    },
    completedAt: {
      type: Date,
      // When user completed the entire course (null if not completed)
    },
    lastWatchedLecture: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lecture",
      // Reference to the most recently watched lecture
      // Useful for "Continue watching" feature
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual: Calculate completion percentage
// (watched lectures / total lectures) * 100
CourseProgressSchema.virtual("completionPercentage").get(function () {
  if (!this.lectureProgress || this.lectureProgress.length === 0) return 0;

  const watchedCount = this.lectureProgress.filter((lp) => lp.isWatched).length;
  const totalCount = this.lectureProgress.length;

  return Math.round((watchedCount / totalCount) * 100);
});

// Index: Ensure one progress document per user per course
// Prevents duplicate progress tracking
CourseProgressSchema.index({ userId: 1, courseId: 1 }, { unique: true });

// Index: Fast queries for user's all course progress
CourseProgressSchema.index({ userId: 1 });

// Index: Fast queries for course's all student progress
CourseProgressSchema.index({ courseId: 1 });

const CourseProgressModel = mongoose.model(
  "CourseProgress",
  CourseProgressSchema
);

export default CourseProgressModel;
