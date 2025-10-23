import multer from "multer";
import fs from "fs";
import fsp from "fs/promises";
import os from "os";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import "dotenv/config";


const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.AWS_BUCKET_NAME;
console.log(BUCKET)
const CLOUDFRONT_URL = process.env.CLOUDFRONT_URL;
console.log(CLOUDFRONT_URL)
const toPublicUrl = (key) => {
  if (!CLOUDFRONT_URL) {
    return `https://${BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
  }
  return `${CLOUDFRONT_URL.replace(/\/+$/, "")}/${key}`;
};

const sanitizeBase = (name) =>
  path
    .basename(name, path.extname(name))
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_-]/g, "");

const nowUid = () => `${Date.now()}-${uuidv4()}`;
const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, os.tmpdir()),
  filename: (req, file, cb) => {
    const safe = sanitizeBase(file.originalname);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${nowUid()}-${safe}${ext}`);
  },
});
const EXT_ALLOW =
  /\.(jpe?g|png|gif|webp|mp4|mov|avi|mkv|pdf|ppt|pptx|txt|mp3|wav|m4a|csv)$/i;

const MIME_ALLOW = new Set([
  // images
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  // video
  "video/mp4",
  "video/quicktime",
  "video/x-msvideo",
  "video/x-matroska",
  // docs
  "application/pdf",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  // audio
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/mp4",
  "audio/m4a",
    // CSV
  "text/csv",
  "application/vnd.ms-excel",
]);

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (EXT_ALLOW.test(ext) && MIME_ALLOW.has(file.mimetype))
    return cb(null, true);
  return cb(
    new multer.MulterError("LIMIT_UNEXPECTED_FILE", "Invalid file type")
  );
};
const MAX_FILE_SIZE = Number(
  process.env.UPLOAD_MAX_FILE_BYTES ?? 100 * 1024 * 1024
);

const createMulter = (maxFileSize = MAX_FILE_SIZE) =>
  multer({
    storage: diskStorage,
    fileFilter,
    limits: { fileSize: maxFileSize },
  });
const resolveFolder = (fieldname, mimetype) => {
  if (fieldname === "profileImage") return "users/profileImages";
  if (fieldname === "groupImage") return "users/groupImages";
  if (fieldname === "image") return "courses/images";
  if (fieldname === "previewVideo") return "courses/previews";
  if (fieldname === "downloadBrochure") return "courses/brochures";
  if (fieldname === "blogImage") return "blogs/coverImages";
  if (fieldname === "blogAImages") return "blogs/authorImages";
  if (/^content-image-\d+/.test(fieldname)) return "blogs/contentBlocks";
  if (/^course-image/.test(fieldname)) return "courses/contentBlocks";
  if (fieldname?.startsWith?.("content-image")) return "modules/images";
  if (fieldname?.startsWith?.("content-audio")) return "modules/audios";
  if (fieldname?.startsWith?.("content-video")) return "modules/videos";
  if (fieldname?.startsWith?.("content-pdf")) return "modules/pdfs";
  if (fieldname === "file" || fieldname === "files") {
    if (mimetype.startsWith("image/")) return "chats/images";
    if (mimetype.startsWith("video/")) return "chats/videos";
    if (mimetype.startsWith("audio/")) return "chats/audios";
    if (mimetype === "application/pdf") return "chats/pdfs";
    if (
      mimetype === "application/vnd.ms-powerpoint" ||
      mimetype ===
        "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    )
      return "chats/presentations";
    if (mimetype === "text/plain") return "chats/text";
    return "chats/others";
  }
  if (mimetype.startsWith("image/")) return "uploads/images";
  if (mimetype.startsWith("video/")) return "uploads/videos";
  if (mimetype.startsWith("audio/")) return "uploads/audios";
  if (mimetype === "application/pdf") return "uploads/pdfs";
  if (
    mimetype === "application/vnd.ms-powerpoint" ||
    mimetype ===
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  )
    return "uploads/presentations";
  if (mimetype === "text/plain") return "uploads/text";
if (fieldname === "paymentImage") return "payments/images"; 
  return "uploads/others";
};
export const getUploadMiddleware = (fieldConfig = null, maxFileSize) => {
  const instance = createMulter(maxFileSize);
  return fieldConfig ? instance.fields(fieldConfig) : instance.any();
};
export const uploadProfileImage = getUploadMiddleware(
  [{ name: "profileImage", maxCount: 1 }],
  MAX_FILE_SIZE
);
export const uploadGroupProfileImage = getUploadMiddleware(
  [{ name: "groupImage", maxCount: 1 }],
  MAX_FILE_SIZE
);
export const uploadChatSingle = getUploadMiddleware(
  [{ name: "file", maxCount: 1 }],
  MAX_FILE_SIZE
);
export const uploadChatMultiple = getUploadMiddleware(
  [{ name: "files", maxCount: 10 }],
  MAX_FILE_SIZE
);
export const uploadPaymentImage = getUploadMiddleware(
  [{ name: "paymentImage", maxCount: 1 }],
  MAX_FILE_SIZE
);
const cleanupAll = async (files = []) => {
  await Promise.allSettled(
    files
      .filter(Boolean)
      .map((f) => f.path)
      .map((p) => (p ? fsp.unlink(p) : Promise.resolve()))
  );
};
export const uploadChatAny = getUploadMiddleware(
  [
    { name: "file", maxCount: 1 }, 
    { name: "files", maxCount: 10 }, 
  ],
  MAX_FILE_SIZE
);
export const extractS3Uploads = async (req, res, next) => {
  if (!BUCKET) {
    return res.status(500).json({
      success: false,
      message: "S3 upload failed",
      error: "AWS_BUCKET_NAME is not set",
    });
  }

  const files = Array.isArray(req.files)
    ? req.files
    : Object.values(req.files || {}).flat();

  if (!files.length) {
    req.s3Uploads = [];
    return next();
  }

  const uploads = [];

  try {
    for (const file of files) {
      const folder = resolveFolder(file.fieldname, file.mimetype);
      const base = sanitizeBase(file.originalname);
      const ext = path
        .extname(file.originalname)
        .toLowerCase()
        .replace(/^\./, "");
      const key = `${folder}/${nowUid()}-${base}.${ext || "bin"}`;

      const bodyStream = fs.createReadStream(file.path);

      try {
        await s3.send(
          new PutObjectCommand({
            Bucket: BUCKET,
            Key: key,
            Body: bodyStream,
            ContentType: file.mimetype,
            CacheControl: "public, max-age=31536000",
          })
        );

        uploads.push({
          field: file.fieldname,
          key,
          url: toPublicUrl(key),
          originalName: file.originalname,
          type: file.mimetype,
          size: file.size,
        });
      } finally {
        try {
          await fsp.unlink(file.path);
        } catch {
        }
      }
    }

    req.s3Uploads = uploads;
    return next();
  } catch (err) {
    console.error("❌ S3 Upload Error:", err);
    await cleanupAll(files);
    return res.status(500).json({
      success: false,
      message: "S3 upload failed",
      error: err?.message || "Unknown error",
    });
  }
};
export const extractKeyFromUrl = (url = "") => {
  try {
    const u = new URL(url);
    return u.pathname.replace(/^\/+/, "");
  } catch {
    return null;
  }
};

export const deleteFromS3 = async (key) => {
  if (!key) return;
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
};
export default {
  getUploadMiddleware,
  uploadChatAny,
  uploadProfileImage,
  extractS3Uploads,
  uploadPaymentImage,
  uploadGroupProfileImage
};