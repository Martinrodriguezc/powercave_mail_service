import { Router } from "express";
import { getLastEmailByTenant } from "../service";
import { AuthenticatedRequest, requireAuth } from "../middleware.ts/auth";
import { requireMailServiceAccess } from "../middleware.ts/mail";
import { createServiceLogger } from "../../utils/logger";

const router = Router();
const logger = createServiceLogger('tenant');

router.get("/last-emails-by-tenant", requireAuth, requireMailServiceAccess, async (req: AuthenticatedRequest, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const lastEmails = await getLastEmailByTenant({
            role: req.user.role,
            gymName: req.user.gymName,
        });

        res.status(200).json({
            count: lastEmails.length,
            data: lastEmails
        });
    } catch (error) {
        logger.error('Error getting last emails by tenant', error);
        res.status(500).json({ message: "Error retrieving last emails by tenant" });
    }
});

export default router;
