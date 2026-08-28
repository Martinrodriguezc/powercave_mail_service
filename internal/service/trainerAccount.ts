import {
  TrainerAccountExistsMail,
  TrainerEmailVerificationMail,
  TrainerInvitationMail,
} from "../domain/mail";
import {
  trainerAccountExistsTemplate,
  trainerEmailVerificationTemplate,
  trainerInvitationTemplate,
} from "../domain/templates";
import { sendMail } from "./mail";
import type { MailContext } from "./mailLog";

// Ninguno de los dos interpola gymName ni logoImg: el entrenador no pertenece a
// un gimnasio y la cabecera lleva la marca de la plataforma.
export const sendTrainerEmailVerificationEmail = async (
  opts: TrainerEmailVerificationMail,
  ctx: MailContext,
): Promise<void> => {
  let html = trainerEmailVerificationTemplate;
  html = html.replace(/\{\{userName\}\}/g, opts.userName);
  html = html.replace(/\{\{verificationLink\}\}/g, opts.verificationLink);
  html = html.replace(/\{\{year\}\}/g, new Date().getFullYear().toString());

  await sendMail(
    { to: opts.to, subject: opts.subject, html },
    { log: { context: ctx, mailType: "trainer_email_verification" } },
  );
};

export const sendTrainerAccountExistsEmail = async (
  opts: TrainerAccountExistsMail,
  ctx: MailContext,
): Promise<void> => {
  let html = trainerAccountExistsTemplate;
  html = html.replace(/\{\{loginLink\}\}/g, opts.loginLink);
  html = html.replace(/\{\{year\}\}/g, new Date().getFullYear().toString());

  await sendMail(
    { to: opts.to, subject: opts.subject, html },
    { log: { context: ctx, mailType: "trainer_account_exists" } },
  );
};

export const sendTrainerInvitationEmail = async (
  opts: TrainerInvitationMail,
  ctx: MailContext,
): Promise<void> => {
  let html = trainerInvitationTemplate;
  html = html.replace(/\{\{gymName\}\}/g, opts.gymName);
  html = html.replace(/\{\{loginLink\}\}/g, opts.loginLink);
  html = html.replace(/\{\{year\}\}/g, new Date().getFullYear().toString());

  await sendMail(
    { to: opts.to, subject: opts.subject, html },
    { log: { context: ctx, mailType: "trainer_invitation" } },
  );
};
