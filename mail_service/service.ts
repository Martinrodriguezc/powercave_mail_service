import { config } from "../config/config";
import { AdminRenewalReportMail, DiscountMail, Mail, ReminderMail, ReminderReportResult } from "../domain/mail";
import { discountEmailTemplate, reminderTemplate, reminderReportTemplate } from "../domain/templates";
import { PrismaClient } from '@prisma/client';
import { createServiceLogger } from "../utils/logger";

const prisma = new PrismaClient();
const logger = createServiceLogger('mail-service');

import { Resend } from "resend";

const resend = new Resend(config.RESEND_API_KEY);

export async function sendMail(opts: Mail | ReminderMail | AdminRenewalReportMail): Promise<void> {
    try {
        const result = await resend.emails.send({
            from: `${config.SENDER_EMAIL}`,
            to: opts.to,
            subject: opts.subject,
            text: opts.text || '',
            html: opts.html,
        });
        
        logger.info('Email sent via Resend', { email: opts.to, emailId: result.data?.id || 'N/A' });
        
    } catch (error: any) {
        logger.error('Error sending email', error, { email: opts.to });
        throw error;
    }
}


// Error personalizado para cuando se omite el envío por tiempo reciente
export class RecentEmailSentError extends Error {
    constructor(public lastSentAt: Date | null) {
        super('Email already sent in the last 48 hours');
        this.name = 'RecentEmailSentError';
    }
}

export const sendReminderMail = async (opts: ReminderMail, sentBy: string): Promise<void> => {
    if (!sentBy) {
        throw new Error('Sent by is required');
    }

    // Verificar si ya se envió un correo en las últimas 48 horas
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
        html = html.replace(/\{\{year\}\}/g, new Date().getFullYear().toString());

        html = html.replace(/\{\{#if.*?\}\}[\s\S]*?\{\{\/if\}\}/g, '');

        // Crear log inicial con estado pending si hay publicId
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

        // Actualizar log a sent si existe
        if (logId) {
            await prisma.emailLog.update({
                where: { id: logId },
                data: {
                    status: 'sent',
                },
            });
            logger.success('Email log updated to sent status', { logId, email: opts.to });
        } else if (!opts.publicId) {
            logger.info('Test email - skipping database log', { email: opts.to });
        }

    } catch (error: any) {
        // Si es un error de email reciente, no actualizar el log (ya existe uno previo)
        if (error instanceof RecentEmailSentError) {
            throw error;
        }

        // Actualizar log a failed si existe
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
}

/**
 * Delay helper para throttling
 */
const delay = (ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Verifica si se envió un correo de recordatorio a un cliente en las últimas 48 horas
 */
async function hasRecentReminderSent(publicId: string): Promise<{ hasRecent: boolean; lastSentAt: Date | null }> {
    if (!publicId) {
        return { hasRecent: false, lastSentAt: null };
    }

    const fortyEightHoursAgo = new Date();
    fortyEightHoursAgo.setHours(fortyEightHoursAgo.getHours() - 48);

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

/**
 * Genera el HTML del reporte administrativo de recordatorios
 */
function generateReminderReportHTML(reporte_final: ReminderReportResult[], fecha: string): string {
    const total = reporte_final.length;
    const successful = reporte_final.filter(r => r.status === 'success').length;
    const failed = reporte_final.filter(r => r.status === 'failed').length;
    const skipped = reporte_final.filter(r => r.status === 'skipped').length;

    // Generar filas de la tabla
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

        // Mostrar razón o error según corresponda
        let reasonCell: string;
        if (result.reason) {
            reasonCell = `<td style="padding:10px 8px; border-bottom:1px solid #e0e0e0; color:${result.status === 'skipped' ? '#f59e0b' : '#ef4444'}; font-size:13px;">${result.reason}</td>`;
        } else if (result.error) {
            // Mostrar error completo (puede incluir stack trace)
            const errorDisplay = result.error.length > 200 
                ? result.error.substring(0, 200) + '...' 
                : result.error;
            reasonCell = `<td style="padding:10px 8px; border-bottom:1px solid #e0e0e0; color:#ef4444; font-size:12px; font-family:monospace; word-break:break-word;">${errorDisplay}</td>`;
        } else {
            reasonCell = '<td style="padding:10px 8px; border-bottom:1px solid #e0e0e0; color:#9ca3af;">-</td>';
        }

        return `
            <tr>
                <td style="padding:10px 8px; border-bottom:1px solid #e0e0e0; font-family:monospace; font-size:12px; color:#6b7280;">${result.publicId || 'N/A'}</td>
                <td style="padding:10px 8px; border-bottom:1px solid #e0e0e0;">${result.email}</td>
                <td style="padding:10px 8px; border-bottom:1px solid #e0e0e0; text-align:center;">
                    <span style="color:${statusColor}; font-weight:600;">${statusText}</span>
                </td>
                ${reasonCell}
            </tr>
        `;
    }).join('');

    let html = reminderReportTemplate;

    // Reemplazar valores
    html = html.replace('{{reportDate}}', fecha);
    html = html.replace('{{total}}', total.toString());
    html = html.replace('{{successful}}', successful.toString());
    html = html.replace('{{skipped}}', skipped.toString());
    html = html.replace('{{failed}}', failed.toString());
    html = html.replace('{{tableRows}}', tableRows);
    html = html.replace('{{year}}', new Date().getFullYear().toString());

    return html;
}

/**
 * Envía el reporte administrativo de recordatorios
 */
export async function sendReminderReportEmail(reporte_final: ReminderReportResult[]): Promise<void> {
    const fecha = new Date().toLocaleDateString('es-CL', {
        timeZone: 'America/Santiago',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    const subject = `[Gym Report] Estado de Recordatorios Diarios - ${fecha}`;
    const html = generateReminderReportHTML(reporte_final, fecha);
    const recipients = ['martin.rodriguez@uc.cl', 'powercave.chile@gmail.com'];

    // Enviar a cada destinatario con delay de 1 segundo entre envíos
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
            // No lanzamos el error para que no afecte el flujo principal
            // Solo lo registramos y continuamos con el siguiente destinatario
        }

        // Delay de 1 segundo entre envíos (excepto después del último)
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
    
    // Procesar emails uno por uno con delay de 1 segundo entre cada envío
    // Esto respeta el límite de 2 correos por segundo del proveedor
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
            // Verificar si es un error de email reciente
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
                // Error real al enviar
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
        
        // Delay de 1 segundo entre envíos (excepto después del último)
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
}

export const sendDiscountEmail = async (opts: DiscountMail): Promise<void> => {
    try {
        let html = discountEmailTemplate;

        html = html.replace(/\{\{userName\}\}/g, opts.userName || '');
        html = html.replace(/\{\{promotionEndDate\}\}/g, opts.promotionEndDate || '');
        html = html.replace(/\{\{year\}\}/g, new Date().getFullYear().toString());

        html = html.replace(/\{\{#if.*?\}\}[\s\S]*?\{\{\/if\}\}/g, '');

        await sendMail({
            to: opts.to,
            subject: opts.subject,
            html: html,
            userName: opts.userName,
        });
    } catch (error) {
        throw error;
    }
}

export const getLastEmailByTenant = async () => {
    try {
        const lastEmails = await prisma.emailLog.groupBy({
            by: ['publicId'],
            _max: {
                sentAt: true,
            },
        });

        const emailDetails = await Promise.all(
            lastEmails
                .filter((group: { _max: { sentAt: Date | null } }) => group._max.sentAt !== null)
                .map(async (group: { publicId: string; _max: { sentAt: Date | null } }) => {
                    const lastEmail = await prisma.emailLog.findFirst({
                        where: {
                            publicId: group.publicId,
                            sentAt: group._max.sentAt!,
                        },
                        select: {
                            id: true,
                            publicId: true,
                            clientName: true,
                            recipient: true,
                            subject: true,
                            mail_type: true,
                            status: true,
                            sentAt: true,
                            errorMessage: true,
                            sentBy: true,
                        },
                    });
                    return lastEmail;
                })
        );

        return emailDetails
            .filter(email => email !== null)
            .sort((a, b) => new Date(b!.sentAt).getTime() - new Date(a!.sentAt).getTime());

    } catch (error) {
        throw error;
    }
}