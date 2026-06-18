import { config } from "../../config/config";
import { AdminRenewalReportMail, Mail, ReminderMail } from "../domain/mail";
import { getLogoCid } from "../domain/logo";
import { createServiceLogger } from "../../utils/logger";
import { Resend } from "resend";

const logger = createServiceLogger("mail-service");
const resend = new Resend(config.RESEND_API_KEY);

// Timeouts del envío a Resend. Acotan la llamada: si Resend se cuelga, el
// worker se libera y el servicio responde rápido en lugar de bloquearse hasta
// el timeout del SO (~2 min) y dejar de aceptar conexiones nuevas. El de
// adjuntos es más amplio porque subir el PDF a Resend tarda más; ambos quedan
// por debajo del timeout que el backend da a cada llamada (20s / 120s).
const RESEND_TIMEOUT_MS = 15_000;
const RESEND_ATTACHMENT_TIMEOUT_MS = 60_000;

// El SDK de Resend (6.x) no expone AbortSignal, así que acotamos con una
// carrera contra un timer. No cancela el fetch subyacente, pero libera el
// worker: el resultado tardío se ignora.
function withTimeout<T>(
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

export interface SendMailOptions {
  attachments?: MailAttachment[];
}

export async function sendMail(
  opts: Mail | ReminderMail | AdminRenewalReportMail,
  options: SendMailOptions = {},
): Promise<void> {
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

    const extraAttachments = (options.attachments ?? []).map((att) => ({
      filename: att.filename,
      content: att.content,
      contentType: att.contentType,
    }));

    const mergedAttachments = [...logoAttachment, ...extraAttachments];

    const payload: Parameters<typeof resend.emails.send>[0] = {
      from: `${config.SENDER_EMAIL}`,
      to: opts.to,
      subject: opts.subject,
      text: opts.text || "",
      html: opts.html,
      ...(mergedAttachments.length > 0 && { attachments: mergedAttachments }),
    };

    const timeoutMs =
      mergedAttachments.length > 0
        ? RESEND_ATTACHMENT_TIMEOUT_MS
        : RESEND_TIMEOUT_MS;
    const result = await withTimeout(
      resend.emails.send(payload),
      timeoutMs,
      "Resend send",
    );

    logger.info("Email sent via Resend", {
      email: opts.to,
      emailId: result.data?.id || "N/A",
    });
  } catch (error: any) {
    logger.error("Error sending email", error, { email: opts.to });
    throw error;
  }
}
