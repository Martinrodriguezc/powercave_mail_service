import { InactivityReminderMail } from "../domain/mail";
import { getLogoImgHtml } from "../domain/logo";
import { inactivityReminderTemplate } from "../domain/templates";
import { escapeHtml } from "../../utils/html";
import { createServiceLogger } from "../../utils/logger";
import { prisma } from "./db";
import { sendMail } from "./mail";
import { DailyEmailLimitReachedError, type MailContext } from "./mailLog";

const logger = createServiceLogger("inactivity-reminder");

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

// Una vez por racha: si ya se le escribió después de su última visita, se omite.
// Un envío fallido también cuenta, para no gastar cupo a diario en una dirección rota.
// ponytail: un socio que nunca vino recibe uno solo en toda su vida de cliente.
export const alreadySentThisStreak = async (
  publicId: string,
  lastAccessAt: string | null,
): Promise<boolean> => {
  const sent = await prisma.emailLog.findFirst({
    where: {
      publicId,
      mail_type: "inactivity_reminder",
      status: { in: ["sent", "failed"] },
      sentAt: { gte: lastAccessAt ? new Date(lastAccessAt) : new Date(0) },
    },
    select: { id: true },
  });
  return sent !== null;
};

const renderInactivityReminder = (opts: InactivityReminderMail): string =>
  inactivityReminderTemplate
    .replace(/\{\{logoImg\}\}/g, getLogoImgHtml(opts.logoUrl, opts.gymName))
    .replace(/\{\{gymName\}\}/g, escapeHtml(opts.gymName ?? ""))
    .replace(/\{\{userName\}\}/g, escapeHtml(opts.userName))
    .replace(/\{\{days\}\}/g, String(opts.daysSinceLastVisit))
    .replace(/\{\{year\}\}/g, new Date().getFullYear().toString());

export const sendBulkInactivityReminders = async (
  reminders: InactivityReminderMail[],
  ctx: MailContext,
): Promise<{
  successful: number;
  skipped: number;
  failed: { email: string; error: string }[];
}> => {
  let successful = 0;
  let skipped = 0;
  const failed: { email: string; error: string }[] = [];

  for (const reminder of reminders) {
    if (await alreadySentThisStreak(reminder.publicId, reminder.lastAccessAt)) {
      skipped++;
      continue;
    }

    try {
      await sendMail(
        {
          to: reminder.to,
          subject: reminder.subject,
          html: renderInactivityReminder(reminder),
          logoUrl: reminder.logoUrl ?? undefined,
          gymName: reminder.gymName ?? undefined,
        },
        {
          log: {
            context: ctx,
            mailType: "inactivity_reminder",
            publicId: reminder.publicId,
            clientName: reminder.userName,
          },
        },
      );
      successful++;
    } catch (error: unknown) {
      // Al tope diario se corta: el cron de mañana retoma a los pendientes.
      if (error instanceof DailyEmailLimitReachedError) throw error;
      logger.error("Error sending inactivity reminder", error, {
        email: reminder.to,
        publicId: reminder.publicId,
      });
      failed.push({
        email: reminder.to,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    await delay(1000);
  }

  return { successful, skipped, failed };
};
