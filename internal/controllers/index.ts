import { Router } from "express";
import credentialsRouter from "./credentials";
import discountRouter from "./discount";
import remindersRouter from "./reminders";
import reportsRouter from "./reports";
import tenantRouter from "./tenant";
import paymentLinkRouter from "./paymentLink";

const router = Router();

router.use(remindersRouter);
router.use(discountRouter);
router.use(reportsRouter);
router.use(credentialsRouter);
router.use(tenantRouter);
router.use(paymentLinkRouter);

export default router;
