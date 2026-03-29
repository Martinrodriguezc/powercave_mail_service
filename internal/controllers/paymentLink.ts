import { Router } from "express";
import { sendPaymentLinkEmail } from "../service";
import { requireApiKey } from "../middleware.ts/apiKeyAuth";
import { createServiceLogger } from "../../utils/logger";

const router = Router();
const logger = createServiceLogger("paymentLink");

router.post("/send_payment_link", requireApiKey, async (req, res) => {
  const {
    to,
    clientName,
    paymentUrl,
    amount,
    description,
    providerName,
    providerLogoUrl,
    gymName,
    logoUrl,
    isRecurring,
  } = req.body;

  if (
    !to ||
    !clientName ||
    !paymentUrl ||
    !amount ||
    !description ||
    !providerName ||
    !providerLogoUrl
  ) {
    return res.status(400).json({
      message:
        "Missing required fields: to, clientName, paymentUrl, amount, description, providerName, providerLogoUrl",
    });
  }

  try {
    const subject = `Link de pago${gymName ? ` | ${gymName}` : ""}`;
    await sendPaymentLinkEmail({
      to,
      subject,
      clientName,
      paymentUrl,
      amount,
      description,
      providerName,
      providerLogoUrl,
      gymName: gymName ?? null,
      logoUrl: logoUrl ?? null,
      isRecurring: isRecurring ?? false,
    });

    logger.success("Payment link email sent", {
      email: to,
      isRecurring: isRecurring ?? false,
    });
    res.status(200).json({ message: "Payment link email sent successfully" });
  } catch (error: unknown) {
    logger.error("Error sending payment link email", error, { email: to });
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({
      message: "Error sending payment link email",
      error: message,
    });
  }
});

export default router;
