import { Router } from "express";
import { getMailUsage, InvalidMonthError } from "../service/usage";
import { AuthenticatedRequest, requireAuth } from "../middleware.ts/auth";
import { requireSuperadmin } from "../middleware.ts/mail";
import { createServiceLogger } from "../../utils/logger";

const router = Router();
const logger = createServiceLogger("usage");

router.get(
  "/usage",
  requireAuth,
  requireSuperadmin,
  async (req: AuthenticatedRequest, res) => {
    const month =
      typeof req.query.month === "string" ? req.query.month : undefined;

    try {
      const usage = await getMailUsage(month);
      res.status(200).json(usage);
    } catch (error) {
      if (error instanceof InvalidMonthError) {
        return res.status(400).json({ message: error.message });
      }
      logger.error("Error getting mail usage", error, { month });
      res.status(500).json({ message: "Error retrieving mail usage" });
    }
  },
);

export default router;
