import mongoose from "mongoose";

const PurchaseSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      index: true,
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: [true, "Course ID is required"],
      index: true,
    },

    // Payment Details
    amount: {
      type: Number,
      required: [true, "Amount is required"],
      min: [0, "Amount must be non-negative"],
      // This is the final amount charged (after discounts)
    },
    currency: {
      type: String,
      required: [true, "Currency is required"],
      uppercase: true,
      default: "USD",
      trim: true,
      // ISO 4217 currency codes (USD, EUR, INR, GBP, etc.)
    },
    paymentStatus: {
      type: String,
      enum: {
        values: ["pending", "completed", "failed", "refunded"],
        message: "{VALUE} is not a valid payment status",
      },
      default: "pending",
      index: true,
    },
    paymentMethod: {
      type: String,
      required: [true, "Payment method is required"],
      trim: true,
      // e.g., "card", "paypal", "google_pay", "apple_pay"
      // Stripe supports multiple payment methods
    },

    // Stripe Integration Fields
    paymentGateway: {
      type: String,
      default: "stripe",
      trim: true,
    },
    stripePaymentIntentId: {
      type: String,
      required: [true, "Stripe Payment Intent ID is required"],
      unique: true,
      trim: true,
      // Unique identifier from Stripe for this transaction
      // Used to track payment status and handle webhooks
    },
    stripeCustomerId: {
      type: String,
      trim: true,
      // Stripe customer ID for this user
      // Useful for future purchases, payment methods, etc.
    },

    // Pricing Breakdown
    coursePrice: {
      type: Number,
      required: [true, "Course price is required"],
      min: [0, "Course price must be non-negative"],
      // Original price of the course at time of purchase
      // Important: lock this in case course price changes later
    },
    discountAmount: {
      type: Number,
      default: 0,
      min: [0, "Discount must be non-negative"],
      // Total discount applied (from coupon/promo)
    },
    couponCode: {
      type: String,
      uppercase: true,
      trim: true,
      // Promo/coupon code used (e.g., "SAVE20", "BLACKFRIDAY")
    },

    // Timestamps
    purchasedAt: {
      type: Date,
      // Set when paymentStatus becomes "completed"
      // Used for "purchased on" display and analytics
    },

    // Refund Tracking
    refundStatus: {
      type: String,
      enum: {
        values: ["none", "pending", "completed"],
        message: "{VALUE} is not a valid refund status",
      },
      default: "none",
    },
    refundedAt: {
      type: Date,
      // When refund was successfully processed
    },
    refundReason: {
      type: String,
      trim: true,
      maxLength: [500, "Refund reason cannot exceed 500 characters"],
      // Admin/user-provided reason for refund
    },
    refundAmount: {
      type: Number,
      min: [0, "Refund amount must be non-negative"],
      // Amount refunded (can be partial or full)
      // Full refund: refundAmount === amount
    },
    stripeRefundId: {
      type: String,
      trim: true,
      // Stripe refund transaction ID
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
  }
);

// Compound Indexes for Common Queries
PurchaseSchema.index({ userId: 1, courseId: 1 }); // Check if user purchased specific course
PurchaseSchema.index({ userId: 1, paymentStatus: 1 }); // User's completed purchases
PurchaseSchema.index({ courseId: 1, paymentStatus: 1 }); // Course revenue analytics
PurchaseSchema.index({ createdAt: -1 }); // Recent purchases (for admin dashboard)

// Pre-save Hook: Auto-set purchasedAt when payment completes
PurchaseSchema.pre("save", function (next) {
  // If payment status just changed to "completed" and purchasedAt not set
  if (
    this.isModified("paymentStatus") &&
    this.paymentStatus === "completed" &&
    !this.purchasedAt
  ) {
    this.purchasedAt = new Date();
  }

  // If refund status just changed to "completed" and refundedAt not set
  if (
    this.isModified("refundStatus") &&
    this.refundStatus === "completed" &&
    !this.refundedAt
  ) {
    this.refundedAt = new Date();
  }

  // Update paymentStatus to "refunded" when refund completes
  if (this.refundStatus === "completed" && this.paymentStatus !== "refunded") {
    this.paymentStatus = "refunded";
  }

  next();
});

// Instance Method: Check if purchase is active (completed and not refunded)
PurchaseSchema.methods.isActive = function () {
  return (
    this.paymentStatus === "completed" && this.refundStatus === "none"
  );
};

// Static Method: Find active purchase for user and course
PurchaseSchema.statics.findActivePurchase = async function (userId, courseId) {
  return await this.findOne({
    userId,
    courseId,
    paymentStatus: "completed",
    refundStatus: "none",
  });
};

const PurchaseModel = mongoose.model("Purchase", PurchaseSchema);

export default PurchaseModel;
