/*
 * Sends a test email with your current mail settings.
 *   npm run mail:test -- you@example.com
 */
const env = require("../config/env");
const { sendMail, provider } = require("../lib/mailer");

(async () => {
  const to = process.argv[2];
  if (!to || !to.includes("@")) {
    console.error("Usage: npm run mail:test -- you@example.com");
    process.exit(1);
  }
  console.log(`Provider: ${provider()}  ·  From: ${env.MAIL_FROM}`);
  if (provider() === "console") console.log("No RESEND_API_KEY or SMTP_HOST set — the email will only be printed below.");
  const result = await sendMail({
    to,
    subject: "BachelorMate test email ✓",
    title: "Your email setup works",
    body: "If you can read this in your inbox, BachelorMate can send verification codes, password resets and invitations.",
    code: "123456",
    cta: { label: "Open BachelorMate", url: env.CLIENT_URL },
  });
  console.log(result.ok ? `Sent ✓ ${result.id ? `(id ${result.id})` : ""}` : `Failed: ${result.error}`);
  process.exit(result.ok ? 0 : 1);
})();
