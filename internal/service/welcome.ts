import { ManagerWelcomeMail, StaffWelcomeMail } from "../domain/mail";
import { getLogoImgHtml } from "../domain/logo";
import {
  managerWelcomeTemplate,
  staffWelcomeTemplate,
} from "../domain/templates";
import { sendMail } from "./mail";
import type { MailContext } from "./mailLog";

export const sendManagerWelcomeEmail = async (
  opts: ManagerWelcomeMail,
  ctx: MailContext,
): Promise<void> => {
  let html = managerWelcomeTemplate;

  html = html.replace(
    /\{\{logoImg\}\}/g,
    getLogoImgHtml(opts.logoUrl, opts.gymName),
  );
  html = html.replace(/\{\{userName\}\}/g, opts.userName);
  html = html.replace(/\{\{gymName\}\}/g, opts.gymName);
  html = html.replace(/\{\{serviceStartDate\}\}/g, opts.serviceStartDate);
  html = html.replace(/\{\{freeMonthEndsAt\}\}/g, opts.freeMonthEndsAt);
  html = html.replace(/\{\{loginLink\}\}/g, opts.loginLink);
  html = html.replace(/\{\{year\}\}/g, new Date().getFullYear().toString());

  await sendMail(
    {
      to: opts.to,
      subject: opts.subject,
      html: html,
      logoUrl: opts.logoUrl ?? undefined,
      gymName: opts.gymName,
    },
    { log: { context: ctx, mailType: "manager_welcome", clientName: opts.userName } },
  );
};

export const sendStaffWelcomeEmail = async (
  opts: StaffWelcomeMail,
  ctx: MailContext,
): Promise<void> => {
  let html = staffWelcomeTemplate;

  html = html.replace(
    /\{\{logoImg\}\}/g,
    getLogoImgHtml(opts.logoUrl, opts.gymName),
  );
  html = html.replace(/\{\{userName\}\}/g, opts.userName);
  html = html.replace(/\{\{gymName\}\}/g, opts.gymName);
  html = html.replace(/\{\{loginLink\}\}/g, opts.loginLink);
  html = html.replace(/\{\{year\}\}/g, new Date().getFullYear().toString());

  await sendMail(
    {
      to: opts.to,
      subject: opts.subject,
      html: html,
      logoUrl: opts.logoUrl ?? undefined,
      gymName: opts.gymName,
    },
    { log: { context: ctx, mailType: "staff_welcome", clientName: opts.userName } },
  );
};
