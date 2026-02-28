import multer from "multer";
import path from "path";

// File filter helper: validates file types
const createFileFilter = (allowedMimeTypes, allowedExtensions) => {
  return (req, file, cb) => {
    // Check MIME type
    const isMimeTypeValid = allowedMimeTypes.includes(file.mimetype);

    // Check file extension
    const extname = path.extname(file.originalname).toLowerCase();
    const isExtensionValid = allowedExtensions.includes(extname);

    if (isMimeTypeValid && isExtensionValid) {
      cb(null, true); // Accept file
    } else {
      cb(
        new Error(
          `Invalid file type. Allowed: ${allowedExtensions.join(", ")}`
        ),
        false
      );
    }
  };
};

// Memory Storage Configuration
// Files stored in memory as Buffer objects - ideal for cloud uploads (Cloudinary/S3)
// No disk I/O overhead, files cleaned up automatically after request
const memoryStorage = multer.memoryStorage();

// Disk Storage Configuration (optional - use if you need temporary local storage)
// Files saved to disk before upload to cloud
const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Save to uploads/ directory (create this folder or it will error)
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    // Generate unique filename: timestamp-randomstring-originalname
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    const nameWithoutExt = path.basename(file.originalname, ext);
    cb(null, `${nameWithoutExt}-${uniqueSuffix}${ext}`);
  },
});

// Avatar Upload Configuration
// For user profile pictures
const uploadAvatar = multer({
  storage: memoryStorage, // Use memory storage for cloud uploads
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB max
  },
  fileFilter: createFileFilter(
    ["image/jpeg", "image/jpg", "image/png", "image/webp"], // Allowed MIME types
    [".jpg", ".jpeg", ".png", ".webp"] // Allowed extensions
  ),
});

// Course Thumbnail Upload Configuration
// For course cover images
const uploadThumbnail = multer({
  storage: memoryStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB max
  },
  fileFilter: createFileFilter(
    ["image/jpeg", "image/jpg", "image/png", "image/webp"],
    [".jpg", ".jpeg", ".png", ".webp"]
  ),
});

// Lecture Video Upload Configuration
// For course lecture videos
const uploadVideo = multer({
  storage: memoryStorage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500 MB max (adjust based on your needs)
  },
  fileFilter: createFileFilter(
    [
      "video/mp4",
      "video/webm",
      "video/ogg",
      "video/quicktime", // .mov files
      "video/x-msvideo", // .avi files
    ],
    [".mp4", ".webm", ".ogg", ".mov", ".avi"]
  ),
});

// Document Upload Configuration
// For PDFs, course materials, etc.
const uploadDocument = multer({
  storage: memoryStorage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB max
  },
  fileFilter: createFileFilter(
    [
      "application/pdf",
      "application/msword", // .doc
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
      "application/vnd.ms-powerpoint", // .ppt
      "application/vnd.openxmlformats-officedocument.presentationml.presentation", // .pptx
      "text/plain", // .txt
    ],
    [".pdf", ".doc", ".docx", ".ppt", ".pptx", ".txt"]
  ),
});

// Generic Image Upload Configuration
// For any image upload (flexible use)
const uploadImage = multer({
  storage: memoryStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB max
  },
  fileFilter: createFileFilter(
    ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"],
    [".jpg", ".jpeg", ".png", ".webp", ".gif"]
  ),
});

// Export all upload configurations
export {
  uploadAvatar, // For user profile pictures
  uploadThumbnail, // For course thumbnails
  uploadVideo, // For lecture videos
  uploadDocument, // For PDFs and documents
  uploadImage, // Generic image uploads
  memoryStorage, // Raw storage if you need custom multer instance
  diskStorage, // Raw storage for disk-based uploads
};

// Usage Examples:
//
// In your routes:
// import { uploadAvatar, uploadThumbnail, uploadVideo } from "./config/multer.js";
//
// Single file upload:
// router.post("/upload-avatar", uploadAvatar.single("avatar"), uploadController);
//
// Multiple files upload:
// router.post("/upload-lectures", uploadVideo.array("videos", 10), uploadController);
//
// Mixed fields:
// router.post("/create-course",
//   uploadThumbnail.fields([
//     { name: "thumbnail", maxCount: 1 },
//     { name: "materials", maxCount: 5 }
//   ]),
//   createCourseController
// );
//
// Accessing uploaded file in controller:
// const uploadController = (req, res) => {
//   const file = req.file; // For single file (.single())
//   const files = req.files; // For multiple files (.array() or .fields())
//
//   // File object structure:
//   // {
//   //   fieldname: 'avatar',
//   //   originalname: 'profile.jpg',
//   //   encoding: '7bit',
//   //   mimetype: 'image/jpeg',
//   //   buffer: <Buffer ...>, // File data (when using memoryStorage)
//   //   size: 123456 // File size in bytes
//   // }
//
//   // Upload to Cloudinary/S3:
//   // const result = await cloudinary.uploader.upload(file.buffer);
// };
