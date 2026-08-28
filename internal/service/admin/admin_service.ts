import { AdminRenewalReportMail } from "../../domain/mail";
import { renderDailyAdminReportHTML } from "./helpers";
import { sendMail } from "..";
import type { MailContext } from "../mailLog";

export const sendDailyAdminReportMail = async (opts: AdminRenewalReportMail, ctx: MailContext): Promise<void> => {
  if (!opts?.to) {
    throw new Error('Destination email (to) is required');
  }
  if (!opts?.subject) {
    throw new Error('Subject is required');
  }

  const html = renderDailyAdminReportHTML(opts);

  await sendMail(
    {
      to: opts.to,
      subject: opts.subject,
      html,
      userName: ctx.sentBy,
      logoUrl: opts.logoUrl ?? undefined,
      gymName: opts.gymName ?? undefined,
    },
    { log: { context: ctx, mailType: "daily_admin_report" } },
  );
};