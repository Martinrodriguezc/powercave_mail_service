import { Router } from "express";
import { getLastEmailByTenant } from "../service";
import { AuthenticatedRequest, requireAuth } from "../middleware.ts/auth";
import { requireMailServiceAccess } from "../middleware.ts/mail";
import { createServiceLogger } from "../../utils/logger";

const router = Router();
const logger = createServiceLogger('tenant');

router.get("/last-emails-by-tenant", requireAuth, requireMailServiceAccess, async (req: AuthenticatedRequest, res) => {
    try {
        const lastEmails = await getLastEmailByTenant();

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
