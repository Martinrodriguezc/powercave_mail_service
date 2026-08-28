export { sendMail } from "./mail";
export {
  RecentEmailSentError,
  sendReminderMail,
  sendReminderReportEmail,
  sendBulkReminderMails,
} from "./reminders";
export {
  sendCampaignEmail,
  sendCampaignBatch,
  MAX_CAMPAIGN_RECIPIENTS_PER_BATCH,
} from "./campaign";
export {
  sendPasswordResetEmail,
  sendPlatformUserCredentialsEmail,
  sendClientAppInvitationEmail,
  sendClientAppInvitationsBulk,
  sendClientPasswordResetEmail,
} from "./credentials";
export { getLastEmailByTenant } from "./tenant";
export { sendPaymentLinkEmail } from "./paymentLink";
export { sendManagerWelcomeEmail, sendStaffWelcomeEmail } from "./welcome";
export { sendLowStockAlertEmail } from "./lowStockAlert";
export {
  sendTrainerEmailVerificationEmail,
  sendTrainerAccountExistsEmail,
  sendTrainerInvitationEmail,
} from "./trainerAccount";
export { getMailUsage, InvalidMonthError } from "./usage";
