import fs from "fs";
import path from "path";

export const reminderTemplate = fs.readFileSync(
  path.join(__dirname, "../html/reminder.html"),
  "utf8",
);

export const dailyAdminReportTemplate = fs.readFileSync(
  path.join(__dirname, "../html/daily_admin_report.html"),
  "utf8",
);

export const dailySalesReportTemplate = fs.readFileSync(
  path.join(__dirname, "../html/daily_sales_report.html"),
  "utf8",
);

export const reminderReportTemplate = fs.readFileSync(
  path.join(__dirname, "../html/reminder_report.html"),
  "utf8",
);

export const passwordResetTemplate = fs.readFileSync(
  path.join(__dirname, "../html/password_reset.html"),
  "utf8",
);

export const platformUserCredentialsTemplate = fs.readFileSync(
  path.join(__dirname, "../html/platform_user_credentials.html"),
  "utf8",
);

export const paymentLinkTemplate = fs.readFileSync(
  path.join(__dirname, "../html/payment_link.html"),
  "utf8",
);

export const clientAppInvitationTemplate = fs.readFileSync(
  path.join(__dirname, "../html/client_app_invitation.html"),
  "utf8",
);

export const clientPasswordResetTemplate = fs.readFileSync(
  path.join(__dirname, "../html/client_password_reset.html"),
  "utf8",
);

export const managerWelcomeTemplate = fs.readFileSync(
  path.join(__dirname, "../html/manager_welcome.html"),
  "utf8",
);

export const staffWelcomeTemplate = fs.readFileSync(
  path.join(__dirname, "../html/staff_welcome.html"),
  "utf8",
);
