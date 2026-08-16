import { Router } from "express";
import credentialsRouter from "./credentials";
import campaignRouter from "./campaign";
import remindersRouter from "./reminders";
import reportsRouter from "./reports";
import tenantRouter from "./tenant";
import paymentLinkRouter from "./paymentLink";
import welcomeRouter from "./welcome";
import lowStockAlertRouter from "./lowStockAlert";
import testRouter from "./test";
import appReleaseRouter from "./appRelease";

const router = Router();

router.use(remindersRouter);
router.use(campaignRouter);
router.use(reportsRouter);
router.use(credentialsRouter);
router.use(tenantRouter);
router.use(paymentLinkRouter);
router.use(welcomeRouter);
router.use(lowStockAlertRouter);
router.use(appReleaseRouter);
router.use(testRouter);

export default router;
