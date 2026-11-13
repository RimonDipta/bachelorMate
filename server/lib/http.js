// HTTP helpers: typed errors and zod-backed request validation.
const { z } = require("zod");
const mongoose = require("mongoose");

class HttpError extends Error {
  constructor(status, message, details, code) {
    super(message);
    this.status = status;
    this.details = details;
    this.code = code; // machine-readable reason, e.g. EMAIL_NOT_VERIFIED
  }
}

const badRequest = (msg, details, code) => new HttpError(400, msg, details, code);
const unauthorized = (msg = "Authentication required") => new HttpError(401, msg);
const forbidden = (msg = "You do not have permission to do this") => new HttpError(403, msg);
const notFound = (msg = "Not found") => new HttpError(404, msg);
const conflict = (msg) => new HttpError(409, msg);

/**
 * validate({ body, query, params }) – parses each part with its zod schema and
 * stores the result on req.v so handlers never touch unvalidated input.
 */
const validate = (schemas) => (req, res, next) => {
  req.v = req.v || {};
  for (const part of ["params", "query", "body"]) {
    if (!schemas[part]) continue;
    const result = schemas[part].safeParse(req[part] ?? {});
    if (!result.success) {
      const details = result.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      }));
      return next(badRequest(details[0]?.message ? `${details[0].path ? details[0].path + ": " : ""}${details[0].message}` : "Invalid input", details));
    }
    req.v[part] = result.data;
  }
  next();
};

const objectId = z
  .string()
  .refine((v) => mongoose.isValidObjectId(v), { message: "Invalid id" });

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

// Money in major units as number or string ("120.50") -> validated later by toMinor.
const moneyInput = z.union([z.number(), z.string().trim()]);

module.exports = {
  HttpError,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  validate,
  z,
  objectId,
  day,
  moneyInput,
};
