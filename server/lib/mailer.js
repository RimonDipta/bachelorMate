// Email delivery. Uses SMTP when configured; otherwise logs the email (dev) or
// stores it in an in-memory outbox (tests) so flows remain fully usable.
const nodemailer = require("nodemailer");
const env = require("../config/env");

let transporter = null;
if (env.SMTP_HOST) {
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });
}

const outbox = [];

const layout = (title, body, cta) => `
<div style="font-family:Inter,Segoe UI,Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#18181b">
  <div style="font-weight:700;font-size:18px;margin-bottom:24px">BachelorMate</div>
  <h1 style="font-size:20px;margin:0 0 12px">${title}</h1>
  <div style="font-size:14px;line-height:1.6;color:#3f3f46">${body}</div>
  ${cta ? `<a href="${cta.url}" style="display:inline-block;margin-top:20px;background:#6d28d9;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px">${cta.label}</a>
  <p style="font-size:12px;color:#71717a;margin-top:20px">Or open this link: ${cta.url}</p>` : ""}
</div>`;

async function sendMail({ to, subject, title, body, cta }) {
  const message = { from: env.MAIL_FROM, to, subject, html: layout(title || subject, body, cta), text: `${body.replace(/<[^>]+>/g, "")}${cta ? `\n\n${cta.url}` : ""}` };
  if (env.isTest) {
    outbox.push({ ...message, cta });
    return;
  }
  if (!transporter) {
    console.log(`[mail:dev] To: ${to} | ${subject}${cta ? ` | ${cta.url}` : ""}`);
    return;
  }
  try {
    await transporter.sendMail(message);
  } catch (err) {
    // Email failures must never break the user-facing request.
    console.error("Email send failed:", err.message);
  }
}

module.exports = { sendMail, outbox, layout };
