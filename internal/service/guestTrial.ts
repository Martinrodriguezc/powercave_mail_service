import {
  GuestTrialCancelReason,
  GuestTrialCancelledMail,
  GuestTrialConfirmationMail,
} from "../domain/mail";
import { getLogoImgHtml } from "../domain/logo";
import {
  guestTrialCancelledTemplate,
  guestTrialConfirmationTemplate,
} from "../domain/templates";
import { escapeHtml } from "../../utils/html";
import { sendMail } from "./mail";
import type { MailContext } from "./mailLog";

// Reemplazo con función y no con string: un `$&` o `$'` en el nombre del
// invitado se interpretaría como patrón de reemplazo de String.replace.
const fillTemplate = (template: string, values: Record<string, string>) =>
  template.replace(/\{\{(\w+)\}\}/g, (token, key: string) =>
    key in values ? values[key] : token,
  );

const addressRowHtml = (address: string) => `<tr>
                        <td style="padding:16px 24px; border-top:1px solid #1e1e1e;">
                          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                            <tr>
                              <td style="vertical-align:middle;">
                                <p style="margin:0; font-size:12px; color:#6b7280;">Dirección</p>
                              </td>
                              <td align="right" style="vertical-align:middle;">
                                <p style="margin:0; font-size:14px; color:#ffffff; font-weight:600;">${address}</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
`;

const classValues = (opts: GuestTrialConfirmationMail | GuestTrialCancelledMail) => {
  const gymName = escapeHtml(opts.gymName ?? "");
  return {
    logoImg: getLogoImgHtml(opts.logoUrl, opts.gymName),
    gymName,
    gymLabel: gymName || "tu gimnasio",
    guestName: escapeHtml(opts.guestName),
    className: escapeHtml(opts.className),
    classDate: escapeHtml(opts.classDate),
    classTime: escapeHtml(opts.classTime),
    year: new Date().getFullYear().toString(),
  };
};

const cancelReasonText = (reason: GuestTrialCancelReason, gymName: string) => {
  const actor = gymName || "El gimnasio";
  return reason === "CLASS_CANCELLED"
    ? `${actor} canceló la clase que tenías reservada como clase de prueba.`
    : `${actor} canceló tu reserva para la clase de prueba.`;
};

export const sendGuestTrialConfirmationEmail = async (
  opts: GuestTrialConfirmationMail,
  ctx: MailContext,
): Promise<void> => {
  const html = fillTemplate(guestTrialConfirmationTemplate, {
    ...classValues(opts),
    addressRow: opts.gymAddress ? addressRowHtml(escapeHtml(opts.gymAddress)) : "",
    cancelUrl: escapeHtml(opts.cancelUrl),
  });

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
        mailType: "guest_trial_confirmation",
        clientName: opts.guestName,
      },
    },
  );
};

export const sendGuestTrialCancelledEmail = async (
  opts: GuestTrialCancelledMail,
  ctx: MailContext,
): Promise<void> => {
  const values = classValues(opts);
  const html = fillTemplate(guestTrialCancelledTemplate, {
    ...values,
    reasonText: cancelReasonText(opts.reason, values.gymName),
  });

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
        mailType: "guest_trial_cancelled",
        clientName: opts.guestName,
      },
    },
  );
};
