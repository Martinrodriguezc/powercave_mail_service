import { Router } from "express";
import { sendPaymentFailedEmail } from "../service";
import { requireApiKey } from "../middleware.ts/apiKeyAuth";
import { respondIfDailyLimitReached } from "./limitResponse";
import { resolveMailContext } from "../service/mailLog";
import { createServiceLogger } from "../../utils/logger";

const router = Router();
const logger = createServiceLogger("paymentFailed");

router.post("/send_payment_failed", requireApiKey, async (req, res) => {
  const {
    to,
    clientName,
    planName,
    amount,
    providerName,
    reason,
    willRetry,
    gymName,
    logoUrl,
  } = req.body;

  if (!to || !clientName || !planName || !amount || !providerName) {
    return res.status(400).json({
      message:
        "Missing required fields: to, clientName, planName, amount, providerName",
    });
  }

  try {
    const subject = `Tu pago no se pudo procesar${gymName ? ` | ${gymName}` : ""}`;
    await sendPaymentFailedEmail(
      {
        to,
        subject,
        clientName,
        planName,
        amount,
        providerName,
        reason: reason ?? null,
        willRetry: willRetry === true,
        gymName: gymName ?? null,
        logoUrl: logoUrl ?? null,
      },
      resolveMailContext(req.body),
    );

    res.status(200).json({ message: "Payment failed email sent successfully" });
  } catch (error: unknown) {
    if (respondIfDailyLimitReached(res, error)) return;

    logger.error("Error sending payment failed email", error, { email: to });
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({
      message: "Error sending payment failed email",
      error: message,
    });
  }
});

export default router;
