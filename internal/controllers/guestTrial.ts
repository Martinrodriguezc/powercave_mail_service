import { Router } from "express";
import {
  sendGuestTrialCancelledEmail,
  sendGuestTrialConfirmationEmail,
} from "../service";
import { requireApiKey } from "../middleware.ts/apiKeyAuth";
import { respondIfDailyLimitReached } from "./limitResponse";
import { resolveMailContext } from "../service/mailLog";
import {
  GUEST_TRIAL_CANCEL_REASONS,
  GuestTrialCancelReason,
} from "../domain/mail";
import { createServiceLogger } from "../../utils/logger";

const router = Router();
const logger = createServiceLogger("guestTrial");

const isHttpUrl = (value: unknown): boolean => {
  if (typeof value !== "string") return false;
  try {
    const { protocol } = new URL(value);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
};

const isCancelReason = (value: unknown): value is GuestTrialCancelReason =>
  GUEST_TRIAL_CANCEL_REASONS.includes(value as GuestTrialCancelReason);

const trialSubject = (gymName: unknown, outcome: string) =>
  gymName
    ? `Tu clase de prueba en ${gymName} ${outcome}`
    : `Tu clase de prueba ${outcome}`;

router.post("/send_guest_trial_confirmation", requireApiKey, async (req, res) => {
  const {
    to,
    guestName,
    className,
    classDate,
    classTime,
    gymAddress,
    cancelUrl,
    gymName,
    logoUrl,
  } = req.body;

  if (!to || !guestName || !className || !classDate || !classTime || !cancelUrl) {
    return res.status(400).json({
      message:
        "Missing required fields: to, guestName, className, classDate, classTime, cancelUrl",
    });
  }

  if (!isHttpUrl(cancelUrl)) {
    return res.status(400).json({ message: "cancelUrl must be an http(s) URL" });
  }

  try {
    await sendGuestTrialConfirmationEmail(
      {
        to,
        subject: trialSubject(gymName, "está confirmada"),
        guestName,
        className,
        classDate,
        classTime,
        gymAddress: gymAddress ?? null,
        cancelUrl,
        gymName: gymName ?? null,
        logoUrl: logoUrl ?? null,
      },
      resolveMailContext(req.body),
    );

    res
      .status(200)
      .json({ message: "Guest trial confirmation email sent successfully" });
  } catch (error: unknown) {
    if (respondIfDailyLimitReached(res, error)) return;

    logger.error("Error sending guest trial confirmation email", error, {
      email: to,
    });
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({
      message: "Error sending guest trial confirmation email",
      error: message,
    });
  }
});

router.post("/send_guest_trial_cancelled", requireApiKey, async (req, res) => {
  const {
    to,
    guestName,
    className,
    classDate,
    classTime,
    reason,
    gymName,
    logoUrl,
  } = req.body;

  if (!to || !guestName || !className || !classDate || !classTime || !reason) {
    return res.status(400).json({
      message:
        "Missing required fields: to, guestName, className, classDate, classTime, reason",
    });
  }

  if (!isCancelReason(reason)) {
    return res.status(400).json({
      message: `Invalid reason. Expected one of: ${GUEST_TRIAL_CANCEL_REASONS.join(", ")}`,
    });
  }

  try {
    await sendGuestTrialCancelledEmail(
      {
        to,
        subject: trialSubject(gymName, "fue cancelada"),
        guestName,
        className,
        classDate,
        classTime,
        reason,
        gymName: gymName ?? null,
        logoUrl: logoUrl ?? null,
      },
      resolveMailContext(req.body),
    );

    res
      .status(200)
      .json({ message: "Guest trial cancelled email sent successfully" });
  } catch (error: unknown) {
    if (respondIfDailyLimitReached(res, error)) return;

    logger.error("Error sending guest trial cancelled email", error, {
      email: to,
    });
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({
      message: "Error sending guest trial cancelled email",
      error: message,
    });
  }
});

export default router;
