import { config } from "../../config/config";
import {
  AppReleaseContent,
  AppReleaseMail,
  AppReleaseSendResult,
} from "../domain/mail";
import { appReleaseTemplate } from "../domain/templates";
import { createServiceLogger } from "../../utils/logger";
import { resend, withTimeout, RESEND_TIMEOUT_MS } from "./mail";
import { prisma } from "./db";

const logger = createServiceLogger("app-release");

export const MAX_RECIPIENTS_PER_BATCH = 100;

// El contenido lo escribe un superadmin pero termina en cientos de inboxes:
// se escapa antes de entrar a la plantilla.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildNotesHtml(notes: string[]): string {
  return notes
    .map(
      (
        note,
      ) => `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 12px;">
                      <tr>
                        <td width="18" valign="top" style="padding-top:7px;">
                          <div style="width:6px; height:6px; background-color:#f5b305; border-radius:50%;"></div>
                        </td>
                        <td style="color:#d1d5db; font-size:15px; line-height:1.7;">${escapeHtml(note)}</td>
                      </tr>
                    </table>`,
    )
    .join("\n                    ");
}

function buildStoreButtons(content: AppReleaseContent): string {
  const buttons: string[] = [];

  const badge = (link: string, badgeUrl: string, alt: string) =>
    `<td style="padding:0 6px;" align="center">
                          <a href="${escapeHtml(link)}" target="_blank" style="display:block; text-decoration:none; border:0; outline:none;">
                            <img src="${escapeHtml(badgeUrl)}" alt="${alt}" width="148" height="44" border="0" style="display:block; width:148px; height:44px; border:0; outline:none;" />
                          </a>
                        </td>`;

  // Sin badge en S3 el correo no puede quedarse sin salida a la tienda: se cae
  // a un boton de texto con el mismo link.
  const textButton = (link: string, label: string) =>
    `<td style="padding:0 6px;" align="center">
                          <a href="${escapeHtml(link)}" target="_blank" style="display:inline-block; background-color:#f5b305; color:#0a0a0a; font-size:14px; font-weight:700; text-decoration:none; padding:12px 22px; border-radius:6px;">${label}</a>
                        </td>`;

  if (content.appStoreLink) {
    buttons.push(
      content.appStoreBadgeUrl
        ? badge(
            content.appStoreLink,
            content.appStoreBadgeUrl,
            "Descargar en App Store",
          )
        : textButton(content.appStoreLink, "Actualizar en App Store"),
    );
  }
  if (content.googlePlayLink) {
    buttons.push(
      content.googlePlayBadgeUrl
        ? badge(
            content.googlePlayLink,
            content.googlePlayBadgeUrl,
            "Disponible en Google Play",
          )
        : textButton(content.googlePlayLink, "Actualizar en Google Play"),
    );
  }

  if (buttons.length === 0) return "";

  return `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 28px;">
                <tr>
                  <td align="center" style="padding:20px 0 8px; border-top:1px solid #1a1a1a;">
                    <p style="margin:0 0 14px; font-size:11px; color:#6b7280; letter-spacing:2px; text-transform:uppercase;">Actualiza la app</p>
                    <table cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin:0 auto;">
                      <tr>
                        ${buttons.join("\n                        ")}
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>`;
}

export function composeAppReleaseHtml(
  content: AppReleaseContent,
  recipientName?: string | null,
): string {
  const name = recipientName?.trim();
  const appLogoImg = content.appLogoUrl
    ? `<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin:0 auto 14px auto;">
        <tr><td align="center" style="line-height:0;">
          <img src="${escapeHtml(content.appLogoUrl)}" alt="Dashcore Members" width="80" height="80" border="0" style="display:block;width:80px;height:80px;border-radius:18px;outline:none;text-decoration:none;" />
        </td></tr>
      </table>`
    : "";

  return appReleaseTemplate
    .replace(/\{\{appLogoImg\}\}/g, appLogoImg)
    .replace(/\{\{greeting\}\}/g, name ? `Hola ${escapeHtml(name)},` : "Hola,")
    .replace(/\{\{version\}\}/g, escapeHtml(content.version))
    .replace(/\{\{title\}\}/g, escapeHtml(content.title))
    .replace(/\{\{notesHtml\}\}/g, buildNotesHtml(content.notes))
    .replace(/\{\{storeButtons\}\}/g, buildStoreButtons(content))
    .replace(/\{\{year\}\}/g, new Date().getFullYear().toString());
}

/**
 * Envia el anuncio a todo el lote en una sola llamada a Resend y devuelve el
 * estado por destinatario, en el mismo orden en que llegaron.
 */
export async function sendAppReleaseBatch(
  opts: AppReleaseMail,
): Promise<AppReleaseSendResult[]> {
  const results: AppReleaseSendResult[] = opts.recipients.map((recipient) => ({
    email: recipient.email,
    status: recipient.email ? "sent" : "failed",
    errorMessage: recipient.email ? null : "Missing email",
  }));

  // Los invalidos no viajan a Resend, pero conservan su posicion en `results`.
  const sendable = opts.recipients
    .map((recipient, index) => ({ recipient, index }))
    .filter(({ recipient }) => !!recipient.email);

  if (sendable.length === 0) {
    await logBatch(opts, results);
    return results;
  }

  const payload = sendable.map(({ recipient }) => ({
    from: `${config.SENDER_EMAIL}`,
    to: recipient.email,
    subject: opts.subject,
    html: composeAppReleaseHtml(opts, recipient.name),
  }));

  try {
    const response = await withTimeout(
      resend.batch.send(payload, { batchValidation: "permissive" }),
      RESEND_TIMEOUT_MS,
      "Resend batch send",
    );

    if (response.error) {
      throw new Error(response.error.message || "Resend rejected the batch");
    }

    // Con validacion permisiva Resend devuelve los indices que rechazo; el
    // resto salio. El indice es relativo al payload enviado, no a la lista
    // original, asi que se traduce antes de marcar.
    for (const failure of response.data?.errors ?? []) {
      const original = sendable[failure.index];
      const result = original && results[original.index];
      if (result) {
        result.status = "failed";
        result.errorMessage = failure.message;
      }
    }

    logger.info("App release batch sent", {
      version: opts.version,
      size: opts.recipients.length,
      failed: results.filter((r) => r.status === "failed").length,
    });
  } catch (error: any) {
    const errorMessage = error?.message || "Unknown error";
    logger.error("Error sending app release batch", error, {
      version: opts.version,
      size: opts.recipients.length,
    });
    for (const { index } of sendable) {
      const result = results[index];
      if (result) {
        result.status = "failed";
        result.errorMessage = errorMessage;
      }
    }
  }

  await logBatch(opts, results);

  return results;
}

async function logBatch(
  opts: AppReleaseMail,
  results: AppReleaseSendResult[],
): Promise<void> {
  try {
    await prisma.emailLog.createMany({
      data: results.map((result, index) => ({
        recipient: result.email,
        subject: opts.subject,
        mail_type: "app_release" as const,
        publicId: opts.announcementPublicId,
        clientName: opts.recipients[index]?.name ?? "",
        status:
          result.status === "sent" ? ("sent" as const) : ("failed" as const),
        errorMessage: result.errorMessage,
        sentBy: opts.sentBy,
      })),
    });
  } catch (error: any) {
    // El registro no puede tumbar el envio: el backend ya tiene su propio log
    // por destinatario.
    logger.error("Error logging app release batch", error, {
      version: opts.version,
    });
  }
}
