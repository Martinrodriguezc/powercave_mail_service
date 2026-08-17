import {
  PasswordResetMail,
  PlatformUserCredentialsMail,
  ClientAppInvitationMail,
  ClientPasswordResetMail,
} from "../domain/mail";
import { config } from "../../config/config";
import { getLogoImgHtml, getRemoteLogoImgHtml } from "../domain/logo";
import {
  passwordResetTemplate,
  platformUserCredentialsTemplate,
  clientAppInvitationTemplate,
  clientPasswordResetTemplate,
} from "../domain/templates";
import { sendMail, resend, withTimeout, RESEND_TIMEOUT_MS } from "./mail";
import { createServiceLogger } from "../../utils/logger";

const logger = createServiceLogger("credentials-bulk");

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

/**
 * Los logos van con `src` remoto, no como adjunto CID: esta plantilla se envia
 * en lote por la API batch de Resend, que no acepta adjuntos.
 */
export function composeClientAppInvitationHtml(
  opts: Omit<ClientAppInvitationMail, "subject">,
): string {
  const appLogoImg = opts.appLogoUrl
    ? `<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin:0 auto 14px auto;">
        <tr><td align="center" style="line-height:0;">
          <img src="${opts.appLogoUrl}" alt="Dashcore Members" width="80" height="80" border="0" style="display:block;width:80px;height:80px;border-radius:18px;outline:none;text-decoration:none;" />
        </td></tr>
      </table>`
    : "";
  const dashcoreLogoImg = opts.dashcoreLogoUrl
    ? `<img src="${opts.dashcoreLogoUrl}" alt="DashCore" width="180" height="47" border="0" style="display:block; margin:0 auto 12px; width:180px; height:auto; outline:none; text-decoration:none;">`
    : "";

  return clientAppInvitationTemplate
    .replace(/\{\{appLogoImg\}\}/g, appLogoImg)
    .replace(/\{\{dashcoreLogoImg\}\}/g, dashcoreLogoImg)
    .replace(/\{\{logoImg\}\}/g, getRemoteLogoImgHtml(opts.logoUrl))
    .replace(/\{\{gymName\}\}/g, opts.gymName ?? "")
    .replace(/\{\{gymSlug\}\}/g, opts.gymSlug)
    .replace(/\{\{userEmail\}\}/g, opts.to)
    .replace(/\{\{tempPassword\}\}/g, opts.tempPassword)
    .replace(/\{\{appStoreBadgeUrl\}\}/g, opts.appStoreBadgeUrl ?? "")
    .replace(/\{\{googlePlayBadgeUrl\}\}/g, opts.googlePlayBadgeUrl ?? "")
    .replace(/\{\{appStoreLink\}\}/g, opts.appStoreLink ?? "#")
    .replace(/\{\{googlePlayLink\}\}/g, opts.googlePlayLink ?? "#")
    .replace(/\{\{year\}\}/g, new Date().getFullYear().toString());
}

export const sendClientAppInvitationEmail = async (
  opts: ClientAppInvitationMail,
): Promise<void> => {
  // Sin `logoUrl`: el HTML ya apunta al logo por URL y el adjunto quedaria
  // colgando sin que ninguna etiqueta lo referencie.
  await sendMail({
    to: opts.to,
    subject: opts.subject,
    html: composeClientAppInvitationHtml(opts),
    gymName: opts.gymName ?? undefined,
  });
};

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

// Tope de la API batch de Resend.
const MAX_INVITATIONS_PER_BATCH = 100;
// Resend permite ~2 requests/segundo; con el lote entero en una sola llamada,
// el throttle aplica entre lotes y no entre correos.
const BATCH_THROTTLE_MS = 600;

export type ClientAppInvitationBulkItem = Omit<ClientAppInvitationMail, "subject">;

export interface BulkInvitationResult {
  to: string;
  status: "sent" | "failed";
  error?: string;
}

export interface BulkInvitationsResponse {
  summary: { requested: number; sent: number; failed: number };
  results: BulkInvitationResult[];
}

/** 429 de Resend: cuota diaria agotada o rate limit; reintentar no sirve. */
const isQuotaError = (error: { statusCode?: number; name?: string }): boolean =>
  error.statusCode === 429 || error.name === "daily_quota_exceeded";

/**
 * Envia el lote en llamadas batch de 100, no correo por correo: cada llamada
 * mantiene su propia contrasena temporal por destinatario.
 */
export const sendClientAppInvitationsBulk = async (
  invitations: ClientAppInvitationBulkItem[],
): Promise<BulkInvitationsResponse> => {
  const results: BulkInvitationResult[] = invitations.map((inv) => ({
    to: inv.to,
    status: "sent",
  }));

  const markFailed = (index: number, error: string) => {
    results[index] = { to: results[index].to, status: "failed", error };
  };

  for (
    let start = 0;
    start < invitations.length;
    start += MAX_INVITATIONS_PER_BATCH
  ) {
    const chunk = invitations.slice(start, start + MAX_INVITATIONS_PER_BATCH);
    const payload = chunk.map((inv) => ({
      from: `${config.SENDER_EMAIL}`,
      to: inv.to,
      subject: `Bienvenido a la app | ${inv.gymName}`,
      html: composeClientAppInvitationHtml(inv),
    }));

    try {
      const response = await withTimeout(
        resend.batch.send(payload, { batchValidation: "permissive" }),
        RESEND_TIMEOUT_MS,
        "Resend batch send",
      );

      if (response.error) {
        const message = response.error.message || "Resend rejected the batch";
        // Contra la cuota diaria agotada no hay reintento util: el lote entero
        // y el resto de los lotes van a recibir el mismo 429.
        if (isQuotaError(response.error)) {
          logger.error("Resend quota reached, aborting the bulk", new Error(message), {
            pending: invitations.length - start,
          });
          for (let i = start; i < invitations.length; i++) markFailed(i, message);
          break;
        }
        throw new Error(message);
      }

      // Con validacion permisiva Resend devuelve solo los indices rechazados;
      // el resto salio. El indice es relativo al chunk enviado.
      const failures = response.data?.errors ?? [];
      for (const failure of failures) {
        const result = results[start + failure.index];
        if (result) {
          result.status = "failed";
          result.error = failure.message;
        }
      }
      if (failures.length > 0) {
        logger.error(
          "Resend rejected invitations inside the batch",
          new Error(failures[0].message),
          { rejected: failures.length, size: chunk.length },
        );
      }
    } catch (error: any) {
      // Sin reintento: el backend no persiste las credenciales de lo que no
      // salio, asi que el lote se recupera volviendo a filtrar por "Sin
      // invitar". El log es la unica pista de por que fallo, y faltaba.
      logger.error("Resend batch send failed", error, { size: chunk.length });
      const message = error?.message || "Unknown error";
      for (let i = start; i < start + chunk.length; i++) markFailed(i, message);
    }

    if (start + MAX_INVITATIONS_PER_BATCH < invitations.length) {
      await delay(BATCH_THROTTLE_MS);
    }
  }

  const sent = results.filter((r) => r.status === "sent").length;
  return {
    summary: {
      requested: invitations.length,
      sent,
      failed: results.length - sent,
    },
    results,
  };
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
