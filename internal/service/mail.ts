import { MailType } from "@prisma/client";
import { config } from "../../config/config";
import { AdminRenewalReportMail, Mail, ReminderMail } from "../domain/mail";
import { DASHCORE_LOGOS, getLogoCid } from "../domain/logo";
import { createServiceLogger } from "../../utils/logger";
import {
  checkQuota,
  DailyEmailLimitReachedError,
  logMail,
  type MailContext,
} from "./mailLog";
import { Resend } from "resend";

const logger = createServiceLogger("mail-service");
const resend = new Resend(config.RESEND_API_KEY);

// Timeouts del envío a Resend. Acotan la llamada: si Resend se cuelga, el
// worker se libera y el servicio responde rápido en lugar de bloquearse hasta
// el timeout del SO (~2 min) y dejar de aceptar conexiones nuevas. El de
// adjuntos es más amplio porque subir el PDF a Resend tarda más; ambos quedan
// por debajo del timeout que el backend da a cada llamada (20s / 120s).
export const RESEND_TIMEOUT_MS = 15_000;
const RESEND_ATTACHMENT_TIMEOUT_MS = 60_000;

export { resend };

// El SDK de Resend (6.x) no expone AbortSignal, así que acotamos con una
// carrera contra un timer. No cancela el fetch subyacente, pero libera el
// worker: el resultado tardío se ignora.
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export interface MailAttachment {
  filename: string;
  content: string; // base64
  contentType?: string;
}

/**
 * Registro del envio. Sin `log` el correo no se registra ni consume cupo: es el
 * caso del mail tester, que ya tiene su propio limite en memoria.
 */
export interface SendMailLogOptions {
  context: MailContext;
  mailType: MailType;
  publicId?: string | null;
  clientName?: string | null;
  /** El app release lo inicia el superadmin, el gimnasio no debe pagar ese cupo. */
  enforceQuota?: boolean;
}

export interface SendMailOptions {
  attachments?: MailAttachment[];
  log?: SendMailLogOptions;
}

export async function sendMail(
  opts: Mail | ReminderMail | AdminRenewalReportMail,
  options: SendMailOptions = {},
): Promise<void> {
  const log = options.log;

  if (log) {
    const quota = await checkQuota(log.context, 1, log.enforceQuota ?? true);
    if (quota.allowed === 0) {
      await logMail(log.context, [
        {
          recipient: opts.to,
          subject: opts.subject,
          mailType: log.mailType,
          status: "blocked",
          errorMessage: `Daily email limit reached (${quota.dailyLimit})`,
          publicId: log.publicId,
          clientName: log.clientName,
        },
      ]);
      throw new DailyEmailLimitReachedError(quota.sentToday, quota.dailyLimit);
    }
  }

  try {
    const logoUrl =
      opts.logoUrl &&
      typeof opts.logoUrl === "string" &&
      opts.logoUrl.trim() !== ""
        ? opts.logoUrl.trim()
        : null;

    const logoAttachment = logoUrl
      ? [
          {
            path: logoUrl,
            filename: "logo.jpg",
            contentId: getLogoCid(opts.gymName),
          },
        ]
      : [];

    // Solo se adjunta la variante que la plantilla referencia: el HTML de
    // campañas llega compuesto desde el backend y no lleva logo de DashCore.
    // La comilla de cierre es necesaria: sin ella "cid:dashcore_logo" también
    // matchea "cid:dashcore_logo_light" y la nota de venta B2B se llevaba las
    // dos variantes, con la oscura colgando como adjunto sin referenciar.
    const dashcoreAttachment = DASHCORE_LOGOS.filter((logo) =>
      opts.html?.includes(`cid:${logo.cid}"`),
    ).map((logo) => ({
      filename: `${logo.cid}.png`,
      content: logo.base64,
      contentType: "image/png",
      contentId: logo.cid,
    }));

    const extraAttachments = (options.attachments ?? []).map((att) => ({
      filename: att.filename,
      content: att.content,
      contentType: att.contentType,
    }));

    const mergedAttachments = [
      ...logoAttachment,
      ...dashcoreAttachment,
      ...extraAttachments,
    ];

    const payload: Parameters<typeof resend.emails.send>[0] = {
      from: `${config.SENDER_EMAIL}`,
      to: opts.to,
      subject: opts.subject,
      text: opts.text || "",
      html: opts.html,
      ...(mergedAttachments.length > 0 && { attachments: mergedAttachments }),
    };

    // El logo de DashCore no cuenta: va inline y es fijo, no agrega latencia
    // de descarga como el logo del gym (path remoto) ni peso como el PDF B2B.
    const timeoutMs =
      logoAttachment.length + extraAttachments.length > 0
        ? RESEND_ATTACHMENT_TIMEOUT_MS
        : RESEND_TIMEOUT_MS;
    const result = await withTimeout(
      resend.emails.send(payload),
      timeoutMs,
      "Resend send",
    );

    // El SDK de Resend no lanza ante un rechazo de la API: devuelve { error }.
    // Sin este chequeo un envío fallido se reportaba como enviado.
    if (result.error) {
      throw new Error(result.error.message || "Resend rejected the email");
    }

    logger.info("Email sent via Resend", {
      email: opts.to,
      emailId: result.data?.id || "N/A",
    });

    if (log) {
      await logMail(log.context, [
        {
          recipient: opts.to,
          subject: opts.subject,
          mailType: log.mailType,
          status: "sent",
          publicId: log.publicId,
          clientName: log.clientName,
          providerMessageId: result.data?.id ?? null,
        },
      ]);
    }
  } catch (error: any) {
    logger.error("Error sending email", error, { email: opts.to });

    if (log) {
      await logMail(log.context, [
        {
          recipient: opts.to,
          subject: opts.subject,
          mailType: log.mailType,
          status: "failed",
          errorMessage: error?.message || "Unknown error",
          publicId: log.publicId,
          clientName: log.clientName,
        },
      ]);
    }

    throw error;
  }
}
