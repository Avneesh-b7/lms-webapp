# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an LMS (Learning Management System) web application - a monorepo with separate backend and frontend directories. The backend is a production-ready Express.js API with security, logging, and MongoDB support.

## Development Commands

```bash
cd backend
npm install        # Install dependencies
npm run dev        # Start server (defaults to port 3000)
```

## Project Structure

```
lms-webapp/
├── backend/
│   ├── index.js           # Server entry point - all middleware registered here
│   ├── config/
│   │   ├── db.js          # MongoDB connection, pooling, graceful shutdown
│   │   └── db.md          # Explanation of db.js architecture
│   ├── models/
│   │   ├── user.model.js         # User model with auth (bcrypt hashing, password reset)
│   │   ├── courses.model.js      # Course model
│   │   ├── lecture.model.js      # Lecture model
│   │   ├── courseProgress.model.js # Progress tracking
│   │   └── MONGOOSE_GUIDE.md     # Mongoose patterns reference (virtuals, aggregations)
│   ├── utils/
│   │   └── logger.js      # Winston logger - import this for all logging
│   └── logs/              # Auto-created at runtime, gitignored
│       ├── error.log
│       └── combined.log
└── frontend/              # Not yet implemented
```

## Environment Variables

```env
PORT=XXXX
NODE_ENV=development
CLIENT_URL=http://localhost:frontend-port
MONGO_URI=mongodb+srv://...
DB_NAME=lms
```

## Architecture

### Middleware Order (index.js)

The order is intentional and must be preserved:

1. **Morgan** → HTTP request logging, piped through Winston
2. **Helmet** → Security headers
3. **Rate limiter** → 100 req / 15 min per IP
4. **CORS** → Allows requests from `CLIENT_URL` (Vite default: 5173)
5. **Body parsers** → JSON and URL-encoded, both capped at 10kb
6. **Cookie parser**
7. **Mongo sanitize** → Sanitizes `req.body` and `req.params` only
8. **Routes**
9. **404 handler**
10. **Global error handler** → Triggered via `next(error)` from any route

### Logging (utils/logger.js)

Winston is the single logger for the entire app. Morgan pipes HTTP logs through it.

```javascript
import logger from "./utils/logger.js";

logger.error("something broke"); // → console + error.log + combined.log
logger.warn("heads up"); // → console + combined.log
logger.info("user logged in"); // → console + combined.log
logger.debug("cache miss"); // → console only (suppressed in production)
```

- **Development**: colored, human-readable `[HH:mm:ss] level: message`
- **Production**: structured JSON (for Datadog, Splunk, etc.)

### Known Express v5 Quirk

`express-mongo-sanitize` cannot be used as `app.use(mongoSanitize())` because Express v5 makes `req.query` a read-only getter. Instead, `mongoSanitize.sanitize()` is called manually on `req.body` and `req.params` only.

### Database (config/db.js)

`connectDB()` is called in `index.js` before `app.listen()` — the server never starts if the DB connection fails.

Key behaviours:

- **Pool**: `maxPoolSize: 5`, `minPoolSize: 2`
- **autoIndex**: disabled in production to prevent collection locks — create indexes via migrations
- **Graceful shutdown**: listens for `SIGINT` (Ctrl+C) and `SIGTERM` (Docker/K8s/PM2), closes the connection cleanly before exiting
- **Events**: connected / error / disconnected / reconnected are all logged through Winston

### Models (models/)

All models follow these conventions:

- **Naming**: `UserSchema` for schema, `UserModel` for model
- **Import**: `import UserModel from "./models/user.model.js"`
- **Reference guide**: See `models/MONGOOSE_GUIDE.md` for Mongoose patterns (virtuals, aggregations, hooks, toJSON)

**User Model** (`user.model.js`):
- Email, password (bcrypt hashed via pre-save hook), name, avatar, bio
- Roles: `student` (default), `instructor`, `admin`
- `enrolledCourses`: array of Course ObjectIds
- `isPaid`: boolean for subscription tracking
- Password methods: `comparePassword()`, `createPasswordResetToken()`
- Security: `toJSON` transform auto-removes password/tokens from API responses
- Fields with `select: false`: password, passwordResetToken, passwordResetExpires, isActive

## Technical Details

- **Module system**: ES modules (`import`/`export`) throughout — no `require()`
- **Framework**: Express v5.2.1
- **Database**: Mongoose v9 connected via `config/db.js`
- **Authentication**: bcryptjs for password hashing (cost factor: 12)
