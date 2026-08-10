// scripts/test_smtp_resend.js
// Testa SMTP Resend via nodemailer.
// Usage:
//   npm install nodemailer
//   RESEND_SMTP_PASS=sk_xxx TEST_TO=seu@dominio.com SENDER_EMAIL=no-reply@send.phmsdev.com.br node scripts/test_smtp_resend.js

import nodemailer from 'nodemailer';
import assert from 'assert';

const {
  RESEND_SMTP_USER = 'resend',
  RESEND_SMTP_PASS,
  SENDER_EMAIL = 'no-reply@send.phmsdev.com.br',
  TEST_TO
} = process.env;

assert(RESEND_SMTP_PASS, 'RESEND_SMTP_PASS required (Resend API key)');
assert(TEST_TO, 'TEST_TO required (recipient email)');

const transporter = nodemailer.createTransport({
  host: 'smtp.resend.com',
  port: 587,
  secure: false,
  auth: {
    user: RESEND_SMTP_USER,
    pass: RESEND_SMTP_PASS
  }
});

async function main() {
  await transporter.verify();
  console.log('SMTP verified');
  const info = await transporter.sendMail({
    from: SENDER_EMAIL,
    to: TEST_TO,
    subject: 'Teste SMTP - Qualivida',
    text: 'Teste SMTP via Resend'
  });
  console.log('Message sent:', info.messageId || info.response);
}

main().catch(err => {
  console.error('SMTP test failed', err);
  process.exit(1);
});

