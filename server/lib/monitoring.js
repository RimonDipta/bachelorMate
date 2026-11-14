// Error monitoring. Every server error and client crash is logged as one JSON
// line with a short reference id (shown to the user, so they can quote it).
// If SENTRY_DSN is set, the same errors also go to Sentry (free plan is enough).
const crypto = require("crypto");
const env = require("../config/env");

let Sentry = null;
if (env.SENTRY_DSN && !env.isTest) {
  Sentry = require("@sentry/node");
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    release: env.RELEASE,
    tracesSampleRate: 0, // errors only — stays well inside the free quota
    sendDefaultPii: false,
    beforeSend(event) {
      // Never send cookies, auth headers or request bodies.
      if (event.request) {
        delete event.request.cookies;
        delete event.request.data;
        if (event.request.headers) {
          delete event.request.headers.authorization;
          delete event.request.headers.cookie;
        }
      }
      return event;
    },
  });
}

const newRef = () => crypto.randomBytes(4).toString("hex");

function log(level, payload) {
  if (env.isTest) return;
  const line = JSON.stringify({ level, time: new Date().toISOString(), release: env.RELEASE, ...payload });
  (level === "error" ? console.error : console.warn)(line);
}

/** A server-side error (500s, crashes, failed background jobs). Returns the reference id. */
function reportError(err, context = {}) {
  const ref = context.ref || newRef();
  log("error", { kind: "server", ref, message: err?.message, stack: err?.stack, ...context });
  if (Sentry) {
    Sentry.withScope((scope) => {
      scope.setTag("ref", ref);
      Object.entries(context).forEach(([k, v]) => scope.setExtra(k, v));
      if (context.userId) scope.setUser({ id: String(context.userId) });
      Sentry.captureException(err);
    });
  }
  return ref;
}

/** A crash reported by the browser app. */
function reportClientError(report, context = {}) {
  const ref = newRef();
  log("error", { kind: "client", ref, ...report, ...context });
  if (Sentry) {
    Sentry.withScope((scope) => {
      scope.setTag("source", "client");
      scope.setTag("ref", ref);
      scope.setExtras({ ...report, ...context });
      if (context.userId) scope.setUser({ id: String(context.userId) });
      const e = new Error(report.message);
      e.name = report.name || "ClientError";
      if (report.stack) e.stack = report.stack;
      Sentry.captureException(e);
    });
  }
  return ref;
}

const flush = () => (Sentry ? Sentry.flush(2000) : Promise.resolve(true));

module.exports = { reportError, reportClientError, flush, newRef, enabled: () => Boolean(Sentry) };
