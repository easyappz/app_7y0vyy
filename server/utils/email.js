const nodemailer = require('nodemailer');

// Email configuration (hardcoded as per instructions)
const EMAIL_HOST = 'smtp.example.com';
const EMAIL_PORT = 587;
const EMAIL_USER = 'your-email@example.com';
const EMAIL_PASS = 'your-email-password';

// Create transporter
const transporter = nodemailer.createTransport({
  host: EMAIL_HOST,
  port: EMAIL_PORT,
  secure: false,
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS
  }
});

// Send email function
exports.sendEmail = async (to, subject, text) => {
  try {
    await transporter.sendMail({
      from: `"Prof-it Art School" <${EMAIL_USER}>`,
      to,
      subject,
      text
    });
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
};
