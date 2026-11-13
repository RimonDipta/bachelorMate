// Secure uploads: size limit, MIME allow-list, magic-byte verification, then
// processing + durable storage in GridFS (see services/storage.js).
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const env = require("../config/env");
const { badRequest } = require("../lib/http");
const { storeUpload } = require("../services/storage");

const TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

// Magic-byte check so a renamed file cannot masquerade as an image.
function sniff(buf) {
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.slice(0, 8).toString("hex") === "89504e470d0a1a0a") return "image/png";
  if (buf.slice(0, 4).toString() === "RIFF" && buf.slice(8, 12).toString() === "WEBP") return "image/webp";
  if (buf.slice(0, 5).toString() === "%PDF-") return "application/pdf";
  return null;
}

/**
 * makeUploader(kind, { allowPdf }) → (field) => middleware array.
 * After it runs, req.file.url holds the stored file's URL (/api/files/<id>).
 */
const makeUploader = (kind, { allowPdf = false } = {}) => {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, cb) => {
      const ok = TYPES.includes(file.mimetype) && (allowPdf || file.mimetype !== "application/pdf");
      cb(ok ? null : badRequest(allowPdf ? "Only JPG, PNG, WEBP or PDF files are allowed" : "Only JPG, PNG or WEBP images are allowed"), Boolean(ok));
    },
  });

  return (field) => [
    upload.single(field),
    async (req, _res, next) => {
      if (!req.file) return next();
      const real = sniff(req.file.buffer);
      if (!real || real !== req.file.mimetype) throw badRequest("File content does not match its type");
      const stored = await storeUpload(req.file, { kind, home: req.home?._id, owner: req.user?._id });
      req.file.url = stored.url;
      req.file.storedPath = stored.url; // kept for older call sites
      req.file.buffer = undefined; // free memory early
      next();
    },
  ];
};

/** Removes a legacy disk upload (pre-GridFS paths like "avatars/x.jpg"). */
const removeUpload = async (storedPath) => {
  if (!storedPath || storedPath.startsWith("/api/")) return;
  const safe = path.normalize(storedPath).replace(/^(\.\.[/\\])+/, "");
  await fs.promises.unlink(path.join(env.UPLOAD_DIR, safe)).catch(() => {});
};

module.exports = { makeUploader, removeUpload };
