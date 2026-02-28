# Database Indexes: Product Manager's Guide

A clear guide to understanding database indexes, why they matter for performance, and how to use them effectively.

---

## What Are Indexes?

Indexes are **lookup tables** that help databases find data quickly, just like the index at the back of a textbook.

### The Book Analogy

**Without an index:**
- Want to find "React" in a 500-page programming book?
- Read every page from start to finish → takes hours

**With an index:**
- Flip to the back: "React ... pages 47, 89, 234"
- Jump directly to those pages → takes seconds

**Database indexes work exactly the same way** — they let MongoDB jump directly to the data you need instead of scanning every document.

---

## Why Indexes Matter (Product Perspective)

### Performance Impact

**Real LMS Example: Course Browse Page**

Without indexes:
```javascript
// Query: "Show published Web Development courses"
db.courses.find({ isPublished: true, category: "Web Development" })

// MongoDB scans ALL 50,000 courses → 800ms ⏳
// User sees loading spinner for almost a second
// Bounce rate increases, users get frustrated
```

With proper indexes:
```javascript
// Same query with index on { isPublished: 1, category: 1 }

// MongoDB uses index → finds 500 matches instantly → 8ms ⚡
// Page loads instantly, users happy
// 100x faster!
```

### Business Impact

| Metric | Without Indexes | With Indexes |
|--------|----------------|--------------|
| Browse page load | 800ms | 8ms |
| Instructor dashboard | 600ms | 3ms |
| User search | 1200ms | 5ms |
| **User experience** | Frustrating | Instant |
| **Bounce rate** | Higher | Lower |
| **Server costs** | Higher (more CPU) | Lower (efficient queries) |

**Bottom line:** Indexes are the difference between a slow, expensive app and a fast, efficient one.

---

## How Indexes Work (Simplified)

### Without Index: Full Collection Scan

```javascript
// Find user: john@example.com
// MongoDB checks EVERY user:

Document 1: alice@example.com ❌
Document 2: bob@example.com ❌
Document 3: charlie@example.com ❌
... scan 100,000 documents ...
Document 99,999: john@example.com ✅

Result: 500ms (SLOW)
```

### With Index: Direct Lookup

```javascript
// MongoDB maintains a sorted index:
Index:
  alice@example.com → doc 1
  bob@example.com → doc 2
  charlie@example.com → doc 3
  ...
  john@example.com → doc 99,999

// Process:
1. Look up "john@example.com" in index (2ms)
2. Jump directly to document 99,999 (1ms)
3. Return result

Result: 3ms (FAST)
```

---

## Types of Indexes

### 1. Single Field Index

Index on one field:

```javascript
CourseSchema.index({ category: 1 });
```

**Use case:** Filter courses by category
```javascript
// Fast query:
find({ category: "Web Development" })
```

### 2. Compound Index

Index on multiple fields together:

```javascript
CourseSchema.index({ isPublished: 1, category: 1 });
```

**Use case:** Filter published courses by category
```javascript
// Fast query:
find({ isPublished: true, category: "Web Development" })
```

**Important Rule:** Compound indexes work **left-to-right**

Index `{isPublished: 1, category: 1}` speeds up:
- ✅ `find({ isPublished: true })` (first field)
- ✅ `find({ isPublished: true, category: "X" })` (both fields)
- ❌ `find({ category: "X" })` (second field only - needs separate index)

### 3. Unique Index

Prevents duplicate values:

```javascript
UserSchema.index({ email: 1 }, { unique: true });
```

**Use case:** Ensure no two users have the same email
- MongoDB enforces at database level
- Prevents race conditions
- Automatic validation

---

## Real LMS Examples

### Example 1: Instructor Dashboard

**Feature:** "Show all my courses"

```javascript
const myCourses = await CourseModel.find({
  instructor: instructorId
});
```

**Index needed:**
```javascript
CourseSchema.index({ instructor: 1 });
```

**Impact:**
- Without index: Scan 50,000 courses → 600ms
- With index: Jump to instructor's 12 courses → 3ms
- **200x faster**

### Example 2: Course Catalog with Filters

**Feature:** Browse page with category and level filters

```javascript
const courses = await CourseModel.find({
  isPublished: true,
  category: "Web Development",
  level: "beginner"
});
```

**Indexes needed:**
```javascript
// Compound index for common filters
CourseSchema.index({ isPublished: 1, category: 1 });
CourseSchema.index({ isPublished: 1, level: 1 });
```

**Impact:**
- Search narrows from 50,000 → 500 → 50 instantly
- Users can filter/sort without delays
- Better UX = more enrollments

### Example 3: Purchase History

**Feature:** "Show my completed purchases"

```javascript
const purchases = await PurchaseModel.find({
  userId: currentUser.id,
  paymentStatus: "completed"
});
```

**Index needed:**
```javascript
PurchaseSchema.index({ userId: 1, paymentStatus: 1 });
```

**Impact:**
- Without index: Scan all transactions → slow
- With index: Jump to user's completed purchases → instant
- Critical for good checkout/account UX

### Example 4: Unique Constraint (Prevent Double Enrollment)

**Feature:** Prevent user from enrolling twice in same course

```javascript
CourseProgressSchema.index(
  { userId: 1, courseId: 1 },
  { unique: true }
);
```

**Impact:**
- Database enforces "one progress per user per course"
- Prevents race conditions (user clicks "Enroll" twice)
- No duplicate data, no bugs
- Application logic doesn't need to check manually

---

## Trade-offs

### ✅ Benefits

**Faster Reads:**
- Queries are 10-1000x faster
- Better user experience
- Lower server CPU usage

**Data Integrity:**
- Unique indexes prevent duplicates
- Enforced at database level

**Sorting:**
- Indexed fields sort faster
- `sort({ createdAt: -1 })` is instant with index

### ⚠️ Costs

**Storage:**
- Each index takes disk space
- Usually small (5-15% of collection size)

**Slower Writes:**
- Inserts/updates must update all indexes
- More indexes = slower writes
- Example: 10 indexes = 10x write overhead

**Maintenance:**
- Need to keep indexes updated as queries evolve
- Too many indexes = diminishing returns

**Rule of Thumb:**
- 5-10 indexes per collection is typical
- Index what you query, not everything

---

## When to Use Indexes

### ✅ Use Indexes For:

**Fields you filter by:**
```javascript
find({ category: "Web Dev" })        // Index: { category: 1 }
find({ instructor: userId })          // Index: { instructor: 1 }
```

**Fields you sort by:**
```javascript
find().sort({ createdAt: -1 })       // Index: { createdAt: -1 }
find().sort({ price: 1 })             // Index: { price: 1 }
```

**Foreign keys (ObjectId references):**
```javascript
// Always index refs for fast lookups
courseId: { type: ObjectId, ref: "Course" }  // Index: { courseId: 1 }
userId: { type: ObjectId, ref: "User" }      // Index: { userId: 1 }
```

**Unique constraints:**
```javascript
email: { type: String, unique: true }        // Index: { email: 1, unique }
stripePaymentIntentId: { unique: true }      // Index: { stripePaymentIntentId: 1, unique }
```

**Compound queries (multiple filters):**
```javascript
find({ isPublished: true, category: "X" })   // Index: { isPublished: 1, category: 1 }
```

### ❌ Don't Index:

**Fields you never query:**
```javascript
// Don't index fields that are only displayed, never searched
description: { type: String }  // ❌ No index needed
```

**Small collections:**
```javascript
// Collections with < 1,000 documents
// Full scans are fast enough, indexes add overhead
```

**Low cardinality fields:**
```javascript
// Boolean fields with 95% same value
isActive: { type: Boolean, default: true }  // ❌ Usually true, index not helpful
```

**Every field "just in case":**
```javascript
// Over-indexing slows down writes
// Only index what you actually query
```

---

## Production Considerations

### Auto-Index in Development

In development, Mongoose auto-creates indexes:
```javascript
// Indexes sync automatically when server starts
```

### Manual Indexes in Production

Your LMS disables `autoIndex` in production (to prevent collection locks):

```javascript
// From config/db.js
autoIndex: false  // Production setting
```

**Why?** Creating indexes on large collections can lock the database for minutes.

**Solution:** Create indexes manually via migrations:

```javascript
// One-time migration script
await UserModel.createIndexes();
await CourseModel.createIndexes();
await PurchaseModel.createIndexes();
```

### Monitoring Indexes

Check if queries are using indexes:
```javascript
// MongoDB explain plan
db.courses.find({ category: "Web Dev" }).explain("executionStats")

// Look for:
// "executionStats.totalDocsExamined": 500  ✅ (with index)
// "executionStats.totalDocsExamined": 50000 ❌ (without index - full scan)
```

---

## LMS Index Strategy Summary

### User Model
```javascript
UserSchema.index({ role: 1 });               // Admin: filter by role
UserSchema.index({ role: 1, isActive: 1 });  // Active instructors
```

**Queries optimized:**
- "Show all instructors"
- "Find active students"

### Course Model
```javascript
CourseSchema.index({ instructor: 1 });               // Instructor dashboard
CourseSchema.index({ isPublished: 1, category: 1 }); // Browse by category
CourseSchema.index({ isPublished: 1, level: 1 });    // Browse by level
```

**Queries optimized:**
- "My courses" (instructor)
- "Published Web Dev courses"
- "Beginner courses"

### Purchase Model
```javascript
PurchaseSchema.index({ userId: 1, paymentStatus: 1 });   // Purchase history
PurchaseSchema.index({ courseId: 1, paymentStatus: 1 }); // Revenue analytics
```

**Queries optimized:**
- "My completed purchases"
- "Course revenue report"

### CourseProgress Model
```javascript
CourseProgressSchema.index({ userId: 1, courseId: 1 }, { unique: true });
```

**Queries optimized:**
- "User's progress in course"
- Prevent duplicate enrollment

---

## Where Indexes Are Stored

Indexes are **not stored in your application code** — they live in MongoDB's database files on the server.

### Your Code vs. MongoDB Storage

**Your Code (models/courses.model.js):**
```javascript
CourseSchema.index({ category: 1 }); // This is just a declaration/instruction
```
- Tells MongoDB "create this index"
- Not the actual index data

**MongoDB Server:**
```
/data/db/
├── collection-0-1234.wt       # Course documents
├── index-1-1234.wt            # category index
├── index-2-1234.wt            # instructor index
└── ...
```
- Actual indexes stored in `.wt` files (WiredTiger storage engine)
- Each index is a B-tree structure on disk

### Quick Reference

| Question | Answer |
|----------|--------|
| **Where are indexes stored?** | MongoDB server disk (`.wt` files) |
| **Are they in my code?** | No, code just declares them |
| **Local MongoDB location?** | `/usr/local/var/mongodb/` or `/data/db/` |
| **Cloud (Atlas) location?** | Atlas servers (AWS/GCP/Azure) |
| **How to view them?** | `db.collection.getIndexes()` or MongoDB Compass |
| **How much space?** | Typically 10-20% of collection size |
| **Are they in RAM?** | Frequently used ones, yes (for speed) |
| **How are they created?** | Auto (dev) or manual migration (prod) |

### Viewing Your Indexes

```javascript
// MongoDB shell
mongosh "mongodb://localhost:27017/lms"

// View all indexes on courses collection
db.courses.getIndexes()

// Output:
[
  { v: 2, key: { _id: 1 }, name: '_id_' },
  { v: 2, key: { instructor: 1 }, name: 'instructor_1' },
  { v: 2, key: { category: 1 }, name: 'category_1' },
  { v: 2, key: { isPublished: 1, category: 1 }, name: 'isPublished_1_category_1' }
]

// Check index sizes
db.courses.stats().indexSizes
```

---

## Key Takeaways

1. **Indexes = Speed** → Queries go from 500ms to 5ms (100x faster)
2. **Index what you query** → Filter fields, sort fields, foreign keys
3. **Don't over-index** → Each index slows writes, balance is key
4. **Compound indexes** → Left-to-right prefix matching
5. **Unique indexes** → Prevent duplicates at database level
6. **Production** → Create indexes via migrations, not auto-sync

**Bottom line:** Proper indexes are the difference between a fast, scalable LMS and a slow, expensive one. They're invisible to users but critical to performance.
