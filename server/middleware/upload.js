// Secure uploads: random file names, MIME + extension allow-list, size limit.
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const env = require("../config/env");
const { randomToken } = require("../lib/security");
const { badRequest } = require("../lib/http");

const TYPES = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
};

// Magic-byte check so a renamed file cannot masquerade as an image.
function sniff(buf) {
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.slice(0, 8).toString("hex") === "89504e470d0a1a0a") return "image/png";
  if (buf.slice(0, 4).toString() === "RIFF" && buf.slice(8, 12).toString() === "WEBP") return "image/webp";
  if (buf.slice(0, 5).toString() === "%PDF-") return "application/pdf";
  return null;
}

const makeUploader = (folder, { allowPdf = false } = {}) => {
  const dir = path.join(env.UPLOAD_DIR, folder);
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, cb) => {
      const ok = TYPES[file.mimetype] && (allowPdf || file.mimetype !== "application/pdf");
      cb(ok ? null : badRequest(allowPdf ? "Only JPG, PNG, WEBP or PDF files are allowed" : "Only JPG, PNG or WEBP images are allowed"), Boolean(ok));
    },
  });

  // Returns middleware that parses `field` and writes the file to disk.
  return (field) => [
    upload.single(field),
    async (req, _res, next) => {
      if (!req.file) return next();
      const real = sniff(req.file.buffer);
      if (!real || real !== req.file.mimetype) throw badRequest("File content does not match its type");
      await fs.promises.mkdir(dir, { recursive: true });
      const name = `${randomToken(18)}${TYPES[real]}`;
      await fs.promises.writeFile(path.join(dir, name), req.file.buffer);
      req.file.storedName = name;
      req.file.storedPath = `${folder}/${name}`;
      next();
    },
  ];
};

const removeUpload = async (storedPath) => {
  if (!storedPath) return;
  const safe = path.normalize(storedPath).replace(/^(\.\.[/\\])+/, "");
  await fs.promises.unlink(path.join(env.UPLOAD_DIR, safe)).catch(() => {});
};

module.exports = { makeUploader, removeUpload };
