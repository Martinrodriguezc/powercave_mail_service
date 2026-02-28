import { PasswordResetMail, PlatformUserCredentialsMail } from "../domain/mail";
import { passwordResetTemplate, platformUserCredentialsTemplate } from "../domain/templates";
import { sendMail } from "./mail";

export const sendPasswordResetEmail = async (opts: PasswordResetMail): Promise<void> => {
    let html = passwordResetTemplate;

    html = html.replace(/\{\{resetLink\}\}/g, opts.resetLink);
    html = html.replace(/\{\{year\}\}/g, new Date().getFullYear().toString());
    html = html.replace(/\{\{gymName\}\}/g, opts.gymName ?? '');

    await sendMail({
        to: opts.to,
        subject: opts.subject,
        html: html,
    });
};

export const sendPlatformUserCredentialsEmail = async (opts: PlatformUserCredentialsMail): Promise<void> => {
    let html = platformUserCredentialsTemplate;

    html = html.replace(/\{\{userEmail\}\}/g, opts.to);
    html = html.replace(/\{\{temporaryPassword\}\}/g, opts.temporaryPassword);
    html = html.replace(/\{\{resetPasswordLink\}\}/g, opts.resetPasswordLink);
    html = html.replace(/\{\{year\}\}/g, new Date().getFullYear().toString());
    html = html.replace(/\{\{gymName\}\}/g, opts.gymName ?? '');

    await sendMail({
        to: opts.to,
        subject: opts.subject,
        html: html,
    });
};
