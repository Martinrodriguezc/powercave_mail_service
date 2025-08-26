import { Router } from "express";
import { sendReminderMail } from "../mail_service/service";
import { validateBody } from "./middleware";

const router = Router();

router.post("/send_reminder", validateBody, (req, res) => {
    const { to, userName, planName, expiryDate } = req.body;
    try {
        sendReminderMail({
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

export default router;