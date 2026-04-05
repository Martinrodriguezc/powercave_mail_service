import {
  PasswordResetMail,
  PlatformUserCredentialsMail,
  ClientAppInvitationMail,
} from "../domain/mail";
import { getLogoImgHtml } from "../domain/logo";
import {
  passwordResetTemplate,
  platformUserCredentialsTemplate,
  clientAppInvitationTemplate,
} from "../domain/templates";
import { sendMail } from "./mail";

export const sendPasswordResetEmail = async (
  opts: PasswordResetMail,
): Promise<void> => {
  let html = passwordResetTemplate;

  html = html.replace(
    /\{\{logoImg\}\}/g,
    getLogoImgHtml(opts.logoUrl, opts.gymName),
  );
  html = html.replace(/\{\{resetLink\}\}/g, opts.resetLink);
  html = html.replace(/\{\{year\}\}/g, new Date().getFullYear().toString());
  html = html.replace(/\{\{gymName\}\}/g, opts.gymName ?? "");

  await sendMail({
    to: opts.to,
    subject: opts.subject,
    html: html,
    logoUrl: opts.logoUrl ?? undefined,
    gymName: opts.gymName ?? undefined,
  });
};

export const sendPlatformUserCredentialsEmail = async (
  opts: PlatformUserCredentialsMail,
): Promise<void> => {
  let html = platformUserCredentialsTemplate;

  html = html.replace(
    /\{\{logoImg\}\}/g,
    getLogoImgHtml(opts.logoUrl, opts.gymName),
  );
  html = html.replace(/\{\{userEmail\}\}/g, opts.to);
  html = html.replace(/\{\{temporaryPassword\}\}/g, opts.temporaryPassword);
  html = html.replace(/\{\{resetPasswordLink\}\}/g, opts.resetPasswordLink);
  html = html.replace(/\{\{year\}\}/g, new Date().getFullYear().toString());
  html = html.replace(/\{\{gymName\}\}/g, opts.gymName ?? "");

  await sendMail({
    to: opts.to,
    subject: opts.subject,
    html: html,
    logoUrl: opts.logoUrl ?? undefined,
    gymName: opts.gymName ?? undefined,
  });
};

export const sendClientAppInvitationEmail = async (
  opts: ClientAppInvitationMail,
): Promise<void> => {
  let html = clientAppInvitationTemplate;

  html = html.replace(
    /\{\{logoImg\}\}/g,
    getLogoImgHtml(opts.logoUrl, opts.gymName),
  );
  html = html.replace(/\{\{gymName\}\}/g, opts.gymName ?? "");
  html = html.replace(/\{\{gymSlug\}\}/g, opts.gymSlug);
  html = html.replace(/\{\{userEmail\}\}/g, opts.to);
  html = html.replace(/\{\{tempPassword\}\}/g, opts.tempPassword);
  html = html.replace(/\{\{year\}\}/g, new Date().getFullYear().toString());

  await sendMail({
    to: opts.to,
    subject: opts.subject,
    html: html,
    logoUrl: opts.logoUrl ?? undefined,
    gymName: opts.gymName ?? undefined,
  });
};
