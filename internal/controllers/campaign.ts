import { Router } from "express";
import {
  sendCampaignEmail,
  sendCampaignBatch,
  MAX_CAMPAIGN_RECIPIENTS_PER_BATCH,
} from "../service";
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

router.post("/send_campaign_batch", requireApiKey, async (req, res) => {
  const { recipients, subject, gymName, logoUrl } = req.body;

  try {
    if (!Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({
        message: "recipients debe ser un array no vacío",
      });
    }
    if (recipients.length > MAX_CAMPAIGN_RECIPIENTS_PER_BATCH) {
      return res.status(400).json({
        message: `recipients no puede superar ${MAX_CAMPAIGN_RECIPIENTS_PER_BATCH} destinatarios`,
      });
    }
    if (!subject) {
      return res.status(400).json({
        message: "Faltan campos obligatorios: subject",
      });
    }
    if (recipients.some((r: unknown) => !(r as { html?: string })?.html)) {
      return res.status(400).json({
        message: "Cada destinatario debe traer html",
      });
    }

    const results = await sendCampaignBatch({
      recipients,
      subject,
      gymName: gymName ?? null,
      logoUrl: logoUrl ?? null,
    });

    logger.info("Lote de campaña enviado", {
      size: results.length,
      failed: results.filter((r) => r.status === "failed").length,
    });

    return res.status(200).json({ results });
  } catch (error: any) {
    logger.error("Error enviando lote de campaña", error, { subject });
    return res.status(500).json({ message: "Error sending campaign batch" });
  }
});

export default router;
