const env = require("../config/env");
const { HttpError } = require("../lib/http");
const { reportError } = require("../lib/monitoring");

const notFound = (req, res) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
};

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, _next) => {
  let status = 500;
  let message = "Something went wrong";
  let details;
  let code;

  if (err instanceof HttpError) {
    status = err.status;
    message = err.message;
    details = err.details;
    code = err.code;
  } else if (err.name === "ValidationError") {
    status = 400;
    message = Object.values(err.errors)[0]?.message || "Invalid data";
  } else if (err.name === "CastError") {
    status = 400;
    message = "Invalid identifier";
  } else if (err.code === 11000) {
    status = 409;
    message = "This record already exists";
  } else if (err.name === "MulterError") {
    status = 400;
    message = err.code === "LIMIT_FILE_SIZE" ? `File is too large (max ${env.MAX_UPLOAD_MB} MB)` : err.message;
  } else if (err.type === "entity.parse.failed") {
    status = 400;
    message = "Malformed JSON body";
  } else if (err.type === "entity.too.large") {
    status = 413;
    message = "Request body too large";
  }

  // Server faults get a short reference id the user can quote when reporting a problem.
  let ref;
  if (status >= 500) {
    ref = reportError(err, { method: req.method, path: req.originalUrl.split("?")[0], userId: req.user?._id });
    message = `Something went wrong on our side (ref ${ref}). Please try again.`;
  }
  // Internal error details are never leaked to clients.
  res.status(status).json({ message, ...(code ? { code } : {}), ...(details ? { details } : {}), ...(ref ? { ref } : {}) });
};

module.exports = { notFound, errorHandler };
