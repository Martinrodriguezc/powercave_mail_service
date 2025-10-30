import { Router } from "express";
import { sendReminderMail, sendBulkReminderMails, sendDiscountEmail } from "../mail_service/service";
import { requireMailServiceAccess, validateBody } from "../middleware.ts/mail";
import { AuthenticatedRequest, requireAuth } from "../middleware.ts/auth";
import { sendDailyAdminReportMail } from "../mail_service/admin/admin_service";

const router = Router();

router.use(requireAuth);
router.use(requireMailServiceAccess);

router.post("/send_reminder", validateBody, async (req: AuthenticatedRequest, res) => {
    const { to, userName, planName, expiryDate, clientId } = req.body;
    const sentBy = req.user?.name || 'test-user';
    try {
        await sendReminderMail({
            to,
            userName,
            planName,
            expiryDate,
            subject: 'Recordatorio: tu plan vence pronto | Powercave',
            ...(clientId && { clientId })
        }, sentBy);
        res.status(200).json({ message: "Reminder sent successfully" });
    } catch (error) {
        console.error('Error sending reminder:', error);
        res.status(500).json({ message: "Error sending reminder" });
    }
});

router.post("/send_bulk_reminders", async (req: AuthenticatedRequest, res) => {
    const { reminders } = req.body;
    const sentBy = req.user?.name || 'test-user';

    if (!Array.isArray(reminders) || reminders.length === 0) {
        return res.status(400).json({ message: "Array of reminders is required" });
    }

    try {
        const reminderMails = reminders.map((reminder) => ({
            ...reminder,
            subject: 'Recordatorio: tu plan vence pronto | Powercave',
            ...(reminder.clientId && { clientId: reminder.clientId })
        }));

        const result = await sendBulkReminderMails(reminderMails, sentBy);

        res.status(200).json({
            message: "Bulk reminders sent successfully",
            successful: result.successful,
            failed: result.failed.length,
            failures: result.failed
        });
    } catch (error) {
        res.status(500).json({ message: "Error sending bulk reminders" });
    }
});

router.post("/send_discount_email", async (req: AuthenticatedRequest, res) => {
    const { to, userName, promotionEndDate } = req.body;
    try {
        await sendDiscountEmail({ to, userName, subject: '💥 Vuelve a entrenar con descuento exclusivo | Powercave', promotionEndDate });
        res.status(200).json({ message: "Discount email sent successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error sending discount email" });
    }
});

router.post("/send_daily_admin_report", async (req: AuthenticatedRequest, res) => {
    const mailData = req.body;
    const sentBy = req.user?.name || 'test-user';

    try {
        await sendDailyAdminReportMail(mailData, sentBy);
        res.status(200).json({ message: "Daily admin report sent successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error sending daily admin report" });
    }
});


export default router;