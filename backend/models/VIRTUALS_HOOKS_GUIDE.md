# Virtuals & Hooks: Product Manager's Guide

A quick guide to two key database patterns that enable better features without data redundancy.

---

## Virtuals: Calculated Fields That Don't Store Data

### What Are They?
Virtuals are fields that **calculate values on-the-fly** from existing data. They're not stored in the database — they're computed every time you request them.

### Why They Matter (Product Perspective)

**Benefits:**
- **Always accurate** — no risk of stale/outdated data
- **Save storage** — don't duplicate information
- **Simplify updates** — change source data once, virtual updates automatically

**Example 1: Course Completion Percentage**

Instead of storing `completionPercentage: 75` in the database (which could become wrong if the user watches more lectures), we calculate it:

```javascript
// Virtual in CourseProgress model
completionPercentage = (watched lectures / total lectures) × 100
```

**Product Impact:**
- Progress bar always shows the real percentage
- No bugs where users see "75% complete" after finishing the course
- Backend doesn't need to update this field every time a user watches a lecture

**Example 2: Course Total Duration**

Instead of storing `totalDuration: 7200` (2 hours in seconds), we calculate it from all lectures:

```javascript
// Virtual in Course model
totalDuration = sum of all lecture.duration values
```

**Product Impact:**
- When instructors add/remove/edit lectures, total duration updates automatically
- "4h 30m course" badge is always correct
- No need to recalculate and save every time a lecture changes

### When to Use Virtuals

✅ **Use virtuals when:**
- Value can be calculated from existing fields
- You need the value to always be current
- Example: totals, averages, percentages, derived states

❌ **Don't use virtuals for:**
- Values that need database queries (use aggregation instead)
- Values needed for sorting/filtering in the database

---

## Hooks: Auto-Actions Before/After Database Events

### What Are They?
Hooks are functions that **run automatically** when something happens to your data (before save, after delete, etc.). Think of them as "triggers" or "watchers."

### Why They Matter (Product Perspective)

**Benefits:**
- **Enforce business rules** — certain actions happen automatically, always
- **Reduce bugs** — developers can't forget critical steps
- **Maintain data integrity** — relationships stay consistent

### Common Hooks

#### Pre-Save Hook: "Before this document saves..."

**Example 1: Password Hashing**
```javascript
// User model pre-save hook
Before saving a user → hash their password
```

**Product Impact:**
- Passwords are NEVER stored in plain text (critical security requirement)
- Happens automatically — engineers can't accidentally skip this step
- Users' accounts are secure by default

**Example 2: Auto-Update Total Lectures Count**
```javascript
// Course model pre-save hook
Before saving a course → count lectures array → update totalLectures field
```

**Product Impact:**
- "This course has 24 lectures" is always accurate
- Instructors don't manually maintain this count
- API responses show correct numbers without extra computation

#### Post-Save Hook: "After this document saves..."

**Example: Sync Course List When User Enrolls**
```javascript
// CourseProgress model post-save hook
After creating progress → add courseId to user's enrolledCourses array
```

**Product Impact:**
- User's profile shows enrolled courses instantly
- "My Courses" page stays in sync
- One enrollment action updates both Progress and User models

#### Pre-Delete Hook: "Before this document deletes..."

**Example: Clean Up Related Data**
```javascript
// Course model pre-delete hook
Before deleting a course → delete all its lectures → delete all progress records
```

**Product Impact:**
- No orphaned data (lectures/progress for deleted courses)
- Database stays clean
- Prevents bugs like "continue watching" showing deleted courses

### When to Use Hooks

✅ **Use hooks when:**
- Action must happen every time (hashing passwords, updating counts)
- Multiple models need to stay in sync
- You need to clean up related data
- Business rule enforcement (e.g., "instructor can't have >50 courses")

❌ **Don't use hooks for:**
- Complex business logic better suited for service layer
- Operations that might fail and shouldn't block the save
- Actions that need conditional logic based on user permissions

---

## Real LMS Product Scenarios

| Feature | Pattern | Why It Matters |
|---------|---------|----------------|
| Progress bar shows "67% complete" | **Virtual** | Always accurate, even after watching more lectures |
| Course card shows "12h 30m total" | **Virtual** | Updates when instructor edits lectures |
| Instructor adds a lecture | **Hook** | `totalLectures` increments automatically |
| User enrolls in course | **Hook** | Progress record created + course added to user's list |
| User changes password | **Hook** | New password hashed before saving |
| Admin deletes course | **Hook** | All lectures and student progress cleaned up |

---

## Key Takeaway

**Virtuals** = Calculate values from existing data (no storage, always current)
**Hooks** = Auto-run actions when data changes (enforce rules, maintain integrity)

Both patterns help us build features that are **accurate**, **efficient**, and **hard to break**.
