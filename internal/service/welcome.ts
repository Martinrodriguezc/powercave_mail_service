import { ManagerWelcomeMail, StaffWelcomeMail } from "../domain/mail";
import { getLogoImgHtml } from "../domain/logo";
import {
  managerWelcomeTemplate,
  staffWelcomeTemplate,
} from "../domain/templates";
import { sendMail } from "./mail";

export const sendManagerWelcomeEmail = async (
  opts: ManagerWelcomeMail,
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

  await sendMail({
    to: opts.to,
    subject: opts.subject,
    html: html,
    logoUrl: opts.logoUrl ?? undefined,
    gymName: opts.gymName,
  });
};

export const sendStaffWelcomeEmail = async (
  opts: StaffWelcomeMail,
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

  await sendMail({
    to: opts.to,
    subject: opts.subject,
    html: html,
    logoUrl: opts.logoUrl ?? undefined,
    gymName: opts.gymName,
  });
};
