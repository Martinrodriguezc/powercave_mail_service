import { Router } from "express";
import { sendBulkReminderMails, sendReminderReportEmail } from "../service";
import { requireApiKey } from "../middleware.ts/apiKeyAuth";
import { createServiceLogger } from "../../utils/logger";

const router = Router();
const logger = createServiceLogger('reminders');

interface SendReminderBodyItem {
    to: string;
    userName: string;
    planName: string;
    expiryDate: string;
    publicId?: string;
}

router.post("/send_reminder", requireApiKey, async (req, res) => {
    if (!req.body || !Array.isArray(req.body.reminders)) {
        return res.status(400).json({
            message: "Request body must be { reminders: [...], report_recipients: string[] }"
        });
    }
    const reminders = req.body.reminders as SendReminderBodyItem[];
    const reportRecipients = req.body.report_recipients as string[];
    if (!Array.isArray(reportRecipients) || reportRecipients.length === 0) {
        return res.status(400).json({
            message: "report_recipients is required and must be a non-empty array of email addresses"
        });
    }
    const sentBy = req.body.sentBy ?? 'backend_service';
    const gymName = req.body.gymName as string | undefined;

    for (let i = 0; i < reminders.length; i++) {
        const reminder = reminders[i];
        if (!reminder.to || !reminder.userName || !reminder.planName || !reminder.expiryDate) {
            return res.status(400).json({
                message: `Missing required fields in reminder at index ${i}. Required: to, userName, planName, expiryDate`
            });
        }
    }

    try {
        const reminderSubject = `Recordatorio: tu plan vence pronto | ${gymName ?? ''}`;
        const reminderMails = reminders.map((reminder) => ({
            to: reminder.to,
            userName: reminder.userName,
            planName: reminder.planName,
            expiryDate: reminder.expiryDate,
            subject: reminderSubject,
            ...(reminder.publicId && { publicId: reminder.publicId }),
            ...(gymName !== undefined && { gymName }),
        }));

        const result = await sendBulkReminderMails(reminderMails, sentBy);

        await new Promise(resolve => setTimeout(resolve, 2000));

        logger.info('Processing completed, sending administrative report', {
            total: reminders.length,
            successful: result.successful,
            failed: result.failed.length
        });
        await sendReminderReportEmail(result.reporte_final, reportRecipients, gymName);

        res.status(200).json({
            message: "Reminders processed successfully",
            total: reminders.length,
            successful: result.successful,
            failed: result.failed.length,
            ...(result.failed.length > 0 && { failures: result.failed })
        });
    } catch (error: any) {
        logger.error('Error sending reminders', error, {
            totalReminders: reminders.length
        });
        res.status(500).json({
            message: "Error sending reminders",
            error: error?.message
        });
    }
});

export default router;
