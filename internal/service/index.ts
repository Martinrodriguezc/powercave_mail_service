export { sendMail } from "./mail";
export { RecentEmailSentError, sendReminderMail, sendReminderReportEmail, sendBulkReminderMails } from "./reminders";
export { sendDiscountEmail } from "./discount";
export { sendPasswordResetEmail, sendPlatformUserCredentialsEmail } from "./credentials";
export { getLastEmailByTenant } from "./tenant";
