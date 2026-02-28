import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";
import path from "path";

// Initialize S3 Client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// S3 Bucket Name from environment
const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME;

// Generate unique filename to prevent collisions
const generateUniqueFilename = (originalFilename) => {
  const timestamp = Date.now();
  const randomString = crypto.randomBytes(8).toString("hex");
  const ext = path.extname(originalFilename);
  const nameWithoutExt = path.basename(originalFilename, ext);

  // Sanitize filename: remove special chars, spaces -> hyphens
  const sanitized = nameWithoutExt.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();

  return `${sanitized}-${timestamp}-${randomString}${ext}`;
};

// Get content type based on file extension
const getContentType = (filename) => {
  const ext = path.extname(filename).toLowerCase();

  const contentTypes = {
    // Images
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",

    // Videos
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".ogg": "video/ogg",
    ".mov": "video/quicktime",
    ".avi": "video/x-msvideo",

    // Documents
    ".pdf": "application/pdf",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".txt": "text/plain",
  };

  return contentTypes[ext] || "application/octet-stream";
};

/**
 * Upload file to S3
 * @param {Buffer} fileBuffer - File data from multer (req.file.buffer)
 * @param {string} originalFilename - Original filename
 * @param {string} folder - Folder path in S3 (e.g., "avatars", "courses/thumbnails")
 * @returns {Promise<{key: string, url: string, bucket: string}>}
 */
export const uploadToS3 = async (fileBuffer, originalFilename, folder = "") => {
  try {
    const filename = generateUniqueFilename(originalFilename);
    const key = folder ? `${folder}/${filename}` : filename;
    const contentType = getContentType(originalFilename);

    const uploadParams = {
      Bucket: BUCKET_NAME,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
      // ACL: "public-read", // Uncomment if you want files publicly accessible
    };

    // For small files (< 5MB), use PutObjectCommand
    if (fileBuffer.length < 5 * 1024 * 1024) {
      const command = new PutObjectCommand(uploadParams);
      await s3Client.send(command);
    } else {
      // For large files (>= 5MB), use multipart upload
      const upload = new Upload({
        client: s3Client,
        params: uploadParams,
        queueSize: 4, // Concurrent uploads
        partSize: 5 * 1024 * 1024, // 5 MB per part
      });

      await upload.done();
    }

    // Construct the public URL
    const url = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || "us-east-1"}.amazonaws.com/${key}`;

    return {
      key,
      url,
      bucket: BUCKET_NAME,
    };
  } catch (error) {
    console.error("S3 Upload Error:", error);
    throw new Error(`Failed to upload file to S3: ${error.message}`);
  }
};

/**
 * Delete file from S3
 * @param {string} key - S3 object key (file path)
 * @returns {Promise<boolean>}
 */
export const deleteFromS3 = async (key) => {
  try {
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    await s3Client.send(command);
    return true;
  } catch (error) {
    console.error("S3 Delete Error:", error);
    throw new Error(`Failed to delete file from S3: ${error.message}`);
  }
};

/**
 * Delete file from S3 using full URL
 * @param {string} url - Full S3 URL
 * @returns {Promise<boolean>}
 */
export const deleteFromS3ByUrl = async (url) => {
  try {
    // Extract key from URL
    // Example URL: https://my-bucket.s3.us-east-1.amazonaws.com/avatars/file-123.jpg
    const urlParts = new URL(url);
    const key = urlParts.pathname.substring(1); // Remove leading slash

    return await deleteFromS3(key);
  } catch (error) {
    console.error("S3 Delete By URL Error:", error);
    throw new Error(`Failed to delete file from S3: ${error.message}`);
  }
};

/**
 * Generate presigned URL for private files (temporary access)
 * Useful for private videos that only enrolled students can access
 * @param {string} key - S3 object key
 * @param {number} expiresIn - URL expiration time in seconds (default: 1 hour)
 * @returns {Promise<string>} - Presigned URL
 */
export const getPresignedUrl = async (key, expiresIn = 3600) => {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn });
    return url;
  } catch (error) {
    console.error("Presigned URL Error:", error);
    throw new Error(`Failed to generate presigned URL: ${error.message}`);
  }
};

/**
 * Upload multiple files to S3
 * @param {Array<{buffer: Buffer, originalname: string}>} files - Array of file objects from multer
 * @param {string} folder - Folder path in S3
 * @returns {Promise<Array<{key: string, url: string, bucket: string}>>}
 */
export const uploadMultipleToS3 = async (files, folder = "") => {
  try {
    const uploadPromises = files.map((file) =>
      uploadToS3(file.buffer, file.originalname, folder)
    );

    return await Promise.all(uploadPromises);
  } catch (error) {
    console.error("Multiple Upload Error:", error);
    throw new Error(`Failed to upload multiple files: ${error.message}`);
  }
};

// Export S3 client for advanced usage
export { s3Client };

// Helper: Extract S3 key from full URL
export const extractKeyFromUrl = (url) => {
  try {
    const urlParts = new URL(url);
    return urlParts.pathname.substring(1); // Remove leading slash
  } catch (error) {
    throw new Error("Invalid S3 URL");
  }
};

// Predefined folder paths for organization
export const S3_FOLDERS = {
  AVATARS: "avatars",
  COURSE_THUMBNAILS: "courses/thumbnails",
  LECTURE_VIDEOS: "lectures/videos",
  COURSE_MATERIALS: "courses/materials",
  CERTIFICATES: "certificates",
};

// Usage Examples:
//
// 1. Upload Avatar:
// import { uploadToS3, S3_FOLDERS } from "./config/s3.js";
//
// const result = await uploadToS3(
//   req.file.buffer,
//   req.file.originalname,
//   S3_FOLDERS.AVATARS
// );
// // Returns: { key: "avatars/profile-123456.jpg", url: "https://...", bucket: "..." }
//
// 2. Upload Video:
// const result = await uploadToS3(
//   req.file.buffer,
//   req.file.originalname,
//   S3_FOLDERS.LECTURE_VIDEOS
// );
//
// 3. Delete File:
// await deleteFromS3("avatars/profile-123456.jpg");
// // or
// await deleteFromS3ByUrl("https://my-bucket.s3.amazonaws.com/avatars/profile-123456.jpg");
//
// 4. Get Presigned URL (for private videos):
// const privateUrl = await getPresignedUrl("lectures/videos/video-123.mp4", 3600);
// // URL expires in 1 hour
