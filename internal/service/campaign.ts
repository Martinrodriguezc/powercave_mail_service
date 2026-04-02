import { Mail } from "../domain/mail";
import { getLogoImgHtml } from "../domain/logo";
import { sendMail } from "./mail";

/**
 * Envía un email de campaña con HTML pre-compuesto desde el backend.
 * Inyecta el logo del gym como CID attachment si está disponible.
 */
export const sendCampaignEmail = async (opts: Mail): Promise<void> => {
  let html = opts.html ?? "";

  // Inyectar logo inline si el HTML contiene el placeholder
  if (html.includes("{{logoImg}}")) {
    html = html.replace(
      /\{\{logoImg\}\}/g,
      getLogoImgHtml(opts.logoUrl, opts.gymName),
    );
  }

  await sendMail({
    to: opts.to,
    subject: opts.subject,
    html,
    gymName: opts.gymName ?? undefined,
    logoUrl: opts.logoUrl ?? undefined,
  });
};
