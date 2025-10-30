import { config } from "../config/config";
import { AdminRenewalReportMail, DiscountMail, Mail, ReminderMail } from "../domain/mail";
import { discountEmailTemplate, reminderTemplate } from "../domain/templates";
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

import { Resend } from "resend";

const resend = new Resend(config.RESEND_API_KEY);

export async function sendMail(opts: Mail | ReminderMail | AdminRenewalReportMail): Promise<void> {
  try {
    await resend.emails.send({
      from: `${config.SENDER_EMAIL}`,
      to: opts.to,
      subject: opts.subject,
      text: opts.text || '',
      html: opts.html,
    });

  } catch (error: any) {
    console.error("Error enviando correo:", error);
    throw error;
  }
}


export const sendReminderMail = async (opts: ReminderMail, sentBy: string): Promise<void> => {
    if (!sentBy) {
        throw new Error('Sent by is required');
    }

    try {
        let html = reminderTemplate;

        html = html.replace(/\{\{userName\}\}/g, opts.userName || '');
        html = html.replace(/\{\{planName\}\}/g, opts.planName || '');
        html = html.replace(/\{\{expiryDate\}\}/g, opts.expiryDate || '');
        html = html.replace(/\{\{year\}\}/g, new Date().getFullYear().toString());

        html = html.replace(/\{\{#if.*?\}\}[\s\S]*?\{\{\/if\}\}/g, '');

        await sendMail({
            to: opts.to,
            subject: opts.subject,
            html: html,
            userName: opts.userName,
            planName: opts.planName,
            expiryDate: opts.expiryDate,
        });

        // Solo guardar en la base de datos si no es un correo de prueba
        if (opts.clientId) {
            await prisma.emailLog.create({
                data: {
                    recipient: opts.to,
                    subject: opts.subject,
                    mail_type: 'plan_renovation_reminder',
                    clientId: opts.clientId,
                    clientName: opts.userName,
                    status: 'sent',
                    sentBy: sentBy,
                },
            });
            console.log("✅ Email log saved to database successfully!");
        } else {
            console.log("📧 Test email - skipping database log");
        }

    } catch (error) {
        throw error;
    }
}

export const sendBulkReminderMails = async (reminders: ReminderMail[], sentBy: string): Promise<{
    successful: number;
    failed: { email: string; error: string }[];
}> => {
    const results = await Promise.allSettled(
        reminders.map(reminder => sendReminderMail(reminder, sentBy))
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results
        .map((result, index) => ({ result, index }))
        .filter(({ result }) => result.status === 'rejected')
        .map(({ result, index }) => ({
            email: reminders[index].to,
            error: result.status === 'rejected'
                ? (result.reason?.message ?? 'Unknown error')
                : '',
        }));

    return { successful, failed };
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

