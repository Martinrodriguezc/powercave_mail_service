import { config } from "../../config/config";
import { AdminRenewalReportMail, Mail, ReminderMail } from "../domain/mail";
import { getLogoCid } from "../domain/logo";
import { createServiceLogger } from "../../utils/logger";
import { Resend } from "resend";

const logger = createServiceLogger('mail-service');
const resend = new Resend(config.RESEND_API_KEY);

export async function sendMail(opts: Mail | ReminderMail | AdminRenewalReportMail): Promise<void> {
    try {
        const logoUrl = opts.logoUrl && typeof opts.logoUrl === 'string' && opts.logoUrl.trim() !== ''
            ? opts.logoUrl.trim()
            : null;

        const attachments = logoUrl
            ? [{
                path: logoUrl,
                filename: 'logo.jpg',
                contentId: getLogoCid(opts.gymName),
            }]
            : undefined;

        const payload: Parameters<typeof resend.emails.send>[0] = {
            from: `${config.SENDER_EMAIL}`,
            to: opts.to,
            subject: opts.subject,
            text: opts.text || '',
            html: opts.html,
            ...(attachments && { attachments }),
        };

        const result = await resend.emails.send(payload);

        logger.info('Email sent via Resend', { email: opts.to, emailId: result.data?.id || 'N/A' });
    } catch (error: any) {
        logger.error('Error sending email', error, { email: opts.to });
        throw error;
    }
}
