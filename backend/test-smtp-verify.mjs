import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '.env');
dotenv.config({ path: envPath });

const rawPass = process.env.SMTP_PASS || '';
const cleanPass = rawPass.replace(/^["']|["']$/g, '').replace(/\s+/g, '');

console.log('Host:', process.env.SMTP_HOST);
console.log('Port:', process.env.SMTP_PORT);
console.log('User:', process.env.SMTP_USER ? `${process.env.SMTP_USER.slice(0, 3)}***@...` : 'undefined');
console.log('Password length:', cleanPass.length);

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: cleanPass,
  },
  connectionTimeout: 10000,
});

try {
  await transporter.verify();
  console.log('🎉 SMTP VERIFICATION SUCCESS: Connected & Authenticated with Gmail SMTP successfully!');
} catch (err) {
  console.log('❌ SMTP VERIFICATION FAILED:', err.message);
}

