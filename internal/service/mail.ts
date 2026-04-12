import { config } from "../../config/config";
import { AdminRenewalReportMail, Mail, ReminderMail } from "../domain/mail";
import { getLogoCid } from "../domain/logo";
import { createServiceLogger } from "../../utils/logger";
import { Resend } from "resend";

const logger = createServiceLogger("mail-service");
const resend = new Resend(config.RESEND_API_KEY);

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

    const result = await resend.emails.send(payload);

    logger.info("Email sent via Resend", {
      email: opts.to,
      emailId: result.data?.id || "N/A",
    });
  } catch (error: any) {
    logger.error("Error sending email", error, { email: opts.to });
    throw error;
  }
}
