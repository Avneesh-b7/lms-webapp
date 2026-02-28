import mongoose from "mongoose";

const LectureSchema = new mongoose.Schema(
  {
    lectureTitle: {
      type: String,
      required: [true, "Lecture title is required"],
      trim: true,
      maxLength: [100, "Lecture title cannot exceed 100 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxLength: [500, "Description cannot exceed 500 characters"],
    },
    videoUrl: {
      type: String,
      required: [true, "Video URL is required"],
      trim: true,
    },
    publicId: {
      type: String,
      trim: true,
      // Cloud storage public ID (Cloudinary, AWS S3, etc.)
      // Used to delete/manage the video file
    },
    duration: {
      type: Number,
      required: [true, "Lecture duration is required"],
      min: [0, "Duration must be non-negative"],
      // Duration in seconds (e.g., 300 = 5 minutes)
      // Used to calculate Course's totalDuration virtual
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: [true, "Course reference is required"],
      // Each lecture belongs to one course
    },
    isPreviewFree: {
      type: Boolean,
      default: false,
      // If true, non-enrolled students can watch this lecture
      // Useful for "preview" lectures to attract students
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
  }
);

// Index on courseId for faster queries (find all lectures for a course)
LectureSchema.index({ courseId: 1 });

const LectureModel = mongoose.model("Lecture", LectureSchema);

export default LectureModel;
