import { Router } from "express";
import {
  sendTrainerAccountExistsEmail,
  sendTrainerEmailVerificationEmail,
} from "../service";
import { requireApiKey } from "../middleware.ts/apiKeyAuth";
import { createServiceLogger } from "../../utils/logger";

const router = Router();
const logger = createServiceLogger("trainerAccount");

router.post(
  "/send_trainer_email_verification",
  requireApiKey,
  async (req, res) => {
    const { to, userName, verificationLink, subject } = req.body;

    if (!to || !userName || !verificationLink) {
      return res.status(400).json({
        message: "Missing required fields: to, userName, verificationLink",
      });
    }

    try {
      await sendTrainerEmailVerificationEmail({
        to,
        userName,
        verificationLink,
        subject: subject || "Verifica tu correo | Dashcore",
      });

      logger.success("Trainer email verification sent", { email: to });
      res
        .status(200)
        .json({ message: "Trainer email verification sent successfully" });
    } catch (error: any) {
      logger.error("Error sending trainer email verification", error, {
        email: to,
      });
      res.status(500).json({
        message: "Error sending trainer email verification",
        error: error?.message,
      });
    }
  },
);

router.post("/send_trainer_account_exists", requireApiKey, async (req, res) => {
  const { to, loginLink, subject } = req.body;

  if (!to || !loginLink) {
    return res.status(400).json({
      message: "Missing required fields: to, loginLink",
    });
  }

  try {
    await sendTrainerAccountExistsEmail({
      to,
      loginLink,
      subject: subject || "Ya tienes una cuenta | Dashcore",
    });

    logger.success("Trainer account exists notice sent", { email: to });
    res
      .status(200)
      .json({ message: "Trainer account exists notice sent successfully" });
  } catch (error: any) {
    logger.error("Error sending trainer account exists notice", error, {
      email: to,
    });
    res.status(500).json({
      message: "Error sending trainer account exists notice",
      error: error?.message,
    });
  }
});

export default router;
