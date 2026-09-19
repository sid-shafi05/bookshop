// backend/test_email.js
const nodemailer = require('nodemailer');
require('dotenv').config();

async function testEmail() {
  console.log('--- Testing Email Setup ---');
  console.log('SMTP_USER:', process.env.SMTP_USER);
  console.log('SMTP_PASS length:', process.env.SMTP_PASS ? process.env.SMTP_PASS.trim().length : 0);

  // Using Gmail's official preset (most reliable)
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.SMTP_USER ? process.env.SMTP_USER.trim() : '',
      pass: process.env.SMTP_PASS ? process.env.SMTP_PASS.trim() : '',
    },
  });

  try {
    console.log('Verifying connection with Google...');
    await transporter.verify();
    console.log('✅ Google accepted your login credentials!');

    console.log('Sending test email to yourself...');
    const info = await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: process.env.SMTP_USER, // Sends email to your own address as a test
      subject: 'Bookstore SMTP Test',
      text: 'If you see this, email sending is working!',
    });

    console.log('✅ Test email delivered successfully! Message ID:', info.messageId);
  } catch (err) {
    console.error('❌ Google Error Details:\n', err.message);
  }
}

testEmail();