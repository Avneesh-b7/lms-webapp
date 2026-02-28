import mongoose from "mongoose";

const CourseSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Course title is required"],
      trim: true,
      maxLength: [100, "Course title cannot exceed 100 characters"],
    },
    subtitle: {
      type: String,
      trim: true,
      maxLength: [200, "Course subtitle cannot exceed 200 characters"],
    },
    description: {
      type: String,
      trim: true,
    },
    category: {
      type: String,
      required: [true, "Course category is required"],
      trim: true,
    },
    level: {
      type: String,
      enum: {
        values: ["beginner", "intermediate", "advanced"],
        message: "Please select a valid course level",
      },
      default: "beginner",
    },
    price: {
      type: Number,
      required: [true, "Course price is required"],
      min: [0, "Course price must be non-negative"],
    },
    thumbnail: {
      type: String,
      required: [true, "Course thumbnail is required"],
    },
    enrolledStudents: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    lectures: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Lecture",
      },
    ],
    instructor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Course instructor is required"],
    },
    isPublished: {
      type: Boolean,
      default: false,
    },
    totalLectures: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Virtual field for average rating (to be implemented with reviews)
CourseSchema.virtual("averageRating").get(function () {
  return 0; // Placeholder until review system is implemented
});

// Virtual field for total duration (calculated from lectures)
// Only works when lectures are populated with .populate('lectures')
CourseSchema.virtual("totalDuration").get(function () {
  if (!this.lectures || this.lectures.length === 0) return 0;

  // Sum up duration from all lectures
  return this.lectures.reduce((total, lecture) => {
    // lecture.duration should exist when populated
    return total + (lecture.duration || 0);
  }, 0);
});

// Update total lectures count when lectures are modified
CourseSchema.pre("save", function (next) {
  if (this.lectures) {
    this.totalLectures = this.lectures.length;
  }
  next();
});

// Indexes for Performance
// Single field indexes
CourseSchema.index({ instructor: 1 }); // Instructor dashboard: "My courses"
CourseSchema.index({ category: 1 }); // Browse: "Web Development courses"
CourseSchema.index({ level: 1 }); // Browse: "Beginner courses"
CourseSchema.index({ isPublished: 1 }); // Only show published courses to students
CourseSchema.index({ createdAt: -1 }); // Sort by newest courses

// Compound indexes for common queries
CourseSchema.index({ isPublished: 1, category: 1 }); // Browse published courses by category
CourseSchema.index({ instructor: 1, isPublished: 1 }); // Instructor's published courses
CourseSchema.index({ isPublished: 1, level: 1 }); // Published courses by level
CourseSchema.index({ category: 1, level: 1 }); // Category + level filter (browse page)

const CourseModel = mongoose.model("Course", CourseSchema);

export default CourseModel;
