import {
  PasswordResetMail,
  PlatformUserCredentialsMail,
  ClientAppInvitationMail,
  ClientPasswordResetMail,
  AthleteAppInvitationMail,
} from "../domain/mail";
import { config } from "../../config/config";
import { getLogoImgHtml, getRemoteLogoImgHtml } from "../domain/logo";
import {
  passwordResetTemplate,
  platformUserCredentialsTemplate,
  clientAppInvitationTemplate,
  clientPasswordResetTemplate,
  athleteAppInvitationTemplate,
} from "../domain/templates";
import { sendMail, resend, withTimeout, RESEND_TIMEOUT_MS } from "./mail";
import { checkQuota, logMail, type MailContext } from "./mailLog";
import { createServiceLogger } from "../../utils/logger";
import { escapeHtml } from "../../utils/html";

const logger = createServiceLogger("credentials-bulk");

export const sendPasswordResetEmail = async (
  opts: PasswordResetMail,
  ctx: MailContext,
): Promise<void> => {
  let html = passwordResetTemplate;

  html = html.replace(
    /\{\{logoImg\}\}/g,
    getLogoImgHtml(opts.logoUrl, opts.gymName),
  );
  html = html.replace(/\{\{resetLink\}\}/g, opts.resetLink);
  html = html.replace(/\{\{year\}\}/g, new Date().getFullYear().toString());
  html = html.replace(/\{\{gymName\}\}/g, opts.gymName ?? "");

  await sendMail(
    {
      to: opts.to,
      subject: opts.subject,
      html: html,
      logoUrl: opts.logoUrl ?? undefined,
      gymName: opts.gymName ?? undefined,
    },
    { log: { context: ctx, mailType: "password_reset" } },
  );
};

export const sendPlatformUserCredentialsEmail = async (
  opts: PlatformUserCredentialsMail,
  ctx: MailContext,
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

  await sendMail(
    {
      to: opts.to,
      subject: opts.subject,
      html: html,
      logoUrl: opts.logoUrl ?? undefined,
      gymName: opts.gymName ?? undefined,
    },
    { log: { context: ctx, mailType: "platform_user_credentials" } },
  );
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
  ctx: MailContext,
): Promise<void> => {
  // Sin `logoUrl`: el HTML ya apunta al logo por URL y el adjunto quedaria
  // colgando sin que ninguna etiqueta lo referencie.
  await sendMail(
    {
      to: opts.to,
      subject: opts.subject,
      html: composeClientAppInvitationHtml(opts),
      gymName: opts.gymName ?? undefined,
    },
    { log: { context: ctx, mailType: "client_app_invitation" } },
  );
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
  /** `blocked`: el gimnasio agoto su cupo diario, el correo no viajo a Resend. */
  status: "sent" | "failed" | "blocked";
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
  ctx: MailContext,
): Promise<BulkInvitationsResponse> => {
  const results: BulkInvitationResult[] = invitations.map((inv) => ({
    to: inv.to,
    status: "sent",
  }));

  const markFailed = (index: number, error: string) => {
    results[index] = { to: results[index].to, status: "failed", error };
  };

  // Lo que no entra en el cupo del dia se marca y no viaja: el lote sale
  // parcial, cada destinatario trae su estado.
  const quota = await checkQuota(ctx, invitations.length);
  for (let i = quota.allowed; i < invitations.length; i++) {
    results[i] = {
      to: results[i].to,
      status: "blocked",
      error: `Daily email limit reached (${quota.dailyLimit})`,
    };
  }
  const sendableCount = quota.allowed;

  for (
    let start = 0;
    start < sendableCount;
    start += MAX_INVITATIONS_PER_BATCH
  ) {
    const chunk = invitations.slice(
      start,
      Math.min(start + MAX_INVITATIONS_PER_BATCH, sendableCount),
    );
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
            pending: sendableCount - start,
          });
          for (let i = start; i < sendableCount; i++) markFailed(i, message);
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

    if (start + MAX_INVITATIONS_PER_BATCH < sendableCount) {
      await delay(BATCH_THROTTLE_MS);
    }
  }

  await logMail(
    ctx,
    results.map((result, index) => ({
      recipient: result.to,
      subject: `Bienvenido a la app | ${invitations[index]?.gymName ?? ""}`,
      mailType: "client_app_invitation" as const,
      status: result.status,
      errorMessage: result.error ?? null,
    })),
  );

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
  ctx: MailContext,
): Promise<void> => {
  let html = clientPasswordResetTemplate;

  html = html.replace(
    /\{\{logoImg\}\}/g,
    getLogoImgHtml(opts.logoUrl, opts.gymName),
  );
  html = html.replace(/\{\{gymName\}\}/g, opts.gymName ?? "");
  html = html.replace(/\{\{otp\}\}/g, opts.otp);
  html = html.replace(/\{\{year\}\}/g, new Date().getFullYear().toString());

  await sendMail(
    {
      to: opts.to,
      subject: opts.subject,
      html: html,
      logoUrl: opts.logoUrl ?? undefined,
      gymName: opts.gymName ?? undefined,
    },
    { log: { context: ctx, mailType: "client_password_reset" } },
  );
};

/**
 * Botones de tienda del atleta. Sin badges en S3 (la app no esta publicada):
 * son botones de texto, y sin ningun link el bloque entero desaparece.
 */
function buildAthleteStoreButtons(
  opts: Pick<AthleteAppInvitationMail, "appStoreLink" | "googlePlayLink">,
): string {
  const button = (link: string, label: string) =>
    `<td style="padding:0 6px;" align="center">
                          <a href="${escapeHtml(link)}" target="_blank" style="display:inline-block; background-color:#f5b305; color:#0a0a0a; font-size:14px; font-weight:700; text-decoration:none; padding:12px 22px; border-radius:6px;">${label}</a>
                        </td>`;

  const buttons: string[] = [];
  if (opts.appStoreLink) buttons.push(button(opts.appStoreLink, "App Store"));
  if (opts.googlePlayLink)
    buttons.push(button(opts.googlePlayLink, "Google Play"));
  if (buttons.length === 0) return "";

  return `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 28px;">
                <tr>
                  <td align="center" style="padding:20px 0 8px; border-top:1px solid #1a1a1a;">
                    <p style="margin:0 0 14px; font-size:11px; color:#6b7280; letter-spacing:2px; text-transform:uppercase;">Descarga la app</p>
                    <table cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin:0 auto;">
                      <tr>
                        ${buttons.join("\n                        ")}
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>`;
}

export function composeAthleteAppInvitationHtml(
  opts: Omit<AthleteAppInvitationMail, "subject">,
): string {
  return athleteAppInvitationTemplate
    .replace(/\{\{trainerName\}\}/g, escapeHtml(opts.trainerName))
    .replace(/\{\{userEmail\}\}/g, escapeHtml(opts.to))
    .replace(/\{\{tempPassword\}\}/g, escapeHtml(opts.tempPassword))
    .replace(/\{\{storeButtons\}\}/g, buildAthleteStoreButtons(opts))
    .replace(/\{\{year\}\}/g, new Date().getFullYear().toString());
}

/** Sin gimnasio: el atleta es del entrenador. El logo de DashCore va por CID. */
export const sendAthleteAppInvitationEmail = async (
  opts: AthleteAppInvitationMail,
  ctx: MailContext,
): Promise<void> => {
  await sendMail(
    {
      to: opts.to,
      subject: opts.subject,
      html: composeAthleteAppInvitationHtml(opts),
    },
    { log: { context: ctx, mailType: "athlete_app_invitation" } },
  );
};
