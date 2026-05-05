import { Router } from "express";
import {
  sendManagerWelcomeEmail,
  sendStaffWelcomeEmail,
} from "../service";
import { requireApiKey } from "../middleware.ts/apiKeyAuth";
import { createServiceLogger } from "../../utils/logger";

const router = Router();
const logger = createServiceLogger("welcome");

router.post("/send_manager_welcome", requireApiKey, async (req, res) => {
  const {
    to,
    userName,
    gymName,
    serviceStartDate,
    freeMonthEndsAt,
    loginLink,
    logoUrl,
  } = req.body;

  if (
    !to ||
    !userName ||
    !gymName ||
    !serviceStartDate ||
    !freeMonthEndsAt ||
    !loginLink
  ) {
    return res.status(400).json({
      message:
        "Missing required fields: to, userName, gymName, serviceStartDate, freeMonthEndsAt, loginLink",
    });
  }

  try {
    const subject = `Bienvenido a ${gymName}`;
    await sendManagerWelcomeEmail({
      to,
      subject,
      userName,
      gymName,
      serviceStartDate,
      freeMonthEndsAt,
      loginLink,
      logoUrl: logoUrl ?? null,
    });

    logger.success("Manager welcome email sent", { email: to });
    res.status(200).json({ message: "Manager welcome email sent successfully" });
  } catch (error: any) {
    logger.error("Error sending manager welcome email", error, { email: to });
    res.status(500).json({
      message: "Error sending manager welcome email",
      error: error?.message,
    });
  }
});

router.post("/send_staff_welcome", requireApiKey, async (req, res) => {
  const { to, userName, gymName, loginLink, logoUrl } = req.body;

  if (!to || !userName || !gymName || !loginLink) {
    return res.status(400).json({
      message: "Missing required fields: to, userName, gymName, loginLink",
    });
  }

  try {
    const subject = `Bienvenido a ${gymName}`;
    await sendStaffWelcomeEmail({
      to,
      subject,
      userName,
      gymName,
      loginLink,
      logoUrl: logoUrl ?? null,
    });

    logger.success("Staff welcome email sent", { email: to });
    res.status(200).json({ message: "Staff welcome email sent successfully" });
  } catch (error: any) {
    logger.error("Error sending staff welcome email", error, { email: to });
    res.status(500).json({
      message: "Error sending staff welcome email",
      error: error?.message,
    });
  }
});

export default router;
