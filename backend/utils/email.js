// backend/utils/email.js
//
// Thin nodemailer wrapper. If SMTP isn't configured (e.g. local dev without
// a mail server), sendEmail() just logs instead of throwing, so email being
// unavailable never breaks the actual request that triggered it.
//
// Required env vars in production:
//   SMTP_HOST, SMTP_PORT, SMTP_SECURE ('true'/'false'), SMTP_USER, SMTP_PASS,
//   EMAIL_FROM (e.g. "BookHarbour <no-reply@bookharbour.com>")

const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST) return null;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
  return transporter;
}

async function sendEmail({ to, subject, text, html }) {
  if (!to) return;
  const t = getTransporter();
  if (!t) {
    console.log(`[email disabled — SMTP_HOST not set] would send to ${to}: "${subject}" — ${text}`);
    return;
  }
  await t.sendMail({
    from: process.env.EMAIL_FROM || 'BookHarbour <no-reply@bookharbour.com>',
    to,
    subject,
    text,
    html,
  });
}

module.exports = { sendEmail };