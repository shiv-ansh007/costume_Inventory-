/**
 * ============================================================================
 * NODEMAILER SMTP TRANSPORTER CONFIGURATION
 * ============================================================================
 * Connects to Gmail's SMTP server (smtp.gmail.com on port 587 with TLS).
 * Credentials (EMAIL_USER, EMAIL_PASS) are dynamically loaded from process.env.
 * 
 * Free Gmail SMTP setup:
 * 1. Turn on 2-Step Verification in your Google Account.
 * 2. Generate an App Password at: https://myaccount.google.com/apppasswords
 * 3. Set EMAIL_USER and EMAIL_PASS in your .env file.
 */

const nodemailer = require('nodemailer');

// ─── Default Sender Placeholder ──────────────────────────────────────────────
// Fallback email address placeholder if EMAIL_FROM or EMAIL_USER is not specified
const DEFAULT_SENDER_EMAIL = 'your-email@gmail.com'; // <-- REPLACE with your sender email
const DEFAULT_SENDER_NAME = 'Costume Rental Support';

// ─── Transporter Setup ───────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // true for port 465, false for 587 (uses STARTTLS)
  auth: {
    user: process.env.EMAIL_USER || DEFAULT_SENDER_EMAIL,
    pass: process.env.EMAIL_PASS || 'your-gmail-app-password',
  },
  tls: {
    rejectUnauthorized: true, // Enforce valid TLS certificate
    ciphers: 'SSLv3',
  },
});

/**
 * Helper to get default 'from' header
 */
const getDefaultFrom = () => {
  const senderEmail = process.env.EMAIL_USER || DEFAULT_SENDER_EMAIL;
  return process.env.EMAIL_FROM || `"${DEFAULT_SENDER_NAME}" <${senderEmail}>`;
};

/**
 * Verify SMTP connection configuration
 * Useful during startup or on-demand health check
 */
const verifyConnection = async () => {
  try {
    await transporter.verify();
    console.log('[SMTP] Gmail SMTP transporter is ready to dispatch emails.');
    return { success: true };
  } catch (error) {
    console.warn('[SMTP Warning] Gmail SMTP verification failed:', error.message);
    return { success: false, error: error.message };
  }
};

module.exports = {
  transporter,
  getDefaultFrom,
  verifyConnection,
  DEFAULT_SENDER_EMAIL,
};
