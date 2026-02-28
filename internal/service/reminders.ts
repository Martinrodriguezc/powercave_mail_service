import { ReminderMail, ReminderReportResult } from "../domain/mail";
import { reminderReportTemplate, reminderTemplate } from "../domain/templates";
import { createServiceLogger } from "../../utils/logger";
import { prisma } from "./db";
import { sendMail } from "./mail";

const logger = createServiceLogger('mail-service');

export class RecentEmailSentError extends Error {
    constructor(public lastSentAt: Date | null) {
        super('Email already sent in the last 48 hours');
        this.name = 'RecentEmailSentError';
    }
}

const delay = (ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

async function hasRecentReminderSent(publicId: string): Promise<{ hasRecent: boolean; lastSentAt: Date | null }> {
    if (!publicId) {
        return { hasRecent: false, lastSentAt: null };
    }

    const fortyEightHoursAgo = new Date();
    fortyEightHoursAgo.setHours(fortyEightHoursAgo.getHours() - 47);

    const lastEmail = await prisma.emailLog.findFirst({
        where: {
            publicId: publicId,
            mail_type: 'plan_renovation_reminder',
            status: 'sent',
            sentAt: {
                gte: fortyEightHoursAgo,
            },
        },
        orderBy: {
            sentAt: 'desc',
        },
        select: {
            sentAt: true,
        },
    });

    return {
        hasRecent: lastEmail !== null,
        lastSentAt: lastEmail?.sentAt || null,
    };
}

function generateReminderReportHTML(reporte_final: ReminderReportResult[], fecha: string, gymName?: string): string {
    const total = reporte_final.length;
    const successful = reporte_final.filter(r => r.status === 'success').length;
    const failed = reporte_final.filter(r => r.status === 'failed').length;
    const skipped = reporte_final.filter(r => r.status === 'skipped').length;

    const tableRows = reporte_final.map(result => {
        let statusColor: string;
        let statusText: string;

        if (result.status === 'success') {
            statusColor = '#10b981';
            statusText = '✓ Enviado';
        } else if (result.status === 'skipped') {
            statusColor = '#f59e0b';
            statusText = '⏭️ Omitido';
        } else {
            statusColor = '#ef4444';
            statusText = '✗ Fallido';
        }

        let reasonCell: string;
        if (result.reason) {
            reasonCell = `<td style="padding:10px 8px; border-bottom:1px solid #1e1e1e; color:${result.status === 'skipped' ? '#f59e0b' : '#ef4444'}; font-size:13px; background-color:#0f0f0f;">${result.reason}</td>`;
        } else if (result.error) {
            const errorDisplay = result.error.length > 200
                ? result.error.substring(0, 200) + '...'
                : result.error;
            reasonCell = `<td style="padding:10px 8px; border-bottom:1px solid #1e1e1e; color:#ef4444; font-size:12px; font-family:monospace; word-break:break-word; background-color:#0f0f0f;">${errorDisplay}</td>`;
        } else {
            reasonCell = '<td style="padding:10px 8px; border-bottom:1px solid #1e1e1e; color:#6b7280; background-color:#0f0f0f;">-</td>';
        }

        return `
            <tr>
                <td style="padding:10px 8px; border-bottom:1px solid #1e1e1e; font-family:monospace; font-size:12px; color:#6b7280; background-color:#0f0f0f;">${result.publicId || 'N/A'}</td>
                <td style="padding:10px 8px; border-bottom:1px solid #1e1e1e; color:#d1d5db; background-color:#0f0f0f;">${result.email}</td>
                <td style="padding:10px 8px; border-bottom:1px solid #1e1e1e; text-align:center; background-color:#0f0f0f;">
                    <span style="color:${statusColor}; font-weight:600;">${statusText}</span>
                </td>
                ${reasonCell}
            </tr>
        `;
    }).join('');

    let html = reminderReportTemplate;

    html = html.replace('{{reportDate}}', fecha);
    html = html.replace('{{total}}', total.toString());
    html = html.replace('{{successful}}', successful.toString());
    html = html.replace('{{skipped}}', skipped.toString());
    html = html.replace('{{failed}}', failed.toString());
    html = html.replace('{{tableRows}}', tableRows);
    html = html.replace(/\{\{gymName\}\}/g, gymName || '');
    html = html.replace('{{year}}', new Date().getFullYear().toString());

    return html;
}

export const sendReminderMail = async (opts: ReminderMail, sentBy: string): Promise<void> => {
    if (!sentBy) {
        throw new Error('Sent by is required');
    }

    if (opts.publicId) {
        const { hasRecent, lastSentAt } = await hasRecentReminderSent(opts.publicId);
        if (hasRecent) {
            throw new RecentEmailSentError(lastSentAt);
        }
    }

    let logId: number | null = null;

    try {
        let html = reminderTemplate;

        html = html.replace(/\{\{userName\}\}/g, opts.userName || '');
        html = html.replace(/\{\{planName\}\}/g, opts.planName || '');
        html = html.replace(/\{\{expiryDate\}\}/g, opts.expiryDate || '');
        html = html.replace(/\{\{gymName\}\}/g, opts.gymName || '');
        html = html.replace(/\{\{year\}\}/g, new Date().getFullYear().toString());
        html = html.replace(/\{\{#if.*?\}\}[\s\S]*?\{\{\/if\}\}/g, '');

        if (opts.publicId) {
            const log = await prisma.emailLog.create({
                data: {
                    recipient: opts.to,
                    subject: opts.subject,
                    mail_type: 'plan_renovation_reminder',
                    publicId: opts.publicId,
                    clientName: opts.userName,
                    status: 'pending',
                    sentBy: sentBy,
                },
            });
            logId = log.id;
        }

        await sendMail({
            to: opts.to,
            subject: opts.subject,
            html: html,
            userName: opts.userName,
            planName: opts.planName,
            expiryDate: opts.expiryDate,
        });

        if (logId) {
            await prisma.emailLog.update({
                where: { id: logId },
                data: { status: 'sent' },
            });
            logger.success('Email log updated to sent status', { logId, email: opts.to });
        } else if (!opts.publicId) {
            logger.info('Test email - skipping database log', { email: opts.to });
        }
    } catch (error: any) {
        if (error instanceof RecentEmailSentError) {
            throw error;
        }

        if (logId) {
            await prisma.emailLog.update({
                where: { id: logId },
                data: {
                    status: 'failed',
                    errorMessage: error?.message || 'Unknown error',
                },
            });
            logger.warn('Email log updated to failed status', { logId, email: opts.to, error: error?.message });
        }
        throw error;
    }
};

export async function sendReminderReportEmail(
    reporte_final: ReminderReportResult[],
    recipients: string[],
    gymName?: string
): Promise<void> {
    const fecha = new Date().toLocaleDateString('es-CL', {
        timeZone: 'America/Santiago',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    const subject = `[Gym Report] Estado de Recordatorios Diarios - ${fecha}`;
    const html = generateReminderReportHTML(reporte_final, fecha, gymName);

    for (let i = 0; i < recipients.length; i++) {
        const recipient = recipients[i];
        try {
            await sendMail({
                to: recipient,
                subject: subject,
                html: html,
            });

            logger.success('Administrative report sent', {
                email: recipient,
                reportDate: fecha,
                totalRecords: reporte_final.length
            });
        } catch (error: any) {
            logger.error('Error sending administrative report', error, {
                email: recipient,
                reportDate: fecha
            });
        }

        if (i < recipients.length - 1) {
            await delay(1000);
        }
    }
}

export const sendBulkReminderMails = async (reminders: ReminderMail[], sentBy: string): Promise<{
    successful: number;
    failed: { email: string; error: string }[];
    reporte_final: ReminderReportResult[];
}> => {
    const reporte_final: ReminderReportResult[] = [];

    for (let i = 0; i < reminders.length; i++) {
        const reminder = reminders[i];

        try {
            await sendReminderMail(reminder, sentBy);
            reporte_final.push({
                publicId: reminder.publicId || null,
                email: reminder.to,
                status: 'success',
                error: null,
                reason: null,
            });
            logger.success('Reminder email sent', {
                email: reminder.to,
                publicId: reminder.publicId,
                progress: `${i + 1}/${reminders.length}`
            });
        } catch (error: any) {
            if (error instanceof RecentEmailSentError) {
                const lastSentDate = error.lastSentAt
                    ? new Date(error.lastSentAt).toLocaleString('es-CL', {
                        timeZone: 'America/Santiago',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false
                    })
                    : 'fecha desconocida';
                const reason = `Ya se envió un correo de recordatorio en las últimas 48 horas (último envío: ${lastSentDate})`;
                reporte_final.push({
                    publicId: reminder.publicId || null,
                    email: reminder.to,
                    status: 'skipped',
                    error: null,
                    reason: reason,
                });
                logger.warn('Reminder email skipped - recent email sent', {
                    email: reminder.to,
                    publicId: reminder.publicId,
                    reason,
                    progress: `${i + 1}/${reminders.length}`
                });
            } else {
                const errorMessage = error?.message || 'Unknown error';
                const errorDetails = error?.stack || errorMessage;
                const reason = `Error al enviar: ${errorMessage}`;
                logger.error('Error sending reminder email', error, {
                    email: reminder.to,
                    publicId: reminder.publicId,
                    progress: `${i + 1}/${reminders.length}`
                });
                reporte_final.push({
                    publicId: reminder.publicId || null,
                    email: reminder.to,
                    status: 'failed',
                    error: errorDetails,
                    reason: reason,
                });
            }
        }

        if (i < reminders.length - 1) {
            await delay(1000);
        }
    }

    const successful = reporte_final.filter(r => r.status === 'success').length;
    const failed = reporte_final
        .filter(r => r.status === 'failed')
        .map(r => ({
            email: r.email,
            error: r.error || 'Unknown error',
        }));

    return { successful, failed, reporte_final };
};
