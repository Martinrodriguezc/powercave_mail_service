import { PaymentFailedMail } from "../domain/mail";
import { getLogoImgHtml } from "../domain/logo";
import { paymentFailedTemplate } from "../domain/templates";
import { escapeHtml } from "../../utils/html";
import { sendMail } from "./mail";
import type { MailContext } from "./mailLog";

const reasonRowHtml = (reason: string) => `<tr>
                  <td style="background-color:#141414; border-left:1px solid #2a2a2a; border-right:1px solid #2a2a2a; border-top:1px solid #1e1e1e; padding:16px 24px;">
                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td style="vertical-align:middle;">
                          <p style="margin:0; font-size:12px; color:#6b7280;">Motivo</p>
                        </td>
                        <td align="right" style="vertical-align:middle;">
                          <p style="margin:0; font-size:14px; color:#ffffff; font-weight:600;">${reason}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>`;

export const sendPaymentFailedEmail = async (
  opts: PaymentFailedMail,
  ctx: MailContext,
): Promise<void> => {
  const gymName = escapeHtml(opts.gymName ?? "");
  const providerName = escapeHtml(opts.providerName);
  // Con reintento pendiente el socio no tiene que hacer nada todavía, solo
  // asegurarse de que el próximo intento pase.
  const nextStepText = opts.willRetry
    ? `${providerName} volverá a intentar el cobro en los próximos días. Revisa que tu medio de pago esté al día para que no pierdas tu acceso.`
    : `Para mantener tu acceso, revisa tu medio de pago o comunícate con ${gymName || "tu gimnasio"}.`;

  let html = paymentFailedTemplate;
  html = html.replace(
    /\{\{logoImg\}\}/g,
    getLogoImgHtml(opts.logoUrl, opts.gymName),
  );
  html = html.replace(/\{\{gymName\}\}/g, gymName);
  html = html.replace(/\{\{clientName\}\}/g, escapeHtml(opts.clientName));
  html = html.replace(/\{\{planName\}\}/g, escapeHtml(opts.planName));
  html = html.replace(/\{\{amount\}\}/g, escapeHtml(opts.amount));
  html = html.replace(
    /\{\{reasonRow\}\}/g,
    opts.reason ? reasonRowHtml(escapeHtml(opts.reason)) : "",
  );
  html = html.replace(/\{\{nextStepText\}\}/g, nextStepText);
  html = html.replace(/\{\{year\}\}/g, new Date().getFullYear().toString());

  await sendMail(
    {
      to: opts.to,
      subject: opts.subject,
      html,
      logoUrl: opts.logoUrl ?? undefined,
      gymName: opts.gymName ?? undefined,
    },
    {
      log: {
        context: ctx,
        mailType: "payment_failed",
        clientName: opts.clientName,
      },
    },
  );
};
