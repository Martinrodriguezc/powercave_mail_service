import fs from 'fs';
import path from 'path';

export const reminderTemplate = fs.readFileSync(
    path.join(__dirname, '../html/reminder.html'),
    'utf8'
);

export const discountEmailTemplate = fs.readFileSync(
    path.join(__dirname, '../html/discount_email.html'),
    'utf8'
);

export const dailyAdminReportTemplate = fs.readFileSync(
    path.join(__dirname, '../html/daily_admin_report.html'),
    'utf8'
);