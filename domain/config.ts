import nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Try different Gmail configurations
const gmailConfig = {
    service: 'gmail', // Use Gmail service shortcut
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
    connectionTimeout: 60000, // Increase timeout to 60 seconds
    greetingTimeout: 30000,
    socketTimeout: 60000,
};

// Fallback manual configuration
const manualConfig = {
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    requireTLS: true,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
    connectionTimeout: 60000,
    greetingTimeout: 30000,
    socketTimeout: 60000,
    tls: {
        rejectUnauthorized: false 
    }
};

const transporter: Transporter = nodemailer.createTransport(gmailConfig);

// Test connection with better error handling
transporter.verify((error, success) => {
    if (error) {
        console.error('❌ Gmail service connection failed:', error.message);
        console.log('🔄 Trying manual configuration...');
        
        // Try manual configuration as fallback
        const fallbackTransporter = nodemailer.createTransport(manualConfig);
        fallbackTransporter.verify((fallbackError, fallbackSuccess) => {
            if (fallbackError) {
                console.error('❌ Manual SMTP configuration also failed:', fallbackError.message);
                console.log('💡 Possible solutions:');
                console.log('   1. Check if Gmail App Password is correct');
                console.log('   2. Verify 2FA is enabled on Gmail account');
                console.log('   3. Check firewall/network restrictions');
                console.log('   4. Try using port 465 with secure: true');
            } else {
                console.log('✅ Fallback SMTP configuration working');
                Object.assign(transporter, fallbackTransporter);
            }
        });
    } else {
        console.log('✅ Gmail service SMTP ready to send messages');
    }
});

export default transporter;