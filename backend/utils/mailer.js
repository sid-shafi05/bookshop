// backend/utils/mailer.js
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

async function sendEmail(to, subject, text) {
  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'BookHarbour <no-reply@bookharbour.com>',
    to, subject, text,
  });
}

module.exports = sendEmail;