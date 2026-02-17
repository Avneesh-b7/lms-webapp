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
│   ├── index.js          # Server entry point - all middleware registered here
│   ├── utils/
│   │   └── logger.js     # Winston logger - import this for all logging
│   └── logs/             # Auto-created at runtime, gitignored
│       ├── error.log
│       └── combined.log
└── frontend/             # Not yet implemented
```

## Environment Variables

```env
PORT=3000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
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

logger.error("something broke");   // → console + error.log + combined.log
logger.warn("heads up");           // → console + combined.log
logger.info("user logged in");     // → console + combined.log
logger.debug("cache miss");        // → console only (suppressed in production)
```

- **Development**: colored, human-readable `[HH:mm:ss] level: message`
- **Production**: structured JSON (for Datadog, Splunk, etc.)

### Known Express v5 Quirk

`express-mongo-sanitize` cannot be used as `app.use(mongoSanitize())` because Express v5 makes `req.query` a read-only getter. Instead, `mongoSanitize.sanitize()` is called manually on `req.body` and `req.params` only.

## Technical Details

- **Module system**: ES modules (`import`/`export`) throughout — no `require()`
- **Framework**: Express v5.2.1
- **Database**: Mongoose v9 (not yet connected)
