// File storage in MongoDB GridFS: durable across deploys (no local disk),
// zero extra infrastructure. Images are normalised with sharp before saving:
// auto-rotated, resized, re-encoded to WebP and stripped of EXIF/GPS data.
const mongoose = require("mongoose");
const sharp = require("sharp");
const { badRequest, notFound } = require("../lib/http");

const PRESETS = {
  avatar: { size: 512, cover: true, private: false },
  listing: { size: 1600, private: false },
  receipt: { size: 2000, private: true },
  attachment: { size: 2000, private: true },
};

const bucket = () => new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: "uploads" });
const ID_RE = /^[a-f0-9]{24}$/;

async function processImage(buffer, preset) {
  try {
    const img = sharp(buffer, { failOn: "error", limitInputPixels: 50_000_000 }).rotate();
    const resized = preset.cover
      ? img.resize(preset.size, preset.size, { fit: "cover", position: "attention" })
      : img.resize(preset.size, preset.size, { fit: "inside", withoutEnlargement: true });
    const { data, info } = await resized.webp({ quality: 82, effort: 4 }).toBuffer({ resolveWithObject: true });
    return { data, contentType: "image/webp", width: info.width, height: info.height };
  } catch {
    throw badRequest("That image couldn't be read. Try a different JPG, PNG or WEBP file.");
  }
}

/**
 * Stores an uploaded file. `file` is a multer memory file whose type has
 * already been verified by magic bytes. Returns { id, url, contentType }.
 */
async function storeUpload(file, { kind, home, owner }) {
  const preset = PRESETS[kind];
  if (!preset) throw new Error(`Unknown upload kind ${kind}`);
  const isPdf = file.mimetype === "application/pdf";
  const out = isPdf ? { data: file.buffer, contentType: "application/pdf" } : await processImage(file.buffer, preset);
  const id = new mongoose.Types.ObjectId();
  await new Promise((resolve, reject) => {
    const stream = bucket().openUploadStreamWithId(id, `${kind}-${id}`, {
      metadata: { kind, home: home || null, owner: owner || null, private: preset.private, contentType: out.contentType, width: out.width, height: out.height, size: out.data.length },
    });
    stream.on("error", reject).on("finish", resolve);
    stream.end(out.data);
  });
  return { id: String(id), url: `/api/files/${id}`, contentType: out.contentType };
}

const idFromUrl = (url) => {
  const m = /\/api\/files\/([a-f0-9]{24})$/.exec(url || "");
  return m ? m[1] : null;
};

async function findFile(id) {
  if (!ID_RE.test(id)) throw notFound("File not found");
  const [file] = await bucket().find({ _id: new mongoose.Types.ObjectId(id) }).limit(1).toArray();
  if (!file) throw notFound("File not found");
  return file;
}

function streamFile(file, res) {
  res.setHeader("Content-Type", file.metadata?.contentType || "application/octet-stream");
  res.setHeader("Content-Length", file.length);
  res.setHeader("X-Content-Type-Options", "nosniff");
  // File ids never change content, so public files can be cached forever.
  res.setHeader("Cache-Control", file.metadata?.private ? "private, max-age=3600" : "public, max-age=31536000, immutable");
  if (file.metadata?.contentType === "application/pdf") res.setHeader("Content-Disposition", "inline");
  return new Promise((resolve, reject) => {
    bucket().openDownloadStream(file._id).on("error", reject).on("end", resolve).pipe(res);
  });
}

/** Deletes a stored file by its /api/files/<id> url (no-op for other urls). */
async function deleteByUrl(url) {
  const id = idFromUrl(url);
  if (!id) return;
  await bucket().delete(new mongoose.Types.ObjectId(id)).catch(() => {});
}

module.exports = { storeUpload, findFile, streamFile, deleteByUrl, idFromUrl, PRESETS };
