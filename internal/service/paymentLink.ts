import { PaymentLinkMail } from "../domain/mail";
import { getLogoImgHtml } from "../domain/logo";
import { paymentLinkTemplate } from "../domain/templates";
import { sendMail } from "./mail";

const EXPIRATION_NOTE_HTML = `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 20px;">
                <tr>
                  <td style="background-color:#1c1608; border:1px solid rgba(212,168,83,0.35); border-radius:8px; padding:14px 20px; text-align:center;">
                    <p style="margin:0; font-size:13px; color:#D4A853;">Este link expira en 48 horas.</p>
                  </td>
                </tr>
              </table>`;

export const sendPaymentLinkEmail = async (
  opts: PaymentLinkMail,
): Promise<void> => {
  let html = paymentLinkTemplate;

  const ctaText = opts.isRecurring
    ? "Activar cobro recurrente"
    : "Realizar pago";
  const bodyText = opts.isRecurring
    ? "Se ha generado un link para activar tu cobro recurrente. Revisa el detalle a continuacion y haz clic en el boton para autorizar el cargo automatico de forma segura."
    : "Se ha generado un link de pago a tu nombre. Revisa el detalle a continuacion y haz clic en el boton para completar el pago de forma segura.";
  const expirationNote = opts.isRecurring ? "" : EXPIRATION_NOTE_HTML;

  html = html.replace(
    /\{\{logoImg\}\}/g,
    getLogoImgHtml(opts.logoUrl, opts.gymName),
  );
  html = html.replace(/\{\{gymName\}\}/g, opts.gymName ?? "");
  html = html.replace(/\{\{clientName\}\}/g, opts.clientName);
  html = html.replace(/\{\{bodyText\}\}/g, bodyText);
  html = html.replace(/\{\{description\}\}/g, opts.description);
  html = html.replace(/\{\{amount\}\}/g, opts.amount);
  html = html.replace(/\{\{providerLogoUrl\}\}/g, opts.providerLogoUrl);
  html = html.replace(/\{\{providerName\}\}/g, opts.providerName);
  html = html.replace(/\{\{paymentUrl\}\}/g, opts.paymentUrl);
  html = html.replace(/\{\{ctaText\}\}/g, ctaText);
  html = html.replace(/\{\{expirationNote\}\}/g, expirationNote);
  html = html.replace(/\{\{year\}\}/g, new Date().getFullYear().toString());

  await sendMail({
    to: opts.to,
    subject: opts.subject,
    html,
    logoUrl: opts.logoUrl ?? undefined,
    gymName: opts.gymName ?? undefined,
  });
};
