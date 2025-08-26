import fs from 'fs';
import path from 'path';

export const reminderTemplate = fs.readFileSync(
    path.join(__dirname, '../html/reminder.html'),
    'utf8'
);