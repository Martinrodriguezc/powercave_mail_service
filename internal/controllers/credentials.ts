import { Router } from "express";
import {
  sendPasswordResetEmail,
  sendPlatformUserCredentialsEmail,
  sendClientAppInvitationEmail,
  sendClientPasswordResetEmail,
} from "../service";
import { requireApiKey } from "../middleware.ts/apiKeyAuth";
import { createServiceLogger } from "../../utils/logger";

const router = Router();
const logger = createServiceLogger("credentials");

router.post("/send_password_reset", requireApiKey, async (req, res) => {
  const { to, resetLink, subject, gymName, logoUrl } = req.body;

  if (!to || !resetLink) {
    return res.status(400).json({
      message: "Missing required fields: to, resetLink",
    });
  }

  try {
    await sendPasswordResetEmail({
      to,
      resetLink,
      subject:
        subject || `Restablece tu contraseña${gymName ? ` | ${gymName}` : ""}`,
      gymName,
      logoUrl: logoUrl ?? null,
    });

    logger.success("Password reset email sent", { email: to });
    res.status(200).json({ message: "Password reset email sent successfully" });
  } catch (error: any) {
    logger.error("Error sending password reset email", error, { email: to });
    res.status(500).json({
      message: "Error sending password reset email",
      error: error?.message,
    });
  }
});

router.post(
  "/send_platform_user_credentials",
  requireApiKey,
  async (req, res) => {
    const { to, temporaryPassword, gymName, resetPasswordLink, logoUrl } =
      req.body;

    if (!to || !temporaryPassword || !resetPasswordLink) {
      return res.status(400).json({
        message:
          "Missing required fields: to, temporaryPassword, resetPasswordLink",
      });
    }

    try {
      const subject = `Credenciales de tu cuenta${gymName ? ` | ${gymName}` : ""}`;
      await sendPlatformUserCredentialsEmail({
        to,
        subject,
        temporaryPassword,
        gymName: gymName ?? null,
        resetPasswordLink,
        logoUrl: logoUrl ?? null,
      });

      logger.success("Platform user credentials email sent", { email: to });
      res.status(200).send();
    } catch (error: any) {
      logger.error("Error sending platform user credentials email", error, {
        email: to,
      });
      res.status(500).json({
        message: "Error sending platform user credentials email",
        error: error?.message,
      });
    }
  },
);

router.post("/send_client_app_invitation", requireApiKey, async (req, res) => {
  const { to, tempPassword, gymName, gymSlug, logoUrl } = req.body;

  if (!to || !tempPassword || !gymName || !gymSlug) {
    return res.status(400).json({
      message: "Missing required fields: to, tempPassword, gymName, gymSlug",
    });
  }

  try {
    const subject = `Bienvenido a la app | ${gymName}`;
    await sendClientAppInvitationEmail({
      to,
      subject,
      tempPassword,
      gymName,
      gymSlug,
      logoUrl: logoUrl ?? null,
    });

    logger.success("Client app invitation email sent", { email: to });
    res
      .status(200)
      .json({ message: "Client app invitation email sent successfully" });
  } catch (error: any) {
    logger.error("Error sending client app invitation email", error, {
      email: to,
    });
    res.status(500).json({
      message: "Error sending client app invitation email",
      error: error?.message,
    });
  }
});

router.post("/send_client_password_reset", requireApiKey, async (req, res) => {
  const { to, otp, gymName, logoUrl } = req.body;

  if (!to || !otp || !gymName) {
    return res.status(400).json({
      message: "Missing required fields: to, otp, gymName",
    });
  }

  try {
    const subject = `Codigo de verificacion | ${gymName}`;
    await sendClientPasswordResetEmail({
      to,
      subject,
      otp,
      gymName,
      logoUrl: logoUrl ?? null,
    });

    logger.success("Client password reset email sent", { email: to });
    res
      .status(200)
      .json({ message: "Client password reset email sent successfully" });
  } catch (error: any) {
    logger.error("Error sending client password reset email", error, {
      email: to,
    });
    res.status(500).json({
      message: "Error sending client password reset email",
      error: error?.message,
    });
  }
});

export default router;
