import { AdminRenewalReportMail } from "../../domain/mail";
import { renderDailyAdminReportHTML } from "./helpers";
import { sendMail } from "..";

export const sendDailyAdminReportMail = async (opts: AdminRenewalReportMail, sentBy: string): Promise<void> => {
  if (!sentBy) {
    throw new Error('Sent by is required');
  }
  if (!opts?.to) {
    throw new Error('Destination email (to) is required');
  }
  if (!opts?.subject) {
    throw new Error('Subject is required');
  }

  const html = renderDailyAdminReportHTML(opts);

  await sendMail({
    to: opts.to,
    subject: opts.subject,
    html,
    userName: sentBy,
  });
};