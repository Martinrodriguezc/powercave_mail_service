import { Router } from "express";
import { TEST_MAILS, TEST_MAIL_TYPES } from "../domain/testData";
import { AuthenticatedRequest, requireAuth } from "../middleware.ts/auth";
import { requireSuperadmin } from "../middleware.ts/mail";
import { createServiceLogger } from "../../utils/logger";

const router = Router();
const logger = createServiceLogger("mail-tester");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.get(
  "/test/types",
  requireAuth,
  requireSuperadmin,
  (_req: AuthenticatedRequest, res) => {
    res.status(200).json({ count: TEST_MAIL_TYPES.length, data: TEST_MAIL_TYPES });
  },
);

router.post(
  "/test/send",
  requireAuth,
  requireSuperadmin,
  async (req: AuthenticatedRequest, res) => {
    const { type, withTestData, gymName, logoUrl } = req.body ?? {};
    const to = (req.body?.to || req.user?.email || "").trim();

    const testMail = TEST_MAILS[type];
    if (!testMail) {
      return res.status(400).json({ message: `Unknown mail type: ${type}` });
    }
    if (!EMAIL_REGEX.test(to)) {
      return res.status(400).json({ message: "Invalid recipient email" });
    }
    if (logoUrl && !/^https?:\/\//.test(logoUrl)) {
      return res.status(400).json({ message: "logoUrl must be an http(s) URL" });
    }

    try {
      await testMail.send({
        to,
        full: withTestData !== false,
        gymName: typeof gymName === "string" && gymName.trim() ? gymName.trim() : null,
        logoUrl: logoUrl || null,
      });
      res.status(200).json({ message: "Test email sent", type, to });
    } catch (error) {
      logger.error("Error sending test email", error, { type, to });
      res.status(500).json({ message: "Error sending test email" });
    }
  },
);

export default router;
