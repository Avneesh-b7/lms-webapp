# Mongoose Concepts Reference

Quick reference for Mongoose patterns used in this LMS application.

---

## Virtuals

**What:** Fields computed on-the-fly, NOT stored in the database.

**Why:** Saves space, keeps derived data always in sync with source data.

**Example:**
```javascript
// Instead of storing redundant data:
{
  firstName: "John",
  lastName: "Doe",
  fullName: "John Doe"  // ❌ Wastes space, can get out of sync
}

// Use a virtual:
UserSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Usage:
console.log(user.fullName);  // "John Doe" (computed, not in DB)
```

**Common Use Cases:**
- Full name from first + last name
- Age from date of birth
- Domain from email address
- URL slugs from titles

**Limitations:**
- ❌ Can't query/filter by virtuals in MongoDB
- ❌ Run on every access (not cached)
- ✅ Perfect for simple, fast computations

---

## Aggregation Pipelines

**What:** Multi-stage data transformations that run ON THE MONGODB SERVER.

**Why:** Much faster than fetching all data and processing in JavaScript.

**How It Works:**
```
Your App          MongoDB Server
   │                   │
   │  Send pipeline    │
   ├─────────────────>│
   │                   │ [Does all the work]
   │                   │ • Filters
   │                   │ • Groups
   │                   │ • Sorts
   │                   │ • Calculates
   │                   │
   │  Returns result   │
   │<──────────────────┤
```

**Example 1: Count users by role**
```javascript
await UserModel.aggregate([
  {
    $group: {
      _id: '$role',        // Group by role
      count: { $sum: 1 }   // Count each group
    }
  }
]);

// Result: [
//   { _id: 'student', count: 150 },
//   { _id: 'instructor', count: 12 }
// ]
```

**Example 2: Top 5 most enrolled students**
```javascript
await UserModel.aggregate([
  { $match: { role: 'student' } },              // Stage 1: Filter
  { $addFields: {
      count: { $size: '$enrolledCourses' }      // Stage 2: Add field
  }},
  { $sort: { count: -1 } },                     // Stage 3: Sort
  { $limit: 5 }                                 // Stage 4: Limit
]);
```

**Common Stages:**
- `$match` - Filter documents (like `.find()`)
- `$group` - Group and calculate aggregates (count, sum, avg)
- `$sort` - Sort results
- `$limit` - Take only N results
- `$project` - Select which fields to return
- `$addFields` - Add computed fields
- `$lookup` - Join with another collection

**When to Use:**
- ✅ Grouping/counting
- ✅ Calculating averages, sums, min/max
- ✅ Complex multi-stage transformations
- ✅ Joining data from multiple collections

**Performance:**
```
Fetching 100,000 docs to Node.js: ~2000ms, 50MB transferred
Aggregation on MongoDB: ~50ms, 5KB transferred
```

**40x faster!** Always prefer aggregations for heavy data processing.

---

## Other Mongoose Patterns in This App

### Pre-save Hooks
```javascript
UserSchema.pre('save', async function(next) {
  // Runs automatically BEFORE saving to DB
  // Example: Hash password before saving
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 12);
  }
  next();
});
```

### Instance Methods
```javascript
UserSchema.methods.comparePassword = async function(candidatePassword) {
  // Custom method available on user instances
  return await bcrypt.compare(candidatePassword, this.password);
};

// Usage:
const isMatch = await user.comparePassword('password123');
```

### Select: false
```javascript
password: {
  type: String,
  select: false  // Never return this field in queries
}

// Must explicitly request it:
const user = await UserModel.findOne({ email }).select('+password');
```

### toJSON Transform

**What:** Controls how Mongoose documents are converted to JSON (e.g., in API responses).

**Why:** Security - automatically removes sensitive fields before sending to client.

**How It Works:**
```javascript
UserSchema.set('toJSON', {
  virtuals: true,  // Include virtual fields in JSON output

  transform: (doc, ret) => {
    // doc = original Mongoose document (with methods, virtuals)
    // ret = plain object that will be sent as JSON

    delete ret.password;              // Remove hashed password
    delete ret.passwordResetToken;    // Remove reset token
    delete ret.passwordResetExpires;  // Remove expiry
    delete ret.__v;                   // Remove Mongoose version key

    return ret;  // Client receives this cleaned object
  }
});
```

**Example:**
```javascript
// In your controller
const user = await UserModel.findOne({ email });
res.json(user);  // toJSON runs automatically

// Client receives (password automatically removed):
{
  "_id": "123",
  "email": "john@example.com",
  "name": "John Doe",
  "role": "student"
  // No password, tokens, or __v ✅
}
```

**Why This Matters:**
- ❌ Without it: Easy to accidentally leak password/tokens in API responses
- ✅ With it: Set once in schema, safe forever - runs on every `res.json(user)`

---

## Quick Decision Guide

**Need derived data?**
- Simple computation → Use **virtuals**
- Need to query by it → Store it in DB

**Need to process data?**
- Simple filter/find → Use `.find()`
- Complex grouping/stats → Use **aggregation**

**Need to transform data before save?**
- Use **pre-save hooks**

**Need custom logic on documents?**
- Use **instance methods**
