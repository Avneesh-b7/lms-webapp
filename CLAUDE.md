# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LMS (Learning Management System) - a monorepo with separate backend and frontend directories. The backend is a production-ready Express.js API with JWT authentication, file uploads, cloud storage, security middleware, logging, and MongoDB support.

## Development Commands

```bash
cd backend
npm install        # Install dependencies
npm run dev        # Start server (port from .env, default 3004)
```

## Project Structure

```
lms-webapp/
├── backend/
│   ├── index.js           # Server entry point - all middleware registered here
│   ├── config/
│   │   ├── db.js          # MongoDB connection, pooling, graceful shutdown
│   │   ├── db.md          # DB architecture explanation
│   │   ├── multer.js      # File upload configs (avatar, thumbnail, video, document)
│   │   └── s3.js          # AWS S3 upload/delete utilities
│   ├── models/
│   │   ├── user.model.js           # User with auth, roles, refresh tokens
│   │   ├── courses.model.js        # Course with virtuals, hooks, indexes
│   │   ├── lecture.model.js        # Lecture videos with duration tracking
│   │   ├── courseProgress.model.js # Progress tracking with completion %
│   │   ├── purchase.model.js       # Stripe payments, refunds, coupons
│   │   ├── MONGOOSE_GUIDE.md       # Virtuals, aggregations, hooks reference
│   │   ├── VIRTUALS_HOOKS_GUIDE.md # PM-friendly guide on virtuals/hooks
│   │   └── INDEXES_GUIDE.md        # Indexing strategy and examples
│   └── utils/
│       ├── logger.js      # Winston logger - use for all logging
│       └── jwt.js         # JWT token generation/verification
└── frontend/              # Not yet implemented
```

## Environment Variables

```env
# Server
PORT=3004
NODE_ENV=development
CLIENT_URL=http://localhost:5173

# Database
MONGO_URI=mongodb+srv://...
DB_NAME=lms-webapp

# JWT Authentication
JWT_ACCESS_SECRET=...      # 128-char random secret
JWT_REFRESH_SECRET=...     # 128-char random secret
JWT_ACCESS_EXPIRES_IN=15m  # Short-lived access token
JWT_REFRESH_EXPIRES_IN=7d  # Long-lived refresh token

# AWS S3 (for file uploads)
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
AWS_S3_BUCKET_NAME=...
```

## Architecture

### Middleware Order (index.js)

The order is intentional and must be preserved:

1. **Morgan** → HTTP request logging, piped through Winston
2. **Helmet** → Security headers
3. **Rate limiter** → 100 req / 15 min per IP
4. **CORS** → Allows requests from `CLIENT_URL`
5. **Body parsers** → JSON and URL-encoded, both capped at 10kb
6. **Cookie parser** → For refresh token cookies
7. **Mongo sanitize** → Sanitizes `req.body` and `req.params` only
8. **Routes** → Auth, courses, uploads, etc.
9. **404 handler**
10. **Global error handler** → Triggered via `next(error)` from any route

### Logging (utils/logger.js)

Winston is the single logger for the entire app. Morgan pipes HTTP logs through it.

```javascript
import logger from "./utils/logger.js";

logger.error("something broke"); // → console + error.log + combined.log
logger.warn("heads up");         // → console + combined.log
logger.info("user logged in");   // → console + combined.log
logger.debug("cache miss");      // → console only (suppressed in production)
```

- **Development**: colored, human-readable `[HH:mm:ss] level: message`
- **Production**: structured JSON (for Datadog, Splunk, etc.)

### Authentication (JWT)

Custom JWT implementation with access + refresh tokens:

**Token Strategy:**
- **Access Token**: Short-lived (15 mins), sent with every request, stateless
- **Refresh Token**: Long-lived (7 days), stored in DB (hashed), used to get new access tokens

**Utilities (`utils/jwt.js`):**
```javascript
import { generateTokenPair, verifyAccessToken, verifyRefreshToken } from "./utils/jwt.js";

// Login: generate both tokens
const { accessToken, refreshToken } = generateTokenPair(user);

// Middleware: verify access token
const decoded = verifyAccessToken(token); // { userId, email, role }

// Refresh: validate and issue new access token
const decoded = verifyRefreshToken(refreshToken);
// Also check: user.hasValidRefreshToken(refreshToken)
```

**User Model Refresh Token Methods:**
```javascript
user.addRefreshToken(token, expiresIn, userAgent, ip);
user.removeRefreshToken(token);              // Logout
user.removeAllRefreshTokens();               // Logout all devices
user.hasValidRefreshToken(token);            // Validate token
user.cleanupExpiredTokens();                 // Cleanup
```

### File Uploads (config/multer.js)

Multer configured for different upload types:

```javascript
import { uploadAvatar, uploadThumbnail, uploadVideo, uploadDocument } from "./config/multer.js";

// Single file
router.post("/avatar", uploadAvatar.single("avatar"), uploadController);

// Multiple files
router.post("/lectures", uploadVideo.array("videos", 10), uploadController);

// Access uploaded file
const file = req.file; // { buffer, originalname, mimetype, size }
```

**Configurations:**
- `uploadAvatar` - 5 MB, images only
- `uploadThumbnail` - 10 MB, images only
- `uploadVideo` - 500 MB, video files
- `uploadDocument` - 50 MB, PDFs, docs
- `uploadImage` - 10 MB, generic images

**Storage**: Memory storage (files in `req.file.buffer`) for direct cloud upload

### Cloud Storage (config/s3.js)

AWS S3 utilities for file management:

```javascript
import { uploadToS3, deleteFromS3, S3_FOLDERS } from "./config/s3.js";

// Upload to S3
const result = await uploadToS3(
  req.file.buffer,
  req.file.originalname,
  S3_FOLDERS.AVATARS // or COURSE_THUMBNAILS, LECTURE_VIDEOS, etc.
);
// Returns: { key, url, bucket }

// Delete from S3
await deleteFromS3(key);
await deleteFromS3ByUrl(fullUrl);

// Presigned URLs (private videos for enrolled students)
const privateUrl = await getPresignedUrl(key, 3600); // Expires in 1 hour
```

**S3 Folders:**
- `avatars/` - User profile pictures
- `courses/thumbnails/` - Course cover images
- `lectures/videos/` - Lecture videos
- `courses/materials/` - PDFs, documents
- `certificates/` - Course certificates

### Database (config/db.js)

`connectDB()` called in `index.js` before `app.listen()` — server never starts if DB fails.

Key behaviors:
- **Pool**: `maxPoolSize: 5`, `minPoolSize: 2`
- **autoIndex**: Disabled in production (create indexes via migrations)
- **Graceful shutdown**: SIGINT/SIGTERM closes connection cleanly
- **Events**: connected/error/disconnected/reconnected logged via Winston

### Models (models/)

All models follow these conventions:
- **Naming**: `UserSchema` for schema, `UserModel` for model
- **Import**: `import UserModel from "./models/user.model.js"`
- **Exports**: `export default UserModel` (default export)

#### User Model (`user.model.js`)
- **Fields**: email, password (bcrypt hashed), name, avatar, bio, role, enrolledCourses, isPaid, refreshTokens
- **Roles**: `student` (default), `instructor`, `admin`
- **Auth Methods**: `comparePassword()`, `createPasswordResetToken()`, `addRefreshToken()`, `removeRefreshToken()`, `hasValidRefreshToken()`
- **Security**: `toJSON` transform auto-removes sensitive fields
- **Indexes**: role, isActive, role+isActive compound

#### Course Model (`courses.model.js`)
- **Fields**: title, subtitle, description, category, level, price, thumbnail, lectures, enrolledStudents, instructor, isPublished, totalLectures
- **Virtuals**: `totalDuration` (sum of lecture durations), `averageRating` (placeholder)
- **Hooks**: Pre-save updates `totalLectures` count
- **Indexes**: instructor, category, level, isPublished, createdAt, compound indexes for browse queries

#### Lecture Model (`lecture.model.js`)
- **Fields**: lectureTitle, description, videoUrl, publicId (S3 key), duration, courseId, isPreviewFree
- **Indexes**: courseId for fast course lookup

#### CourseProgress Model (`courseProgress.model.js`)
- **Fields**: userId, courseId, lectureProgress (nested array), isCompleted, enrolledAt, completedAt, lastWatchedLecture
- **Nested Schema**: lectureProgress (lectureId, isWatched, watchedDuration, lastWatchedAt)
- **Virtuals**: `completionPercentage` (watched / total * 100)
- **Indexes**: Unique compound (userId, courseId), userId, courseId

#### Purchase Model (`purchase.model.js`)
- **Fields**: userId, courseId, amount, currency, paymentStatus, paymentMethod, stripePaymentIntentId, stripeCustomerId, coursePrice, discountAmount, couponCode, purchasedAt
- **Refunds**: refundStatus, refundedAt, refundReason, refundAmount, stripeRefundId
- **Hooks**: Pre-save sets purchasedAt/refundedAt, updates paymentStatus
- **Methods**: `isActive()` (completed and not refunded), `findActivePurchase()` (static)
- **Indexes**: userId+courseId, userId+paymentStatus, courseId+paymentStatus, createdAt

### Known Express v5 Quirk

`express-mongo-sanitize` cannot be used as `app.use(mongoSanitize())` because Express v5 makes `req.query` a read-only getter. Instead, `mongoSanitize.sanitize()` is called manually on `req.body` and `req.params` only.

### Documentation Files

- **models/MONGOOSE_GUIDE.md** - Technical reference for virtuals, aggregations, hooks, instance methods, toJSON
- **models/VIRTUALS_HOOKS_GUIDE.md** - PM-friendly guide explaining virtuals and hooks with LMS examples
- **models/INDEXES_GUIDE.md** - Complete indexing strategy, performance impact, when to use indexes
- **config/db.md** - Explanation of MongoDB connection architecture

### Mongoose Patterns

**Virtuals** (calculated fields, not stored):
```javascript
CourseSchema.virtual("totalDuration").get(function() {
  return this.lectures.reduce((sum, lec) => sum + lec.duration, 0);
});
```

**Pre-save Hooks** (auto-run before save):
```javascript
UserSchema.pre("save", async function(next) {
  if (this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, 12);
  }
  next();
});
```

**Instance Methods**:
```javascript
UserSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};
```

**Indexes** (for query performance):
```javascript
CourseSchema.index({ instructor: 1, isPublished: 1 }); // Compound index
```

## Technical Details

- **Module system**: ES modules (`import`/`export`) — no `require()`
- **Framework**: Express v5.2.1
- **Database**: Mongoose v9
- **Authentication**: Custom JWT (jsonwebtoken v9.0.3)
- **Password Hashing**: bcryptjs (cost factor: 12)
- **File Uploads**: Multer v2.1.0 (memory storage)
- **Cloud Storage**: AWS SDK v3 (@aws-sdk/client-s3, @aws-sdk/lib-storage)
- **Security**: Helmet, express-rate-limit, express-mongo-sanitize, CORS
- **Logging**: Winston v3.19.0
