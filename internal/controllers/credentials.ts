import { Router } from "express";
import { sendPasswordResetEmail, sendPlatformUserCredentialsEmail } from "../service";
import { requireApiKey } from "../middleware.ts/apiKeyAuth";
import { createServiceLogger } from "../../utils/logger";

const router = Router();
const logger = createServiceLogger('credentials');

router.post("/send_password_reset", requireApiKey, async (req, res) => {
    const { to, resetLink, subject, gymName } = req.body;

    if (!to || !resetLink) {
        return res.status(400).json({
            message: "Missing required fields: to, resetLink"
        });
    }

    try {
        await sendPasswordResetEmail({
            to,
            resetLink,
            subject: subject || `Restablece tu contraseña${gymName ? ` | ${gymName}` : ''}`,
            gymName,
        });

        logger.success('Password reset email sent', { email: to });
        res.status(200).json({ message: "Password reset email sent successfully" });
    } catch (error: any) {
        logger.error('Error sending password reset email', error, { email: to });
        res.status(500).json({ message: "Error sending password reset email", error: error?.message });
    }
});

router.post("/send_platform_user_credentials", requireApiKey, async (req, res) => {
    const { to, temporaryPassword, gymName, resetPasswordLink } = req.body;

    if (!to || !temporaryPassword || !resetPasswordLink) {
        return res.status(400).json({
            message: "Missing required fields: to, temporaryPassword, resetPasswordLink"
        });
    }

    try {
        const subject = `Credenciales de tu cuenta${gymName ? ` | ${gymName}` : ''}`;
        await sendPlatformUserCredentialsEmail({
            to,
            subject,
            temporaryPassword,
            gymName: gymName ?? null,
            resetPasswordLink,
        });

        logger.success('Platform user credentials email sent', { email: to });
        res.status(200).send();
    } catch (error: any) {
        logger.error('Error sending platform user credentials email', error, { email: to });
        res.status(500).json({ message: "Error sending platform user credentials email", error: error?.message });
    }
});

export default router;
