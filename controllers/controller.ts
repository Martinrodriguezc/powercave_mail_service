import { Router } from "express";
import { sendReminderMail, sendBulkReminderMails } from "../mail_service/service";
import { validateBody } from "./middleware";

const router = Router();

router.post("/send_reminder", validateBody, async (req, res) => {
    const { to, userName, planName, expiryDate } = req.body;
    try {
        await sendReminderMail({
            to,
            userName,
            planName,
            expiryDate,
            subject: 'Recordatorio: tu plan vence pronto | Powercave',
        }); 
        res.status(200).json({ message: "Reminder sent successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error sending reminder" });
    }
});

router.post("/send_bulk_reminders", async (req, res) => {
    const { reminders } = req.body;
    
    if (!Array.isArray(reminders) || reminders.length === 0) {
        return res.status(400).json({ message: "Array of reminders is required" });
    }

    try {
        const reminderMails = reminders.map(reminder => ({
            ...reminder,
            subject: 'Recordatorio: tu plan vence pronto | Powercave'
        }));

        const result = await sendBulkReminderMails(reminderMails);
        
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

export default router;