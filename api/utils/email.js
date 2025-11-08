const nodemailer = require('nodemailer');

// Create a transporter object using SMTP transport
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: process.env.EMAIL_PORT == 465, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * Sends a password reset email to a user.
 * @param {string} to The recipient's email address.
 * @param {string} token The password reset token.
 */
const sendPasswordResetEmail = async (to, token) => {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: to,
    subject: 'Your Password Reset Request',
    text: `You are receiving this email because you (or someone else) have requested the reset of the password for your account.\n\n           Please click on the following link, or paste this into your browser to complete the process:\n\n           ${resetUrl}\n\n           If you did not request this, please ignore this email and your password will remain unchanged.\n`,
    html: `<p>You are receiving this email because you (or someone else) have requested the reset of the password for your account.</p>
           <p>Please click on the following link, or paste this into your browser to complete the process:</p>
           <p><a href="${resetUrl}">${resetUrl}</a></p>
           <p>If you did not request this, please ignore this email and your password will remain unchanged.</p>`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`[EMAIL] Password reset email sent to ${to}`);
  } catch (error) {
    console.error(`[EMAIL] Error sending password reset email to ${to}:`, error);
    // In a real app, you might want to handle this more gracefully
    throw new Error('Failed to send password reset email.');
  }
};

module.exports = {
  sendPasswordResetEmail,
};
