import {
  TrainerAccountExistsMail,
  TrainerEmailVerificationMail,
} from "../domain/mail";
import {
  trainerAccountExistsTemplate,
  trainerEmailVerificationTemplate,
} from "../domain/templates";
import { sendMail } from "./mail";

// Ninguno de los dos interpola gymName ni logoImg: el entrenador no pertenece a
// un gimnasio y la cabecera lleva la marca de la plataforma.
export const sendTrainerEmailVerificationEmail = async (
  opts: TrainerEmailVerificationMail,
): Promise<void> => {
  let html = trainerEmailVerificationTemplate;
  html = html.replace(/\{\{userName\}\}/g, opts.userName);
  html = html.replace(/\{\{verificationLink\}\}/g, opts.verificationLink);
  html = html.replace(/\{\{year\}\}/g, new Date().getFullYear().toString());

  await sendMail({ to: opts.to, subject: opts.subject, html });
};

export const sendTrainerAccountExistsEmail = async (
  opts: TrainerAccountExistsMail,
): Promise<void> => {
  let html = trainerAccountExistsTemplate;
  html = html.replace(/\{\{loginLink\}\}/g, opts.loginLink);
  html = html.replace(/\{\{year\}\}/g, new Date().getFullYear().toString());

  await sendMail({ to: opts.to, subject: opts.subject, html });
};
