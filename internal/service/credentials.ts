import {
  PasswordResetMail,
  PlatformUserCredentialsMail,
  ClientAppInvitationMail,
  ClientPasswordResetMail,
} from "../domain/mail";
import { getLogoImgHtml } from "../domain/logo";
import {
  passwordResetTemplate,
  platformUserCredentialsTemplate,
  clientAppInvitationTemplate,
  clientPasswordResetTemplate,
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

  const appLogoImg = opts.appLogoUrl
    ? `<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin:0 auto 14px auto;">
        <tr><td align="center" style="line-height:0;">
          <img src="${opts.appLogoUrl}" alt="Dashcore" width="80" height="80" border="0" style="display:block;width:80px;height:80px;border-radius:18px;outline:none;text-decoration:none;" />
        </td></tr>
      </table>`
    : "";
  html = html.replace(/\{\{appLogoImg\}\}/g, appLogoImg);
  html = html.replace(
    /\{\{logoImg\}\}/g,
    getLogoImgHtml(opts.logoUrl, opts.gymName),
  );
  html = html.replace(/\{\{gymName\}\}/g, opts.gymName ?? "");
  html = html.replace(/\{\{gymSlug\}\}/g, opts.gymSlug);
  html = html.replace(/\{\{userEmail\}\}/g, opts.to);
  html = html.replace(/\{\{tempPassword\}\}/g, opts.tempPassword);
  html = html.replace(/\{\{appStoreBadgeUrl\}\}/g, opts.appStoreBadgeUrl ?? "");
  html = html.replace(
    /\{\{googlePlayBadgeUrl\}\}/g,
    opts.googlePlayBadgeUrl ?? "",
  );
  html = html.replace(/\{\{year\}\}/g, new Date().getFullYear().toString());

  await sendMail({
    to: opts.to,
    subject: opts.subject,
    html: html,
    logoUrl: opts.logoUrl ?? undefined,
    gymName: opts.gymName ?? undefined,
  });
};

export const sendClientPasswordResetEmail = async (
  opts: ClientPasswordResetMail,
): Promise<void> => {
  let html = clientPasswordResetTemplate;

  html = html.replace(
    /\{\{logoImg\}\}/g,
    getLogoImgHtml(opts.logoUrl, opts.gymName),
  );
  html = html.replace(/\{\{gymName\}\}/g, opts.gymName ?? "");
  html = html.replace(/\{\{otp\}\}/g, opts.otp);
  html = html.replace(/\{\{year\}\}/g, new Date().getFullYear().toString());

  await sendMail({
    to: opts.to,
    subject: opts.subject,
    html: html,
    logoUrl: opts.logoUrl ?? undefined,
    gymName: opts.gymName ?? undefined,
  });
};
