import { CampaignBatchMail, CampaignSendResult, Mail } from "../domain/mail";
import { getLogoImgHtml, getRemoteLogoImgHtml } from "../domain/logo";
import { createServiceLogger } from "../../utils/logger";
import { resend, withTimeout, RESEND_TIMEOUT_MS, sendMail } from "./mail";
import { checkQuota, logMail, type MailContext } from "./mailLog";
import { config } from "../../config/config";

const logger = createServiceLogger("campaign");

export const MAX_CAMPAIGN_RECIPIENTS_PER_BATCH = 100;

/**
 * Envía un email de campaña con HTML pre-compuesto desde el backend.
 * Inyecta el logo del gym como CID attachment si está disponible.
 */
export const sendCampaignEmail = async (
  opts: Mail,
  ctx: MailContext,
): Promise<void> => {
  let html = opts.html ?? "";

  // Inyectar logo inline si el HTML contiene el placeholder
  if (html.includes("{{logoImg}}")) {
    html = html.replace(
      /\{\{logoImg\}\}/g,
      getLogoImgHtml(opts.logoUrl, opts.gymName),
    );
  }

  await sendMail(
    {
      to: opts.to,
      subject: opts.subject,
      html,
      gymName: opts.gymName ?? undefined,
      logoUrl: opts.logoUrl ?? undefined,
    },
    { log: { context: ctx, mailType: "campaign_email" } },
  );
};

/**
 * Envía un lote de campaña en una sola llamada a Resend y devuelve el estado por
 * destinatario, en el mismo orden en que llegaron. El logo del gym viaja con
 * `src` remoto: la API batch no admite adjuntos y por lo tanto tampoco CID.
 */
export async function sendCampaignBatch(
  opts: CampaignBatchMail,
  ctx: MailContext,
): Promise<CampaignSendResult[]> {
  const logoImg = getRemoteLogoImgHtml(opts.logoUrl);

  const results: CampaignSendResult[] = opts.recipients.map((recipient) => ({
    email: recipient.email,
    status: recipient.email ? "sent" : "failed",
    errorMessage: recipient.email ? null : "Missing email",
  }));

  // Los inválidos no viajan a Resend, pero conservan su posición en `results`.
  const sendable = opts.recipients
    .map((recipient, index) => ({ recipient, index }))
    .filter(({ recipient }) => !!recipient.email);

  // Los que no entran en el cupo del dia se marcan y no viajan: un lote
  // parcialmente enviado no es un error, cada destinatario trae su estado.
  const quota = await checkQuota(ctx, sendable.length);
  const blocked = sendable.splice(quota.allowed);
  for (const { index } of blocked) {
    const result = results[index];
    if (result) {
      result.status = "blocked";
      result.errorMessage = `Daily email limit reached (${quota.dailyLimit})`;
    }
  }

  if (sendable.length === 0) {
    await logCampaignBatch(opts, ctx, results);
    return results;
  }

  const payload = sendable.map(({ recipient }) => ({
    from: `${config.SENDER_EMAIL}`,
    to: recipient.email,
    subject: opts.subject,
    html: recipient.html.replace(/\{\{logoImg\}\}/g, logoImg),
  }));

  try {
    const response = await withTimeout(
      resend.batch.send(payload, { batchValidation: "permissive" }),
      RESEND_TIMEOUT_MS,
      "Resend campaign batch send",
    );

    if (response.error) {
      throw new Error(response.error.message || "Resend rejected the batch");
    }

    // Con validación permisiva Resend devuelve los índices que rechazó; el resto
    // salió. El índice es relativo al payload enviado, no a la lista original,
    // así que se traduce antes de marcar.
    for (const failure of response.data?.errors ?? []) {
      const original = sendable[failure.index];
      const result = original && results[original.index];
      if (result) {
        result.status = "failed";
        result.errorMessage = failure.message;
      }
    }
  } catch (error: any) {
    const errorMessage = error?.message || "Unknown error";
    logger.error("Error sending campaign batch", error, {
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

  await logCampaignBatch(opts, ctx, results);

  return results;
}

async function logCampaignBatch(
  opts: CampaignBatchMail,
  ctx: MailContext,
  results: CampaignSendResult[],
): Promise<void> {
  await logMail(
    ctx,
    results.map((result) => ({
      recipient: result.email,
      subject: opts.subject,
      mailType: "campaign_email" as const,
      status: result.status,
      errorMessage: result.errorMessage,
    })),
  );
}
