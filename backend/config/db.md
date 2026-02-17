# db.js — MongoDB Connection Explained

## What Does This File Do?

It does **one job**: connect the app to MongoDB safely and keep that
connection healthy for the entire lifetime of the server.

---

## The Big Picture

```
index.js imports db.js
        │
        ▼
┌───────────────────────────────────────┐
│              db.js                    │
│                                       │
│  1. Validate MONGO_URI                │
│  2. Register event listeners          │
│  3. Connect with pool + timeouts      │
│  4. Register shutdown hooks           │
└───────────────────────────────────────┘
        │
        ▼
   MongoDB Atlas
```

---

## Step 1 — Validate MONGO_URI

```
db.js starts
    │
    ├── MONGO_URI exists? ──YES──▶ continue
    │
    └── NO ──▶ log error ──▶ process.exit(1)
               "Don't even try to start without a DB URI"
```

**Why?** Without this, you'd get a cryptic mongoose error.
With this, you get a clear message instantly.

---

## Step 2 — Event Listeners

These listen to the connection state at runtime and log everything
through Winston so you're never flying blind.

```
MongoDB Connection State Machine:

  ┌─────────────┐   success   ┌─────────────┐
  │ CONNECTING  │────────────▶│  CONNECTED  │
  └─────────────┘             └──────┬──────┘
                                     │ network drop
                                     ▼
                              ┌─────────────┐
                              │DISCONNECTED │
                              └──────┬──────┘
                                     │ mongoose auto-retries
                                     ▼
                              ┌─────────────┐
                              │ RECONNECTED │
                              └─────────────┘

Each state change → Winston logs it so you always know what's happening.
```

---

## Step 3 — Connection Pool

Instead of opening and closing a DB connection on every request
(expensive), we keep a pool of connections alive and reuse them.

```
WITHOUT pooling (bad):
  Request 1 → open connection → query → close   ← slow!
  Request 2 → open connection → query → close   ← slow!
  Request 3 → open connection → query → close   ← slow!

WITH pooling (what we do):
  App starts → open 10 connections → keep alive

  Request 1 ──▶ borrow conn 1 ──▶ query ──▶ return conn 1
  Request 2 ──▶ borrow conn 2 ──▶ query ──▶ return conn 2
  Request 3 ──▶ borrow conn 1 ──▶ query ──▶ return conn 1  (reused!)
```

### Pool Settings We Use

| Option           | Value  | Why                                          |
|------------------|--------|----------------------------------------------|
| maxPoolSize      | 10     | Max 10 simultaneous DB operations            |
| minPoolSize      | 2      | Always keep 2 warm to avoid cold-start delay |

### Timeout Settings

| Option                    | Value  | Why                                        |
|---------------------------|--------|--------------------------------------------|
| serverSelectionTimeoutMS  | 5000ms | Give up finding MongoDB after 5s           |
| socketTimeoutMS           | 45000ms| Close idle sockets after 45s               |
| connectTimeoutMS          | 10000ms| Give up on initial TCP connection after 10s|
| heartbeatFrequencyMS      | 10000ms| Ping MongoDB every 10s to detect drops     |

### autoIndex

```
autoIndex: true  (development)
  → Mongoose creates indexes automatically
  → Convenient for local dev

autoIndex: false (production)
  → Indexes must be created manually via migrations
  → WHY? Auto-indexing locks the collection under traffic
     which causes slowdowns or timeouts for real users
```

---

## Step 4 — Graceful Shutdown

When the server stops, we close the DB connection cleanly
instead of just cutting the cord.

```
SIGNALS WE LISTEN FOR:
  SIGINT  → Ctrl+C in terminal (local dev)
  SIGTERM → sent by Docker / Kubernetes / PM2 on deploy

WHAT HAPPENS:
  Signal received
      │
      ▼
  gracefulShutdown() called automatically
      │
      ▼
  mongoose.connection.close()
  (waits for in-flight writes to finish)
      │
      ▼
  process.exit(0)   ← 0 means "intentional, clean exit"


WHY DOES THIS MATTER?
  Without it:              With it:
  ┌──────────────┐         ┌──────────────┐
  │ Write 50%    │         │ Write 50%    │
  │ done...      │         │ done...      │
  │ SIGTERM! ❌  │         │ SIGTERM      │
  │ Process      │         │ Wait...      │
  │ killed!      │         │ Write 100% ✅│
  │ Data corrupt!│         │ Close conn   │
  └──────────────┘         │ Exit cleanly │
                           └──────────────┘
```

---

## Complete Startup Flow

```
npm run dev
    │
    ▼
index.js imports db.js
    │
    ├── Registers SIGINT / SIGTERM hooks
    │
    ▼
connectDB() called
    │
    ├── MONGO_URI missing? → exit(1)
    │
    ├── Event listeners registered
    │
    ├── mongoose.connect() with pool + timeout config
    │
    ├── SUCCESS ──▶ "MongoDB connected: cluster0.xxx.mongodb.net"
    │               app.listen(3000)
    │               "Server running on http://localhost:3000"
    │
    └── FAILURE ──▶ "Failed to connect to MongoDB: ..."
                    process.exit(1)
```
