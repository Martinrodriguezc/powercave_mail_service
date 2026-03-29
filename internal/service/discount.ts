import { DiscountMail } from "../domain/mail";
import { discountEmailTemplate } from "../domain/templates";
import { sendMail } from "./mail";

export const sendDiscountEmail = async (opts: DiscountMail): Promise<void> => {
  let html = discountEmailTemplate;

  html = html.replace(/\{\{userName\}\}/g, opts.userName || "");
  html = html.replace(/\{\{gymName\}\}/g, opts.gymName || "");
  html = html.replace(/\{\{promotionEndDate\}\}/g, opts.promotionEndDate || "");
  html = html.replace(/\{\{contactUrl\}\}/g, opts.contactUrl || "");
  html = html.replace(/\{\{contactLabel\}\}/g, opts.contactLabel || "");
  html = html.replace(/\{\{year\}\}/g, new Date().getFullYear().toString());
  html = html.replace(/\{\{#if.*?\}\}[\s\S]*?\{\{\/if\}\}/g, "");

  await sendMail({
    to: opts.to,
    subject: opts.subject,
    html: html,
    userName: opts.userName,
    gymName: opts.gymName ?? undefined,
  });
};
