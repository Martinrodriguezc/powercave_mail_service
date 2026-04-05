export { sendMail } from "./mail";
export {
  RecentEmailSentError,
  sendReminderMail,
  sendReminderReportEmail,
  sendBulkReminderMails,
} from "./reminders";
export { sendCampaignEmail } from "./campaign";
export {
  sendPasswordResetEmail,
  sendPlatformUserCredentialsEmail,
  sendClientAppInvitationEmail,
  sendClientPasswordResetEmail,
} from "./credentials";
export { getLastEmailByTenant } from "./tenant";
export { sendPaymentLinkEmail } from "./paymentLink";
