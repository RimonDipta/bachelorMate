// Email delivery (first match wins):
//   BREVO_API_KEY  → Brevo HTTP API — works WITHOUT owning a domain (verify a single sender address)
//   RESEND_API_KEY → Resend HTTP API — needs a verified domain to email anyone
//   SMTP_HOST      → any SMTP provider via nodemailer (e.g. Gmail with an app password)
//   none           → logged to the console (dev) / stored in `outbox` (tests)
// Sending never throws into the request that triggered it.
const nodemailer = require("nodemailer");
const env = require("../config/env");

let transporter = null;
if (!env.BREVO_API_KEY && !env.RESEND_API_KEY && env.SMTP_HOST) {
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });
}

const provider = () => (env.BREVO_API_KEY ? "brevo" : env.RESEND_API_KEY ? "resend" : transporter ? "smtp" : env.isTest ? "test" : "console");
const outbox = [];

/** "BachelorMate <me@gmail.com>" → { name: "BachelorMate", email: "me@gmail.com" } */
function parseAddress(value) {
  const m = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(value || "");
  if (m) return { name: m[1].trim() || undefined, email: m[2].trim() };
  return { email: String(value || "").trim() };
}

/** Builds the Brevo transactional-email request body (exported for tests). */
function brevoPayload({ to, subject, html, text }) {
  const replyTo = env.MAIL_REPLY_TO ? parseAddress(env.MAIL_REPLY_TO) : undefined;
  return { sender: parseAddress(env.MAIL_FROM), to: [{ email: to }], subject, htmlContent: html, textContent: text, ...(replyTo ? { replyTo } : {}) };
}

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/** Responsive, client-safe HTML email (tables + inline styles). `body` is trusted HTML built by the server. */
function layout({ title, body, cta, code, footer }) {
  const brand = "#6d4bf0";
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:#f4f2ee;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;color:#18171c">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f2ee;padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;border:1px solid #e8e5df">
<tr><td style="padding:28px 32px 8px">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
    <td style="width:30px;height:30px;border-radius:9px;background:${brand};color:#fff;font-weight:700;font-size:15px;text-align:center;vertical-align:middle">B</td>
    <td style="padding-left:10px;font-weight:700;font-size:16px;letter-spacing:-0.02em">BachelorMate</td>
  </tr></table>
</td></tr>
<tr><td style="padding:16px 32px 4px"><h1 style="margin:0;font-size:22px;line-height:1.25;letter-spacing:-0.02em;color:#18171c">${esc(title)}</h1></td></tr>
<tr><td style="padding:10px 32px 0;font-size:15px;line-height:1.65;color:#4a4752">${body}</td></tr>
${code ? `<tr><td style="padding:22px 32px 0"><div style="font-family:SFMono-Regular,Menlo,Consolas,monospace;font-size:32px;font-weight:700;letter-spacing:10px;text-align:center;background:#f4f2ee;border-radius:12px;padding:16px 8px;color:#18171c">${esc(code)}</div></td></tr>` : ""}
${cta ? `<tr><td style="padding:24px 32px 0"><a href="${esc(cta.url)}" style="display:inline-block;background:${brand};color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:10px">${esc(cta.label)}</a></td></tr>
<tr><td style="padding:16px 32px 0;font-size:12px;line-height:1.6;color:#8a8794">Button not working? Paste this link into your browser:<br><a href="${esc(cta.url)}" style="color:${brand};word-break:break-all">${esc(cta.url)}</a></td></tr>` : ""}
<tr><td style="padding:28px 32px 28px"><div style="border-top:1px solid #eeebe6;padding-top:16px;font-size:12px;line-height:1.6;color:#8a8794">${footer || "You're receiving this because of activity on your BachelorMate account. You can change email preferences in Settings → Notifications."}</div></td></tr>
</table></td></tr></table></body></html>`;
}

const toText = ({ title, body, cta, code }) =>
  [title, "", body.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&"), code ? `\nCode: ${code}` : "", cta ? `\n${cta.label}: ${cta.url}` : ""].join("\n");

/**
 * sendMail({ to, subject, title?, body, cta?, code?, footer? }) – resolves to
 * { ok, provider, id?, error? }. Never rejects.
 */
async function sendMail(msg) {
  const content = { title: msg.title || msg.subject, body: msg.body, cta: msg.cta, code: msg.code, footer: msg.footer };
  const html = layout(content);
  const text = toText(content);
  const p = provider();
  try {
    if (p === "test") {
      outbox.push({ to: msg.to, subject: msg.subject, html, text, cta: msg.cta, code: msg.code });
      return { ok: true, provider: p };
    }
    if (p === "console") {
      console.log(`[mail:dev] To: ${msg.to} | ${msg.subject}${msg.code ? ` | code ${msg.code}` : ""}${msg.cta ? ` | ${msg.cta.url}` : ""}`);
      return { ok: true, provider: p };
    }
    if (p === "brevo") {
      const res = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": env.BREVO_API_KEY, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(brevoPayload({ to: msg.to, subject: msg.subject, html, text })),
        signal: AbortSignal.timeout(10000),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || `Brevo responded ${res.status}`);
      return { ok: true, provider: p, id: data.messageId };
    }
    if (p === "resend") {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: env.MAIL_FROM, to: [msg.to], subject: msg.subject, html, text, reply_to: env.MAIL_REPLY_TO || undefined }),
        signal: AbortSignal.timeout(10000),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || `Resend responded ${res.status}`);
      return { ok: true, provider: p, id: data.id };
    }
    const info = await transporter.sendMail({ from: env.MAIL_FROM, to: msg.to, subject: msg.subject, html, text, replyTo: env.MAIL_REPLY_TO || undefined });
    return { ok: true, provider: p, id: info.messageId };
  } catch (err) {
    console.error(`Email to ${msg.to} failed (${p}):`, err.message);
    return { ok: false, provider: p, error: err.message };
  }
}

module.exports = { sendMail, outbox, layout, provider, esc, parseAddress, brevoPayload };
