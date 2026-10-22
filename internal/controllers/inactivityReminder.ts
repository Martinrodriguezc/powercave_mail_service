import { Router } from "express";
import { sendBulkInactivityReminders } from "../service";
import { requireApiKey } from "../middleware.ts/apiKeyAuth";
import { respondIfDailyLimitReached } from "./limitResponse";
import { resolveMailContext } from "../service/mailLog";
import { createServiceLogger } from "../../utils/logger";

const router = Router();
const logger = createServiceLogger("inactivityReminder");

interface InactivityReminderBodyItem {
  to: string;
  userName: string;
  publicId: string;
  daysSinceLastVisit: number;
  lastAccessAt: string | null;
}

router.post("/send_inactivity_reminder", requireApiKey, async (req, res) => {
  const reminders = req.body?.reminders as
    InactivityReminderBodyItem[] | undefined;
  if (!Array.isArray(reminders)) {
    return res
      .status(400)
      .json({ message: "Request body must be { reminders: [...] }" });
  }

  const invalidIndex = reminders.findIndex(
    (r) =>
      !r ||
      !r.to ||
      !r.userName ||
      !r.publicId ||
      !Number.isInteger(r.daysSinceLastVisit),
  );
  if (invalidIndex !== -1) {
    return res.status(400).json({
      message: `Missing required fields in reminder at index ${invalidIndex}. Required: to, userName, publicId, daysSinceLastVisit`,
    });
  }

  const gymName = req.body.gymName as string | undefined;
  const logoUrl = req.body.logoUrl as string | null | undefined;
  const subject =
    (req.body.subject as string | undefined) ||
    `Te extrañamos${gymName ? ` | ${gymName}` : ""}`;

  try {
    const result = await sendBulkInactivityReminders(
      reminders.map((r) => ({
        to: r.to,
        subject,
        userName: r.userName,
        publicId: r.publicId,
        daysSinceLastVisit: r.daysSinceLastVisit,
        lastAccessAt: r.lastAccessAt ?? null,
        gymName: gymName ?? null,
        logoUrl: logoUrl ?? null,
      })),
      resolveMailContext(req.body),
    );

    res.status(200).json({
      message: "Inactivity reminders processed successfully",
      total: reminders.length,
      successful: result.successful,
      skipped: result.skipped,
      failed: result.failed.length,
      ...(result.failed.length > 0 && { failures: result.failed }),
    });
  } catch (error: unknown) {
    if (respondIfDailyLimitReached(res, error)) return;

    logger.error("Error sending inactivity reminders", error, {
      total: reminders.length,
    });
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({
      message: "Error sending inactivity reminders",
      error: message,
    });
  }
});

export default router;
