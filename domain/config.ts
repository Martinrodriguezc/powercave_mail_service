import nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const transporter: Transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: false,
    requireTLS: true, 
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
    connectionTimeout: 10000,
    greetingTimeout: 5000, 
    socketTimeout: 10000,
});

transporter.verify((error, success) => {
    if (error) {
        console.error('❌ SMTP connection failed:', error);
    } else {
        console.log('✅ SMTP server is ready to take our messages');
    }
});

export default transporter;