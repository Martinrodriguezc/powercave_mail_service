import { Router } from "express";
import { sendCampaignEmail } from "../service";
import { requireApiKey } from "../middleware.ts/apiKeyAuth";
import { createServiceLogger } from "../../utils/logger";

const router = Router();
const logger = createServiceLogger("campaign");

router.post("/send_campaign_email", requireApiKey, async (req, res) => {
  const { to, subject, html, gymName, logoUrl } = req.body;

  try {
    // Validar campos obligatorios
    if (!to || !subject || !html) {
      return res.status(400).json({
        message: "Faltan campos obligatorios: to, subject, html",
      });
    }

    logger.info("Enviando email de campaña", { to, subject });

    await sendCampaignEmail({
      to,
      subject,
      html,
      gymName: gymName ?? null,
      logoUrl: logoUrl ?? null,
    });

    logger.success("Email de campaña enviado", { to, subject });

    return res
      .status(200)
      .json({ message: "Campaign email sent successfully" });
  } catch (error: any) {
    logger.error("Error enviando email de campaña", error, { to, subject });
    return res.status(500).json({ message: "Error sending campaign email" });
  }
});

export default router;
